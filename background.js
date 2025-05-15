// background.js - Service worker for Loyalty Form Filler
// Handles extension initialization, messaging, and data management

// Initialize the extension data when installed
chrome.runtime.onInstalled.addListener(async () => {
    // Set up default storage structure
    const defaultData = {
        profiles: [
            {
                id: 'default',
                name: 'Default Profile',
                firstName: '',
                lastName: '',
                email: '',
                birthday: '',
                phone: '',
                address: '',
                city: '',
                state: '',
                zip: ''
            }
        ],
        activeProfile: 'default',
        submissions: [],
        settings: {
            customKeywords: {
                firstName: ['first name', 'fname', 'given name'],
                lastName: ['last name', 'lname', 'surname', 'family name'],
                email: ['email address', 'e-mail', 'email id'],
                birthday: ['date of birth', 'birth date', 'dob', 'birth day'],
                phone: ['telephone', 'phone number', 'mobile', 'cell phone'],
                address: ['street address', 'mailing address', 'residence'],
                city: ['town', 'municipality'],
                state: ['province', 'region', 'county'],
                zip: ['postal code', 'zip code', 'post code']
            },
            autoFillEnabled: true,
            confirmBeforeSubmit: true
        }
    };

    // Initialize storage
    try {
        await chrome.storage.sync.set({ formFillerData: defaultData });
        console.log('Extension initialized with default data');
    } catch (error) {
        console.error('Error initializing extension data:', error);
    }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getFormFillerData') {
        chrome.storage.sync.get('formFillerData', (data) => {
            sendResponse(data.formFillerData || {});
        });
        return true; // Required for async sendResponse
    }

    else if (message.action === 'saveFormFillerData') {
        chrome.storage.sync.set({ formFillerData: message.data }, () => {
            sendResponse({ success: true });
        });
        return true;
    }

    else if (message.action === 'trackSubmission') {
        addSubmissionToTracker(message.data, sendResponse);
        return true;
    }

    else if (message.action === 'scanPage') {
        // Inject content script if not already injected
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            files: ['content.js']
        }).then(() => {
            chrome.tabs.sendMessage(sender.tab.id, { action: 'performScan' });
            sendResponse({ success: true });
        }).catch(error => {
            console.error('Error injecting content script:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }
});

// Add a new submission to the tracker
async function addSubmissionToTracker(submission, sendResponse) {
    try {
        const data = await chrome.storage.sync.get('formFillerData');
        const formFillerData = data.formFillerData || {};

        // Ensure submissions array exists
        if (!formFillerData.submissions) {
            formFillerData.submissions = [];
        }

        // Add the new submission with timestamp
        submission.timestamp = Date.now();
        formFillerData.submissions.push(submission);

        // Limit to last 100 submissions to prevent storage quota issues
        if (formFillerData.submissions.length > 100) {
            formFillerData.submissions = formFillerData.submissions.slice(-100);
        }

        // Save updated data
        await chrome.storage.sync.set({ formFillerData });
        sendResponse({ success: true });
    } catch (error) {
        console.error('Error adding submission to tracker:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle tab updates to inject content script when needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url.startsWith('http')) {
        chrome.scripting.executeScript({
            target: { tabId },
            function: checkPageForForms
        });
    }
});

// Function to check if the page contains forms
function checkPageForForms() {
    const forms = document.forms;
    if (forms.length > 0) {
        // Notify that forms are available on the page
        chrome.runtime.sendMessage({
            action: 'formsDetected',
            count: forms.length
        });
    }
}