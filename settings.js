/**
 * Settings.js - Handles settings page functionality for Loyalty Program Assistant
 */

document.addEventListener('DOMContentLoaded', function () {
    // Tab navigation
    setupTabs();

    // Profile management
    loadProfiles();
    setupProfileHandlers();

    // Keywords section
    loadKeywords();
    setupKeywordHandlers();

    // Validation rules
    loadValidationRules();
    setupValidationHandlers();

    // Privacy settings
    loadPrivacySettings();
    setupPrivacyHandlers();

    // Modal setup
    setupModal();
});

/**
 * Tab Navigation
 */
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab
            tab.classList.add('active');

            // Show corresponding content
            const targetId = tab.id.replace('Tab', 'Section');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

/**
 * Profile Management
 */
function loadProfiles() {
    chrome.storage.sync.get('profiles', function (data) {
        const profiles = data.profiles || [];
        const profilesContainer = document.getElementById('profilesContainer');
        profilesContainer.innerHTML = '';

        if (profiles.length === 0) {
            profilesContainer.innerHTML = '<p>No profiles found. Create a new profile to get started.</p>';
            return;
        }

        profiles.forEach((profile, index) => {
            const profileCard = document.createElement('div');
            profileCard.className = 'profile-card';
            profileCard.innerHTML = `
        <div class="profile-info">
          <h4>${profile.profileName}</h4>
          <p>${profile.email}</p>
        </div>
        <div class="profile-actions">
          <button class="btn small primary edit-profile" data-index="${index}">Edit</button>
          <button class="btn small danger delete-profile" data-index="${index}">Delete</button>
        </div>
      `;
            profilesContainer.appendChild(profileCard);
        });

        // Set up event listeners for edit and delete buttons
        document.querySelectorAll('.edit-profile').forEach(btn => {
            btn.addEventListener('click', function () {
                const index = parseInt(this.getAttribute('data-index'));
                editProfile(index);
            });
        });

        document.querySelectorAll('.delete-profile').forEach(btn => {
            btn.addEventListener('click', function () {
                const index = parseInt(this.getAttribute('data-index'));
                showConfirmation(
                    `Are you sure you want to delete the profile "${profiles[index].profileName}"?`,
                    () => deleteProfile(index)
                );
            });
        });
    });
}

function setupProfileHandlers() {
    // Add new profile button
    document.getElementById('addProfileBtn').addEventListener('click', () => {
        document.getElementById('profileEditorTitle').textContent = 'Create New Profile';
        document.getElementById('profileForm').reset();
        document.getElementById('profileEditor').classList.remove('hidden');
    });

    // Cancel profile editing
    document.getElementById('cancelProfileBtn').addEventListener('click', () => {
        document.getElementById('profileEditor').classList.add('hidden');
    });

    // Save profile
    document.getElementById('profileForm').addEventListener('submit', function (e) {
        e.preventDefault();

        const profileData = {
            profileName: document.getElementById('profileName').value,
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            birthdate: document.getElementById('birthdate').value,
            address: document.getElementById('address').value,
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            zipCode: document.getElementById('zipCode').value,
            country: document.getElementById('country').value
        };

        const editIndex = this.getAttribute('data-edit-index');

        chrome.storage.sync.get('profiles', function (data) {
            const profiles = data.profiles || [];

            if (editIndex !== null && !isNaN(parseInt(editIndex))) {
                // Update existing profile
                profiles[parseInt(editIndex)] = profileData;
            } else {
                // Add new profile
                profiles.push(profileData);
            }

            chrome.storage.sync.set({ profiles }, function () {
                document.getElementById('profileEditor').classList.add('hidden');
                document.getElementById('profileForm').removeAttribute('data-edit-index');
                loadProfiles();
            });
        });
    });
}

function editProfile(index) {
    chrome.storage.sync.get('profiles', function (data) {
        const profiles = data.profiles || [];
        if (index >= 0 && index < profiles.length) {
            const profile = profiles[index];

            document.getElementById('profileEditorTitle').textContent = 'Edit Profile';
            document.getElementById('profileName').value = profile.profileName || '';
            document.getElementById('firstName').value = profile.firstName || '';
            document.getElementById('lastName').value = profile.lastName || '';
            document.getElementById('email').value = profile.email || '';
            document.getElementById('phone').value = profile.phone || '';
            document.getElementById('birthdate').value = profile.birthdate || '';
            document.getElementById('address').value = profile.address || '';
            document.getElementById('city').value = profile.city || '';
            document.getElementById('state').value = profile.state || '';
            document.getElementById('zipCode').value = profile.zipCode || '';
            document.getElementById('country').value = profile.country || '';

            document.getElementById('profileForm').setAttribute('data-edit-index', index);
            document.getElementById('profileEditor').classList.remove('hidden');
        }
    });
}

function deleteProfile(index) {
    chrome.storage.sync.get('profiles', function (data) {
        const profiles = data.profiles || [];
        if (index >= 0 && index < profiles.length) {
            profiles.splice(index, 1);
            chrome.storage.sync.set({ profiles }, function () {
                loadProfiles();
            });
        }
    });
}

/**
 * Field Keywords Management
 */
function loadKeywords() {
    chrome.storage.sync.get('fieldKeywords', function (data) {
        const defaultKeywords = {
            firstName: ['first name', 'first', 'given name', 'forename'],
            lastName: ['last name', 'last', 'surname', 'family name'],
            email: ['email', 'e-mail', 'email address', 'mail'],
            birthdate: ['birthdate', 'birthday', 'date of birth', 'birth date', 'dob', 'bday'],
            phone: ['phone', 'telephone', 'phone number', 'mobile', 'cell']
        };

        const fieldKeywords = data.fieldKeywords || defaultKeywords;

        // Populate each keyword category
        Object.keys(fieldKeywords).forEach(field => {
            const container = document.getElementById(`${field}Keywords`);
            container.innerHTML = '';

            fieldKeywords[field].forEach(keyword => {
                const keywordElem = document.createElement('span');
                keywordElem.className = 'keyword-item';
                keywordElem.innerHTML = `
          ${keyword}
          <span class="keyword-remove" data-field="${field}" data-keyword="${keyword}">×</span>
        `;
                container.appendChild(keywordElem);
            });
        });

        // Set up remove keyword event listeners
        document.querySelectorAll('.keyword-remove').forEach(btn => {
            btn.addEventListener('click', function () {
                const field = this.getAttribute('data-field');
                const keyword = this.getAttribute('data-keyword');
                removeKeyword(field, keyword);
            });
        });
    });
}

function setupKeywordHandlers() {
    // Add new keyword buttons
    document.querySelectorAll('.keyword-add button').forEach(btn => {
        btn.addEventListener('click', function () {
            const field = this.getAttribute('data-field');
            const inputId = `new${field.charAt(0).toUpperCase() + field.slice(1)}Keyword`;
            const keyword = document.getElementById(inputId).value.trim().toLowerCase();

            if (keyword) {
                addKeyword(field, keyword);
                document.getElementById(inputId).value = '';
            }
        });
    });

    // Reset to defaults
    document.getElementById('resetKeywordsBtn').addEventListener('click', function () {
        showConfirmation(
            'Are you sure you want to reset all keywords to default values?',
            resetKeywordsToDefault
        );
    });
}

function addKeyword(field, keyword) {
    chrome.storage.sync.get('fieldKeywords', function (data) {
        const defaultKeywords = {
            firstName: ['first name', 'first', 'given name', 'forename'],
            lastName: ['last name', 'last', 'surname', 'family name'],
            email: ['email', 'e-mail', 'email address', 'mail'],
            birthdate: ['birthdate', 'birthday', 'date of birth', 'birth date', 'dob', 'bday'],
            phone: ['phone', 'telephone', 'phone number', 'mobile', 'cell']
        };

        const fieldKeywords = data.fieldKeywords || defaultKeywords;

        // Add keyword if it doesn't already exist
        if (!fieldKeywords[field].includes(keyword)) {
            fieldKeywords[field].push(keyword);

            // Save updated keywords
            chrome.storage.sync.set({ fieldKeywords }, function () {
                loadKeywords();
            });
        }
    });
}

function removeKeyword(field, keyword) {
    chrome.storage.sync.get('fieldKeywords', function (data) {
        const fieldKeywords = data.fieldKeywords;

        // Remove the keyword
        const index = fieldKeywords[field].indexOf(keyword);
        if (index > -1) {
            fieldKeywords[field].splice(index, 1);

            // Save updated keywords
            chrome.storage.sync.set({ fieldKeywords }, function () {
                loadKeywords();
            });
        }
    });
}

function resetKeywordsToDefault() {
    const defaultKeywords = {
        firstName: ['first name', 'first', 'given name', 'forename'],
        lastName: ['last name', 'last', 'surname', 'family name'],
        email: ['email', 'e-mail', 'email address', 'mail'],
        birthdate: ['birthdate', 'birthday', 'date of birth', 'birth date', 'dob', 'bday'],
        phone: ['phone', 'telephone', 'phone number', 'mobile', 'cell']
    };

    chrome.storage.sync.set({ fieldKeywords: defaultKeywords }, function () {
        loadKeywords();
    });
}

/**
 * Validation Rules
 */
function loadValidationRules() {
    chrome.storage.sync.get('validationRules', function (data) {
        const defaultRules = {
            emailValidation: {
                enabled: true,
                level: 'standard'
            },
            phoneValidation: {
                enabled: true,
                level: 'standard'
            },
            dateFormat: 'MM/DD/YYYY',
            zipValidation: {
                enabled: true,
                region: 'US'
            }
        };

        const rules = data.validationRules || defaultRules;

        // Set form values based on rules
        document.getElementById('emailValidationToggle').checked = rules.emailValidation.enabled;
        document.getElementById('emailValidationLevel').value = rules.emailValidation.level;

        document.getElementById('phoneValidationToggle').checked = rules.phoneValidation.enabled;
        document.getElementById('phoneValidationLevel').value = rules.phoneValidation.level;

        document.getElementById('dateFormatPreference').value = rules.dateFormat;

        document.getElementById('zipValidationToggle').checked = rules.zipValidation.enabled;
        document.getElementById('zipValidationRegion').value = rules.zipValidation.region;
    });
}

function setupValidationHandlers() {
    // Save changes when any validation setting is changed
    const validationInputs = [
        'emailValidationToggle', 'emailValidationLevel',
        'phoneValidationToggle', 'phoneValidationLevel',
        'dateFormatPreference',
        'zipValidationToggle', 'zipValidationRegion'
    ];

    validationInputs.forEach(inputId => {
        document.getElementById(inputId).addEventListener('change', saveValidationRules);
    });
}

function saveValidationRules() {
    const rules = {
        emailValidation: {
            enabled: document.getElementById('emailValidationToggle').checked,
            level: document.getElementById('emailValidationLevel').value
        },
        phoneValidation: {
            enabled: document.getElementById('phoneValidationToggle').checked,
            level: document.getElementById('phoneValidationLevel').value
        },
        dateFormat: document.getElementById('dateFormatPreference').value,
        zipValidation: {
            enabled: document.getElementById('zipValidationToggle').checked,
            region: document.getElementById('zipValidationRegion').value
        }
    };

    chrome.storage.sync.set({ validationRules: rules });
}

/**
 * Privacy Settings
 */
function loadPrivacySettings() {
    chrome.storage.sync.get('privacySettings', function (data) {
        const defaultSettings = {
            encryptData: true,
            trackSubmissions: true
        };

        const settings = data.privacySettings || defaultSettings;

        document.getElementById('encryptionToggle').checked = settings.encryptData;
        document.getElementById('trackingToggle').checked = settings.trackSubmissions;
    });
}

function setupPrivacyHandlers() {
    // Toggle switches
    document.getElementById('encryptionToggle').addEventListener('change', function () {
        savePrivacySettings();
    });

    document.getElementById('trackingToggle').addEventListener('change', function () {
        savePrivacySettings();
    });

    // Export data button
    document.getElementById('exportDataBtn').addEventListener('click', exportData);

    // Clear tracking button
    document.getElementById('clearTrackingBtn').addEventListener('click', function () {
        showConfirmation(
            'Are you sure you want to clear all submission history? This action cannot be undone.',
            clearSubmissionHistory
        );
    });

    // Delete all data button
    document.getElementById('deleteAllDataBtn').addEventListener('click', function () {
        showConfirmation(
            'Are you sure you want to delete ALL data? This includes profiles, settings, and submission history. This action cannot be undone.',
            deleteAllData
        );
    });

    // Back to popup link
    document.getElementById('backToPopupLink').addEventListener('click', function (e) {
        e.preventDefault();
        window.close();
    });
}

function savePrivacySettings() {
    const settings = {
        encryptData: document.getElementById('encryptionToggle').checked,
        trackSubmissions: document.getElementById('trackingToggle').checked
    };

    chrome.storage.sync.set({ privacySettings: settings });
}

function exportData() {
    chrome.storage.sync.get(null, function (data) {
        // Convert data to JSON string
        const jsonString = JSON.stringify(data, null, 2);

        // Create blob and download link
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'loyalty_program_assistant_data.json';
        a.click();

        // Clean up
        URL.revokeObjectURL(url);
    });
}

function clearSubmissionHistory() {
    chrome.storage.sync.remove('submissionTracker', function () {
        alert('Submission history has been cleared.');
    });
}

function deleteAllData() {
    chrome.storage.sync.clear(function () {
        alert('All data has been deleted. The extension will now return to default settings.');
        window.location.reload();
    });
}

/**
 * Confirmation Modal
 */
function setupModal() {
    // Cancel button
    document.getElementById('cancelAction').addEventListener('click', function () {
        document.getElementById('confirmationModal').classList.add('hidden');
    });

    // Close modal when clicking outside
    window.addEventListener('click', function (e) {
        const modal = document.getElementById('confirmationModal');
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
}

function showConfirmation(message, confirmCallback) {
    document.getElementById('confirmationMessage').textContent = message;
    document.getElementById('confirmationModal').classList.remove('hidden');

    // Remove old event listener and add new one
    const confirmBtn = document.getElementById('confirmAction');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', function () {
        confirmCallback();
        document.getElementById('confirmationModal').classList.add('hidden');
    });
}