/**
 * Loyalty Program Auto-Enroll Extension - Background Script
 * Handles background processes and coordinates between content scripts and popup
 */

// Default list of form field keywords for detection
const DEFAULT_FIELD_KEYWORDS = [
    "First Name", "FirstName", "first_name", "firstname", "fname", "first",
    "Last Name", "LastName", "last_name", "lastname", "lname", "last",
    "Email", "email", "mail", "e-mail", "email_address",
    "Birthday", "Date of Birth", "DOB", "birth_date", "birthdate", "bday", "dob",
    "Phone", "phone", "telephone", "mobile", "cell", "phone_number",
    "Address", "address", "street", "addr", "address1", "street_address"
];

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // Initialize default settings
        chrome.storage.sync.set({
            settings: {
                fontSize: 'normal',
                highContrast: false,
                customKeywords: [],
                dataValidation: true
            },
            autofillEnabled: true,
            manualOverride: false,
            trackerData: [],
            fieldKeywords: DEFAULT_FIELD_KEYWORDS
        });

        // Show onboarding page on install
        chrome.tabs.create({
            url: chrome.runtime.getURL('onboarding.html')
        });
    } else if (details.reason === 'update') {
        // Ensure settings are complete on update
        chrome.storage.sync.get(['settings', 'fieldKeywords'], (data) => {
            // Update settings if needed
            if (!data.settings) {
                chrome.storage.sync.set({
                    settings: {
                        fontSize: 'normal',
                        highContrast: false,
                        customKeywords: [],
                        dataValidation: true
                    }
                });
            }

            // Update field keywords if needed
            if (!data.fieldKeywords) {
                chrome.storage.sync.set({
                    fieldKeywords: DEFAULT_FIELD_KEYWORDS
                });
            }
        });
    }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle form submission tracking
    if (message.action === 'trackSubmission') {
        addTrackerEntry(
            sender.tab.url,
            message.birthdayFieldFound,
            message.captcha || false
        );
        sendResponse({ success: true });
        return true;
    }

    // Handle content script injection request
    if (message.action === 'injectContentScript') {
        injectContentScript(sender.tab.id);
        sendResponse({ success: true });
        return true;
    }

    // Handle profile data request
    if (message.action === 'getProfileData') {
        chrome.storage.sync.get(['activeProfile', 'profiles'], (data) => {
            const profile = data.profiles && data.activeProfile ?
                data.profiles[data.activeProfile] : null;
            sendResponse({ profile });
        });
        return true; // Required for asynchronous response
    }

    // Handle settings request
    if (message.action === 'getSettings') {
        chrome.storage.sync.get(['settings', 'autofillEnabled', 'manualOverride', 'fieldKeywords'], (data) => {
            sendResponse({
                settings: data.settings || {},
                autofillEnabled: data.autofillEnabled !== false,
                manualOverride: data.manualOverride || false,
                fieldKeywords: data.fieldKeywords || DEFAULT_FIELD_KEYWORDS
            });
        });
        return true; // Required for asynchronous response
    }
});

// Listen for tab updates to inject content script on navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only inject when page is fully loaded
    if (changeInfo.status === 'complete' && tab.url.startsWith('http')) {
        // Check if autofill is enabled before injecting
        chrome.storage.sync.get('autofillEnabled', (data) => {
            if (data.autofillEnabled !== false) {
                injectContentScript(tabId);
            }
        });
    }
});

/**
 * Inject content script into the specified tab
 * @param {number} tabId - Tab ID to inject into
 */
function injectContentScript(tabId) {
    // Check if content script is already injected
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
            // Content script not yet injected, inject it
            chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js']
            }).catch(error => {
                console.error('Error injecting content script:', error);
            });
        }
    });
}

/**
 * Add entry to the tracker
 * @param {string} url - Website URL
 * @param {boolean} birthdayFieldFound - Whether a birthday field was found
 * @param {boolean} captcha - Whether a captcha was detected
 */
function addTrackerEntry(url, birthdayFieldFound, captcha = false) {
    chrome.storage.sync.get('trackerData', (data) => {
        const trackerData = data.trackerData || [];

        // Create entry
        const entry = {
            domain: url,
            date: Date.now(),
            birthdayFieldFound,
            captcha
        };

        // Add to tracker
        trackerData.push(entry);

        // Save updated tracker
        chrome.storage.sync.set({ trackerData });
    });
}

/**
 * Handle form data validation
 * @param {Object} formData - Form data to validate
 * @returns {Object} Validation result
 */
function validateFormData(formData) {
    const errors = {};

    // Validate email
    if (formData.email && !isValidEmail(formData.email)) {
        errors.email = 'Invalid email format';
    }

    // Validate birthday
    if (formData.birthday && !isValidDate(formData.birthday)) {
        errors.birthday = 'Invalid date format';
    }

    // Validate phone
    if (formData.phone && !isValidPhone(formData.phone)) {
        errors.phone = 'Invalid phone number format';
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email is valid
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate date format
 * @param {string} date - Date to validate
 * @returns {boolean} Whether date is valid
 */
function isValidDate(date) {
    // Accept multiple formats (MM/DD/YYYY, YYYY-MM-DD, etc.)
    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Whether phone number is valid
 */
function isValidPhone(phone) {
    // Basic validation - allow various formats but require min digits
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length >= 10;
}

// Handle browser action click
chrome.action.onClicked.addListener((tab) => {
    // This handler is only used if no popup is defined in manifest
    // Check if we're on a website where form detection might be useful
    if (tab.url.startsWith('http')) {
        // Open popup
        chrome.action.openPopup();
    }
});

// Handle alarm for periodic checks (for multi-page forms)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'formPageCheck') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                // Re-check for forms on the new page
                chrome.tabs.sendMessage(tabs[0].id, { action: 'scanForForms' });
            }
        });
    }
});

// Set up context menu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'fillFormHere',
        title: 'Fill form fields',
        contexts: ['page']
    });

    chrome.contextMenus.create({
        id: 'addToTracker',
        title: 'Add this site to tracker',
        contexts: ['page']
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'fillFormHere') {
        chrome.storage.sync.get(['activeProfile', 'profiles'], (data) => {
            const profile = data.profiles && data.activeProfile ?
                data.profiles[data.activeProfile] : null;

            if (profile) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'fillForm',
                    profile: profile
                });
            } else {
                // Show notification that no profile is selected
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'No Profile Selected',
                    message: 'Please select a profile in the extension popup first.'
                });
            }
        });
    } else if (info.menuItemId === 'addToTracker') {
        // Manually add current site to tracker
        chrome.tabs.sendMessage(tab.id, { action: 'checkForBirthdayField' }, (response) => {
            const birthdayFieldFound = response && response.birthdayFieldFound;
            addTrackerEntry(tab.url, birthdayFieldFound);

            // Show notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Site Added to Tracker',
                message: birthdayFieldFound ?
                    'Birthday field detected. High reward likelihood!' :
                    'No birthday field found. Unlikely to receive birthday rewards.'
            });
        });
    }
});

// Handle extension update - check for new permissions needed
chrome.runtime.onUpdateAvailable.addListener((details) => {
    console.log('Update available, version:', details.version);
    // Will update when browser restarts
});

// Setup data backup functionality
chrome.alarms.create('dataBackup', { periodInMinutes: 1440 }); // Once a day

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'dataBackup') {
        // Backup all extension data
        chrome.storage.sync.get(null, (data) => {
            const backupDate = new Date().toISOString().split('T')[0];
            const backupKey = `loyalty_backup_${backupDate}`;

            // Store backup in local storage
            chrome.storage.local.set({
                [backupKey]: {
                    date: Date.now(),
                    data: data
                }
            });

            // Clean up old backups (keep only the last 7 days)
            chrome.storage.local.get(null, (localData) => {
                const backupKeys = Object.keys(localData)
                    .filter(key => key.startsWith('loyalty_backup_'))
                    .sort();

                if (backupKeys.length > 7) {
                    const keysToRemove = backupKeys.slice(0, backupKeys.length - 7);
                    chrome.storage.local.remove(keysToRemove);
                }
            });
        });
    }
});