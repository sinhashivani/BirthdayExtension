// options.js

document.addEventListener('DOMContentLoaded', () => {
    const websiteUrlsTextarea = document.getElementById('websiteUrls');
    const saveListButton = document.getElementById('saveList');
    const startButton = document.getElementById('startAutoSubscribe');
    const statusDiv = document.getElementById('status');

    // Load saved list when the options page opens
    loadWebsiteList();

    // Save list when button is clicked
    saveListButton.addEventListener('click', saveWebsiteList);

    // Start process when button is clicked
    startButton.addEventListener('click', startAutoSubscribe);
});

/**
 * Loads the saved website URL list from storage and displays it in the textarea.
 */
function loadWebsiteList() {
    chrome.storage.sync.get('websiteUrls', (data) => {
        const websiteUrls = data.websiteUrls || [];
        document.getElementById('websiteUrls').value = websiteUrls.join('\n');
        console.log("Options: Loaded website list:", websiteUrls);
    });
}

/**
 * Reads the URLs from the textarea, saves them to storage.
 */
function saveWebsiteList() {
    const websiteUrlsTextarea = document.getElementById('websiteUrls');
    const urls = websiteUrlsTextarea.value.split('\n')
        .map(url => url.trim())
        .filter(url => url !== ''); // Remove empty lines

    chrome.storage.sync.set({ websiteUrls: urls }, () => {
        console.log("Options: Website list saved:", urls);
        displayStatus('Website list saved!', 'success');
    });
}

/**
 * Sends a message to the background script to start the auto-subscribe process.
 */
function startAutoSubscribe() {
    saveWebsiteList(); // Save the current list first
    const websiteUrlsTextarea = document.getElementById('websiteUrls');
    const urls = websiteUrlsTextarea.value.split('\n')
        .map(url => url.trim())
        .filter(url => url !== '');

    if (urls.length === 0) {
        displayStatus('Website list is empty. Add URLs before starting.', 'warning');
        return;
    }

    // Send message to background.js to start the process
    chrome.runtime.sendMessage({ action: 'startAutoSubscribe' })
        .then(() => {
            displayStatus('Auto-subscribe process started. Check new tabs.', 'info');
            // Optionally disable the start button or close the options page
            document.getElementById('startAutoSubscribe').disabled = true;
        })
        .catch(error => {
            console.error("Options: Error sending start message:", error);
            displayStatus('Error starting process.', 'error');
        });
}

/**
 * Displays a status message on the options page.
 * @param {string} message The message to display.
 * @param {'info'|'success'|'warning'|'error'} type The type of status.
 */
function displayStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.style.color = ''; // Reset color
    if (type === 'success') statusDiv.style.color = 'green';
    else if (type === 'warning') statusDiv.style.color = 'orange';
    else if (type === 'error') statusDiv.style.color = 'red';
}