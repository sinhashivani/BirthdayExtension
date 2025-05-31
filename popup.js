// popup.js
// Controls the UI and logic of the extension's browser action popup.

// Import necessary functions from utils.js (assuming they exist and are needed elsewhere)
// If you don't have a utils.js or don't need these, you can remove this import.
// Example imports if you have a tracker and export:
// import {
//      exportToCSV, // For exporting tracker data (if used elsewhere or later)
//      exportToJSON, // For exporting tracker data (if used elsewhere or later)
//      // If you had addTrackerEntry in utils.js:
//      // addTrackerEntry // Assuming addTrackerEntry is in utils.js or background script
// } from "./utils.js";


// --- DOM Elements ---
// Get references to all interactive elements and views from popup.html
const profileViewBtn = document.getElementById('profileViewBtn'); // New view switcher button
const autofillViewBtn = document.getElementById('autofillViewBtn'); // New view switcher button

// References to the two main view containers
const profileView = document.getElementById('profile-view');
const autofillView = document.getElementById('autofill-view');

// Profile form and its fields
const profileForm = document.getElementById('profile-form');
const profileFirstNameInput = document.getElementById('profile-firstName');
const profileLastNameInput = document.getElementById('profile-lastName');
const profileEmailInput = document.getElementById('profile-email');
const profilePasswordInput = document.getElementById('profile-password');
console.log("Popup: Found profilePasswordInput:", profilePasswordInput); // <-- Add this line
const profileBirthdayInput = document.getElementById('profile-birthday');
const profileCountryCode = document.getElementById('profile-country-code');
const profilePhoneInput = document.getElementById('profile-phone');
const profileAddressInput = document.getElementById('profile-address');
const profileCityInput = document.getElementById('profile-city');
const profileStateInput = document.getElementById('profile-state');
const profileZipInput = document.getElementById('profile-zip');
const saveProfileBtn = document.getElementById('saveProfileBtn'); // Button to save profile

const triggerAutofillBtn = document.getElementById('triggerAutofillBtn');
const togglePasswordVisibilityButton = document.getElementById('togglePasswordVisibility'); // Get the button by its ID
console.log("Popup: Found togglePasswordVisibilityButton:", togglePasswordVisibilityButton); // <-- Add this line

// --- CORRECT References for the general status message area ---
const statusContainer = document.getElementById('statusContainer'); // General status container
const statusTextElement = document.getElementById('statusTextElement'); // General status text element
const statusIconElement = statusContainer ? statusContainer.querySelector('.status-icon') : null; // Reference the icon span
// --- END CORRECT ---


// Simplified Settings toggles (moved to Autofill view)
const autofillHighlightToggle = document.getElementById('autofillHighlightToggle'); // Corrected ID
const highContrastToggle = document.getElementById('highContrastToggle');

// Other elements from simplified HTML
const helpBtn = document.getElementById('helpBtn'); // Button for Help modal
const openOptionsLink = document.getElementById('openOptionsLink');

// --- Templates ---
const fieldPreviewTemplate = document.getElementById('fieldPreviewTemplate');
const helpModalTemplate = document.getElementById('helpModalTemplate');


// --- Default Data ---
const DEFAULT_SETTINGS = {
    autofillHighlightEnabled: true, // Setting for auto-highlighting
    highContrast: false,
    customKeywords: {}, // Example: { firstName: ['first', 'fname'], email: ['email'] }
    dataValidation: true, // Setting to control validation
};

const DEFAULT_PROFILE = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    birthday: '', // UseYYYY-MM-DD format internally
    countryCode: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
};

// --- State Variables ---
let activeProfile = null; // Stores the single primary profile data
let formPreviewData = null;


// --- Initialization ---
// Wait for the DOM to be fully loaded before initializing the popup
document.addEventListener('DOMContentLoaded', () => {
    console.log("Popup: DOM fully loaded, initializing.");
    initPopup(); // Start the initialization process
    setupEventListeners(); // Set up all button/element listeners
});

/**
 * Initialize popup with stored data and settings.
 * This runs when the popup is opened.
 */
function initPopup() {
    console.log("Popup: Initializing popup.");

    // Load settings and the single profile data concurrently
    chrome.storage.sync.get(['settings', 'profile'], (data) => {
        console.log("Popup: Loaded data from storage:", data);

        // Load and apply settings
        const settings = data.settings || DEFAULT_SETTINGS;
        applySettings(settings);

        // Load the single profile data
        activeProfile = data.profile || DEFAULT_PROFILE;
        console.log("Popup: Active profile loaded:", activeProfile);
        // Load profile data into the form fields in the Profile view
        loadProfileDataIntoForm(activeProfile);

        // After loading data and setting up UI, get status from the current tab
        // This will update the status message and enable/disable the Autofill button
        getCurrentTabStatus();
    });
}

/**
 * Set up event listeners for all interactive popup elements.
 */
function setupEventListeners() {
    console.log("Popup: Setting up event listeners.");

    // --- View Switching ---
    if (profileViewBtn) profileViewBtn.addEventListener('click', () => { showProfileView(); });
    if (autofillViewBtn) autofillViewBtn.addEventListener('click', () => { showAutofillView(); });


    // --- Profile Management ---
    // Listener for the profile form submission (Save Profile button)
    // Check if profileForm exists before adding listener
    if (profileForm) profileForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Prevent default form submission
        console.log("Popup: Profile form submitted (Save Profile button clicked).");
        saveProfileFromForm(); // Function to save the profile data from the form
    });
    // Note: Add/Delete profile buttons are removed in this simplified structure.
    // This assumes managing a single primary profile via the form.

    // --- Settings Controls ---
    // Check if elements exist before adding listeners
    if (autofillHighlightToggle) autofillHighlightToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        console.log("Popup: Autofill Highlight toggle changed to", isEnabled);
        // Save the setting
        saveSettings({ autofillHighlightEnabled: isEnabled }); // Use saveSettings helper
        // Message content script to update its highlighting state
        sendMessageToContentScript({ action: 'toggleAutofillHighlighting', isActive: isEnabled });
    });

    if (highContrastToggle) highContrastToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        console.log("Popup: High contrast toggle changed to", isEnabled);
        // Apply changes immediately to popup UI
        applyHighContrast(isEnabled); // Apply the CSS class
        // Save settings
        saveSettings({ highContrast: isEnabled }); // Use saveSettings helper
    });

    // Add click listener to the toggle button
    if (togglePasswordVisibilityButton && profilePasswordInput) {
        togglePasswordVisibilityButton.addEventListener('click', () => {
            // Toggle the input type between 'password' and 'text'
            const currentType = profilePasswordInput.type;
            if (currentType === 'password') {
                profilePasswordInput.type = 'text';
                // Change the button's text to "Hide"
                togglePasswordVisibilityButton.textContent = 'Hide';
            } else {
                profilePasswordInput.type = 'password';
                // Change the button's text back to "Show"
                togglePasswordVisibilityButton.textContent = 'Show';
            }
        });
    }

    // --- Form Actions (Autofill View) ---
    // This button triggers the scan, fill, and preview flow
    // Check if triggerAutofillBtn exists
    if (triggerAutofillBtn) triggerAutofillBtn.addEventListener('click', () => {
        console.log("Popup: Autofill Page button clicked.");
        if (!activeProfile || !activeProfile.firstName) { // Check if profile data exists
            // --- USE showStatus ---
            showStatus('Please save your profile information first.', 'warning', 5000); // Show for longer
            // --- END USE showStatus ---
            return; // Stop if no profile data
        }

        // --- USE showStatus ---
        showStatus('Scanning page for forms...', 'info'); // Use the general status area
        // --- END USE showStatus ---

        sendMessageToContentScript({ action: 'fillForm', profile: activeProfile })
            .then(response => {
                console.log("Popup: Fill form response received:", response);
                if (response && response.formData && Object.keys(response.formData).length > 0) {
                    // Content script responded with data it attempted to fill
                    formPreviewData = response.formData; // Store this data
                    // Show the preview overlay for user confirmation
                    displayFieldPreview(formPreviewData);
                    // --- USE showStatus ---
                    showStatus('Fields found and filled. Review and confirm on the page.', 'success', 5000);
                    // --- END USE showStatus ---
                } else {
                    // No fields were detected or filled with the profile data
                    formPreviewData = null; // Clear preview data
                    hideFieldPreview(); // Ensure preview is hidden if it was shown
                    // --- USE showStatus ---
                    showStatus('No recognizable fields could be filled on this page with your profile data.', 'warning', 5000);
                    // --- END USE showStatus ---
                }
            })
            .catch(error => {
                // sendMessageToContentScript already handles showing error status using showStatus
                console.error("Popup: Error sending fill message:", error);
                formPreviewData = null;
                hideFieldPreview();
                // Error status is shown by sendMessageToContentScript's catch
                // showStatus('Error attempting autofill.', 'error', 5000); // Redundant if sendMessageToContentScript handles it
                // Ensure button is disabled if content script is unreachable
                getCurrentTabStatus(); // Re-check status
            });
    });

    // Check if helpBtn exists before adding listener
    if (helpBtn) helpBtn.addEventListener('click', () => { showHelpModal(); }); // Help button in the footer

    const openBulkButton = document.getElementById('openBulkAutofill');
    if (openBulkButton) {
        openBulkButton.addEventListener('click', () => {
            // Get the full URL to your bulk_autofill.html within the extension
            const bulkAutofillUrl = chrome.runtime.getURL('bulk_autofill.html');
            chrome.tabs.create({ url: bulkAutofillUrl });
        });
    }

    // Add listener for the options link
    if (openOptionsLink) {
        openOptionsLink.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default link behavior
            chrome.runtime.openOptionsPage(); // Open the options page
        });
    }

    console.log("Popup: All event listeners set up.");

}

/** Hides all main content views. */
function hideAllViews() {
    const views = document.querySelectorAll('.view');
    views.forEach(view => {
        view.classList.remove('active');
    });
    const tabButtons = document.querySelectorAll('.view-switcher .tab-button');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
}

/** Shows the Profile view. */
function showProfileView() {
    console.log("Popup: Showing Profile view.");
    hideAllViews();
    if (profileView) profileView.classList.add('active');
    if (profileViewBtn) profileViewBtn.classList.add('active');
    // Ensure profile data is loaded into the form when showing the profile view
    loadProfileDataIntoForm(activeProfile);
    // Reset status when changing views
    // --- USE showStatus ---
    showStatus('Ready.', 'info'); // Use general status area
    // --- END USE showStatus ---
}

/** Shows the Autofill view. */
function showAutofillView() {
    console.log("Popup: Showing Autofill view.");
    hideAllViews();
    if (autofillView) autofillView.classList.add('active');
    if (autofillViewBtn) autofillViewBtn.classList.add('active');
    // When showing the Autofill view, check the current page status
    getCurrentTabStatus(); // Update status message and button state
}

/**
 * Loads the active profile data into the form fields in the Profile view.
 * @param {Object} profileData - The profile data object.
 */
function loadProfileDataIntoForm(profileData) {
    console.log("Popup: Loading profile data into form.");
    if (!profileData) {
        profileData = DEFAULT_PROFILE; // Use default if none provided
        console.log("Popup: Using default profile data for form.");
    }

    // Check if input elements exist before setting value
    if (profileFirstNameInput) profileFirstNameInput.value = profileData.firstName || '';
    if (profileLastNameInput) profileLastNameInput.value = profileData.lastName || '';
    if (profileEmailInput) profileEmailInput.value = profileData.email || '';
    if (profilePasswordInput) profilePasswordInput.value = profileData.password || '';
    if (profileBirthdayInput) profileBirthdayInput.value = profileData.birthday || '';
    if (profileCountryCode) profileCountryCode.value = profileData.countryCode || '';
    if (profilePhoneInput) profilePhoneInput.value = profileData.phone || '';
    if (profileAddressInput) profileAddressInput.value = profileData.address || '';
    if (profileCityInput) profileCityInput.value = profileData.city || '';
    if (profileStateInput) profileStateInput.value = profileData.state || '';
    if (profileZipInput) profileZipInput.value = profileData.zip || '';

    console.log("Popup: Profile form fields updated.");
}

/**
 * Saves the data from the Profile form fields into the activeProfile variable
 * and persists it in Chrome Storage.
 */
function saveProfileFromForm() {
    console.log("Popup: Saving profile data from form.");
    if (!profileForm) {
        console.error("Popup: Profile form element not found.");
        // --- USE showStatus ---
        showStatus('Error: Profile form missing.', 'error');
        // --- END USE showStatus ---
        return;
    }

    // Create a new profile object from the current form values
    const updatedProfile = {
        firstName: profileFirstNameInput ? profileFirstNameInput.value.trim() : '',
        lastName: profileLastNameInput ? profileLastNameInput.value.trim() : '',
        email: profileEmailInput ? profileEmailInput.value.trim() : '',
        password: profilePasswordInput ? profilePasswordInput.value.trim() : '',
        birthday: profileBirthdayInput ? profileBirthdayInput.value : '', // Date input value isYYYY-MM-DD
        countryCode: profileCountryCode ? profileCountryCode.value.trim() : '',
        phone: profilePhoneInput ? profilePhoneInput.value.trim() : '',
        address: profileAddressInput ? profileAddressInput.value.trim() : '',
        city: profileCityInput ? profileCityInput.value.trim() : '',
        state: profileStateInput ? profileStateInput.value.trim() : '',
        zip: profileZipInput ? profileZipInput.value.trim() : '',
        // Add other fields here
    };

    const validationResult = validateFormData(updatedProfile); // Call the validation function
    if (!validationResult.valid) {
        console.warn("Popup: Profile validation failed:", validationResult.errors);
        // Display validation errors to the user
        let errorMessage = 'Validation errors:';
        for (const field in validationResult.errors) {
            errorMessage += ` ${field.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} - ${validationResult.errors[field]};`;
        }
        // Use showStatus or update specific error elements
        showStatus(errorMessage, 'warning', 8000); // Show validation errors as warnings for longer
        // Consider adding specific error messages next to each field input
        return; // Stop the save process if validation fails
    }
    // --- End Add Validation Call ---


    // If validation passed:
    activeProfile = updatedProfile;
    console.log("Popup: Active profile updated in memory:", activeProfile);

    chrome.storage.sync.set({ profile: activeProfile }, () => {
        console.log("Popup: Profile saved to storage.");
        showStatus('Profile saved successfully!', 'success', 3000);
    });

}

// --- Settings Management ---

/**
 * Saves updated settings to Chrome Storage.
 * @param {Object} updatedSettings - Partial object with settings to update.
 */
function saveSettings(updatedSettings) {
    console.log("Popup: Saving settings:", updatedSettings);
    // Get current settings first to merge
    chrome.storage.sync.get('settings', (data) => {
        const currentSettings = data.settings || DEFAULT_SETTINGS;
        const newSettings = { ...currentSettings, ...updatedSettings };

        chrome.storage.sync.set({ settings: newSettings }, () => {
            console.log("Popup: Settings saved.", newSettings);

            if (updatedSettings.hasOwnProperty('autofillHighlightEnabled') || updatedSettings.hasOwnProperty('highContrast')) {
                console.log("Popup: Sending updated settings affecting content script.");
                // Message all tabs - content script in each tab decides if it needs the setting
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        // Include all settings content script might need
                        // Use chrome.tabs.sendMessage directly, catching potential errors if content script isn't there
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'setInitialSettings', // Re-using initial settings action to send settings
                            settings: newSettings,
                            activeProfile: activeProfile // Also send profile as content script needs it for highlighting if auto-highlighting is on
                        }).catch(() => {
                            // Ignore error if content script not in this tab
                        });
                    });
                });
            }
        });
    });
}

/**
 * Applies or removes the high contrast CSS class to the body.
 * @param {boolean} enabled - True to enable high contrast, false to disable.
 */
function applyHighContrast(enabled) {
    if (!document.body) {
        console.error("Popup: Document body not available to apply high contrast.");
        return;
    }
    if (enabled) {
        document.body.classList.add('high-contrast');
    } else {
        document.body.classList.remove('high-contrast');
    }
    console.log("Popup: High contrast mode applied:", enabled);
}

/**
 * Gets the CSS font size value based on the setting name.
 * Note: Font size selector is removed in simplified UI, keep this function if needed elsewhere.
 * @param {string} sizeSetting - The font size setting name ('normal', 'large', 'x-large').
 * @returns {string} The corresponding CSS font size value.
 */
// This function is likely not used in the current simplified UI, but kept if needed elsewhere
// function getFontSizeValue(sizeSetting) {
//     switch (sizeSetting) {
//         case 'large': return '18px'; // Example values, match your CSS
//         case 'x-large': return '22px'; // Example values, match your CSS
//         case 'normal': // Fall through
//         default: return '14px'; // Default base font size for popup
//     }
// }


/**
 * Displays a status message in the popup UI.
 * @param {string} message - The message text.
 * @param {'info'|'success'|'warning'|'error'} type - The type of status.
 * @param {number} duration - How long to show the message in milliseconds.
 */
// --- ADD THE CORRECT showStatus function ---
let statusTimeoutId = null; // Define statusTimeoutId in a scope accessible by showStatus

function showStatus(message, type = 'info', duration = 3000) {
    console.log(`Popup Status [${type.toUpperCase()}]: ${message}`);
    // Check if status elements exist
    if (!statusTextElement || !statusContainer) {
        console.error("Popup status elements not found!");
        return;
    }

    // Set text and type class
    statusTextElement.textContent = message;
    statusContainer.className = 'status-container'; // Reset classes
    statusContainer.classList.add(type); // Add type class for styling

    // Determine and set icon (optional - requires statusIconElement)
    if (statusIconElement) {
        switch (type) {
            case 'success': statusIconElement.textContent = '✅'; break; // Checkmark
            case 'error': statusIconElement.textContent = '❌'; break;   // Cross mark
            case 'warning': statusIconElement.textContent = '⚠️'; break; // Warning sign
            case 'info': statusIconElement.textContent = 'ℹ️'; break;    // Info sign (or '💬' for message)
            default: statusIconElement.textContent = ''; // No icon for unknown types
        }
    } else {
        // Ensure icon area is cleared if no icon is applicable or element is missing
        const iconSpan = statusContainer.querySelector('.status-icon');
        if (iconSpan) iconSpan.textContent = '';
    }


    // Show message (fade-in via CSS transition on opacity)
    statusContainer.style.opacity = '1';

    // Clear any previous timeout
    if (statusTimeoutId) {
        clearTimeout(statusTimeoutId);
        statusTimeoutId = null; // Clear the ID after clearing the timeout
    }

    // Set timeout to hide message (fade-out via CSS transition)
    statusTimeoutId = setTimeout(() => {
        statusContainer.style.opacity = '0';
        // Optional: Clear text content after fading out for accessibility/cleanliness
        // This waits for the CSS fade-out transition to finish
        statusContainer.addEventListener('transitionend', function clearText(event) {
            if (event.propertyName === 'opacity' && statusContainer.style.opacity === '0') {
                statusTextElement.textContent = '';
                if (statusIconElement) statusIconElement.textContent = ''; // Clear icon as well
                statusContainer.removeEventListener('transitionend', clearText);
            }
        });
    }, duration);
}

/**
 * Sends a message to the content script in the active tab.
 * Handles potential errors if the content script is not available.
 * @param {Object} message - The message payload.
 * @returns {Promise<any>} A promise that resolves with the content script's response.
 */
async function sendMessageToContentScript(message) {
    console.log("Popup: Sending message to content script:", message.action);
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0 || !tabs[0]) {
                console.warn("Popup: No active tab found to send message to.");
                // --- USE showStatus ---
                showStatus('No active tab available.', 'warning', 3000);
                // --- END USE showStatus ---
                // Disable autofill button if no tab
                setAutofillButtonState(false);
                reject(new Error('No active tab'));
                return;
            }
            const tabId = tabs[0].id;

            // Use chrome.tabs.sendMessage and check for runtime errors
            chrome.tabs.sendMessage(tabId, message, (response) => {
                // Check chrome.runtime.lastError to detect if content script failed to respond
                // This happens if content script is not injected or threw an error
                if (chrome.runtime.lastError) {
                    const error = chrome.runtime.lastError;
                    console.error(`Popup: Error sending message to tab ${tabId}:`, error.message);
                    // Depending on the action, show relevant error status
                    let statusMsg = `Error interacting with page.`;
                    if (error.message.includes('Could not establish connection')) {
                        statusMsg = 'Content script not loaded on this page.';
                        // If content script is not there, disable autofill button
                        setAutofillButtonState(false);
                    }
                    // --- USE showStatus ---
                    showStatus(statusMsg, 'error', 5000); // Show errors longer
                    // --- END USE showStatus ---
                    reject(error); // Reject the promise
                } else {
                    console.log(`Popup: Response from content script (tab ${tabId}) for ${message.action}:`, response);
                    resolve(response); // Resolve the promise with the response
                }
            });
        });
    });
}

/**
 * Gets the current form status from the content script and updates UI elements.
 */
function getCurrentTabStatus() {
    console.log("Popup: Getting current tab status from content script.");
    // Reset status display while checking
    // --- USE showStatus ---
    showStatus('Checking page status...', 'info');
    // --- END USE showStatus ---

    // Request status from content script
    sendMessageToContentScript({ action: 'getFormStatus' })
        .then(response => {
            console.log("Popup: Received form status:", response);
            if (response && response.formDetected !== undefined) {
                // Update UI based on response
                if (response.formDetected) {
                    // --- USE showStatus ---
                    showStatus(`Form detected with ${response.fieldCount} fields.`, 'info');
                    // --- END USE showStatus ---
                    // Enable Autofill button IF a profile is loaded AND form is detected
                    setAutofillButtonState(!!activeProfile && !!activeProfile.firstName);

                } else {
                    // --- USE showStatus ---
                    showStatus('No form detected on this page.', 'info');
                    // --- END USE showStatus ---
                    // Disable Autofill button if no form is detected
                    setAutofillButtonState(false);
                }
            } else {
                // Handle cases where response is malformed but no chrome.runtime.lastError
                console.warn("Popup: Received unexpected status response:", response);
                // --- USE showStatus ---
                showStatus('Could not determine page status.', 'warning', 5000);
                // --- END USE showStatus ---
                setAutofillButtonState(false); // Disable button conservatively
            }
        })
        .catch(error => {
            // sendMessageToContentScript already handles showing error status using showStatus
            console.log("Popup: getCurrentTabStatus caught error from sendMessageToContentScript.");
            // Button would have been disabled by sendMessageToContentScript error handling
        });
}

/**
 * Helper function to set the disabled state of the main autofill button.
 * @param {boolean} enable - True to enable, False to disable.
 */
function setAutofillButtonState(enable) {
    if (triggerAutofillBtn) {
        triggerAutofillBtn.disabled = !enable;
        console.log("Popup: Autofill button enabled state set to:", enable);
    } else {
        console.error("Popup: Autofill button element not found!");
    }
}

/**
 * Gets the URL of the currently active tab.
 * @returns {Promise<string>} A promise that resolves with the current tab's URL.
 */
async function getCurrentTabUrl() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0 && tabs[0].url) {
                resolve(tabs[0].url);
            } else {
                console.warn("Popup: Could not get current tab URL.");
                reject(new Error('Could not get active tab URL'));
            }
        });
    });
}

/**
 * Applies the loaded settings to the popup's UI.
 * @param {Object} settings - The settings object.
 */
function applySettings(settings) {
    console.log("Popup: Applying settings to UI.", settings);

    // Apply high contrast setting to the toggle and the body
    if (highContrastToggle) {
        highContrastToggle.checked = settings.highContrast;
        applyHighContrast(settings.highContrast);
    }

    // Apply autofill highlight setting to the toggle
    if (autofillHighlightToggle) {
        autofillHighlightToggle.checked = settings.autofillHighlightEnabled;
    }
}

/**
 * Applies or removes the high contrast CSS class to the body.
 * @param {boolean} enabled - True to enable high contrast, false to disable.
 */
function applyHighContrast(enabled) {
    if (!document.body) {
        console.error("Popup: Document body not available to apply high contrast.");
        return;
    }
    if (enabled) {
        document.body.classList.add('high-contrast');
    } else {
        document.body.classList.remove('high-contrast');
    }
    console.log("Popup: High contrast mode applied:", enabled);
}


/**
 * Displays the field preview overlay with data from the fill process.
 * @param {Object} formData - Object containing the field types and values that were filled.
 */
function displayFieldPreview(formData) {
    if (!fieldPreviewTemplate) {
        console.error("Popup: Field preview template not found!");
        // Fallback: show a status message instead of overlay
        // --- USE showStatus ---
        showStatus('Field preview not available, review fields on page.', 'warning', 5000);
        // --- END USE showStatus ---
        // Also decide how submission happens if no preview (manual?)
        return;
    }
    console.log("Popup: Displaying field preview.", formData);

    // Remove any existing preview overlay to avoid duplicates
    const existingPreview = document.querySelector('.field-preview-overlay');
    if (existingPreview) {
        existingPreview.remove();
    }

    // Clone the template content
    const previewOverlay = fieldPreviewTemplate.content.cloneNode(true).firstElementChild;

    // Get references to elements within the cloned template
    const fieldList = previewOverlay.querySelector('.field-list');
    const closeBtn = previewOverlay.querySelector('.close-preview');
    const cancelBtn = previewOverlay.querySelector('.cancel-fill'); // Corrected class
    const confirmBtn = previewOverlay.querySelector('.confirm-fill'); // Corrected class text to Confirm & Submit
    fieldList.innerHTML = '';

    // Populate the field list with the data that was filled
    if (formData && Object.keys(formData).length > 0) {
        for (const fieldType in formData) {
            if (formData.hasOwnProperty(fieldType)) {
                const fieldItem = document.createElement('div');
                fieldItem.className = 'field-item';

                const fieldName = document.createElement('div');
                fieldName.className = 'field-name';
                // Format the field type name nicely (e.g., "firstName" -> "First Name")
                fieldName.textContent = fieldType.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase());

                const fieldValue = document.createElement('div');
                fieldValue.className = 'field-value';
                const value = formData[fieldType];
                fieldValue.textContent = (value === '' || value === null || value === undefined) ? '[Empty]' : value;

                fieldItem.appendChild(fieldName);
                fieldItem.appendChild(fieldValue);
                fieldList.appendChild(fieldItem);
            }
        }
    } else {
        // Handle case where no fields were filled but preview was still shown (shouldn't happen with current logic)
        const noFieldsMessage = document.createElement('div');
        noFieldsMessage.textContent = 'No recognizable fields were filled.';
        noFieldsMessage.style.fontStyle = 'italic';
        noFieldsMessage.style.color = '#666';
        fieldList.appendChild(noFieldsMessage);
        // Disable confirm button if nothing was filled
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'No fields to confirm';
            confirmBtn.classList.remove('btn-primary');
            confirmBtn.classList.add('btn-secondary');
        }
    }

    if (closeBtn) closeBtn.addEventListener('click', () => { hideFieldPreview(); });
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
        console.log("Popup: Field preview cancelled.");
        hideFieldPreview(); // Hide the overlay
        // --- USE showStatus ---
        showStatus('Autofill cancelled.', 'info', 3000); // Use general status area
        // --- END USE showStatus ---
    });
    if (confirmBtn) confirmBtn.addEventListener('click', (event) => {
        // This button triggers the actual form submission message
        handleConfirmFillClick(event);
    });

    // Add the populated overlay to the body
    document.body.appendChild(previewOverlay);

    // Make the element visible (but still off-screen due to transform) immediately
    // This is necessary for the CSS 'transform' transition to work from 'display: none'
    previewOverlay.style.display = 'block';


    // Add 'active' class to trigger CSS transition (slide-in effect)
    // Use a slight timeout to ensure the element is added to the DOM before transition
    setTimeout(() => {
        if (previewOverlay) { // Check exists before adding class
            previewOverlay.classList.add('active');
            console.log("Popup: Field preview overlay should now be visible.");
        }
    }, 10); // Small delay
}

function hideFieldPreview() {
    console.log("Popup: Hiding field preview.");
    const previewOverlay = document.querySelector('.field-preview-overlay');
    if (previewOverlay) {
        // Trigger CSS transition (slide-out effect)
        previewOverlay.classList.remove('active');

        // Listen for the end of the transition to remove the element
        // Use a named function or check the element's parent to avoid issues if element is removed quickly
        previewOverlay.addEventListener('transitionend', function handler(event) {
            // Ensure the event is for the transform property and the element is still in the DOM
            if (event.propertyName === 'transform' && document.body.contains(previewOverlay) && !previewOverlay.classList.contains('active')) {
                previewOverlay.style.display = 'none'; // Hide element from layout
                previewOverlay.remove(); // Remove from DOM
                formPreviewData = null; // Clear stored data
                console.log("Popup: Field preview element hidden and removed after transition.");
            }
            previewOverlay.removeEventListener('transitionend', handler);
        });
    }
}

function handleConfirmFillClick(event) {
    console.log("Popup: Confirm & Submit button clicked.");
    // Prevent default button behavior if it's inside a form (though this is a template)
    if (event) event.preventDefault();

    // Hide the preview overlay immediately
    hideFieldPreview();

    // Send the submit message to the content script
    // --- USE showStatus ---
    showStatus('Attempting to submit form...', 'info'); // Show status while waiting for submit response
    // --- END USE showStatus ---
    sendMessageToContentScript({ action: 'submitForm' })
        .then(response => {
            console.log("Popup: Submit form response received:", response);
            // Handle response: success, captcha detected, hasBirthdayField etc.
            if (response && response.success) {
                // Submission attempted successfully (doesn't guarantee server success)
                // --- USE showStatus ---
                showStatus('Form submission attempted.', 'success', 5000);
                // --- END USE showStatus ---
                // Add tracker entry if submission was attempted (and not blocked by captcha)
                // Need addTrackerEntry function from utils or background script
                // Assuming addTrackerEntry is available or sent to background
                // if (!response.captchaDetected) {
                //     getCurrentTabUrl().then(url => {
                //       // Assuming the content script response includes whether a birthday field was found on the page
                //       addTrackerEntry(url, response.hasBirthdayField, response.captchaDetected);
                //     });
                // }


            } else if (response && response.captchaDetected) {
                // CAPTCHA was detected by the content script and submission was aborted by content script
                // --- USE showStatus ---
                showStatus('CAPTCHA detected. Please submit manually on the page.', 'warning', 8000); // Longer duration
                // --- END USE showStatus ---
                // Still add tracker entry, noting captcha was detected
                // Assuming addTrackerEntry is available or sent to background
                // getCurrentTabUrl().then(url => {
                //     addTrackerEntry(url, response.hasBirthdayField || false, true); // Mark as captcha detected
                // });


            } else {
                // Submission failed for other reasons (e.g., no form/button found by content script)
                // --- USE showStatus ---
                showStatus('Could not submit form automatically.', 'error', 8000); // Longer duration
                // --- END USE showStatus ---
                // Decide if you want to track failed attempts or just successful attempts (or attempts not blocked by captcha)
            }
            // Re-check status after potential submission
            getCurrentTabStatus(); // This will update based on new page state or report if content script is gone
        })
        .catch(error => {
            // sendMessageToContentScript already handles showing error status and disabling button
            console.error("Popup: Error sending submit message:", error);
            // Error status is shown by sendMessageToContentScript's catch
            // showStatus('Error during form submission.', 'error', 8000); // Redundant
            getCurrentTabStatus(); // Re-check status
        });
}

function showHelpModal() {
    if (!helpModalTemplate) {
        console.error("Popup: Help modal template not found!");
        // Use generic status if help is unavailable
        // --- USE showStatus ---
        showStatus('Help content not available.', 'warning', 3000);
        // --- END USE showStatus ---
        return;
    }
    console.log("Popup: Showing help modal.");

    // Remove any existing modal
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    // Clone the template
    const modalOverlay = helpModalTemplate.content.cloneNode(true).firstElementChild;

    // Get the close button inside the modal
    const closeBtn = modalOverlay.querySelector('.close-modal');

    // Add event listener to close button
    if (closeBtn) closeBtn.addEventListener('click', () => {
        console.log("Popup: Help modal closed.");
        modalOverlay.classList.remove('active'); // Trigger fade out
        // Remove element after transition or immediately if no transition
        modalOverlay.addEventListener('transitionend', function handler() {
            if (!modalOverlay.classList.contains('active')) {
                modalOverlay.remove();
                console.log("Popup: Help modal element removed from DOM.");
            }
            modalOverlay.removeEventListener('transitionend', handler);
        });
        // Fallback for removal if transitionend doesn't fire
        // --- FIXED INCOMPLETE SETTIMEOUT ---
        setTimeout(() => { if (document.body.contains(modalOverlay)) modalOverlay.remove(); }, 400); // Fixed closing parenthesis and block
        // --- END FIXED ---
    });

    // Add the modal to the body
    document.body.appendChild(modalOverlay);

    // Add 'active' class to trigger CSS transition (fade-in effect)
    // Use a slight timeout to ensure the element is added to the DOM before transition
    setTimeout(() => {
        if (modalOverlay) { // Check exists before adding class
            modalOverlay.classList.add('active');
            console.log("Popup: Help modal overlay should now be visible.");
        }
    }, 10); // Small delay
}

// --- Placeholder/To Be Implemented (Simplified) ---
// Profile management is simplified to saving/loading a single profile from the form.
// Tracker is removed.
// Full settings page is removed, only toggles in Autofill view.
// Custom keywords feature is removed in this simplification, identifyFieldType will use its defaults + any base keywords.

// --- Assuming addTrackerEntry is handled elsewhere (e.g., background script or utils.js) ---
// If addTrackerEntry was defined here or used functions that were removed, it might cause errors.
// For now, assuming addTrackerEntry comes from utils.js or is a message to background.
// function addTrackerEntry(domain, birthdayFieldDetected, captchaDetected = false) { ... }

// Assuming you don't need this for the simplified UI:
// function getFontSizeValue(sizeSetting) { ... }

// --- Self-invoking function end ---
// No IIFE needed in modern ES Modules