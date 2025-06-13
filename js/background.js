// background.js

let websiteList = [];
let currentWebsiteIndex = 0;
let currentProcessingTabId = null; // To keep track of the tab we are currently processing
let bulkProcessQueue = []; // Array of retailer IDs to process
let currentBulkJobStatus = {}; // retailerId: { status: 'pending'|'in_progress'|'complete'|'error', message: '', tabId: null }
let activeProcessingCount = 0;
let bulkAutofillStatuses = {}; // To track statuses of each retailer in the bulk process
let retailerDatabase = []; // Assuming this is populated from storage or elsewhere
let currentAutofillTabId = null; // To track the tab currently being autofilled
let backgroundPort = null; // For long-lived connection with bulk_autofill.js


const MAX_CONCURRENT_PROCESSES = 1; // Start with 1 for simplicity, can increase later
const PROFILE_STORAGE_KEY = 'autofillProfiles'; // Assuming this is your key for all profiles
const ACTIVE_PROFILE_ID_STORAGE_KEY = 'activeAutofillProfileId'; // Assuming this is your key for the active profile ID
const DEFAULT_PROFILES = {
    "default-profile": {
        id: "default-profile", // Crucial for unique identification
        name: "Default Profile", // Name for display in multi-profile scenarios
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "securepassword",
        birthday: "1990-01-01",
        countryCode: "+1",
        phone: "5551234567",
        address: "123 Main St",
        city: "Anytown",
        state: "CA",
        zip: "90210",
        country: "USA",
        gender: "male"
    }
};

let bulkUIPort = null; // For long-lived connection with bulk_autofill.html

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "bulkAutofillUI") {
        bulkUIPort = port;
        console.log("Bulk Autofill UI connected.");

        bulkUIPort.onMessage.addListener(async (msg) => {
            if (msg.action === "startBulkAutofill" && msg.selectedRetailerIds) {
                await initializeBulkProcess(msg.selectedRetailerIds);
            } else if (msg.action === "retryRetailer" && msg.retailerId) {
                // Add logic to retry a single failed retailer
                retryRetailer(msg.retailerId);
            }
        });

        bulkUIPort.onDisconnect.addListener(() => {
            bulkUIPort = null;
            console.log("Bulk Autofill UI disconnected.");
            // Optionally: cancel ongoing bulk process if UI is closed? Or let it finish.
        });
    }
});

// Listener for tab updates - used to detect when a page has finished loading
chrome.tabs.onUpdated.addListener(handleTabUpdated);

chrome.action.onClicked.addListener(() => {
    const bulkAutofillUrl = chrome.runtime.getURL('bulk_autofill.html');
    chrome.tabs.create({ url: bulkAutofillUrl });
});

function notifyUI(statusUpdate) {
    if (bulkUIPort) {
        bulkUIPort.postMessage(statusUpdate);
    }
}

async function initializeBulkProcess(selectedRetailerIds) {
    const allRetailers = (await chrome.storage.local.get(['retailerDatabase']))?.retailerDatabase || [];
    bulkProcessQueue = selectedRetailerIds
        .map(id => allRetailers.find(r => r.id === id))
        .filter(r => r); // Ensure retailer exists

    currentBulkJobStatus = {};
    bulkProcessQueue.forEach(retailer => {
        currentBulkJobStatus[retailer.id] = { status: 'pending', message: '', tabId: null };
    });

    notifyUI({ action: 'bulkProcessUpdate', statuses: currentBulkJobStatus });
    activeProcessingCount = 0;
    processNextRetailer();
}

async function loadProfilesFromStorage() {
    console.log("background: loadProfilesFromStorage - Loading profiles from local storage and active ID from sync storage...");
    const localData = await chrome.storage.local.get(PROFILE_STORAGE_KEY);
    const syncData = await chrome.storage.sync.get(ACTIVE_PROFILE_ID_STORAGE_KEY);

    let effectiveProfiles = localData[PROFILE_STORAGE_KEY] || {};
    let effectiveActiveProfileId = syncData[ACTIVE_PROFILE_ID_STORAGE_KEY];

    // If no profiles found at all, initialize with default
    if (Object.keys(effectiveProfiles).length === 0) {
        console.log("background: No profiles found in local storage, initializing with default profile.");
        effectiveProfiles = { ...DEFAULT_PROFILES }; // Use spread to create a copy
        await chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: effectiveProfiles });
        effectiveActiveProfileId = DEFAULT_PROFILES["default-profile"].id;
        await chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: effectiveActiveProfileId });
    }

    // Ensure activeProfileId is valid, if not, pick the first one
    if (!effectiveActiveProfileId || !effectiveProfiles[effectiveActiveProfileId]) {
        console.warn(`background: Active profile ID '${effectiveActiveProfileId}' from sync storage is invalid or not found.`);
        effectiveActiveProfileId = Object.keys(effectiveProfiles)[0]; // Get the ID of the first profile
        if (effectiveActiveProfileId) {
            console.log(`background: Setting active profile ID to first available: '${effectiveActiveProfileId}'.`);
            await chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: effectiveActiveProfileId });
        } else {
            console.error("background: No profiles available at all to set as active. This should not happen after initialization.");
        }
    }
    console.log("background: Loaded profiles:", effectiveProfiles, "Active ID:", effectiveActiveProfileId);
    return { profiles: effectiveProfiles, activeProfileId: effectiveActiveProfileId };
}

async function handleGetActiveProfileMessage(request, sender, sendResponse) {
    console.log("background: Received 'getActiveProfile' message from popup.");
    try {
        const { profiles, activeProfileId } = await loadProfilesFromStorage(); // Uses the existing load logic
        const activeProfile = profiles[activeProfileId] || null; // Extract the active profile object

        if (activeProfile) {
            console.log("background: Sending active profile to popup:", activeProfile);
            sendResponse({ success: true, profile: activeProfile });
        } else {
            console.warn("background: No active profile found to send to popup.");
            sendResponse({ success: false, error: "No active profile found." });
        }
    } catch (error) {
        console.error("background: Error in handleGetActiveProfileMessage:", error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleSaveProfileFromPopup(request, sender, sendResponse) {
    console.log("background: Received 'saveProfileFromPopup' message with data:", request.profile);
    try {
        const profileToSave = request.profile;

        if (!profileToSave || !profileToSave.id) {
            // This case ideally shouldn't happen if popup.js correctly generates IDs,
            // but it's a safeguard.
            throw new Error("Profile must have an ID to be saved.");
        }

        let { profiles } = await loadProfilesFromStorage(); // Get the current collection of profiles
        profiles[profileToSave.id] = profileToSave; // Update or add the profile in the collection

        await chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: profiles }); // Save the updated collection
        await chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: profileToSave.id }); // Set this profile as the active one

        console.log(`background: Profile '${profileToSave.id}' saved and set as active.`);
        sendResponse({ success: true, profileId: profileToSave.id });
    } catch (error) {
        console.error("background: Error saving profile from popup:", error);
        sendResponse({ success: false, error: error.message });
    }
}

async function saveProfileToStorage(profile) {
    console.log("Background script: Saving profile:", profile);
    const { [PROFILE_STORAGE_KEY]: storedProfiles } = await chrome.storage.local.get(PROFILE_STORAGE_KEY);
    const profilesToSave = storedProfiles || {};

    if (!profile.id || profile.id === 'new' || typeof profile.id === 'undefined') {
        // Generate a new ID for new profiles
        profile.id = `profile_${Date.now()}`;
    }

    profilesToSave[profile.id] = profile; // Save the entire profile object

    await chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: profilesToSave });
    // Set this newly saved profile as the active one
    // Using chrome.storage.sync for activeProfileId, which is fine, but note the different storage area.
    await chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: profile.id });

    console.log("Background script: Profiles object *after* saving/updating:", profilesToSave);
    console.log(`Background script: Profile '${profile.name}' saved and set as active.`);

    return { profiles: profilesToSave, activeProfileId: profile.id }; // Return the necessary data
}


async function deleteProfileFromStorage(profileIdToDelete) {
    const { [PROFILE_STORAGE_KEY]: storedProfiles } = await chrome.storage.local.get(PROFILE_STORAGE_KEY);
    const profilesToDeleteFrom = storedProfiles || {};

    if (!profilesToDeleteFrom[profileIdToDelete]) {
        throw new Error('Profile not found for deletion.');
    }

    delete profilesToDeleteFrom[profileIdToDelete];

    await chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: profilesToDeleteFrom });

    const { [ACTIVE_PROFILE_ID_STORAGE_KEY]: currentActiveId } = await chrome.storage.sync.get(ACTIVE_PROFILE_ID_STORAGE_KEY);
    if (currentActiveId === profileIdToDelete) {
        const newActiveId = Object.keys(profilesToDeleteFrom)[0] || null;
        await chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: newActiveId });
    }

    console.log(`Background script: Profile '${profileIdToDelete}' deleted.`);
    return { success: true };
}

// Function to handle setting active profile (your existing function)
async function handleSetActiveProfileInBackground(profileId) {
    await chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: profileId });
    console.log(`Background script: Setting active profile to: ${profileId}`);
    return { success: true };
}

function updateUI(type, data) {
    if (type === 'bulkProcessUpdate' && data && data.statuses) {
        console.log("bulk_autofill.js: Updating UI with bulk process statuses:", data.statuses);
        // Implement your UI update logic here.
        // Example: Iterate through statuses and update elements for each retailer
        const retailerStatusContainer = document.getElementById('retailerStatusContainer'); // Assuming you have a container
        if (retailerStatusContainer) {
            retailerStatusContainer.innerHTML = ''; // Clear previous statuses
            for (const retailerId in data.statuses) {
                const statusInfo = data.statuses[retailerId];
                const statusDiv = document.createElement('div');
                statusDiv.textContent = `Retailer ${retailerId}: ${statusInfo.status} - ${statusInfo.message}`;
                statusDiv.className = `status-${statusInfo.status}`; // For CSS styling
                retailerStatusContainer.appendChild(statusDiv);
            }
        }
    }
    // Add other UI update types here if needed (e.g., 'profileUpdated', 'profilesLoaded')
    // else if (type === 'profilesLoaded' && data.profiles) {
    //     populateProfileDropdown(data.profiles, data.activeProfileId);
    // }
    // ...
}

// --- Establish connection to background script ---
function connectToBackground() {
    if (!backgroundPort) {
        backgroundPort = chrome.runtime.connect({ name: "bulkAutofillUI" });

        backgroundPort.onMessage.addListener((msg) => {
            console.log("Message from background:", msg);
            // Route messages to the appropriate UI update function
            if (msg.action === 'bulkProcessUpdate') {
                updateUI('bulkProcessUpdate', msg);
            }
            // Add other message handlers from background if needed
            // else if (msg.action === 'profilesUpdated') {
            //     loadProfiles(); // Reload profiles if they were updated in background
            // }
        });

        backgroundPort.onDisconnect.addListener(() => {
            console.log("Background port disconnected.");
            backgroundPort = null; // Clear the port reference
            // Optionally, try to reconnect after a delay or show a warning
        });
    }
}

let currentBulkProfile = null;

async function processNextRetailer() {
    const MAX_RETRIES = 2;
    if (response.status === 'error' && retailer.retryCount < MAX_RETRIES) {
        retailer.retryCount = (retailer.retryCount || 0) + 1;
        bulkAutofillQueue.push(retailerId); // Re-queue for retry
        console.log(`Retrying retailer ${retailer.name} (${retailerId}), attempt ${retailer.retryCount}`);
        updateRetailerStatus(retailerId, 'pending', `Retrying... (${retailer.retryCount})`);
    }

    if (bulkAutofillQueue.length === 0) {
        console.log("Bulk autofill process complete!");
        updateUI('bulkProcessComplete', { statuses: bulkAutofillStatuses });
        currentAutofillTabId = null; // Reset
        currentBulkProfile = null; // Reset profile for this run
        return;
    }

    const retailerId = bulkAutofillQueue.shift(); // Get next retailer
    const retailer = retailerDatabase.find(r => r.id === retailerId);

    if (!retailer) {
        updateRetailerStatus(retailerId, 'error', 'Retailer not found in database.');
        processNextRetailer(); // Move to next
        return;
    }

    updateRetailerStatus(retailerId, 'in_progress', 'Opening tab...');

    try {
        const tab = await chrome.tabs.create({ url: retailer.url, active: false });
        currentAutofillTabId = tab.id; // Store for tab update listener

        const tabLoadTimeout = setTimeout(() => {
            updateRetailerStatus(retailerId, 'error', 'Tab took too long to load.');
            if (currentAutofillTabId === tab.id) {
                chrome.tabs.remove(tab.id);
            }
            processNextRetailer();
        }, 30000); // 30 seconds timeout

        const onTabUpdated = async (updatedTabId, changeInfo, updatedTab) => {
            if (updatedTabId === tab.id && changeInfo.status === 'complete') {
                clearTimeout(tabLoadTimeout);
                chrome.tabs.onUpdated.removeListener(onTabUpdated);

                updateRetailerStatus(retailerId, 'in_progress', 'Injecting content script...');

                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });

                    // Send message to content script, INCLUDING THE PROFILE DATA
                    const response = await chrome.tabs.sendMessage(tab.id, {
                        action: 'autofill',
                        retailer: retailer,
                        profile: currentBulkProfile // *** CRITICAL: Pass the profile here ***
                    });

                    if (response && response.status === 'success') {
                        updateRetailerStatus(retailerId, 'complete', response.message || 'Autofill successful.');
                    } else {
                        updateRetailerStatus(retailerId, 'error', response.message || 'Autofill failed in content script.');
                    }
                } catch (e) {
                    console.error(`Error during autofill for ${retailer.name}:`, e);
                    updateRetailerStatus(retailerId, 'error', `Autofill error: ${e.message}`);
                } finally {
                    if (currentAutofillTabId === tab.id) {
                        chrome.tabs.remove(tab.id);
                    }
                    processNextRetailer();
                }
            }
        };

        chrome.tabs.onUpdated.addListener(onTabUpdated);

    } catch (e) {
        console.error(`Error opening tab for ${retailer.name}:`, e);
        updateRetailerStatus(retailerId, 'error', `Failed to open tab: ${e.message}`);
        processNextRetailer();
    }
}

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "bulkAutofillUI") {
        console.log("UI connected, port established.");
        uiPort = port;

        // Send initial statuses to the newly connected UI
        if (bulkAutofillStatuses) { // Ensure statuses are available
            uiPort.postMessage({ action: 'bulkProcessUpdate', statuses: bulkAutofillStatuses });
        } else {
            // Handle case where bulkAutofillStatuses might not be initialized yet
            console.warn("background.js: bulkAutofillStatuses not initialized when UI connected.");
            // Maybe send an initial empty status or a "ready" status
            uiPort.postMessage({ action: 'bulkProcessUpdate', statuses: {} });
        }

        uiPort.onMessage.addListener(async (msg) => {
            console.log("Message from UI:", msg);
            if (msg.action === 'startBulkAutofill') {
                bulkAutofillQueue = [...msg.selectedRetailerIds];
                currentBulkProfile = msg.profile;
                bulkAutofillStatuses = {};
                // Assuming retailerDatabase is defined in background.js
                retailerDatabase.forEach(r => {
                    if (msg.selectedRetailerIds.includes(r.id)) {
                        bulkAutofillStatuses[r.id] = { status: 'ready', message: 'In Queue' };
                    } else {
                        bulkAutofillStatuses[r.id] = { status: 'skipped', message: 'Skipped' };
                    }
                });
                // Send initial queue status back to the UI
                uiPort.postMessage({ action: 'bulkProcessUpdate', statuses: bulkAutofillStatuses });

                processNextRetailer(); // Start processing (assuming this exists in background.js)
            }
            // Add other message handlers from UI if needed
        });

        uiPort.onDisconnect.addListener(() => {
            console.log("UI port disconnected.");
            uiPort = null; // Clear the port reference
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background script: Received message:", request);
    const isFromPopup = sender.tab === undefined && sender.url && sender.url.startsWith("chrome-extension://" + chrome.runtime.id);

    if (isFromPopup) {
        if (request.action === 'getActiveProfile') {
            handleGetActiveProfileMessage(request, sender, sendResponse);
            return true; // Indicates an asynchronous response
        } else if (request.action === 'saveProfileFromPopup') {
            handleSaveProfileFromPopup(request, sender, sendResponse);
            return true; // Indicates an asynchronous response
        }
    }

    if (request.action === 'loadProfile' || request.action === 'loadProfiles') {
        loadProfilesFromStorage()
            .then(response => {
                sendResponse({ success: true, profiles: response.profiles, activeProfileId: response.activeProfileId, action: request.action });
            })
            .catch(error => {
                console.error("Background script: Error getting profiles for load:", error);
                sendResponse({ success: false, error: `Error loading profiles: ${error.message}`, action: request.action });
            });
        return true;
    }
    if (request.action === 'saveProfile') {
        console.log("Background script: Received saveProfile request with profile:", request.profile);
        saveProfileToStorage(request.profile)
            .then(response => { // handleSaveProfileInBackground now returns { profiles, activeProfileId }
                sendResponse({ success: true, profileId: response.activeProfileId, action: request.action }); // Send back the new/updated profileId
            })
            .catch(error => {
                console.error("Background script: Error saving profile:", error);
                sendResponse({ success: false, error: `Error saving profile: ${error.message}`, action: request.action });
            });
        return true;
    }
    if (request.action === 'deleteProfile') {
        console.log("Background script: Received deleteProfile request with profileId:", request.profileId);
        deleteProfileFromStorage(request.profileId)
            .then(response => { // handleDeleteProfileInBackground now returns { success: true }
                sendResponse(response); // Send back the success status
            })
            .catch(error => {
                console.error("Background script: Error deleting profile:", error);
                sendResponse({ success: false, error: `Error deleting profile: ${error.message}` });
            });
        return true;

    }
    if (request.action === 'setActiveProfile') {
        console.log("Background script: Received setActiveProfile request with profileId:", request.profileId);
        handleSetActiveProfileInBackground(request.profileId)
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                console.error("Background script: Error setting active profile:", error);
                sendResponse({ success: false, error: `Error setting active profile: ${error.message}` });
            });
        return true;
    }



    if (request.action === "retryRetailer") {
        console.log(`Received retry request for retailerId: ${request.retailerId}`);
        // Implement your retry logic here
        // e.g., call the function that starts autofill for this specific retailer
        // You might need to retrieve the retailer's details from your stored database
        // and then initiate the autofill flow for that single retailer.
        processNextRetailer(); // Assuming you have such a function
        sendResponse({ status: "success", message: "Retry initiated" });
        return true;
    }
    if (request.action === 'getRetailerDatabase') { // For loading retailers in UI
        sendResponse({ retailers: retailerDatabase });
        return true;
    }
    if (request.action === 'getAutofillStatuses') { // For UI to get current statuses on load
        sendResponse({ statuses: bulkAutofillStatuses });
        return true;
    }
    if (request.action === 'isBackgroundReady') { // For UI to check if background is ready
        sendResponse({ success: true }); // Always respond true as long as script is running
        return true;
    }
    console.warn("Background script: Unknown action received:", request.action);
    // No response for unknown actions, let the channel close
    return false;
});

// background.js
function handleRetailerCompletion(retailerId, status, message) {
    const job = currentBulkJobStatus[retailerId];
    if (!job) return;

    job.status = status;
    job.message = message;

    if (job.tabId) {
        // Close the tab if status is complete or error, unless specified otherwise (e.g., needs attention)
        if (status === 'complete' || (status === 'error' && message !== 'Needs Attention')) {
            chrome.tabs.remove(job.tabId, () => {
                if (chrome.runtime.lastError) { /* Optional: Log if tab closing fails */ }
            });
        }
        job.tabId = null; // Clear tabId
    }

    activeProcessingCount--;
    notifyUI({ action: 'bulkProcessUpdate', statuses: currentBulkJobStatus });
    processNextRetailer(); // Attempt to process the next item in the queue
}

// Simplified retry (re-queues and starts if idle)
async function retryRetailer(retailerId) {
    const allRetailers = (await chrome.storage.local.get(['retailerDatabase']))?.retailerDatabase || [];
    const retailerToRetry = allRetailers.find(r => r.id === retailerId);
    if (retailerToRetry && currentBulkJobStatus[retailerId]) {
        currentBulkJobStatus[retailerId] = { status: 'pending', message: '', tabId: null };
        // If not already in queue (e.g. for a full bulk run), add it
        if (!bulkProcessQueue.find(r => r.id === retailerId)) {
            bulkProcessQueue.unshift(retailerToRetry); // Add to front for immediate retry
        }
        notifyUI({ action: 'bulkProcessUpdate', statuses: currentBulkJobStatus });
        processNextRetailer();
    }
}













//CODE BEFORE ANY CHANGES
// Listen for messages from popup or options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startAutoSubscribe') {
        startAutoSubscribeProcess();
        // No need to sendResponse for async operations started here
    }
    // Add other background message listeners here if needed
});

async function startAutoSubscribeProcess() {
    console.log("Background: Auto-subscribe process initiated.");
    // 1. Get the list of websites from storage
    try {
        const data = await chrome.storage.sync.get('websiteUrls');
        websiteList = data.websiteUrls || [];
        currentWebsiteIndex = 0;

        if (websiteList.length === 0) {
            console.warn("Background: Website list is empty. Nothing to process.");
            // TODO: Notify user via a more persistent method (e.g., browser notification)
            return;
        }

        console.log(`Background: Starting process for ${websiteList.length} websites.`);
        // 2. Start processing the first website
        processNextWebsite();

    } catch (error) {
        console.error("Background: Error retrieving website list:", error);
        // TODO: Notify user
    }
}

async function processNextWebsite() {
    // Check if we have processed all websites
    if (currentWebsiteIndex >= websiteList.length) {
        console.log("Background: Auto-subscribe process finished.");
        // TODO: Notify user that the process is complete (e.g., browser notification)
        currentProcessingTabId = null; // Reset tab ID
        return;
    }

    const url = websiteList[currentWebsiteIndex];
    console.log(`Background: Processing website ${currentWebsiteIndex + 1}/${websiteList.length}: ${url}`);

    // 3. Open the URL in a new tab
    try {
        // Use chrome.tabs.create to open in a new tab
        const tab = await chrome.tabs.create({ url: url });
        currentProcessingTabId = tab.id; // Store the ID of the tab we just opened

        // The handleTabUpdated listener will now watch for this tab to complete loading

    } catch (error) {
        console.error(`Background: Error creating tab for URL ${url}:`, error);
        // TODO: Log or handle error for this specific URL

        // Move to the next website even if opening the tab failed
        currentWebsiteIndex++;
        processNextWebsite();
    }
}

/**
 * Handler for chrome.tabs.onUpdated event.
 * Detects when a tab has finished loading and sends a message to its content script.
 */
async function handleTabUpdated(tabId, changeInfo, tab) {
    // We only care about the tab we opened/navigated for the auto-subscribe process
    if (tabId === currentProcessingTabId && changeInfo.status === 'complete') {
        console.log(`Background: Tab ${tabId} finished loading: ${tab.url}`);

        // **Important:** There's still a small race condition here.
        // The content script might not be fully initialized IMMEDIATELY when status is 'complete'.
        // A small timeout or having the content script send a "ready" message is more robust.
        // For this example, we'll use a small timeout and try sending the message.

        // Wait a moment for the content script to be ready
        setTimeout(async () => {
            try {
                // 4. Send message to content script to trigger autofill
                // Reuse the 'fillForm' action you already handle in content.js
                const response = await chrome.tabs.sendMessage(tabId, { action: 'fillForm' });
                console.log(`Background: Autofill message sent to tab ${tabId}. Response:`, response);
                // TODO: Handle the response from the content script (e.g., did it find/fill forms?)
                // TODO: Log success for this website

            } catch (error) {
                // This catch block likely means the content script wasn't ready or threw an error
                console.error(`Background: Error sending message to content script in tab ${tabId}:`, error);
                // TODO: Log failure for this website
            } finally {
                // 5. Move to the next website after processing (regardless of success/failure)
                // You might want a delay here before moving to the next site, or wait for
                // a specific confirmation message from the content script.
                // For this example, we move immediately after attempting the message.
                currentWebsiteIndex++;
                processNextWebsite();
            }
        }, 1500); // Adjust delay as needed (e.g., 1000ms = 1 second)
    }
}

