// background.js

let websiteList = [];
let currentWebsiteIndex = 0;
let currentProcessingTabId = null; // To keep track of the tab we are currently processing
let bulkProcessQueue = []; // Array of retailer IDs to process
let currentBulkJobStatus = {}; // retailerId: { status: 'pending'|'in_progress'|'complete'|'error', message: '', tabId: null }
let activeProcessingCount = 0;
const MAX_CONCURRENT_PROCESSES = 1; // Start with 1 for simplicity, can increase later

let retailerDatabase = [];
let bulkAutofillQueue = [];
let bulkAutofillStatuses = {};
let currentAutofillTabId = null;
let uiPort = null;
let allProfiles = {}; // Stores all user-defined profiles
let activeProfileId = null; // Stores the ID of the currently active profile


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

function processNextRetailer() {
    if (activeProcessingCount >= MAX_CONCURRENT_PROCESSES) {
        return; // Wait for an active process to finish
    }

    const nextRetailerJob = bulkProcessQueue.find(r => currentBulkJobStatus[r.id]?.status === 'pending');
    if (!nextRetailerJob) {
        if (activeProcessingCount === 0) {
            console.log("Bulk process queue finished.");
            notifyUI({ action: 'bulkProcessComplete', statuses: currentBulkJobStatus });
        }
        return;
    }

    activeProcessingCount++;
    currentBulkJobStatus[nextRetailerJob.id].status = 'in_progress';
    currentBulkJobStatus[nextRetailerJob.id].message = 'Opening tab...';
    notifyUI({ action: 'bulkProcessUpdate', statuses: currentBulkJobStatus });

    const retailerUrl = nextRetailerJob.membershipPageUrl;
    chrome.tabs.create({ url: retailerUrl, active: false }, async (tab) => {
        if (chrome.runtime.lastError || !tab) {
            console.error("Error creating tab:", chrome.runtime.lastError?.message);
            handleRetailerCompletion(nextRetailerJob.id, 'error', 'Failed to open tab.');
            return;
        }
        currentBulkJobStatus[nextRetailerJob.id].tabId = tab.id;
        currentBulkJobStatus[nextRetailerJob.id].message = 'Tab opened, waiting for page load...';
        notifyUI({ action: 'bulkProcessUpdate', statuses: currentBulkJobStatus });

        // Listen for tab update to ensure page is loaded before sending message
        chrome.tabs.onUpdated.addListener(async function tabUpdateListener(tabId, changeInfo, updatedTab) {
            if (tabId === tab.id && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(tabUpdateListener); // Clean up listener

                currentBulkJobStatus[nextRetailerJob.id].message = 'Page loaded, attempting autofill...';
                notifyUI({ action: 'bulkProcessUpdate', statuses: currentBulkJobStatus });

                // Send message to content script to start autofill
                // Ensure you have user profile data available to send
                const userData = (await chrome.storage.local.get('userProfileData'))?.userProfileData; // Example
                if (!userData) {
                    handleRetailerCompletion(nextRetailerJob.id, 'error', 'User profile data not found.');
                    return;
                }

                chrome.tabs.sendMessage(
                    tab.id,
                    {
                        action: "executeAutofill",
                        retailerInfo: nextRetailerJob, // For context, if needed by content.js
                        userData: userData // The actual data to fill
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            handleRetailerCompletion(nextRetailerJob.id, 'error', `Autofill communication error: ${chrome.runtime.lastError.message}`);
                        } else if (response) {
                            handleRetailerCompletion(nextRetailerJob.id, response.success ? 'complete' : 'error', response.message);
                        } else {
                            handleRetailerCompletion(nextRetailerJob.id, 'error', 'No response from content script.');
                        }
                    }
                );
            }
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "retryRetailer") {
        console.log(`Received retry request for retailerId: ${request.retailerId}`);
        // Implement your retry logic here
        // e.g., call the function that starts autofill for this specific retailer
        // You might need to retrieve the retailer's details from your stored database
        // and then initiate the autofill flow for that single retailer.
        processNextRetailer(); // Assuming you have such a function
        sendResponse({ status: "success", message: "Retry initiated" });
    }
    // ... other message listeners
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

