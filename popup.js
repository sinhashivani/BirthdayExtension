// popup.js
// Controls the UI and logic of the extension's browser action popup.

// Import necessary functions from utils.js
import {
    exportToCSV, // For exporting tracker data
    exportToJSON, // For exporting tracker data
} from "./utils.js";

// --- DOM Elements ---
// Get references to all interactive elements and views from popup.html
const profileSelect = document.getElementById('profileSelect'); // Corrected ID
const autofillToggle = document.getElementById('autofillToggle'); // Corrected ID
const manualOverrideToggle = document.getElementById('manual-override-toggle');
const highContrastToggle = document.getElementById('high-contrast-toggle');
const fontSizeSelector = document.getElementById('font-size-selector');
const scanPageBtn = document.getElementById('scanPageBtn'); // Corrected ID
const fillFormsBtn = document.getElementById('fillFormsBtn'); // Corrected ID
const resetFormsBtn = document.getElementById('resetFormsBtn'); // Corrected ID
const settingsBtn = document.getElementById('settingsBtn'); // Corrected ID
const backBtn = document.getElementById('backBtn'); // Corrected ID
const manageProfilesBtn = document.getElementById('manageProfilesBtn'); // Corrected ID
const viewTrackerBtn = document.getElementById('viewTrackerBtn'); // Corrected ID
const exportTrackerBtnElement = document.getElementById('exportTrackerBtn'); // Corrected ID
const exportFormatSelect = document.getElementById('exportFormatSelect'); // Corrected ID
const deleteDataBtn = document.getElementById('deleteDataBtn'); // Corrected ID
const addProfileBtn = document.getElementById('addProfileBtn'); // Corrected ID
const saveSettingsBtn = document.getElementById('saveSettingsBtn'); // Corrected ID
const helpBtn = document.getElementById('helpBtn'); // Corrected ID

// References to the main view containers
const mainView = document.getElementById('main-view');
const settingsView = document.getElementById('settings-view');
const trackerView = document.getElementById('tracker-view');
const profileManagerView = document.getElementById('profile-manager-view'); // Corrected ID

// References for status display
const statusContainer = document.getElementById('statusContainer'); // Corrected ID
const statusTextElement = document.getElementById('statusTextElement'); // Corrected ID

// References for tracker overview stats
const totalSubmissionsSpan = document.getElementById('totalSubmissions');
const birthdayFieldsSpan = document.getElementById('birthdayFields');
const successRateSpan = document.getElementById('successRate');
const trackerBody = document.getElementById('trackerBody'); // Corrected ID for table body

// References for settings view
const customKeywordsInput = document.getElementById('customKeywordsInput'); // Corrected ID

// References for profile manager view (form fields will be dynamic or in templates)
// Example field reference if you have a form:
// const profileFormFirstName = document.getElementById('form-firstName');


// --- Templates ---
const fieldPreviewTemplate = document.getElementById('fieldPreviewTemplate');
const helpModalTemplate = document.getElementById('helpModalTemplate');

// --- Default Data ---
const DEFAULT_SETTINGS = {
    autofillEnabled: true, // Default to active
    manualOverride: false,
    fontSize: 'normal',
    highContrast: false,
    customKeywords: {}, // Use object for keywords by type if needed, or array if simple list
    dataValidation: true, // Setting to control validation in popup/content script
};

const DEFAULT_PROFILE = {
    firstName: '',
    lastName: '',
    email: '',
    birthday: '', // YYYY-MM-DD format expected by <input type="date"> and content script
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
};

// --- State Variables ---
let activeProfile = null; // Stores the currently selected profile data
let allProfiles = {}; // Stores all saved profiles
let trackerData = []; // Stores the tracker entries
let formPreviewData = null; // Stores data for the field preview overlay


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

    // Load settings, profiles, active profile, and tracker data concurrently
    chrome.storage.sync.get(['settings', 'profiles', 'activeProfile', 'trackerData'], (data) => {
        console.log("Popup: Loaded data from storage:", data);

        // Load and apply settings
        const settings = data.settings || DEFAULT_SETTINGS;
        applySettings(settings);

        // Load and update profiles selector
        allProfiles = data.profiles || {};
        updateProfileSelector(allProfiles);

        // Load active profile
        const activeProfileId = data.activeProfile;
        if (activeProfileId && allProfiles[activeProfileId]) {
            profileSelect.value = activeProfileId;
            activeProfile = allProfiles[activeProfileId];
            console.log("Popup: Active profile loaded:", activeProfile);
            // If you have a profile form in the popup, load data into it:
            // loadProfileDataIntoForm(activeProfile);
        } else {
            // No active profile or profile not found, set to default and update selector
            activeProfile = DEFAULT_PROFILE;
            profileSelect.value = ""; // Ensure select shows default option
            chrome.storage.sync.remove('activeProfile'); // Clear invalid active profile ID
            console.log("Popup: No active profile found, using default.");
        }

        // Load and update tracker data display
        trackerData = data.trackerData || [];
        updateTrackerUI(trackerData); // Update both table and overview stats

        // After loading data and setting up UI, get status from the current tab
        getCurrentTabStatus();
    });
}

/**
 * Set up event listeners for all interactive popup elements.
 */
function setupEventListeners() {
    console.log("Popup: Setting up event listeners.");

    // --- View Switching ---
    settingsBtn.addEventListener('click', () => { showSettingsView(); });
    backBtn.addEventListener('click', () => { showMainView(); });
    manageProfilesBtn.addEventListener('click', () => { showProfileManagerView(); });
    viewTrackerBtn.addEventListener('click', () => { showTrackerView(); });
    helpBtn.addEventListener('click', () => { showHelpModal(); });

    // --- Profile Management ---
    profileSelect.addEventListener('change', (e) => {
        const selectedProfileId = e.target.value;
        activeProfile = allProfiles[selectedProfileId] || DEFAULT_PROFILE;
        chrome.storage.sync.set({ activeProfile: selectedProfileId }, () => {
            console.log("Popup: Active profile set to", selectedProfileId);
            // If you have a profile form in the popup, load data into it:
            // loadProfileDataIntoForm(activeProfile);
            // Update status based on whether a profile is selected
            getCurrentTabStatus(); // Re-evaluate button states etc.
        });
    });
    addProfileBtn.addEventListener('click', () => {
        // Placeholder: Implement logic to show add profile form/modal
        console.log("Popup: Add Profile button clicked. (Profile adding logic needs implementation)");
        showStatus('Profile adding feature not fully implemented yet.', 'info');
        // Example: showProfileFormForNew();
    });
    // Event listeners for saving/editing/deleting profiles would go here
    // based on your profile management UI.

    // --- Autofill Controls ---
    autofillToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        console.log("Popup: Autofill toggle changed to", isEnabled);
        chrome.storage.sync.set({ autofillEnabled: isEnabled }, () => {
            // Message content script to update its state
            sendMessageToContentScript({ action: 'toggleAutofill', isActive: isEnabled });
            showStatus(`Autofill ${isEnabled ? 'enabled' : 'disabled'}`, 'info');
            getCurrentTabStatus(); // Update button states etc.
        });
    });

    manualOverrideToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        console.log("Popup: Manual override toggle changed to", isEnabled);
        chrome.storage.sync.set({ manualOverride: isEnabled }, () => {
            // Message content script (and maybe background) to update this setting
            sendMessageToContentScript({ action: 'setManualOverride', enabled: isEnabled });
            showStatus(`Manual Override ${isEnabled ? 'enabled' : 'disabled'}`, 'info');
            // Manual override might disable auto-highlighting or change fill behavior
            // The content script needs to handle this logic.
            getCurrentTabStatus(); // Update button states etc.
        });
    });

    // --- Form Actions ---
    scanPageBtn.addEventListener('click', () => {
        console.log("Popup: Scan Page button clicked.");
        showStatus('Scanning page for forms...', 'info');
        // Message content script to detect and highlight forms
        sendMessageToContentScript({ action: 'detectAndHighlightForms' })
            .then(response => {
                console.log("Popup: Scan response received:", response);
                if (response && response.formDetected) {
                    showStatus(`Form detected with ${response.fieldCount} fields`, 'success');
                    // If manual override is NOT enabled, maybe trigger fill/preview automatically?
                    // Based on current flow, Fill button is clicked manually after scan.
                } else {
                    showStatus('No form detected on this page', 'info');
                }
                // Ensure buttons are enabled/disabled based on scan result
                getCurrentTabStatus(); // This re-checks status after scan
            })
            .catch(error => {
                console.error("Popup: Error sending scan message:", error);
                showStatus('Error scanning page.', 'error');
                // If content script is not available, getCurrentTabStatus will handle button state
                getCurrentTabStatus(); // Re-check status to potentially disable buttons
            });
    });


    fillFormsBtn.addEventListener('click', () => {
        console.log("Popup: Fill Forms button clicked.");
        if (!activeProfile || !activeProfile.firstName) { // Check if a profile is loaded/valid
            showStatus('Please select or create a profile first.', 'warning');
            return; // Stop if no profile
        }

        showStatus('Attempting to fill form...', 'info');
        // Message content script to fill the form with the active profile data
        sendMessageToContentScript({ action: 'fillForm', profile: activeProfile })
            .then(response => {
                console.log("Popup: Fill form response received:", response);
                if (response && response.formData && Object.keys(response.formData).length > 0) {
                    formPreviewData = response.formData; // Store the data that was filled
                    // Show the preview overlay with the filled data
                    displayFieldPreview(formPreviewData);
                    showStatus('Fields filled. Review and confirm.', 'success');
                } else {
                    formPreviewData = null; // Clear preview data
                    // Hide any visible preview overlay
                    hideFieldPreview();
                    showStatus('No fields could be filled with the current profile.', 'warning');
                }
                // Re-check status to potentially enable/disable buttons based on detection
                getCurrentTabStatus();
            })
            .catch(error => {
                console.error("Popup: Error sending fill message:", error);
                showStatus('Error attempting to fill form.', 'error');
                formPreviewData = null;
                hideFieldPreview();
                // Re-check status to potentially disable buttons
                getCurrentTabStatus();
            });
    });

    resetFormsBtn.addEventListener('click', () => {
        console.log("Popup: Reset Forms button clicked.");
        showStatus('Resetting form fields...', 'info');
        // Message content script to reset/clear forms
        sendMessageToContentScript({ action: 'resetForms' })
            .then(response => {
                console.log("Popup: Reset response received:", response);
                if (response && response.success) {
                    showStatus('Form fields reset.', 'success');
                } else {
                    showStatus('Could not reset form fields.', 'error');
                }
                // Re-check status
                getCurrentTabStatus();
            })
            .catch(error => {
                console.error("Popup: Error sending reset message:", error);
                showStatus('Error resetting form.', 'error');
                getCurrentTabStatus();
            });
    });


    // --- Submission ---
    // Note: The "Confirm & Fill" button in the preview overlay triggers the actual submission message.
    // The submitFormBtn in the HTML is not directly used in this flow. Let's remove its listener or hide it.
    // Based on popup.html, submitFormBtn is NOT in the main view. It seems removed from the main view flow.
    // The only "submit" action button visible initially is part of the preview template.
    // Let's assume the flow is Scan -> Fill (shows preview) -> Confirm on Preview -> Submit.
    // If submitFormBtn was intended to be a separate button, clarify where it is.
    // Assuming the submit happens from the preview overlay:
    // submitFormBtn.addEventListener('click', () => { ... }); // Remove or adjust if needed


    // --- Tracker Management ---
    // Export data button trigger the export dialog
    exportTrackerBtnElement.addEventListener('click', () => {
        console.log("Popup: Export Data button clicked.");
        showExportDialog(); // Show the export format selection dialog
    });

    // Delete data button
    deleteDataBtn.addEventListener('click', () => {
        console.log("Popup: Delete Data button clicked.");
        if (confirm('Are you sure you want to delete ALL tracker data? This cannot be undone.')) {
            chrome.storage.sync.remove('trackerData', () => {
                console.log("Popup: Tracker data cleared.");
                showStatus('All tracker data deleted.', 'success');
                trackerData = []; // Clear local data
                updateTrackerUI(trackerData); // Update UI
            });
        }
    });

    // --- Settings Management ---
    saveSettingsBtn.addEventListener('click', () => {
        console.log("Popup: Save Settings button clicked.");
        saveCustomSettings();
    });

    fontSizeSelector.addEventListener('change', (e) => {
        console.log("Popup: Font size changed to", e.target.value);
        // Apply changes immediately to popup UI
        document.documentElement.style.fontSize = getFontSizeValue(e.target.value);
        // Save settings (combine with other settings before saving)
        saveSettings({ fontSize: e.target.value }); // Use a helper to save specific settings
    });

    highContrastToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        console.log("Popup: High contrast toggle changed to", isEnabled);
        // Apply changes immediately to popup UI
        applyHighContrast(isEnabled);
        // Save settings
        saveSettings({ highContrast: isEnabled }); // Use a helper to save specific settings
    });

    // Add listeners for buttons within dynamically created elements (like templates)
    // These listeners need to be attached when the elements are created and added to the DOM.
    // The functions that create these elements (e.g., displayFieldPreview, showConsentDialog, showExportDialog, showHelpModal)
    // should contain the logic to attach these listeners.

    console.log("Popup: All event listeners set up.");
}

// --- View Management Functions ---

function hideAllViews() {
    const views = document.querySelectorAll('.view');
    views.forEach(view => {
        view.classList.remove('active');
    });
    // Also hide the back button when returning to a main view
    backBtn.style.display = 'none';
}

function showMainView() {
    console.log("Popup: Showing main view.");
    hideAllViews();
    mainView.classList.add('active');
    // No back button needed on the main view
    backBtn.style.display = 'none';
    // Re-check status when returning to main view? Or rely on initial check.
    getCurrentTabStatus(); // Refresh status display
}

function showSettingsView() {
    console.log("Popup: Showing settings view.");
    hideAllViews();
    settingsView.classList.add('active');
    backBtn.style.display = 'block'; // Show back button

    // Load custom keywords into the textarea when showing settings
    chrome.storage.sync.get('settings', (data) => {
        const settings = data.settings || DEFAULT_SETTINGS;
        // customKeywordsInput might be null if element ID was wrong, check exists
        if (customKeywordsInput && settings.customKeywords) {
            // Assume customKeywords are stored as an array of strings
            // Convert array back to comma-separated string for textarea
            customKeywordsInput.value = Object.entries(settings.customKeywords)
                .map(([type, keywords]) => `${type}:${keywords.join(',')}`)
                .join('; '); // Example format: firstName:fname,first; email:e-mail
            // Or if stored as a flat array:
            // customKeywordsInput.value = settings.customKeywords.join(', '); // Simpler if just a flat list
            // Choose the format that matches how you save them in saveCustomSettings
        }
    });
}

function showTrackerView() {
    console.log("Popup: Showing tracker view.");
    hideAllViews();
    trackerView.classList.add('active');
    backBtn.style.display = 'block'; // Show back button
    // Refresh tracker data table when showing this view
    loadTrackerData();
}

function showProfileManagerView() {
    console.log("Popup: Showing profile manager view.");
    hideAllViews();
    profileManagerView.classList.add('active'); // Assuming profileManagerView is the correct ID
    backBtn.style.display = 'block'; // Show back button
    // Logic to display/manage profiles goes here
}

// --- Status Display ---
/**
 * Displays a status message in the popup UI.
 * @param {string} message - The message text.
 * @param {'info'|'success'|'warning'|'error'} type - The type of status.
 * @param {number} duration - How long to show the message in milliseconds.
 */
function showStatus(message, type = 'info', duration = 3000) {
    console.log(`Popup Status [${type.toUpperCase()}]: ${message}`);
    if (!statusTextElement || !statusContainer) {
        console.error("Popup status elements not found!");
        return;
    }

    statusTextElement.textContent = message;
    // Set status container class for styling based on type
    statusContainer.className = 'status-container'; // Reset classes
    statusContainer.classList.add(type);

    // Show message with fade-in effect (CSS transition handles opacity)
    statusContainer.style.opacity = '1';

    // Hide message after duration with fade-out
    setTimeout(() => {
        statusContainer.style.opacity = '0';
        // Optional: Clear message text after fading
        // setTimeout(() => { statusTextElement.textContent = ''; }, 300); // Match CSS transition time
    }, duration);
}

// --- Chrome Storage Interactions ---

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
            // Optionally show a status message here, but typically done by the action that triggers save
            // showStatus('Settings saved', 'success');

            // If custom keywords were saved, message content scripts to update
            if (updatedSettings.hasOwnProperty('customKeywords')) {
                console.log("Popup: Sending updated keywords to content scripts.");
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        // Only send message to tabs where a content script is likely injected
                        // Add a try/catch or check chrome.runtime.lastError
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'updateKeywords',
                            keywords: newSettings.customKeywords // Send the full, saved keywords object/array
                        }).catch(() => {
                            // Ignore error if content script is not in this tab
                            console.log(`Could not send updateKeywords message to tab ${tab.id}.`);
                        });
                    });
                });
            }
        });
    });
}


/**
 * Saves custom keywords from the settings textarea.
 */
function saveCustomSettings() {
    if (!customKeywordsInput) {
        console.error("Popup: Custom keywords input element not found.");
        showStatus('Error: Keywords input missing.', 'error');
        return;
    }
    const keywordsString = customKeywordsInput.value;

    // Parse the keywords string into a usable format (e.g., an object mapping types to arrays of keywords)
    // This parsing logic must match how content.js expects the custom keywords object/array.
    // Example parsing for "firstName:fname,first; email:email,e-mail" format:
    const customKeywords = {};
    keywordsString.split(';').forEach(section => {
        const [type, keywordList] = section.split(':').map(s => s.trim());
        if (type && keywordList) {
            customKeywords[type] = keywordList.split(',').map(k => k.trim()).filter(k => k.length > 0);
        }
    });
    // Example parsing for simple comma-separated list:
    // const keywordsArray = keywordsString.split(',').map(keyword => keyword.trim()).filter(keyword => keyword.length > 0);
    // Decide which format is used and adjust the parsing here and in content.js/utils.js

    // Save the parsed keywords
    saveSettings({ customKeywords: customKeywords }); // Save as object/array

    // The saveSettings function already messages content scripts if customKeywords are updated.
}


/**
 * Loads all profiles from storage and updates the profile selector dropdown.
 */
function loadProfiles() {
    console.log("Popup: Loading profiles...");
    chrome.storage.sync.get('profiles', (data) => {
        allProfiles = data.profiles || {};
        console.log("Popup: Profiles loaded:", allProfiles);
        updateProfileSelector(allProfiles);
        // After loading all profiles, ensure the active profile variable is set if an ID is stored
        chrome.storage.sync.get('activeProfile', (activeData) => {
            if (activeData.activeProfile && allProfiles[activeData.activeProfile]) {
                profileSelect.value = activeData.activeProfile;
                activeProfile = allProfiles[activeData.activeProfile];
                console.log("Popup: Ensured active profile is set:", activeProfile);
            } else {
                activeProfile = DEFAULT_PROFILE;
                profileSelect.value = "";
                chrome.storage.sync.remove('activeProfile');
                console.log("Popup: No valid active profile set, using default.");
            }
            // Update button states based on whether a profile is selected
            getCurrentTabStatus(); // This will check if activeProfile exists
        });
    });
}


/**
 * Updates the HTML select element with the available profiles.
 * @param {Object} profiles - An object where keys are profile IDs and values are profile objects.
 */
function updateProfileSelector(profiles) {
    if (!profileSelect) {
        console.error("Popup: Profile select element not found!");
        return;
    }
    console.log("Popup: Updating profile selector.");
    // Clear existing options except potentially a default placeholder
    profileSelect.innerHTML = '';

    // Add a default "Select a profile" option
    const defaultOption = document.createElement('option');
    defaultOption.value = ""; // Use an empty string value
    defaultOption.textContent = "Select a profile";
    defaultOption.disabled = true; // Make it unselectable after first choice
    defaultOption.selected = true; // Make it the initially selected option
    profileSelect.appendChild(defaultOption);


    // Add an option for each profile
    for (const id in profiles) {
        if (profiles.hasOwnProperty(id)) {
            const profile = profiles[id];
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${profile.firstName || ''} ${profile.lastName || ''} (${id})`; // Display name and ID
            profileSelect.appendChild(option);
        }
    }
    console.log("Popup: Profile selector updated with", Object.keys(profiles).length, "profiles.");
}


/**
 * Loads tracker data from storage and updates the tracker UI.
 */
function loadTrackerData() {
    console.log("Popup: Loading tracker data...");
    chrome.storage.sync.get('trackerData', (data) => {
        trackerData = data.trackerData || [];
        console.log("Popup: Tracker data loaded:", trackerData);
        updateTrackerUI(trackerData); // Update both table and overview stats
    });
}

/**
 * Updates both the tracker table and the overview statistics.
 * @param {Array} data - The tracker data array.
 */
function updateTrackerUI(data) {
    updateTrackerTable(data); // Update the table rows
    updateTrackerOverviewStats(data); // Update the counts and rate
}

/**
 * Updates the HTML table with tracker entries.
 * @param {Array} data - The tracker data array.
 */
function updateTrackerTable(data) {
    if (!trackerBody) {
        console.error("Popup: Tracker table body element not found!");
        return;
    }
    console.log("Popup: Updating tracker table.");
    // Clear existing entries
    trackerBody.innerHTML = '';

    if (data.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 4; // Match the number of columns in the header
        emptyCell.textContent = 'No submissions tracked yet.';
        emptyCell.style.textAlign = 'center';
        emptyRow.appendChild(emptyCell);
        trackerBody.appendChild(emptyRow);
        console.log("Popup: Tracker table set to empty.");
        return;
    }

    // Sort data by date descending (most recent first)
    const sortedData = data.sort((a, b) => b.timestamp - a.timestamp);


    // Add a row for each entry
    sortedData.forEach(entry => {
        const row = document.createElement('tr');

        // Website Domain Cell
        const domainCell = document.createElement('td');
        try {
            // Extract hostname from URL for cleaner display
            const url = new URL(entry.domain);
            domainCell.textContent = url.hostname;
        } catch (e) {
            // Fallback if domain is not a valid URL
            domainCell.textContent = entry.domain;
        }
        row.appendChild(domainCell);

        // Submission Date Cell
        const dateCell = document.createElement('td');
        const entryDate = new Date(entry.timestamp); // Use timestamp from content script
        dateCell.textContent = entryDate.toLocaleDateString(); // Format date
        // Optional: Add tooltip with full date/time
        dateCell.title = entryDate.toLocaleString();
        row.appendChild(dateCell);

        // Birthday Field Status Cell
        const birthdayCell = document.createElement('td');
        birthdayCell.textContent = entry.birthdayFieldDetected ? 'Detected' : 'Not Found';
        // Apply CSS classes for color coding
        birthdayCell.className = entry.birthdayFieldDetected ? 'status-success' : 'status-warning'; // Using classes from popup.css
        // Add visual indicator using ::before pseudo-element via CSS classes
        if (entry.birthdayFieldDetected) {
            birthdayCell.classList.add('status-success'); // Ensure status-success class is there
        } else {
            birthdayCell.classList.add('status-warning'); // Ensure status-warning class is there
        }

        row.appendChild(birthdayCell);

        // Reward Likelihood Cell
        const rewardCell = document.createElement('td');
        rewardCell.textContent = entry.birthdayFieldDetected ? 'High' : 'Unlikely';
        // Apply CSS classes for color coding
        rewardCell.className = entry.birthdayFieldDetected ? 'status-success' : 'status-warning'; // Using classes from popup.css

        // Add captcha warning icon if present
        if (entry.captchaDetected) { // Use captchaDetected property from content script response
            const warningIcon = document.createElement('span');
            warningIcon.textContent = '⚠️'; // Emoji or character
            warningIcon.className = 'warning-icon'; // Class for styling the icon
            warningIcon.title = 'Captcha detected during submission attempt.'; // Tooltip
            rewardCell.appendChild(warningIcon);
            // Optional: Add a class to the cell/row for specific styling if captcha was involved
            rewardCell.classList.add('has-captcha-warning');
        }

        row.appendChild(rewardCell);

        // Append the row to the table body
        trackerBody.appendChild(row);
    });
    console.log("Popup: Tracker table updated with", data.length, "entries.");
}

/**
 * Updates the statistics shown in the tracker overview section.
 * @param {Array} data - The tracker data array.
 */
function updateTrackerOverviewStats(data) {
    if (!totalSubmissionsSpan || !birthdayFieldsSpan || !successRateSpan) {
        console.error("Popup: Tracker overview elements not found!");
        return;
    }
    console.log("Popup: Updating tracker overview stats.");
    const total = data.length;
    const withBirthday = data.filter(entry => entry.birthdayFieldDetected).length;
    // Calculate success rate based on submissions where birthday field was detected
    const successRate = total > 0 ? Math.round((withBirthday / total) * 100) : 0;

    totalSubmissionsSpan.textContent = total;
    birthdayFieldsSpan.textContent = withBirthday;
    successRateSpan.textContent = `${successRate}%`;
    console.log(`Popup: Stats updated - Total: ${total}, Birthday: ${withBirthday}, Rate: ${successRate}%`);
}


/**
 * Adds a new entry to the tracker data and saves it.
 * @param {string} domain - The domain of the website where the submission occurred.
 * @param {boolean} birthdayFieldDetected - Whether a birthday field was found during filling.
 * @param {boolean} captchaDetected - Whether CAPTCHA was detected during submission attempt.
 */
function addTrackerEntry(domain, birthdayFieldDetected, captchaDetected = false) {
    console.log("Popup: Adding tracker entry for", domain);
    // Get existing tracker data
    chrome.storage.sync.get('trackerData', (data) => {
        const currentTrackerData = data.trackerData || [];

        // Create the new entry object
        const newEntry = {
            domain: domain,
            timestamp: Date.now(), // Store timestamp for sorting
            birthdayFieldDetected: birthdayFieldDetected,
            captchaDetected: captchaDetected, // Store captcha status
            // You could add more details here if needed (e.g., fields filled)
        };

        // Add the new entry
        currentTrackerData.push(newEntry);

        // Save the updated tracker data
        chrome.storage.sync.set({ trackerData: currentTrackerData }, () => {
            console.log("Popup: Tracker entry saved.");
            // Update the UI if the tracker view is currently active
            // Or update the overview stats immediately
            updateTrackerUI(currentTrackerData); // Update UI after saving
        });
    });
}


/**
 * Handles exporting the tracker data.
 */
function exportTrackerData() {
    // This function is triggered when the export button is clicked.
    // It should show the export dialog where the user chooses the format.
    // The actual export logic is handled by the confirm button within the dialog.
    console.log("Popup: Initiating export data process.");
    // The showExportDialog function handles getting the data and creating the dialog.
}

// --- Dynamic UI Elements (Dialogs/Overlays) ---

/**
 * Shows a confirmation dialog before submitting the form.
 * @param {Function} onConfirm - Callback function to run if the user confirms.
 */
function showConsentDialog(onConfirm) {
    console.log("Popup: Showing consent dialog.");
    // Create the dialog elements dynamically based on the CSS classes defined for .consent-dialog
    const dialog = document.createElement('div');
    dialog.className = 'consent-dialog'; // Apply main dialog overlay styles

    const content = document.createElement('div');
    content.className = 'consent-content'; // Apply content box styles

    const title = document.createElement('h3');
    title.textContent = 'Confirm Form Submission';

    const message = document.createElement('p');
    message.textContent = 'You are about to submit a form with your personal information. Do you wish to continue?';

    const buttons = document.createElement('div');
    buttons.className = 'consent-buttons'; // Apply button group styles

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    // Apply button styles from popup.css (e.g., btn-secondary) - update CSS classes
    cancelBtn.classList.add('btn-secondary'); // Use your CSS button classes
    cancelBtn.addEventListener('click', () => {
        console.log("Popup: Consent dialog cancelled.");
        document.body.removeChild(dialog); // Remove dialog from DOM
        showStatus('Form submission cancelled.', 'info'); // Show status
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm';
    // Apply button styles from popup.css (e.g., btn-primary) - update CSS classes
    confirmBtn.classList.add('btn-primary'); // Use your CSS button classes
    confirmBtn.addEventListener('click', () => {
        console.log("Popup: Consent dialog confirmed.");
        document.body.removeChild(dialog); // Remove dialog from DOM
        onConfirm(); // Execute the callback (which sends the submit message)
        showStatus('Attempting to submit form...', 'info'); // Show status while waiting for submit response
    });

    // Assemble the dialog structure
    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);
    content.appendChild(title);
    content.appendChild(message);
    content.appendChild(buttons);
    dialog.appendChild(content);

    // Add the dialog to the body of the popup HTML
    document.body.appendChild(dialog);
}


/**
 * Shows a dialog to select export format and trigger export.
 */
function showExportDialog() {
    console.log("Popup: Showing export dialog.");
    // Create the dialog elements dynamically based on the CSS classes defined for .export-dialog
    const dialog = document.createElement('div');
    dialog.className = 'export-dialog'; // Apply main dialog overlay styles

    const content = document.createElement('div');
    content.className = 'export-content'; // Apply content box styles

    const title = document.createElement('h3');
    title.textContent = 'Export Data';

    const formatSelector = document.createElement('select');
    // Add options based on popup.html's exportFormatSelect options (CSV/JSON)
    const csvOption = document.createElement('option');
    csvOption.value = 'csv';
    csvOption.textContent = 'CSV (.csv)'; // More descriptive text
    const jsonOption = document.createElement('option');
    jsonOption.value = 'json';
    jsonOption.textContent = 'JSON (.json)'; // More descriptive text
    formatSelector.appendChild(csvOption);
    formatSelector.appendChild(jsonOption);
    // Apply styles for the select element within the dialog
    formatSelector.style.marginBottom = '15px'; // Add some spacing


    const buttons = document.createElement('div');
    buttons.className = 'export-buttons'; // Apply button group styles

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.classList.add('btn-secondary'); // Use your CSS button classes
    cancelBtn.addEventListener('click', () => {
        console.log("Popup: Export dialog cancelled.");
        document.body.removeChild(dialog); // Remove dialog from DOM
    });

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export';
    exportBtn.classList.add('btn-primary'); // Use your CSS button classes
    exportBtn.addEventListener('click', () => {
        console.log("Popup: Export dialog confirmed.");
        const format = formatSelector.value;
        let fileContent, fileName, mimeType;

        // Use the imported functions from utils.js for conversion
        if (format === 'csv') {
            fileContent = exportToCSV(trackerData); // Use imported function
            fileName = 'loyalty-tracker.csv';
            mimeType = 'text/csv';
        } else if (format === 'json') { // Ensure value matches option value
            fileContent = exportToJSON(trackerData); // Use imported function
            fileName = 'loyalty-tracker.json';
            mimeType = 'application/json';
        } else {
            console.error("Popup: Unknown export format selected:", format);
            showStatus('Error: Unknown export format.', 'error');
            document.body.removeChild(dialog);
            return;
        }

        // Create a Blob and a download URL
        const blob = new Blob([fileContent], { type: mimeType });
        const url = URL.createObjectURL(blob);

        // Create a temporary anchor element to trigger the download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName; // Set the filename for the download

        // Programmatically click the anchor to trigger the download
        document.body.appendChild(a); // Must be in DOM to click in some browsers
        a.click();

        // Clean up the temporary URL and element
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Remove the dialog from the DOM
        document.body.removeChild(dialog);
        showStatus('Data exported successfully.', 'success');
    });

    // Assemble the dialog structure
    buttons.appendChild(cancelBtn);
    buttons.appendChild(exportBtn);
    content.appendChild(title);
    content.appendChild(formatSelector); // Add the select element
    content.appendChild(buttons);
    dialog.appendChild(content);

    // Add the dialog to the body of the popup HTML
    document.body.appendChild(dialog);
}


/**
 * Shows the field preview overlay with data from the fill process.
 * @param {Object} formData - Object containing the field types and values that were filled.
 */
function displayFieldPreview(formData) {
    if (!fieldPreviewTemplate) {
        console.error("Popup: Field preview template not found!");
        return;
    }
    console.log("Popup: Displaying field preview.", formData);

    // Remove any existing preview overlay to avoid duplicates
    const existingPreview = document.querySelector('.field-preview-overlay');
    if (existingPreview) {
        existingPreview.remove();
    }

    // Clone the template content
    const previewOverlay = fieldPreviewTemplate.content.cloneNode(true).firstElementChild; // Get the root element

    // Get references to elements within the cloned template
    const fieldList = previewOverlay.querySelector('.field-list');
    const closeBtn = previewOverlay.querySelector('.close-preview');
    const cancelBtn = previewOverlay.querySelector('.cancel-fill'); // Corrected class
    const confirmBtn = previewOverlay.querySelector('.confirm-fill'); // Corrected class

    // Clear any default content in the field list
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
                // Display the value, handle sensitive data if necessary (e.g., password)
                // For now, display directly.
                const value = formData[fieldType];
                fieldValue.textContent = (value === '' || value === null || value === undefined) ? '[Empty]' : value;


                fieldItem.appendChild(fieldName);
                fieldItem.appendChild(fieldValue);
                fieldList.appendChild(fieldItem);
            }
        }
    } else {
        // Handle case where no fields were filled but preview was still shown
        const noFieldsMessage = document.createElement('div');
        noFieldsMessage.textContent = 'No recognizable fields were filled with your profile data.';
        noFieldsMessage.style.fontStyle = 'italic';
        noFieldsMessage.style.color = '#666';
        fieldList.appendChild(noFieldsMessage);
        // Maybe disable the confirm button if nothing was filled?
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'No fields to confirm';
        confirmBtn.classList.remove('btn-primary');
        confirmBtn.classList.add('btn-secondary');
    }


    // --- Add Event Listeners to Preview Overlay Buttons ---
    closeBtn.addEventListener('click', () => { hideFieldPreview(); });
    cancelBtn.addEventListener('click', () => {
        console.log("Popup: Field preview cancelled.");
        hideFieldPreview(); // Hide the overlay
        showStatus('Form filling cancelled.', 'info'); // Show status
    });
    confirmBtn.addEventListener('click', (event) => {
        // This button triggers the actual form submission message
        handleConfirmFillClick(event);
    });


    // Add the populated overlay to the body
    document.body.appendChild(previewOverlay);

    // Add 'active' class to trigger CSS transition (slide-in effect)
    // Use a slight timeout to ensure the element is added to the DOM before transition
    setTimeout(() => {
        previewOverlay.classList.add('active');
    }, 10); // Small delay
}

/**
 * Hides the field preview overlay.
 */
function hideFieldPreview() {
    console.log("Popup: Hiding field preview.");
    const previewOverlay = document.querySelector('.field-preview-overlay');
    if (previewOverlay) {
        // Trigger CSS transition (slide-out effect)
        previewOverlay.classList.remove('active');
        // Remove element from DOM after transition ends
        previewOverlay.addEventListener('transitionend', () => {
            if (!previewOverlay.classList.contains('active')) {
                previewOverlay.remove();
                formPreviewData = null; // Clear stored preview data
                console.log("Popup: Field preview element removed from DOM.");
            }
        }, { once: true }); // Use { once: true } to remove the listener after it fires
    }
}


/**
 * Handles the click event on the "Confirm & Fill" button in the field preview.
 * This button triggers the form submission message to the content script.
 */
function handleConfirmFillClick(event) {
    console.log("Popup: Confirm & Fill button clicked.");
    // Prevent default button behavior if it's inside a form (though this is a template)
    event.preventDefault();

    // Hide the preview overlay
    hideFieldPreview();

    // Show consent dialog before submitting
    // The callback function passed to showConsentDialog will send the 'submitForm' message
    showConsentDialog(() => {
        // This is the callback that runs IF the user confirms in the consent dialog
        console.log("Popup: Consent confirmed, sending submit message.");
        // Message content script to submit the form.
        // We don't need to send formData here, the content script finds the fields by highlight class.
        sendMessageToContentScript({ action: 'submitForm' })
            .then(response => {
                console.log("Popup: Submit form response received:", response);
                // Handle response: success, captcha detected, etc.
                if (response && response.success) {
                    // Submission attempted successfully (doesn't guarantee server success)
                    showStatus('Form submission attempted.', 'success');
                    // Add tracker entry if submission was attempted
                    getCurrentTabUrl().then(url => {
                        addTrackerEntry(url, response.hasBirthdayField, response.captchaDetected);
                    });

                } else if (response && response.captchaDetected) {
                    // CAPTCHA was detected by the content script
                    showStatus('CAPTCHA detected. Please submit manually.', 'warning');
                    // Still add tracker entry, noting captcha was detected
                    getCurrentTabUrl().then(url => {
                        addTrackerEntry(url, response.hasBirthdayField, true); // Mark as captcha detected
                    });

                } else {
                    // Submission failed for other reasons (e.g., no form/button found by content script)
                    showStatus('Could not submit form automatically.', 'error');
                    // Decide if you want to track failed attempts
                    // getCurrentTabUrl().then(url => {
                    //    addTrackerEntry(url, response ? response.hasBirthdayField : false, response ? response.captchaDetected : false);
                    // });
                }
                // Re-check status after potential submission
                getCurrentTabStatus();
            })
            .catch(error => {
                console.error("Popup: Error sending submit message:", error);
                showStatus('Error during form submission.', 'error');
                getCurrentTabStatus();
            });
    });
}


/**
 * Shows the help modal.
 */
function showHelpModal() {
    if (!helpModalTemplate) {
        console.error("Popup: Help modal template not found!");
        showStatus('Help content not available.', 'warning');
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
    closeBtn.addEventListener('click', () => {
        console.log("Popup: Help modal closed.");
        modalOverlay.remove(); // Remove modal from DOM
    });

    // Add the modal to the body
    document.body.appendChild(modalOverlay);

    // Add 'active' class to trigger CSS transition (fade-in effect)
    setTimeout(() => {
        modalOverlay.classList.add('active');
    }, 10); // Small delay
}


// --- Communication with Content Script ---

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
                showStatus('No active tab available.', 'warning');
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
                    let statusMsg = `Error with page interaction.`;
                    if (error.message.includes('Could not establish connection')) {
                        statusMsg = 'Content script not loaded on this page.';
                        // Disable fill/submit/scan buttons if content script isn't there
                        setFormActionButtonsState(false);
                    }
                    showStatus(statusMsg, 'error');
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
    // Request status from content script
    sendMessageToContentScript({ action: 'getFormStatus' })
        .then(response => {
            console.log("Popup: Received form status:", response);
            if (response && response.formDetected !== undefined) {
                // Update UI based on response
                if (response.formDetected) {
                    showStatus(`Form detected with ${response.fieldCount} fields.`, 'info');
                    // Enable action buttons if a form is detected AND a profile is selected
                    setFormActionButtonsState(true); // Assume enabled if form detected
                    // Further refine: only enable Fill/Submit if a profile is selected
                    setFormActionButtonsState(true && !!activeProfile && activeProfile.firstName); // Fill/Submit require a profile
                    scanPageBtn.disabled = false; // Scan is always possible if content script is there
                    resetFormsBtn.disabled = (response.fieldCount === 0); // Disable reset if no fields found

                } else {
                    showStatus('No form detected on this page.', 'info');
                    // Disable action buttons if no form is detected
                    setFormActionButtonsState(false);
                    scanPageBtn.disabled = false; // Still allow manual scan
                    resetFormsBtn.disabled = true;
                }
            } else {
                // Handle cases where response is malformed but no chrome.runtime.lastError
                console.warn("Popup: Received unexpected status response:", response);
                showStatus('Could not determine page status.', 'warning');
                setFormActionButtonsState(false); // Disable buttons conservatively
                scanPageBtn.disabled = false; // Still allow manual scan
                resetFormsBtn.disabled = true;
            }
        })
        .catch(error => {
            // sendMessageToContentScript already handles showing error status and disabling buttons
            console.log("Popup: getCurrentTabStatus caught error from sendMessageToContentScript.");
            // Buttons would have been disabled by sendMessageToContentScript
        });
}


/**
 * Helper function to set the disabled state of form action buttons.
 * @param {boolean} enable - True to enable, False to disable.
 */
function setFormActionButtonsState(enable) {
    // Only enable fill and submit if a profile is selected and forms are detected
    const canFillOrSubmit = enable && !!activeProfile && activeProfile.firstName;

    // scanPageBtn.disabled = !enable; // Scan is usually possible unless content script is absent
    // We handle scanPageBtn state in getCurrentTabStatus based on content script availability

    fillFormsBtn.disabled = !canFillOrSubmit;
    // submitFormBtn.disabled = !canFillOrSubmit; // Submit button is on the preview overlay now

    // Reset button is enabled if there are identified fields, regardless of profile
    // Its state is managed in getCurrentTabStatus based on fieldCount
    // resetFormsBtn.disabled = !enable;
    console.log("Popup: Form action buttons enabled state:", enable, "Can Fill/Submit:", canFillOrSubmit);
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


// --- Settings Application ---

/**
 * Applies the loaded settings to the popup's UI.
 * @param {Object} settings - The settings object.
 */
function applySettings(settings) {
    console.log("Popup: Applying settings to UI.", settings);

    // Apply font size
    if (fontSizeSelector) {
        fontSizeSelector.value = settings.fontSize || 'normal';
        // Apply the CSS style to the document element
        document.documentElement.style.fontSize = getFontSizeValue(settings.fontSize);
    }

    // Apply high contrast
    if (highContrastToggle) {
        highContrastToggle.checked = settings.highContrast;
        // Apply the CSS class to the body
        applyHighContrast(settings.highContrast);
    }

    // Load custom keywords into the textarea if settings view is active (handled by showSettingsView)
    // The initial loading into the settings view is done when showSettingsView is called.
    // If custom keywords need to be immediately reflected elsewhere in the popup UI, add logic here.
    // Note: Sending keywords to content script happens when settings are SAVED, not just loaded into popup.
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
 * @param {string} sizeSetting - The font size setting name ('normal', 'large', 'x-large').
 * @returns {string} The corresponding CSS font size value.
 */
function getFontSizeValue(sizeSetting) {
    switch (sizeSetting) {
        case 'large': return '18px'; // Example values, match your CSS
        case 'x-large': return '22px'; // Example values, match your CSS
        case 'normal': // Fall through
        default: return '14px'; // Default base font size for popup
    }
}

// --- Placeholder/To Be Implemented ---
// Functions for managing profile data (adding, editing, deleting, saving form data)
// function loadProfileDataIntoForm(profile) { ... }
// function saveProfileFromForm() { ... }
// function deleteProfile(profileId) { ... }