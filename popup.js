// DOM Elements
const profileSelector = document.getElementById('profile-selector');
const autofillToggle = document.getElementById('autofill-toggle');
const manualOverrideToggle = document.getElementById('manual-override-toggle');
const highContrastToggle = document.getElementById('high-contrast-toggle');
const fontSizeSelector = document.getElementById('font-size-selector');
const fillNowBtn = document.getElementById('fill-now-btn');
const submitFormBtn = document.getElementById('submit-form-btn');
const statusMessage = document.getElementById('status-message');
const trackerTable = document.getElementById('tracker-table');
const trackerBody = document.getElementById('tracker-body');
const exportDataBtn = document.getElementById('export-data-btn');
const deleteDataBtn = document.getElementById('delete-data-btn');
const profileManager = document.getElementById('profile-manager');
const addProfileBtn = document.getElementById('add-profile-btn');
const settingsBtn = document.getElementById('settings-btn');
const mainView = document.getElementById('main-view');
const settingsView = document.getElementById('settings-view');
const trackerView = document.getElementById('tracker-view');
const backBtn = document.getElementById('back-btn');
const viewTrackerBtn = document.getElementById('view-tracker-btn');
const customKeywordsInput = document.getElementById('custom-keywords');
const saveSettingsBtn = document.getElementById('save-settings-btn');

// Default settings
const DEFAULT_SETTINGS = {
    fontSize: 'normal',
    highContrast: false,
    customKeywords: [],
    dataValidation: true
};

// Default user profile
const DEFAULT_PROFILE = {
    firstName: '',
    lastName: '',
    email: '',
    birthday: '',
    phone: '',
    address: ''
};

// Current active profile
let activeProfile = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    initPopup();
    setupEventListeners();
});

/**
 * Initialize popup with stored data and settings
 */
function initPopup() {
    // Load settings
    chrome.storage.sync.get('settings', (data) => {
        const settings = data.settings || DEFAULT_SETTINGS;
        applySettings(settings);
    });

    // Load profiles
    chrome.storage.sync.get('profiles', (data) => {
        const profiles = data.profiles || {};
        updateProfileSelector(profiles);
    });

    // Load active profile
    chrome.storage.sync.get('activeProfile', (data) => {
        if (data.activeProfile) {
            profileSelector.value = data.activeProfile;
            loadProfile(data.activeProfile);
        }
    });

    // Load tracker data
    loadTrackerData();

    // Get current tab information
    getCurrentTabInfo();
}

/**
 * Set up event listeners for popup elements
 */
function setupEventListeners() {
    // Profile selection
    profileSelector.addEventListener('change', (e) => {
        loadProfile(e.target.value);
        chrome.storage.sync.set({ activeProfile: e.target.value });
    });

    // Autofill toggle
    autofillToggle.addEventListener('change', (e) => {
        chrome.storage.sync.set({ autofillEnabled: e.target.checked });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'setAutofill',
                    enabled: e.target.checked
                });
            }
        });
    });

    // Manual override toggle
    manualOverrideToggle.addEventListener('change', (e) => {
        chrome.storage.sync.set({ manualOverride: e.target.checked });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'setManualOverride',
                    enabled: e.target.checked
                });
            }
        });
    });

    // High contrast toggle
    highContrastToggle.addEventListener('change', (e) => {
        const settings = { highContrast: e.target.checked };
        chrome.storage.sync.get('settings', (data) => {
            const currentSettings = data.settings || DEFAULT_SETTINGS;
            chrome.storage.sync.set({
                settings: { ...currentSettings, ...settings }
            });
        });
        applyHighContrast(e.target.checked);
    });

    // Font size selector
    fontSizeSelector.addEventListener('change', (e) => {
        const settings = { fontSize: e.target.value };
        chrome.storage.sync.get('settings', (data) => {
            const currentSettings = data.settings || DEFAULT_SETTINGS;
            chrome.storage.sync.set({
                settings: { ...currentSettings, ...settings }
            });
        });
        document.documentElement.style.fontSize = getFontSizeValue(e.target.value);
    });

    // Fill Now button
    fillNowBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.storage.sync.get(['activeProfile', 'profiles'], (data) => {
                    const profile = data.profiles && data.activeProfile ?
                        data.profiles[data.activeProfile] : DEFAULT_PROFILE;

                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'fillForm',
                        profile: profile
                    }, (response) => {
                        if (response && response.success) {
                            showStatus(`Form filled with ${response.fieldCount} fields`, 'success');
                        } else {
                            showStatus('Could not fill form', 'error');
                        }
                    });
                });
            }
        });
    });

    // Submit Form button
    submitFormBtn.addEventListener('click', () => {
        showConsentDialog(() => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'submitForm' }, (response) => {
                        if (response && response.success) {
                            showStatus('Form submitted successfully', 'success');
                            // Add to tracker
                            addTrackerEntry(tabs[0].url, response.birthdayFieldFound);
                        } else if (response && response.captcha) {
                            showStatus('Captcha detected, manual submission required', 'error');
                            // Add to tracker with captcha warning
                            addTrackerEntry(tabs[0].url, response.birthdayFieldFound, true);
                        } else {
                            showStatus('Could not submit form', 'error');
                        }
                    });
                }
            });
        });
    });

    // Export data button
    exportDataBtn.addEventListener('click', () => {
        exportTrackerData();
    });

    // Delete data button
    deleteDataBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete all data? This action cannot be undone.')) {
            chrome.storage.sync.clear(() => {
                showStatus('All data deleted', 'success');
                initPopup(); // Reinitialize with defaults
            });
        }
    });

    // Add profile button
    addProfileBtn.addEventListener('click', () => {
        showProfileManager();
    });

    // Settings button
    settingsBtn.addEventListener('click', () => {
        showSettingsView();
    });

    // Back button
    backBtn.addEventListener('click', () => {
        showMainView();
    });

    // View tracker button
    viewTrackerBtn.addEventListener('click', () => {
        showTrackerView();
    });

    // Save settings button
    saveSettingsBtn.addEventListener('click', () => {
        saveCustomSettings();
    });
}

/**
 * Apply stored settings to UI
 * @param {Object} settings - User settings
 */
function applySettings(settings) {
    // Set font size selector
    fontSizeSelector.value = settings.fontSize || 'normal';

    // Set high contrast toggle
    highContrastToggle.checked = settings.highContrast;

    // Apply font size
    document.documentElement.style.fontSize = getFontSizeValue(settings.fontSize);

    // Apply high contrast if enabled
    if (settings.highContrast) {
        document.body.classList.add('high-contrast');
    } else {
        document.body.classList.remove('high-contrast');
    }

    // Set custom keywords
    if (settings.customKeywords && customKeywordsInput) {
        customKeywordsInput.value = settings.customKeywords.join(', ');
    }
}

/**
 * Apply high contrast mode
 * @param {boolean} enabled - Whether high contrast is enabled
 */
function applyHighContrast(enabled) {
    if (enabled) {
        document.body.classList.add('high-contrast');
    } else {
        document.body.classList.remove('high-contrast');
    }
}

/**
 * Get font size value from setting
 * @param {string} size - Font size name (normal, large, x-large)
 * @returns {string} CSS font size value
 */
function getFontSizeValue(size) {
    switch (size) {
        case 'large': return '18px';
        case 'x-large': return '22px';
        default: return '16px';
    }
}

/**
 * Get information about the current tab
 */
function getCurrentTabInfo() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            // Check if autofill is enabled
            chrome.storage.sync.get('autofillEnabled', (data) => {
                autofillToggle.checked = data.autofillEnabled !== false;
            });

            // Check if manual override is enabled
            chrome.storage.sync.get('manualOverride', (data) => {
                manualOverrideToggle.checked = !!data.manualOverride;
            });

            // Get form detection status from content script
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getFormStatus' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Content script might not be injected yet
                    console.log('Content script not available:', chrome.runtime.lastError);
                    showStatus('Content script not loaded on this page', 'error');
                    fillNowBtn.disabled = true;
                    submitFormBtn.disabled = true;
                    return;
                }

                if (response && response.formDetected) {
                    showStatus(`Form detected with ${response.fieldCount} fields`, 'info');
                    fillNowBtn.disabled = false;
                    submitFormBtn.disabled = false;
                } else {
                    showStatus('No form detected on this page', 'info');
                    fillNowBtn.disabled = true;
                    submitFormBtn.disabled = true;
                }
            });
        }
    });
}

/**
 * Update profile selector with stored profiles
 * @param {Object} profiles - Stored profiles
 */
function updateProfileSelector(profiles) {
    // Clear existing options
    profileSelector.innerHTML = '';

    // Create default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a profile';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    profileSelector.appendChild(defaultOption);

    // Add profiles
    for (const id in profiles) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = profiles[id].firstName + ' ' + profiles[id].lastName;
        profileSelector.appendChild(option);
    }
}

/**
 * Load profile data
 * @param {string} profileId - Profile ID to load
 */
function loadProfile(profileId) {
    chrome.storage.sync.get('profiles', (data) => {
        const profiles = data.profiles || {};
        activeProfile = profiles[profileId] || DEFAULT_PROFILE;

        // Update form fields if they exist
        const fields = document.querySelectorAll('[data-field]');
        fields.forEach(field => {
            const fieldName = field.dataset.field;
            if (activeProfile[fieldName] !== undefined) {
                field.value = activeProfile[fieldName];
            }
        });
    });
}

/**
 * Show profile manager
 */
function showProfileManager() {
    mainView.style.display = 'none';
    profileManager.style.display = 'block';
    backBtn.style.display = 'block';
}

/**
 * Show settings view
 */
function showSettingsView() {
    mainView.style.display = 'none';
    settingsView.style.display = 'block';
    backBtn.style.display = 'block';

    // Load custom keywords
    chrome.storage.sync.get('settings', (data) => {
        const settings = data.settings || DEFAULT_SETTINGS;
        if (settings.customKeywords && customKeywordsInput) {
            customKeywordsInput.value = settings.customKeywords.join(', ');
        }
    });
}

/**
 * Show tracker view
 */
function showTrackerView() {
    mainView.style.display = 'none';
    trackerView.style.display = 'block';
    backBtn.style.display = 'block';

    // Refresh tracker data
    loadTrackerData();
}

/**
 * Show main view
 */
function showMainView() {
    profileManager.style.display = 'none';
    settingsView.style.display = 'none';
    trackerView.style.display = 'none';
    mainView.style.display = 'block';
    backBtn.style.display = 'none';
}

/**
 * Save custom settings
 */
function saveCustomSettings() {
    chrome.storage.sync.get('settings', (data) => {
        const currentSettings = data.settings || DEFAULT_SETTINGS;

        // Parse custom keywords
        const keywords = customKeywordsInput.value
            .split(',')
            .map(keyword => keyword.trim())
            .filter(keyword => keyword.length > 0);

        const newSettings = {
            ...currentSettings,
            customKeywords: keywords
        };

        chrome.storage.sync.set({ settings: newSettings }, () => {
            showStatus('Settings saved', 'success');

            // Send updated keywords to content scripts
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'updateKeywords',
                        keywords: keywords
                    }).catch(() => {
                        // Ignore errors for tabs where content script isn't loaded
                    });
                });
            });
        });
    });
}

/**
 * Display status message
 * @param {string} message - Status message
 * @param {string} type - Message type (success, error, info)
 */
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message';
    statusMessage.classList.add(type);

    // Show message
    statusMessage.style.opacity = '1';

    // Hide after 3 seconds
    setTimeout(() => {
        statusMessage.style.opacity = '0';
    }, 3000);
}

/**
 * Show consent dialog before form submission
 * @param {Function} onConfirm - Callback on confirmation
 */
function showConsentDialog(onConfirm) {
    const dialog = document.createElement('div');
    dialog.className = 'consent-dialog';

    const content = document.createElement('div');
    content.className = 'consent-content';

    const title = document.createElement('h3');
    title.textContent = 'Confirm Form Submission';

    const message = document.createElement('p');
    message.textContent = 'You are about to submit a form with your personal information. Do you wish to continue?';

    const buttons = document.createElement('div');
    buttons.className = 'consent-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
        document.body.removeChild(dialog);
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm';
    confirmBtn.className = 'primary';
    confirmBtn.onclick = () => {
        document.body.removeChild(dialog);
        onConfirm();
    };

    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);
    content.appendChild(title);
    content.appendChild(message);
    content.appendChild(buttons);
    dialog.appendChild(content);

    document.body.appendChild(dialog);
}

/**
 * Load tracker data
 */
function loadTrackerData() {
    chrome.storage.sync.get('trackerData', (data) => {
        const trackerData = data.trackerData || [];
        updateTrackerTable(trackerData);
    });
}

/**
 * Update tracker table with data
 * @param {Array} trackerData - Array of tracker entries
 */
function updateTrackerTable(trackerData) {
    // Clear existing entries
    trackerBody.innerHTML = '';

    if (trackerData.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 4;
        emptyCell.textContent = 'No submissions tracked yet';
        emptyCell.style.textAlign = 'center';
        emptyRow.appendChild(emptyCell);
        trackerBody.appendChild(emptyRow);
        return;
    }

    // Add entries
    trackerData.forEach(entry => {
        const row = document.createElement('tr');

        // Domain
        const domainCell = document.createElement('td');
        try {
            const url = new URL(entry.domain);
            domainCell.textContent = url.hostname;
        } catch (e) {
            domainCell.textContent = entry.domain;
        }
        row.appendChild(domainCell);

        // Date
        const dateCell = document.createElement('td');
        dateCell.textContent = new Date(entry.date).toLocaleDateString();
        row.appendChild(dateCell);

        // Birthday status
        const birthdayCell = document.createElement('td');
        birthdayCell.textContent = entry.birthdayFieldFound ? 'Detected' : 'Not Found';
        birthdayCell.className = entry.birthdayFieldFound ? 'status-success' : 'status-warning';
        row.appendChild(birthdayCell);

        // Reward likelihood
        const rewardCell = document.createElement('td');
        if (entry.birthdayFieldFound) {
            rewardCell.textContent = 'High';
            rewardCell.className = 'status-success';
        } else {
            rewardCell.textContent = 'Unlikely';
            rewardCell.className = 'status-warning';
        }

        // Add captcha warning if applicable
        if (entry.captcha) {
            const warningIcon = document.createElement('span');
            warningIcon.textContent = '⚠️';
            warningIcon.title = 'Captcha detected';
            warningIcon.className = 'warning-icon';
            rewardCell.appendChild(warningIcon);
        }

        row.appendChild(rewardCell);
        trackerBody.appendChild(row);
    });
}

/**
 * Add tracker entry
 * @param {string} domain - Website domain
 * @param {boolean} birthdayFieldFound - Whether birthday field was found
 * @param {boolean} captcha - Whether captcha was detected
 */
function addTrackerEntry(domain, birthdayFieldFound, captcha = false) {
    chrome.storage.sync.get('trackerData', (data) => {
        const trackerData = data.trackerData || [];

        // Create entry
        const entry = {
            domain,
            date: Date.now(),
            birthdayFieldFound,
            captcha
        };

        // Add to tracker
        trackerData.push(entry);

        // Save updated tracker
        chrome.storage.sync.set({ trackerData }, () => {
            // If tracker view is open, update it
            if (trackerView.style.display !== 'none') {
                updateTrackerTable(trackerData);
            }
        });
    });
}

/**
 * Export tracker data as CSV or JSON
 */
function exportTrackerData() {
    chrome.storage.sync.get('trackerData', (data) => {
        const trackerData = data.trackerData || [];

        if (trackerData.length === 0) {
            showStatus('No data to export', 'error');
            return;
        }

        // Create export dialog
        const dialog = document.createElement('div');
        dialog.className = 'export-dialog';

        const content = document.createElement('div');
        content.className = 'export-content';

        const title = document.createElement('h3');
        title.textContent = 'Export Data';

        const formatSelector = document.createElement('select');
        const csvOption = document.createElement('option');
        csvOption.value = 'csv';
        csvOption.textContent = 'CSV';
        const jsonOption = document.createElement('option');
        jsonOption.value = 'json';
        jsonOption.textContent = 'JSON';
        formatSelector.appendChild(csvOption);
        formatSelector.appendChild(jsonOption);

        const buttons = document.createElement('div');
        buttons.className = 'export-buttons';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            document.body.removeChild(dialog);
        };

        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'Export';
        exportBtn.className = 'primary';
        exportBtn.onclick = () => {
            const format = formatSelector.value;
            let content, fileName, mimeType;

            if (format === 'csv') {
                content = convertToCSV(trackerData);
                fileName = 'loyalty-tracker.csv';
                mimeType = 'text/csv';
            } else {
                content = JSON.stringify(trackerData, null, 2);
                fileName = 'loyalty-tracker.json';
                mimeType = 'application/json';
            }

            // Create download link
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();

            document.body.removeChild(dialog);
        };

        buttons.appendChild(cancelBtn);
        buttons.appendChild(exportBtn);
        content.appendChild(title);
        content.appendChild(formatSelector);
        content.appendChild(buttons);
        dialog.appendChild(content);

        document.body.appendChild(dialog);
    });
}

/**
 * Convert tracker data to CSV format
 * @param {Array} data - Tracker data
 * @returns {string} CSV content
 */
function convertToCSV(data) {
    const header = ['Domain', 'Submission Date', 'Birthday Field', 'Reward Likelihood', 'Captcha Detected'];
    const rows = data.map(entry => {
        let domain;
        try {
            const url = new URL(entry.domain);
            domain = url.hostname;
        } catch (e) {
            domain = entry.domain;
        }

        return [
            domain,
            new Date(entry.date).toLocaleDateString(),
            entry.birthdayFieldFound ? 'Detected' : 'Not Found',
            entry.birthdayFieldFound ? 'High' : 'Unlikely',
            entry.captcha ? 'Yes' : 'No'
        ];
    });

    return [header, ...rows].map(row => row.join(',')).join('\n');
}