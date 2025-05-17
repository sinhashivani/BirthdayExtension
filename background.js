// background.js

let websiteList = [];
let currentWebsiteIndex = 0;
let currentProcessingTabId = null; // To keep track of the tab we are currently processing

// Listen for messages from popup or options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startAutoSubscribe') {
        startAutoSubscribeProcess();
        // No need to sendResponse for async operations started here
    }
    // Add other background message listeners here if needed
});

// Listener for tab updates - used to detect when a page has finished loading
chrome.tabs.onUpdated.addListener(handleTabUpdated);

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

