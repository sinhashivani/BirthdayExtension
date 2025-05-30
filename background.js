// background.js

// --- Global/Module-Level Variables ---
let retailerDatabase = []; // This will hold the combined master and custom retailers
let currentProfileForWorkflow = null; // To store the profile used for the *current* autofill run
const workflowTabs = new Map(); // Map to store ongoing workflow data for each tab, keyed by tabId
let bulkAutofillInProgress = false;
let bulkAutofillStatus = {}; // Stores { retailerId: { status: 'pending'|'filling'|'filled'|'attention'|'success'|'stopped', tabId: number, name: string, url: string, message?: string } }
let currentAutofillTabIds = new Set(); // To track tabs opened specifically for bulk autofill
let customRetailerDatabase = {};
let activeAutofillProcesses = {}; // Tracks ongoing autofill tasks
const pendingContentScriptReady = new Map(); // Map<tabId, Function (resolve)>


// --- Constants for Storage Keys ---
const PROFILE_STORAGE_KEY = 'profiles'; // Local storage for profile data
const ACTIVE_PROFILE_ID_STORAGE_KEY = 'activeProfileId'; // Sync storage for active profile ID
const RETAILER_DATABASE_KEY = 'retailerDatabase'; // Sync storage for custom retailers
const SETTINGS_STORAGE_KEY = 'extensionSettings'; // Sync storage for general settings
const AUTOFILL_STATUSES_KEY = 'autofillStatuses';

// --- Default Data ---

// Default Profile Structure (aligned with popup.js form fields)
const DEFAULT_PROFILES = {
    "default-profile": {
        id: "default-profile",
        name: "My Birthday Profile",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phoneCountryCode: "+1",
        phone: "555-123-4567",
        dob: "1990-01-01", // YYYY-MM-DD
        address1: "123 Main St",
        address2: "Apt 4B",
        city: "Anytown",
        state: "CA", // e.g., "CA"
        zip: "90210",
        password: "", // Keep empty by default for security
        gender: "prefer-not-to-say" // Added gender field
    }
};

// Function to provide the initial/default set of master retailers
// background.js

function getMasterRetailerDatabase() {
    const masterRetailersArray = [
        {
            id: 'amazon',
            name: 'Amazon',
            signupUrl: 'https://www.amazon.com/ap/register/ref=ap_frn_reg',
            isCustom: false,
            selectors: {} // Start with empty selectors for now
        },
        {
            id: 'ebay',
            name: 'eBay',
            signupUrl: 'https://reg.ebay.com/reg/PartialReg',
            isCustom: false,
            selectors: {} // Empty selectors
        },
        {
            id: 'walmart',
            name: 'Walmart',
            signupUrl: 'https://www.walmart.com/account/signup',
            isCustom: false,
            selectors: {} // Empty selectors
        },
        {
            id: 'target',
            name: 'Target',
            signupUrl: 'https://www.target.com/account/create',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'bestbuy',
            name: 'Best Buy',
            signupUrl: 'https://www.bestbuy.com/identity/createAccount',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'homedepot',
            name: 'Home Depot',
            signupUrl: 'https://www.homedepot.com/account/create',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'lowes',
            name: 'Lowe\'s',
            signupUrl: 'https://www.lowes.com/login/createAccount',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'costco',
            name: 'Costco',
            signupUrl: 'https://www.costco.com/join-costco.html',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'kroger',
            name: 'Kroger',
            signupUrl: 'https://www.kroger.com/account/create',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'walgreens',
            name: 'Walgreens',
            signupUrl: 'https://www.walgreens.com/register/new-user',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'cvspharmacy',
            name: 'CVS Pharmacy',
            signupUrl: 'https://www.cvs.com/account/create-account',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'starbucks',
            name: 'Starbucks',
            signupUrl: 'https://www.starbucks.com/account/create',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'dominos',
            name: 'Domino\'s Pizza',
            signupUrl: 'https://www.dominos.com/en/pages/customer/#!/customer/login/register/',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'papajohns',
            name: 'Papa John\'s',
            signupUrl: 'https://www.papajohns.com/create-account.html',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'mcdonalds',
            name: 'McDonald\'s',
            signupUrl: 'https://www.mcdonalds.com/us/en-us/mymcdonalds-rewards/register',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'burgerking',
            name: 'Burger King',
            signupUrl: 'https://www.bk.com/rewards/enroll',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'subway',
            name: 'Subway',
            signupUrl: 'https://www.subway.com/en-US/Rewards',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'chipotle',
            name: 'Chipotle',
            signupUrl: 'https://www.chipotle.com/order/create-account',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'panerabread',
            name: 'Panera Bread',
            signupUrl: 'https://www.panerabread.com/en-us/mypanera/join.html',
            isCustom: false,
            selectors: {}
        },
        {
            id: 'chickfila',
            name: 'Chick-fil-A',
            signupUrl: 'https://www.chick-fil-a.com/myaccount/signup',
            isCustom: false,
            selectors: {}
        }
    ];

    return masterRetailersArray.reduce((acc, retailer) => {
        acc[retailer.id] = retailer;
        return acc;
    }, {});
}

async function loadCustomRetailersFromStorage() {
    try {
        const data = await chrome.storage.local.get('customRetailers');
        customRetailerDatabase = data.customRetailers || {};
        console.log("Background script: Existing custom retailer database loaded from local storage.", customRetailerDatabase);
    } catch (error) {
        console.error("Background script: Error loading custom retailers:", error);
    }
}

async function saveCustomRetailersToStorage() {
    try {
        await chrome.storage.local.set({ customRetailers: customRetailerDatabase });
        console.log("Background script: Custom retailer database saved to local storage.");
    } catch (error) {
        console.error("Background script: Error saving custom retailers:", error);
    }
}

async function handleStartBulkAutofill(profile, retailerIds) {
    console.log("Background: Initiating bulk autofill for:", retailerIds, "with profile:", profile.name);

    const { [RETAILER_DATABASE_KEY]: retailerDatabase } = await chrome.storage.local.get(RETAILER_DATABASE_KEY);
    if (!retailerDatabase) {
        throw new Error("Retailer database not found.");
    }

    // Filter out valid retailers and initialize their status
    const retailersToProcess = retailerIds.map(id => retailerDatabase[id]).filter(Boolean);

    if (retailersToProcess.length === 0) {
        throw new Error("No valid retailers selected for autofill.");
    }

    // Clear previous statuses if starting a new batch, or initialize them
    activeAutofillProcesses = {}; // Clear previous runs
    await chrome.storage.local.set({ [AUTOFILL_STATUSES_KEY]: {} }); // Clear persistent storage

    // Start processing each retailer sequentially (or concurrently, depending on desired behavior)
    for (const retailer of retailersToProcess) {
        if (activeAutofillProcesses[retailer.id]?.status === 'stopped') {
            console.log(`Skipping ${retailer.name} as stop signal received.`);
            await updateAutofillStatus(retailer.id, 'attention', 'Autofill stopped by user.');
            continue;
        }

        await updateAutofillStatus(retailer.id, 'processing', `Navigating to ${retailer.name}...`);
        console.log(`Background: Processing ${retailer.name} (${retailer.url})...`);

        try {
            await injectAndAutofill(retailer, profile);
            await updateAutofillStatus(retailer.id, 'success', `Successfully autofilled ${retailer.name}.`);
        } catch (error) {
            console.error(`Background: Error autofilling ${retailer.name}:`, error);
            await updateAutofillStatus(retailer.id, 'attention', `Failed to autofill: ${error.message}`);
        }
    }

    console.log("Background: Bulk autofill batch completed.");
    chrome.runtime.sendMessage({ action: 'autofillBatchComplete', message: 'Bulk autofill batch completed!' });

    return { success: true, message: "Bulk autofill process started." };
}

async function injectAndAutofill(retailer, profile) {
    return new Promise(async (resolve, reject) => {
        let tab;
        try {
            // 1. Create a new tab
            tab = await chrome.tabs.create({ url: retailer.url, active: false }); // Open in background

            // 2. Wait for the tab to fully load
            const tabLoaded = new Promise(resolveLoad => {
                const listener = (tabId, changeInfo, loadedTab) => {
                    if (tabId === tab.id && changeInfo.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolveLoad(loadedTab);
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });
            await tabLoaded;
            console.log(`Background: Tab for ${retailer.name} loaded.`);

            // Check if stop signal was sent while waiting for tab to load
            if (activeAutofillProcesses[retailer.id]?.status === 'stopped') {
                await chrome.tabs.remove(tab.id);
                return reject(new Error('Process stopped by user.'));
            }

            // 3. Inject content script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['autofill_content_script.js'] // Your content script for filling forms
            });
            console.log(`Background: content_autofill.js injected into ${retailer.name} tab.`);

            // 4. Send profile data and retailer details to content script
            // The content script will send back a status message
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'fillForm',
                profile: profile,
                retailer: retailer // Pass retailer info, including potential field mappings
            });

            if (response && response.success) {
                console.log(`Background: Autofill success for ${retailer.name}.`);
                resolve();
            } else {
                console.error(`Background: Autofill failed for ${retailer.name}:`, response.error);
                reject(new Error(response.error || 'Autofill failed in content script.'));
            }
        } catch (error) {
            console.error(`Background: Error in injectAndAutofill for ${retailer.name}:`, error);
            reject(error);
        } finally {
            if (tab && tab.id) {
                // Consider closing the tab after a short delay or based on user settings
                // For now, close immediately for sequential processing
                await chrome.tabs.remove(tab.id);
            }
        }
    });
}

function sendBulkAutofillStatusUpdate() {
    chrome.runtime.sendMessage({
        action: 'bulkAutofillStatusUpdate',
        statusData: bulkAutofillStatus, // Ensure this reflects activeAutofillProcesses accurately
        inProgress: bulkAutofillInProgress
    }).catch(e => {
        if (e.message !== "Could not establish connection. Receiving end does not exist.") {
            console.error("Background: Error sending status update to popup:", e);
        }
    });
}

async function getCombinedRetailerDatabase() {
    const masterRetailers = getMasterRetailerDatabase(); // Now returns an object
    const { [RETAILER_DATABASE_KEY]: storedCustomRetailersArray } = await chrome.storage.sync.get(RETAILER_DATABASE_KEY);

    let combined = { ...masterRetailers }; // Start with master retailers

    // Add custom retailers, overwriting master if IDs conflict (custom takes precedence)
    if (storedCustomRetailersArray && Array.isArray(storedCustomRetailersArray)) {
        storedCustomRetailersArray.forEach(r => {
            combined[r.id] = { ...r, isCustom: true }; // Ensure isCustom flag is set
        });
    }
    return combined; // Returns an object keyed by ID
}


const DEFAULT_SETTINGS = {
    autofillHighlightToggle: true, // Renamed to match popup.js
    highContrastModeToggle: false, // Renamed to match popup.js
    notificationDuration: 5000,
    enableLogging: true,
    closeTabAfterAutofill: true
};

// --- Helper Functions (Updated or New) ---

// Function to inject content script (same as previous iteration, but good to include for context)
async function injectContentScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        });
        console.log(`Background: content.js injected into tab ${tabId}`);
    } catch (error) {
        console.error(`Background: Failed to inject content.js into tab ${tabId}:`, error);
        throw error;
    }
}

// Handler for saving/updating a profile
async function handleSaveProfileInBackground(profile) {
    const { [PROFILE_STORAGE_KEY]: storedProfiles } = await chrome.storage.local.get(PROFILE_STORAGE_KEY);
    const profilesToSave = storedProfiles || {};

    if (!profile.id || profile.id === 'new') {
        // Generate a new ID for new profiles
        profile.id = `profile_${Date.now()}`;
    }

    profilesToSave[profile.id] = profile;

    await chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: profilesToSave });
    // Set this newly saved profile as the active one
    await chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: profile.id });

    console.log("Background script: Profiles object *after* saving/updating:", profilesToSave);
    console.log(`Background script: Profile '${profile.name}' saved and set as active.`);

    return { profiles: profilesToSave, activeProfileId: profile.id };
}

async function handleLoadProfilesInBackground() {
    // Handler for loading profiles and the active profile ID
    const { [PROFILE_STORAGE_KEY]: profiles, [ACTIVE_PROFILE_ID_STORAGE_KEY]: activeProfileId } = await chrome.storage.local.get([PROFILE_STORAGE_KEY, ACTIVE_PROFILE_ID_STORAGE_KEY]);

    console.log("loadProfile: Raw profiles from local storage:", profiles);
    console.log("loadProfile: Raw activeProfileId from sync storage:", activeProfileId);

    const effectiveProfiles = profiles || {}; // Start with an empty object if no profiles
    let effectiveActiveProfileId = activeProfileId;

    // If no profiles exist at all, initialize with the default one
    if (Object.keys(effectiveProfiles).length === 0) {
        Object.assign(effectiveProfiles, DEFAULT_PROFILES); // Add the default profile
        console.log("Background script: No profiles found, initialized with default.");
        // Ensure default is also saved immediately if it was truly empty
        await chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: effectiveProfiles });
        effectiveActiveProfileId = DEFAULT_PROFILES["default-profile"].id;
        // Keep activeProfileId in sync storage as originally intended if it needs to sync
        await chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: effectiveActiveProfileId });
    }

    // Ensure the active profile ID still exists in the profiles object
    if (!effectiveActiveProfileId || !effectiveProfiles[effectiveActiveProfileId]) {
        effectiveActiveProfileId = Object.keys(effectiveProfiles)[0]; // Fallback to first available
        // Update sync storage with the new active ID
        await chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: effectiveActiveProfileId });
        console.warn(`Background script: Active profile ID '${activeProfileId}' not found or invalid, set to '${effectiveActiveProfileId}'.`);
    }

    console.log("Background script: Loaded profiles to send to UI:", effectiveProfiles);
    console.log("Background script: Effective activeProfileId to send to UI:", effectiveActiveProfileId);

    return { profiles: effectiveProfiles, activeProfileId: effectiveActiveProfileId };
}
// Handler for setting the active profile
async function handleSetActiveProfileInBackground(profileId) {
    await chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: profileId });
    console.log(`Background script: Setting active profile to: ${profileId}`);
    return { success: true };
}

// Handler for deleting a profile
async function handleDeleteProfileInBackground(profileIdToDelete) {
    const { [PROFILE_STORAGE_KEY]: storedProfiles } = await chrome.storage.local.get(PROFILE_STORAGE_KEY);
    const profilesToDeleteFrom = storedProfiles || {};

    if (!profilesToDeleteFrom[profileIdToDelete]) {
        throw new Error('Profile not found for deletion.');
    }

    delete profilesToDeleteFrom[profileIdToDelete];

    await chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: profilesToDeleteFrom });

    // If the deleted profile was the active one, choose a new active profile
    const { [ACTIVE_PROFILE_ID_STORAGE_KEY]: currentActiveId } = await chrome.storage.sync.get(ACTIVE_PROFILE_ID_STORAGE_KEY);
    if (currentActiveId === profileIdToDelete) {
        const newActiveId = Object.keys(profilesToDeleteFrom)[0] || null; // Fallback to first or null
        await chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: newActiveId });
    }

    console.log(`Background script: Profile '${profileIdToDelete}' deleted.`);
    return { success: true };
}

// Modify your processRetailerList function in background.js
async function processRetailerList(selectedRetailerIds, activeProfile) {
    console.log("Background: Starting to process retailer list for autofill.");
    console.log("Selected Retailer IDs:", selectedRetailerIds);
    console.log("Active Profile:", activeProfile);

    const combinedRetailerDatabase = await getCombinedRetailerDatabase();
    const settings = await chrome.storage.sync.get('settings').then(data => data.settings || {});

    for (const retailerId of selectedRetailerIds) {
        if (!bulkAutofillInProgress) {
            console.log("Background: Bulk autofill stopped by user.");
            return;
        }
        const retailer = combinedRetailerDatabase[retailerId];
        if (retailer) {
            console.log(`Background: Processing retailer: ${retailer.name} (URL: ${retailer.signupUrl})`);
            let tab = null;

            try {
                // 1. Create the tab
                console.log(`Background: Creating tab for ${retailer.name} at ${retailer.signupUrl}`);
                tab = await chrome.tabs.create({ url: retailer.signupUrl, active: true }); // Keep active: true for debugging
                console.log(`Background: Tab created. ID: ${tab.id}, URL: ${tab.url}`);

                // 2. Wait for the tab to load "complete"
                console.log(`Background: Waiting for tab ${tab.id} to load...`);
                await new Promise(resolve => {
                    const listener = (tabId, changeInfo) => {
                        if (tabId === tab.id && changeInfo.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(listener);
                            console.log(`Background: Tab ${tab.id} for ${retailer.name} is 'complete'.`);
                            resolve();
                        }
                    };
                    chrome.tabs.onUpdated.addListener(listener);
                });

                if (!bulkAutofillInProgress) {
                    console.log(`Background: Closing tab ${tab.id} for ${retailer.name} - stopped by user after load.`);
                    await chrome.tabs.remove(tab.id);
                    await updateAutofillStatus(retailerId, 'stopped', 'Processing stopped by user.');
                    continue;
                }

                // 3. Prepare a promise to wait for the content script to be ready
                const contentScriptReadyPromise = new Promise(resolve => {
                    pendingContentScriptReady.set(tab.id, resolve);
                    // Add a timeout in case the content script never sends "ready"
                    setTimeout(() => {
                        if (pendingContentScriptReady.has(tab.id)) {
                            console.warn(`Background: Timeout waiting for content script ready in tab ${tab.id}. Proceeding anyway.`);
                            pendingContentScriptReady.delete(tab.id);
                            resolve(); // Resolve the promise so processing can continue
                        }
                    }, 7000); // Increased timeout for content script readiness (e.g., 7 seconds)
                });

                // 4. Programmatic Script Injection
                console.log(`Background: Attempting to inject content script 'autofill_content_script.js' into tab ${tab.id}.`);
                const injectionResults = await chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: true },
                    files: ['autofill_content_script.js']
                });
                console.log(`Background: chrome.scripting.executeScript results for tab ${tab.id}:`, injectionResults);

                if (!injectionResults || injectionResults.length === 0 || (injectionResults[0] && injectionResults[0].frameId !== 0)) {
                    console.error(`Background: Content script injection failed for tab ${tab.id}. No results or main frame injection failed.`);
                    await updateAutofillStatus(retailer.id, 'error', `Script injection failed for ${retailer.name}.`);
                    if (tab && tab.id) await chrome.tabs.remove(tab.id);
                    continue;
                }
                console.log(`Background: Content script 'autofill_content_script.js' injected successfully into tab ${tab.id}.`);

                // 5. WAIT for the content script to signal it's ready
                console.log(`Background: Waiting for content script in tab ${tab.id} to signal readiness...`);
                await contentScriptReadyPromise;
                console.log(`Background: Content script in tab ${tab.id} is ready. Sending autofill message.`);

                if (!bulkAutofillInProgress) {
                    console.log(`Background: Closing tab ${tab.id} for ${retailer.name} - stopped by user before sending autofill message.`);
                    await chrome.tabs.remove(tab.id);
                    await updateAutofillStatus(retailerId, 'stopped', 'Processing stopped by user.');
                    continue;
                }

                // 6. Send message to content script (now that it should be ready)
                const responseFromContent = await chrome.tabs.sendMessage(tab.id, {
                    action: "fillForm",
                    profile: activeProfile,
                    settings: settings, // Pass settings to content script
                    retailer: retailer, // Pass the full retailer object
                    isBulkAutofill: true // Indicate it's a bulk autofill operation
                });
                console.log(`Background: Autofill response from content script for ${retailer.name}:`, responseFromContent);

                if (responseFromContent && responseFromContent.success) {
                    const autofillStatus = responseFromContent.status || 'success'; // default to success if not provided
                    const autofillMessage = responseFromContent.message || `Autofilled ${retailer.name}`;
                    const filledFieldsCount = responseFromContent.filledFields?.length || 0;
                    const missingFieldsList = responseFromContent.missingFields?.join(', ') || 'none';

                    if (autofillStatus === 'success') {
                        await updateAutofillStatus(retailer.id, 'success', `Autofilled ${retailer.name} (${filledFieldsCount} fields).`);
                    } else if (autofillStatus === 'partial-success') {
                        await updateAutofillStatus(retailer.id, 'partial-success', `Autofilled ${retailer.name} (${filledFieldsCount} fields). Needs attention for: ${missingFieldsList}.`);
                    } else if (autofillStatus === 'needs-attention') {
                        await updateAutofillStatus(retailer.id, 'needs-attention', `Autofill for ${retailer.name} failed. All fields need attention: ${missingFieldsList}.`);
                    } else {
                        // Fallback for unknown status
                        await updateAutofillStatus(retailer.id, 'error', `Autofill for ${retailer.name} returned unknown status: ${autofillMessage}`);
                    }
                } else {
                    const errorMessage = responseFromContent?.error || 'Unknown error from content script.';
                    console.error(`Background: Content script reported failure for ${retailer.name}:`, errorMessage);
                    await updateAutofillStatus(retailer.id, 'error', `Content script failed for ${retailer.name}: ${errorMessage}`);
                }

            } catch (error) {
                console.error(`Background: Error during processing for retailer ${retailer.name} (ID: ${retailerId}):`, error);
                await updateAutofillStatus(retailer.id, 'error', `Processing error for ${retailer.name}: ${error.message}`);
                if (tab && tab.id) {
                    try {
                        await chrome.tabs.remove(tab.id);
                    } catch (e) {
                        console.error(`Background: Failed to close tab ${tab.id}:`, e);
                    }
                }
            } finally {
                if (tab && tab.id && activeAutofillProcesses[retailerId]?.tabId === tab.id) {
                    try {
                        await chrome.tabs.remove(tab.id);
                        console.log(`Background: Tab ${tab.id} for ${retailer.name} closed.`);
                    } catch (e) {
                        console.warn(`Background: Could not close tab ${tab.id} for ${retailer.name}, it might already be closed.`, e.message);
                    }
                    delete activeAutofillProcesses[retailerId].tabId;
                }
                console.log(`Background: Waiting 2 seconds before next retailer.`);
                await new Promise(r => setTimeout(r, 2000));
            }
        } else {
            console.warn(`Background: Retailer with ID ${retailerId} not found in database.`);
            await updateAutofillStatus(retailerId, 'error', `Retailer data not found for ID: ${retailerId}`);
        }
    }
    console.log("Background: Finished processing retailer list.");
}


async function updateAutofillStatus(retailerId, status, message) {
    activeAutofillProcesses[retailerId] = { status, message }; // Update in-memory status

    const VALID_STATUSES = ['success', 'partial-success', 'needs-attention', 'error', 'in-progress'];
    if (!VALID_STATUSES.includes(status)) {
        console.warn(`Attempted to set invalid status: ${status} for retailer ${retailerId}.`);
        status = 'error'; // Default to error for invalid statuses
    }

    activeAutofillProcesses[retailerId] = { status, message }; // Update in-memory status

    const { [AUTOFILL_STATUSES_KEY]: storedStatuses } = await chrome.storage.local.get(AUTOFILL_STATUSES_KEY);
    const newStatuses = storedStatuses || {};
    newStatuses[retailerId] = { status, message, timestamp: Date.now() };
    await chrome.storage.local.set({ [AUTOFILL_STATUSES_KEY]: newStatuses });

    chrome.runtime.sendMessage({
        action: 'updateAutofillUI',
        statusUpdate: { retailerId, status, message }
    }).catch(e => console.warn("Could not send status update to UI (UI might be closed):", e));
}

// Handler for getting the retailer database
async function handleGetRetailerDatabaseInBackground() {
    const combinedRetailerDatabase = await getCombinedRetailerDatabase();
    return Object.values(combinedRetailerDatabase); // Directly return the array of retailer objects
}

// Handler for saving/adding a custom retailer (used by bulk_autofill or other UI)
async function handleSaveRetailerDatabaseInBackground(retailerData) {
    // Get current combined database to check for conflicts
    const currentCombinedDbObject = await getCombinedRetailerDatabase();
    if (currentCombinedDbObject[retailerData.id] && !currentCombinedDbObject[retailerData.id].isCustom) {
        throw new Error(`Retailer with ID '${retailerData.id}' is a master retailer and cannot be modified or re-added as custom.`);
    }
    if (Object.values(currentCombinedDbObject).some(r => r.signupUrl === retailerData.signupUrl && r.id !== retailerData.id)) {
        throw new Error("Retailer with this signup URL already exists.");
    }

    // Update the customRetailerDatabase object directly
    customRetailerDatabase[retailerData.id] = { ...retailerData, isCustom: true };

    // Persist the updated customRetailerDatabase
    await saveCustomRetailersToStorage();

    console.log("Background script: Custom retailer saved and global customRetailerDatabase updated.");
    return { success: true, message: "Retailer saved." };
}

// Handler for loading settings
async function handleLoadSettingsInBackground() {
    const { [SETTINGS_STORAGE_KEY]: extensionSettings } = await chrome.storage.sync.get(SETTINGS_STORAGE_KEY);
    const effectiveSettings = extensionSettings || DEFAULT_SETTINGS;
    return { settings: effectiveSettings };
}

// Handler for saving settings
async function handleSaveSettingsInBackground(settingsData) {
    await chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: settingsData });
    return { settings: settingsData }; // Return the updated settings
}

async function handleLoadProfilesInBackground() {
    const { [PROFILE_STORAGE_KEY]: profiles, [ACTIVE_PROFILE_ID_STORAGE_KEY]: activeProfileId } = await chrome.storage.local.get([PROFILE_STORAGE_KEY, ACTIVE_PROFILE_ID_STORAGE_KEY]);

    console.log("loadProfile: Raw profiles from local storage:", profiles);
    console.log("loadProfile: Raw activeProfileId from sync storage:", activeProfileId);

    const effectiveProfiles = profiles || {};
    let effectiveActiveProfileId = activeProfileId;

    if (Object.keys(effectiveProfiles).length === 0) {
        Object.assign(effectiveProfiles, DEFAULT_PROFILES);
        await chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: effectiveProfiles });
        effectiveActiveProfileId = DEFAULT_PROFILES["default-profile"].id;
        await chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: effectiveActiveProfileId });
        console.log("Background script: No profiles found, initialized with default.");
    }

    if (!effectiveActiveProfileId || !effectiveProfiles[effectiveActiveProfileId]) {
        effectiveActiveProfileId = Object.keys(effectiveProfiles)[0];
        await chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: effectiveActiveProfileId });
        console.warn(`Background script: Active profile ID '${activeProfileId}' not found or invalid, set to '${effectiveActiveProfileId}'.`);
    }

    console.log("Background script: Loaded profiles to send to UI:", effectiveProfiles);
    console.log("Background script: Effective activeProfileId to send to UI:", effectiveActiveProfileId);

    return { profiles: effectiveProfiles, activeProfileId: effectiveActiveProfileId };
}
// --- Bulk Autofill Workflow Functions ---

async function processSingleRetailer(retailer, profile) {
    console.log(`Background: Processing retailer: ${retailer.name} (${retailer.signupUrl})...`);

    let tabId = null;
    let finalStatus = {
        retailerId: retailer.id,
        retailerName: retailer.name,
        retailerUrl: retailer.signupUrl,
        status: 'failed', // Default to failed
        message: 'Processing failed.',
        needsManualReview: true, // Default to needing review on failure
        autofillSuccess: false,
        submissionAttempted: false,
        submissionSuccess: false,
        captchaDetected: false,
        error: null,
        tabId: null, // Will be updated with actual tab ID
        startTime: Date.now(),
        endTime: null
    };

    try {
        if (!bulkAutofillInProgress) { // <-- Check at the start of single retailer process
            console.log(`Background: Process for ${retailer.name} skipped, autofill stopped.`);
            finalStatus.status = 'skipped';
            finalStatus.message = 'Process stopped by user.';
            return;
        }

        const newTab = await chrome.tabs.create({ url: retailer.signupUrl, active: false });
        tabId = newTab.id;
        finalStatus.tabId = tabId;
        currentAutofillTabIds.add(tabId); // Track the tab
        activeAutofillProcesses[retailer.id] = { ...finalStatus, status: 'in_progress' }; // Update global tracking


        const initialStatusData = {
            ...finalStatus,
            status: 'in_progress',
            message: `Opened tab for ${retailer.name}. Waiting for content script...`,
            needsManualReview: false
        };
        workflowTabs.set(tabId, initialStatusData);
        updateBulkStatusUI(initialStatusData);

        // Wait for the tab to load before injecting the content script
        await new Promise(resolve => {
            const listener = (id, changeInfo, tab) => {
                // MODIFIED: Check if the tab still exists and is the one we're waiting for
                if (id === tabId && changeInfo.status === 'complete' && tab) {
                    console.log(`Background: Tab ${tabId} loaded completely.`);
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });

        // Check for stop signal after tab loads but before injection
        if (!bulkAutofillInProgress) {
            finalStatus.status = 'stopped';
            finalStatus.message = 'Process stopped by user before autofill.';
            await chrome.tabs.remove(tabId); // Close the tab if stopped
            currentAutofillTabIds.delete(tabId); // Remove from tracking
            return; // Exit early
        }


        // Inject content script once the tab is loaded
        await injectContentScript(tabId);

        // Get current settings before sending to content script
        const { settings: currentSettings } = await handleLoadSettingsInBackground();

        // Send a message to the content script to start autofill
        const responseFromContent = await chrome.tabs.sendMessage(tabId, {
            action: 'autofillPage',
            profile: profile,
            retailer: retailer,
            settings: currentSettings // Pass the loaded settings
        });

        // Update final status based on content script's report
        Object.assign(finalStatus, responseFromContent.statusData);
        if (!responseFromContent.success) {
            console.error(`Background: Content script reported failure for ${retailer.name}:`, responseFromContent.error);
            finalStatus.status = 'error';
            finalStatus.message = `Content script error: ${responseFromContent.error}`;
            finalStatus.error = responseFromContent.error;
            finalStatus.needsManualReview = true;
        }

    } catch (error) {
        console.error(`Background: Error during processing for ${retailer.name}:`, error);
        finalStatus.status = 'error';
        finalStatus.message = `Failed to open tab or during initial script execution: ${error.message}`;
        finalStatus.error = error.message;
        finalStatus.needsManualReview = true;
    } finally {
        finalStatus.endTime = Date.now();
        workflowTabs.set(tabId, finalStatus);
        updateBulkStatusUI(finalStatus);
        updateAutofillStatus(retailer.id, finalStatus.status, finalStatus.message);

        const currentSettings = (await handleLoadSettingsInBackground()).settings;

        if (tabId && currentSettings.closeTabAfterAutofill && finalStatus.submissionSuccess && !finalStatus.needsManualReview) {
            console.log(`Background: Workflow completed (submitted successfully, no review needed) for ${retailer.name}. Closing tab ${tabId}.`);
            setTimeout(() => {
                chrome.tabs.remove(tabId).then(() => {
                    workflowTabs.delete(tabId);
                    currentAutofillTabIds.delete(tabId); // Remove from tracking
                    console.log(`Background: Tab ${tabId} closed successfully.`);
                }).catch(e => console.error(`Background: Error closing tab ${tabId}:`, e));
            }, 500); // 0.5 sec delay
        } else if (tabId) {
            console.log(`Background: Workflow for ${retailer.name} needs manual review or closeTabAfterAutofill is false. Leaving tab ${tabId} open. Status: ${finalStatus.status}, Message: ${finalStatus.message}`);
            // Only activate if manual review is needed AND closeTabAfterAutofill is false.
            if (finalStatus.needsManualReview && !currentSettings.closeTabAfterAutofill) {
                chrome.tabs.update(tabId, { active: false });
            }
        }
    }
}

function updateBulkStatusUI(statusData) {
    chrome.runtime.sendMessage({
        action: 'bulkAutofillStatusUpdate',
        statusData: statusData
    }).catch(e => console.warn("Could not send bulkAutofillStatusUpdate to UI (UI might be closed):", e));
}

function stopProcessingAutofill() {
    console.log("Background: Received request to stop autofill processes.");
    bulkAutofillInProgress = false; // Signal the main loop to stop

    // Send stop signal to any currently active content scripts in tabs
    // This is more robust as tabs might not be instantly closed.
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            // Check if the tab is one we opened for autofill
            if (workflowTabs.has(tab.id)) {
                chrome.tabs.sendMessage(tab.id, { action: 'stopAutofillContent' })
                    .then(response => console.log(`Background: Stop signal sent to tab ${tab.id}`))
                    .catch(e => console.warn(`Background: Could not send stop signal to tab ${tab.id}: ${e.message}`));
            }
        });
    });

    // Update statuses for all 'processing' or 'pending' items to 'stopped'
    for (const retailerId in activeAutofillProcesses) {
        if (activeAutofillProcesses[retailerId].status === 'processing' ||
            activeAutofillProcesses[retailerId].status === 'filling' ||
            activeAutofillProcesses[retailerId].status === 'pending') {
            activeAutofillProcesses[retailerId].status = 'stopped';
            activeAutofillProcesses[retailerId].message = 'Autofill stopped by user.';
            updateAutofillStatus(retailerId, 'stopped', 'Autofill stopped by user.'); // Persist the stop status
        }
    }

    console.log("Background: All autofill processes signaled to stop and statuses updated.");
    // Send a final overall status update
    updateBulkStatusUI({
        retailerId: 'overall_status',
        status: 'stopped',
        message: 'Bulk autofill stopped by user.',
        needsManualReview: true
    });
    return { success: true, message: "Autofill processes stopped." };
}

// --- On Installed Listener ---
chrome.runtime.onInstalled.addListener(() => {
    console.log("Background script: Extension installed or updated.");

    Promise.all([
        // Initialize Default Settings (using sync storage)
        chrome.storage.sync.get(SETTINGS_STORAGE_KEY).then(data => {
            if (!data[SETTINGS_STORAGE_KEY]) {
                return chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: DEFAULT_SETTINGS }).then(() => {
                    console.log('Background script: Default settings initialized in sync storage.');
                });
            }
        }),

        // Initialize Profiles (using local storage)
        chrome.storage.local.get(PROFILE_STORAGE_KEY).then(data => {
            console.log("onInstalled: Existing profiles data:", data[PROFILE_STORAGE_KEY]);
            if (!data[PROFILE_STORAGE_KEY] || Object.keys(data[PROFILE_STORAGE_KEY]).length === 0) {
                // Store profiles as an object/map for easier lookup by ID
                return chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: DEFAULT_PROFILES }).then(() => {
                    console.log("Background script: Default profile created in local storage:", DEFAULT_PROFILES["default-profile"]);
                    // Also set this as the active profile in sync storage
                    return chrome.storage.sync.set({ [ACTIVE_PROFILE_ID_STORAGE_KEY]: DEFAULT_PROFILES["default-profile"].id });
                });
            } else {
                console.log("Background script: Profiles already exist, not creating default on install.");
            }
        }),

        // Load or Initialize Retailer Database into the global `retailerDatabase` variable
        chrome.storage.sync.get(RETAILER_DATABASE_KEY).then(data => {
            if (data[RETAILER_DATABASE_KEY] && Array.isArray(data[RETAILER_DATABASE_KEY]) && data[RETAILER_DATABASE_KEY].length > 0) {
                retailerDatabase = data[RETAILER_DATABASE_KEY]; // Load existing combined list
                console.log('Background script: Existing combined retailer database loaded from sync storage.');
            } else {
                // If no database exists, initialize with the master list
                retailerDatabase = getMasterRetailerDatabase();
                return chrome.storage.sync.set({ [RETAILER_DATABASE_KEY]: retailerDatabase }).then(() => {
                    console.log('Background script: Default master retailer database initialized in sync storage.');
                });
            }
        })
    ])
        .then(() => {
            console.log("Background script: All onInstalled initializations attempted.");
        })
        .catch(error => {
            console.error("Background script: Error during onInstalled initialization:", error);
        });
});

// --- Message Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background script: Received message:", request.action, "from sender:", sender);

    // All message handlers now use async/await and return true for asynchronous responses
    // or call sendResponse directly and do not return true for synchronous responses.

    switch (request.action) {
        case 'isBackgroundReady':
            console.log("Background script: Received 'isBackgroundReady' request from UI.");
            sendResponse({ success: true, message: 'Background is ready!', action: request.action });
            return false; // Synchronous response, no 'return true'
        case 'getSettings':
            chrome.storage.sync.get('settings', function (data) {
                sendResponse(data.settings || {});
            });
            return true;
        case 'loadProfile' || 'loadProfiles':
            handleLoadProfilesInBackground()
                .then(response => {
                    sendResponse({ success: true, profiles: response.profiles, activeProfileId: response.activeProfileId, action: request.action });
                })
                .catch(error => {
                    console.error("Background script: Error getting profiles for load:", error);
                    sendResponse({ success: false, error: `Error loading profiles: ${error.message}`, action: request.action });
                });
            return true;
        case 'setActiveProfile':
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
        case 'getRetailerDatabase':
            console.log("Background script: Received getRetailerDatabase request from extension page.");
            // Since handleGetRetailerDatabaseInBackground is async, you MUST return true for sendResponse to work asynchronously.
            // The response will be sent once the promise resolves.
            handleGetRetailerDatabaseInBackground().then(retailersArray => {
                sendResponse({ retailers: retailersArray }); // Send the array under the 'retailers' key
            }).catch(error => {
                console.error("Error handling getRetailerDatabase:", error);
                sendResponse({ error: "Failed to load retailers." });
            });
            return true; // Indicate that sendResponse will be called asynchronously

        case 'saveProfile':
            handleSaveProfileInBackground(request.profile)
                .then(response => {
                    console.log("Background script: Profile saved. Sending response:", response);
                    sendResponse({ success: true, profiles: response.profiles, activeProfileId: response.activeProfileId });
                })
                .catch(error => {
                    console.error("Background script: Error saving profile:", error);
                    sendResponse({ success: false, error: `Error saving profile: ${error.message}` });
                });
            return true;       // Asynchronous response

        case 'deleteProfile':
            console.log("Background script: Deleting profile:", request.profileId);
            handleDeleteProfileInBackground(request.profileId)
                .then(response => {
                    sendResponse(response);
                })
                .catch(error => {
                    console.error("Background script: Error deleting profile:", error);
                    sendResponse({ success: false, error: `Error deleting profile: ${error.message}` });
                });
            return true;
        case 'getProfileData':
            chrome.storage.local.get(['profiles'], (result) => {
                const profiles = result.profiles || {};
                const profileToSend = profiles[request.profileId];
                if (profileToSend) {
                    sendResponse({ success: true, profile: profileToSend });
                } else {
                    console.error("Background script: Profile not found for getProfileData:", request.profileId);
                    sendResponse({ success: false, error: "Profile not found." });
                }
            });
            return true;

        case 'saveSettings':
            console.log("Background script: Saving settings:", request.settings);
            handleSaveSettingsInBackground(request.settings) // Assuming this is an async function
                .then(response => {
                    sendResponse({ success: true, settings: response.settings, action: request.action });
                })
                .catch(error => {
                    console.error("Background script: Error saving settings:", error);
                    sendResponse({ success: false, error: error.message, action: request.action });
                });
            return true;

        case 'loadSettings':
            console.log("Background script: Loading settings.");
            handleLoadSettingsInBackground() // Assuming this is an async function
                .then(response => {
                    sendResponse({ success: true, settings: response.settings, action: request.action });
                })
                .catch(error => {
                    console.error("Background script: Error loading settings:", error);
                    sendResponse({ success: false, error: `Error loading settings: ${error.message}`, action: request.action });
                });
            return true;
        case 'startAutofill':
        case 'startBulkAutofill':
            console.log("Background: Received startBulkAutofill request.");
            const { retailerIds: idsToProcess, profile: activeProfile } = request;


            if (!idsToProcess || idsToProcess.length === 0) {
                sendResponse({ success: false, message: "No retailers selected for bulk autofill.", action: request.action });
                return false;
            } else {
                console.log("Background: Active Profile received for autofill:", activeProfile);
                bulkAutofillInProgress = true;
                processRetailerList(request.retailerIds, request.profile)
                    .then(() => sendResponse({ success: true, message: 'Bulk autofill process initiated.' }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true; // Important: indicates asynchronous response
            }
        case 'stopBulkAutofill':
        case 'stopAutofill':
            console.log("Background: Received stopBulkAutofill request.");

            if (bulkAutofillInProgress) {
                bulkAutofillInProgress = false; // Set the flag to stop the loop

                // Close any currently active tabs related to the bulk autofill
                currentAutofillTabIds.forEach(tabId => {
                    // Only close tabs that are still associated with pending/filling status for the bulk job
                    const retailer = Object.values(bulkAutofillStatus).find(s => s.tabId === tabId && (s.status === 'pending' || s.status === 'filling'));
                    if (retailer) {
                        retailer.status = 'stopped';
                        retailer.message = 'Tab closed by stop command.';
                        chrome.tabs.remove(tabId).catch(e => console.error("Error closing tab:", e));
                    }
                });

                if (currentAutofillTabIds.size > 0) {
                    console.log("Background: Closing all active autofill tabs due to stop request.");
                    currentAutofillTabIds.forEach(tabId => {
                        chrome.tabs.remove(tabId).catch(e => console.error(`Error closing tab ${tabId} on stop:`, e));
                    });
                    currentAutofillTabIds.clear();
                }

                // Stop any active autofill content scripts and update statuses
                stopProcessingAutofill();
                sendBulkAutofillStatusUpdate(); // Update UI with 'stopped' status
                sendResponse({ success: true, message: "Bulk autofill process stopped." });
            } else {
                sendResponse({ success: false, message: "Bulk autofill not currently active." });
            }
            return false;

        case 'contentScriptAutofillStatus':
            console.log(`Background: Status from content script for ${request.retailerId}: ${request.status} - ${request.message}`);
            // Update activeAutofillProcesses and persist
            updateAutofillStatus(request.retailerId, request.status, request.message);
            sendResponse({ success: true }); // Acknowledge receipt
            return false;

        case 'reportAutofillStatus': // Handles updates for a specific retailer
            const { retailerId: reportedRetailerId, status: reportedStatus, message: reportedMessage } = request;
            if (retailerStatuses[reportedRetailerId]) {
                retailerStatuses[reportedRetailerId].status = reportedStatus;
                retailerStatuses[reportedRetailerId].message = reportedMessage;
                sendBulkAutofillStatusUpdate(); // Assuming this pushes updates to the UI
                sendResponse({ success: true }); // Acknowledge the update
            } else {
                console.warn(`Background: reportAutofillStatus received for unknown retailer: ${reportedRetailerId}`);
                sendResponse({ success: false, error: `Retailer ${reportedRetailerId} not found in status tracking.` });
            }
            return false;

        case 'getAutofillStatuses': // Handles requests for all current statuses
            console.log("Background script: Received getAutofillStatuses request from UI.");
            chrome.storage.local.get([AUTOFILL_STATUSES_KEY], (data) => {
                const autofillStatuses = data[AUTOFILL_STATUSES_KEY] || {};
                sendResponse({ success: true, autofillStatuses: autofillStatuses });
            });
            return true;

        case 'autofillWorkflowComplete':
            console.log("Background: Received autofillWorkflowComplete from tab:", sender.tab?.id, "for retailer:", request.retailerId, "Status:", request.status, "Needs Review:", request.needsManualReview);

            if (!sender.tab) {
                console.warn("Background: autofillWorkflowComplete received without sender.tab. Ignoring.");
                sendResponse({ success: false, message: "No sender tab info." });
                return false;
            }

            const tabIdFromContentScript = sender.tab.id;
            const workflowDataFromContentScript = workflowTabs.get(tabIdFromContentScript); // Assuming workflowTabs is defined

            if (workflowDataFromContentScript) {
                Object.assign(workflowDataFromContentScript, request);
                workflowDataFromContentScript.endTime = Date.now();

                updateBulkStatusUI(workflowDataFromContentScript); // Assuming updateBulkStatusUI is defined

                handleLoadSettingsInBackground().then(data => {
                    const currentSettings = data.settings;
                    if (!workflowDataFromContentScript.needsManualReview && currentSettings.closeTabAfterAutofill) {
                        console.log(`Background: Content script reported completed (no review needed) for ${request.retailerName}. Closing tab ${tabIdFromContentScript}.`);
                        setTimeout(() => {
                            chrome.tabs.remove(tabIdFromContentScript).then(() => {
                                workflowTabs.delete(tabIdFromContentScript);
                                console.log(`Background: Tab ${tabIdFromContentScript} closed by content script completion.`);
                            }).catch(e => console.error(`Background: Error closing tab ${tabIdFromContentScript}:`, e));
                        }, 500);
                    } else {
                        console.log(`Background: Content script reported ${request.retailerName} needs manual review. Leaving tab ${tabIdFromContentScript} open.`);
                    }
                });

            } else {
                console.warn(`Background: Received autofillWorkflowComplete for untracked tab ${tabIdFromContentScript}. Ignoring.`);
            }
            sendResponse({ success: true, message: "Autofill workflow complete acknowledged." });
            return false;

        case 'addCustomRetailer': // Renamed from 'saveCustomRetailer' in previous turn for clarity, assuming original request was 'addCustomRetailer' based on case
            console.log("Background script: Received message to add custom retailer:", request.retailer);
            handleSaveRetailerDatabaseInBackground(request.retailer) // Assuming this saves to customRetailerDatabase and storage
                .then(response => {
                    sendResponse(response);
                    chrome.runtime.sendMessage({ action: 'retailerDatabaseUpdated' });
                })
                .catch(error => {
                    console.error("Background: Error adding custom retailer:", error.message);
                    sendResponse({ success: false, message: error.message });
                });
            return true; // Asynchronous response

        case "ping":
            console.log("Background script: Received 'ping' from content script.");
            sendResponse({ status: "pong" });
            return false;

        case "saveCustomRetailer": // If you still use this action name for saving custom retailers
            const { retailerId, retailerName, retailerUrl, fields } = request;
            if (retailerId && retailerName && retailerUrl) {
                customRetailerDatabase[retailerId] = {
                    id: retailerId,
                    name: retailerName,
                    url: retailerUrl,
                    fields: fields || [],
                };
                saveCustomRetailersToStorage(); // Assuming this is an async function
                sendResponse({ success: true, message: `Retailer '${retailerName}' saved.` });
                return true;
            } else {
                sendResponse({ success: false, error: 'Missing retailer details.' });
            }
            return false // Synchronous, assuming saveCustomRetailersToStorage is sync or called without await

        case "contentScriptReady":
            if (sender.tab && pendingContentScriptReady.has(sender.tab.id)) {
                pendingContentScriptReady.get(sender.tab.id)(); // Resolve the promise
                pendingContentScriptReady.delete(sender.tab.id);
                console.log(`Background: Content script in tab ${sender.tab.id} signaled readiness.`);
                sendResponse({ success: true, message: 'Content script ready acknowledged.' });
            } else {
                console.warn(`Background: Received contentScriptReady from unexpected tab ${sender.tab?.id || 'unknown'}.`);
                sendResponse({ success: false, message: 'Unexpected content script readiness signal.' });
            }
            return true;
        default:
            console.warn("Background script: Unhandled message action:", request.action);
            sendResponse({ success: false, error: 'Unknown action' });
            return false;
    }
});


chrome.tabs.onRemoved.addListener(tabId => {
    // Check if the removed tab was part of an active autofill process
    if (workflowTabs.has(tabId)) {
        const workflowData = workflowTabs.get(tabId);
        console.log(`Background: Tab ${tabId} for retailer ${workflowData.retailerId} removed unexpectedly.`);
        // Update its status to reflect unexpected closure
        updateAutofillStatus(workflowData.retailerId, 'attention', 'Tab closed unexpectedly during autofill.');
        workflowTabs.delete(tabId); // Clean up from workflowTabs
        currentAutofillTabIds.delete(tabId); // Clean up from tracking set
    } else {
        // Find if any active autofill process was tied to this tabId (less direct but still useful)
        for (const retailerId in activeAutofillProcesses) {
            if (activeAutofillProcesses[retailerId].tabId === tabId &&
                (activeAutofillProcesses[retailerId].status === 'processing' || activeAutofillProcesses[retailerId].status === 'filling')) {
                updateAutofillStatus(retailerId, 'attention', 'Tab closed unexpectedly during autofill.');
                delete activeAutofillProcesses[retailerId].tabId; // Remove tab association
                break; // Assuming one retailer per tab at a time for simple lookup
            }
        }
    }
});


/* OPTIONAL CODE */

function setupContextMenuAutofill() {
    // Use onInstalled to create menus only once
    chrome.runtime.onInstalled.addListener(() => {
        chrome.contextMenus.create({
            id: "autofillWithProfile",
            title: "Autofill with Birthday Profile",
            contexts: ["editable"] // Show only on editable fields
        }, () => {
            if (chrome.runtime.lastError) {
                console.warn("Error creating context menu:", chrome.runtime.lastError.message);
                // This error typically means it already exists, which is fine if we re-initialize.
            } else {
                console.log("Context menu 'autofillWithProfile' created.");
            }
        });
    });

    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        if (info.menuItemId === "autofillWithProfile") {
            const { profiles, activeProfileId } = await chrome.runtime.sendMessage({ action: 'loadProfiles' });
            const activeProfile = profiles[activeProfileId];
            const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });

            if (activeProfile && tab && tab.id) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['autofill_content_script.js'] // Ensure your content script is injected
                    });
                    console.log(`Background: autofill_content_script.js injected for context menu.`);

                    // Wait for content script to be ready
                    const contentScriptReadyPromise = new Promise(resolve => {
                        pendingContentScriptReady.set(tab.id, resolve);
                        setTimeout(() => {
                            if (pendingContentScriptReady.has(tab.id)) {
                                console.warn(`Background: Timeout waiting for content script ready for context menu in tab ${tab.id}.`);
                                pendingContentScriptReady.delete(tab.id);
                                resolve();
                            }
                        }, 5000); // Shorter timeout for single page interaction
                    });
                    await contentScriptReadyPromise;
                    console.log(`Background: Content script for context menu in tab ${tab.id} is ready.`);


                    await chrome.tabs.sendMessage(tab.id, {
                        action: "fillForm",
                        profile: activeProfile,
                        settings: settings,
                        retailer: null, // No specific retailer object for context menu autofill
                        isBulkAutofill: false // Not bulk autofill
                    });
                    console.log("Context menu autofill message sent.");
                } catch (error) {
                    console.error("Context menu autofill failed:", error);
                }
            }
        }
    });
}

// Call this function to initialize the context menu
setupContextMenuAutofill();

// --- On Startup Listener (Optional, but good practice for service workers) ---
chrome.runtime.onStartup.addListener(async () => {
    console.log('Background script: Browser started. Restoring any previous state if needed.');
    // You might want to re-load settings or profiles here if your extension needs to operate immediately on startup
    // e.g., await handleLoadSettingsInBackground();
    // Clear any leftover autofill statuses from a previous session if browser crashed
    await chrome.storage.local.set({ [AUTOFILL_STATUSES_KEY]: {} });
    bulkAutofillInProgress = false;
});