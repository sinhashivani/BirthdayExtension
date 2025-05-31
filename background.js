// background.js

let websiteList = [];
let currentWebsiteIndex = 0;
let currentProcessingTabId = null; // To keep track of the tab we are currently processing
let bulkProcessQueue = []; // Array of retailer IDs to process
let currentBulkJobStatus = {}; // retailerId: { status: 'pending'|'in_progress'|'complete'|'error', message: '', tabId: null }
let activeProcessingCount = 0;
const MAX_CONCURRENT_PROCESSES = 1; // Start with 1 for simplicity, can increase later

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
    const result = await chrome.storage.local.get(['userProfiles', 'activeProfileId']);
    allProfiles = result.userProfiles || {};
    activeProfileId = result.activeProfileId || (Object.keys(allProfiles)[0] || null); // Set first as active if none
    console.log("Profiles loaded:", allProfiles, "Active ID:", activeProfileId);
}

async function saveProfileToStorage(profileData) {
    let newProfileId = profileData.id;
    if (!newProfileId || newProfileId === 'new') { // For new profiles
        newProfileId = 'profile-' + Date.now(); // Simple unique ID
    }
    allProfiles[newProfileId] = { ...profileData, id: newProfileId };
    await chrome.storage.local.set({ userProfiles: allProfiles });
    await setActiveProfile(newProfileId); // Make the new/saved profile active
    return newProfileId;
}

async function deleteProfileFromStorage(profileId) {
    if (allProfiles[profileId]) {
        delete allProfiles[profileId];
        await chrome.storage.local.set({ userProfiles: allProfiles });
        if (activeProfileId === profileId) {
            // If the deleted profile was active, set a new active one or null
            activeProfileId = Object.keys(allProfiles)[0] || null;
            await chrome.storage.local.set({ activeProfileId: activeProfileId });
        }
        return true;
    }
    return false;
}

async function setActiveProfile(profileId) {
    activeProfileId = profileId;
    await chrome.storage.local.set({ activeProfileId: profileId });
    console.log("Active profile set to:", activeProfileId);
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
        updateUI('bulkProcessUpdate', { statuses: bulkAutofillStatuses });

        uiPort.onMessage.addListener(async (msg) => {
            console.log("Message from UI:", msg);
            if (msg.action === 'startBulkAutofill') {
                // Initialize queue and statuses for the new run
                bulkAutofillQueue = [...msg.selectedRetailerIds];
                currentBulkProfile = msg.profile; // Store the selected profile for this bulk run
                bulkAutofillStatuses = {}; // Clear previous statuses
                retailerDatabase.forEach(r => {
                    if (msg.selectedRetailerIds.includes(r.id)) {
                        bulkAutofillStatuses[r.id] = { status: 'ready', message: 'In Queue' };
                    } else {
                        bulkAutofillStatuses[r.id] = { status: 'skipped', message: 'Skipped' };
                    }
                });
                updateUI('bulkProcessUpdate', { statuses: bulkAutofillStatuses }); // Send initial queue status

                processNextRetailer(); // Start processing
            }
        });

        uiPort.onDisconnect.addListener(() => {
            console.log("UI port disconnected.");
            uiPort = null; // Clear the port reference
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'loadProfile') {
        sendResponse({ success: true, profiles: allProfiles, activeProfileId: activeProfileId });
        return true; // Keep the message channel open for sendResponse
    }
    if (request.action === 'saveProfile') {
        saveProfileToStorage(request.profile)
            .then(profileId => {
                sendResponse({ success: true, profileId: profileId });
            })
            .catch(error => {
                console.error("Error saving profile:", error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep the message channel open for sendResponse
    }
    if (request.action === 'deleteProfile') {
        deleteProfileFromStorage(request.profileId)
            .then(success => {
                sendResponse({ success: success });
            })
            .catch(error => {
                console.error("Error deleting profile:", error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    if (request.action === 'setActiveProfile') {
        setActiveProfile(request.profileId)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
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

loadRetailerDatabase(); // Load retailer database on startup
loadProfilesFromStorage(); // Load profiles on startup













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

