/**
 * Options page functionality for LoyaltyFill extension
 * Manages tabs, profile management, settings configuration and submission tracker
 */
document.addEventListener('DOMContentLoaded', function () {
    // Initialize managers
    const profileManager = new ProfileManager();

    // Tab Navigation
    initializeTabs();

    // Initialize different sections
    initializeProfilesSection();
    initializeSettingsSection();
    initializeTrackerSection();

    /**
     * Initialize tab switching functionality
     */
    function initializeTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Add active class to clicked button
                button.classList.add('active');

                // Show corresponding content section
                const tabId = button.id.replace('tab-', '');
                document.getElementById(`${tabId}-section`).classList.add('active');
            });
        });
    }

    /**
     * Initialize profiles section with list and editor
     */
    function initializeProfilesSection() {
        const profilesList = document.getElementById('profiles-list');
        const profileEditor = document.getElementById('profile-editor');
        const profileForm = document.getElementById('profile-form');
        const addProfileBtn = document.getElementById('add-profile');
        const cancelProfileBtn = document.getElementById('cancel-profile');
        const saveProfileBtn = document.getElementById('save-profile');

        // Load and display existing profiles
        loadProfiles();

        // Add profile button click handler
        addProfileBtn.addEventListener('click', () => {
            document.getElementById('editor-title').textContent = 'Create New Profile';
            document.getElementById('profile-id').value = '';
            profileForm.reset();

            // Show editor, hide list
            profileEditor.classList.remove('hidden');
            profilesList.classList.add('hidden');
            addProfileBtn.classList.add('hidden');
        });

        // Cancel button click handler
        cancelProfileBtn.addEventListener('click', () => {
            // Hide editor, show list
            profileEditor.classList.add('hidden');
            profilesList.classList.remove('hidden');
            addProfileBtn.classList.remove('hidden');
        });

        // Form submission handler
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const profileId = document.getElementById('profile-id').value;
            const profileData = {
                name: document.getElementById('profile-name').value,
                firstName: document.getElementById('first-name').value,
                lastName: document.getElementById('last-name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                birthdate: document.getElementById('birthdate').value,
                address: document.getElementById('address').value,
                city: document.getElementById('city').value,
                state: document.getElementById('state').value,
                zip: document.getElementById('zip').value,
                country: document.getElementById('country').value
            };

            // Create or update profile
            if (profileId) {
                await profileManager.updateProfile(profileId, profileData);
            } else {
                await profileManager.createProfile(profileData);
            }

            // Refresh the profiles list
            await loadProfiles();

            // Hide editor, show list
            profileEditor.classList.add('hidden');
            profilesList.classList.remove('hidden');
            addProfileBtn.classList.remove('hidden');
        });

        /**
         * Load and display all profiles
         */
        async function loadProfiles() {
            const profiles = await profileManager.getAllProfiles();
            const activeProfile = await profileManager.getActiveProfile();
            const activeProfileId = activeProfile ? activeProfile.id : null;

            // Clear existing profiles
            profilesList.innerHTML = '';

            // Display each profile
            Object.values(profiles).forEach(profile => {
                const profileCard = createProfileCard(profile, profile.id === activeProfileId);
                profilesList.appendChild(profileCard);
            });

            // Show message if no profiles exist
            if (Object.keys(profiles).length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-profiles';
                emptyMessage.textContent = 'No profiles yet. Create a profile to get started.';
                profilesList.appendChild(emptyMessage);
            }
        }

        /**
         * Create a profile card element
         * @param {Object} profile - The profile data
         * @param {boolean} isActive - Whether this profile is active
         * @returns {HTMLElement} The profile card element
         */
        function createProfileCard(profile, isActive) {
            const card = document.createElement('div');
            card.className = 'profile-card';
            if (isActive) card.classList.add('active');

            const header = document.createElement('div');
            header.className = 'profile-header';

            const name = document.createElement('h3');
            name.textContent = profile.name;

            const activeLabel = document.createElement('span');
            activeLabel.className = 'active-label';
            activeLabel.textContent = 'Active';

            header.appendChild(name);
            if (isActive) header.appendChild(activeLabel);

            const details = document.createElement('div');
            details.className = 'profile-details';

            details.innerHTML = `
          <p><strong>Name:</strong> ${profile.firstName} ${profile.lastName}</p>
          <p><strong>Email:</strong> ${profile.email}</p>
          ${profile.birthdate ? `<p><strong>Birthday:</strong> ${new Date(profile.birthdate).toLocaleDateString()}</p>` : ''}
        `;

            const actions = document.createElement('div');
            actions.className = 'profile-actions';

            const activateBtn = document.createElement('button');
            activateBtn.className = 'btn secondary';
            activateBtn.textContent = isActive ? 'Active' : 'Set as Active';
            activateBtn.disabled = isActive;
            activateBtn.addEventListener('click', async () => {
                await profileManager.setActiveProfile(profile.id);
                loadProfiles();
            });

            const editBtn = document.createElement('button');
            editBtn.className = 'btn secondary';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => {
                document.getElementById('editor-title').textContent = 'Edit Profile';
                document.getElementById('profile-id').value = profile.id;
                document.getElementById('profile-name').value = profile.name;
                document.getElementById('first-name').value = profile.firstName;
                document.getElementById('last-name').value = profile.lastName;
                document.getElementById('email').value = profile.email;
                document.getElementById('phone').value = profile.phone;
                document.getElementById('birthdate').value = profile.birthdate;
                document.getElementById('address').value = profile.address;
                document.getElementById('city').value = profile.city;
                document.getElementById('state').value = profile.state;
                document.getElementById('zip').value = profile.zip;
                document.getElementById('country').value = profile.country;

                // Show editor, hide list
                profileEditor.classList.remove('hidden');
                profilesList.classList.add('hidden');
                addProfileBtn.classList.add('hidden');
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn danger';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`Are you sure you want to delete the profile "${profile.name}"?`)) {
                    await profileManager.deleteProfile(profile.id);
                    loadProfiles();
                }
            });

            actions.appendChild(activateBtn);
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);

            card.appendChild(header);
            card.appendChild(details);
            card.appendChild(actions);

            return card;
        }
    }

    /**
     * Initialize settings section
     */
    function initializeSettingsSection() {
        const saveSettingsBtn = document.getElementById('save-settings');
        const clearAllDataBtn = document.getElementById('clear-all-data');

        // Load current settings
        loadSettings();

        // Save settings button click handler
        saveSettingsBtn.addEventListener('click', saveSettings);

        // Clear all data button click handler
        clearAllDataBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete ALL data? This includes all profiles and submission history and cannot be undone.')) {
                clearAllData();
            }
        });

        /**
         * Load settings from storage
         */
        function loadSettings() {
            chrome.storage.sync.get('settings', (result) => {
                const settings = result.settings || getDefaultSettings();

                // Set checkbox values
                document.getElementById('fuzzy-matching').checked = settings.fuzzyMatching;
                document.getElementById('highlight-fields').checked = settings.highlightFields;
                document.getElementById('auto-submit').checked = settings.autoSubmit;
                document.getElementById('data-encryption').checked = settings.encryptData;

                // Set custom keywords
                document.getElementById('first-name-keywords').value = settings.customKeywords.firstName.join(', ');
                document.getElementById('last-name-keywords').value = settings.customKeywords.lastName.join(', ');
                document.getElementById('email-keywords').value = settings.customKeywords.email.join(', ');
                document.getElementById('birthday-keywords').value = settings.customKeywords.birthday.join(', ');
            });
        }

        /**
         * Save settings to storage
         */
        function saveSettings() {
            const settings = {
                fuzzyMatching: document.getElementById('fuzzy-matching').checked,
                highlightFields: document.getElementById('highlight-fields').checked,
                autoSubmit: document.getElementById('auto-submit').checked,
                encryptData: document.getElementById('data-encryption').checked,
                customKeywords: {
                    firstName: document.getElementById('first-name-keywords').value.split(',').map(k => k.trim()).filter(k => k),
                    lastName: document.getElementById('last-name-keywords').value.split(',').map(k => k.trim()).filter(k => k),
                    email: document.getElementById('email-keywords').value.split(',').map(k => k.trim()).filter(k => k),
                    birthday: document.getElementById('birthday-keywords').value.split(',').map(k => k.trim()).filter(k => k)
                }
            };

            chrome.storage.sync.set({ settings }, () => {
                showNotification('Settings saved successfully!');
            });
        }

        /**
         * Clear all extension data
         */
        function clearAllData() {
            chrome.storage.sync.clear(() => {
                profileManager.clearCache();
                showNotification('All data has been deleted.');

                // Reset UI
                document.getElementById('profiles-list').innerHTML = '<div class="empty-profiles">No profiles yet. Create a profile to get started.</div>';
                document.getElementById('tracker-body').innerHTML = '';
                document.getElementById('tracker-empty').classList.remove('hidden');

                // Reload settings with defaults
                loadSettings();
            });
        }

        /**
         * Get default settings object
         * @returns {Object} Default settings
         */
        function getDefaultSettings() {
            return {
                fuzzyMatching: true,
                highlightFields: true,
                autoSubmit: false,
                encryptData: true,
                customKeywords: {
                    firstName: [],
                    lastName: [],
                    email: [],
                    birthday: []
                }
            };
        }
    }

    /**
     * Initialize tracker section with data loading and export functionality
     */
    function initializeTrackerSection() {
        const trackerTable = document.getElementById('tracker-table');
        const trackerBody = document.getElementById('tracker-body');
        const trackerEmpty = document.getElementById('tracker-empty');
        const exportCsvBtn = document.getElementById('export-csv');
        const exportJsonBtn = document.getElementById('export-json');
        const filterStatus = document.getElementById('filter-status');
        const filterDate = document.getElementById('filter-date');
        const searchTracker = document.getElementById('search-tracker');
        const clearSearchBtn = document.getElementById('clear-search');

        // Load submission data
        loadSubmissions();

        // Add event listeners for filters
        filterStatus.addEventListener('change', applyFilters);
        filterDate.addEventListener('change', applyFilters);
        searchTracker.addEventListener('input', applyFilters);
        clearSearchBtn.addEventListener('click', () => {
            searchTracker.value = '';
            applyFilters();
        });

        // Export buttons
        exportCsvBtn.addEventListener('click', exportAsCsv);
        exportJsonBtn.addEventListener('click', exportAsJson);

        /**
         * Load submission data from storage
         */
        function loadSubmissions() {
            chrome.storage.sync.get('submissions', (result) => {
                const submissions = result.submissions || [];

                if (submissions.length === 0) {
                    trackerEmpty.classList.remove('hidden');
                    return;
                }

                // Display submissions
                trackerEmpty.classList.add('hidden');
                renderSubmissions(submissions);
            });
        }

        /**
         * Apply filters to the submissions table
         */
        function applyFilters() {
            chrome.storage.sync.get('submissions', (result) => {
                const submissions = result.submissions || [];

                if (submissions.length === 0) {
                    return;
                }

                const statusFilter = filterStatus.value;
                const dateFilter = parseInt(filterDate.value);
                const searchText = searchTracker.value.toLowerCase();

                let filteredSubmissions = [...submissions];

                // Apply status filter
                if (statusFilter !== 'all') {
                    filteredSubmissions = filteredSubmissions.filter(s => {
                        if (statusFilter === 'high') {
                            return s.birthdayFieldDetected;
                        } else {
                            return !s.birthdayFieldDetected;
                        }
                    });
                }

                // Apply date filter
                if (dateFilter) {
                    const cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - dateFilter);

                    filteredSubmissions = filteredSubmissions.filter(s => {
                        const submissionDate = new Date(s.submissionDate);
                        return submissionDate >= cutoffDate;
                    });
                }

                // Apply search filter
                if (searchText) {
                    filteredSubmissions = filteredSubmissions.filter(s => {
                        return s.domain.toLowerCase().includes(searchText);
                    });
                }

                // Show/hide empty state
                if (filteredSubmissions.length === 0) {
                    trackerBody.innerHTML = '';
                    trackerEmpty.textContent = 'No submissions match your filters.';
                    trackerEmpty.classList.remove('hidden');
                } else {
                    trackerEmpty.classList.add('hidden');
                    renderSubmissions(filteredSubmissions);
                }
            });
        }

        /**
         * Render submissions in the tracker table
         * @param {Array} submissions - Array of submission objects
         */
        function renderSubmissions(submissions) {
            // Clear table body
            trackerBody.innerHTML = '';

            // Sort submissions by date (newest first)
            submissions.sort((a, b) => {
                return new Date(b.submissionDate) - new Date(a.submissionDate);
            });

            // Add each submission to the table
            submissions.forEach(submission => {
                const row = document.createElement('tr');

                // Website domain
                const domainCell = document.createElement('td');
                domainCell.textContent = submission.domain;

                // Submission date
                const dateCell = document.createElement('td');
                dateCell.textContent = new Date(submission.submissionDate).toLocaleDateString();

                // Profile used
                const profileCell = document.createElement('td');
                profileCell.textContent = submission.profileName || 'Unknown';

                // Birthday field
                const birthdayCell = document.createElement('td');
                birthdayCell.textContent = submission.birthdayFieldDetected ? 'Detected' : 'Not Detected';
                birthdayCell.className = submission.birthdayFieldDetected ? 'status-success' : 'status-neutral';

                // Reward likelihood
                const rewardCell = document.createElement('td');
                const likelihoodSpan = document.createElement('span');
                likelihoodSpan.className = `likelihood ${submission.birthdayFieldDetected ? 'high' : 'low'}`;
                likelihoodSpan.textContent = submission.birthdayFieldDetected ? 'High' : 'Low';
                rewardCell.appendChild(likelihoodSpan);

                // Actions
                const actionsCell = document.createElement('td');

                const visitBtn = document.createElement('button');
                visitBtn.className = 'btn small secondary';
                visitBtn.textContent = 'Visit Site';
                visitBtn.addEventListener('click', () => {
                    chrome.tabs.create({ url: submission.url });
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn small danger';
                deleteBtn.textContent = 'Delete';
                deleteBtn.addEventListener('click', () => {
                    deleteSubmission(submission.id);
                });

                actionsCell.appendChild(visitBtn);
                actionsCell.appendChild(deleteBtn);

                // Add cells to row
                row.appendChild(domainCell);
                row.appendChild(dateCell);
                row.appendChild(profileCell);
                row.appendChild(birthdayCell);
                row.appendChild(rewardCell);
                row.appendChild(actionsCell);

                // Add row to table
                trackerBody.appendChild(row);
            });
        }

        /**
         * Delete a submission from storage
         * @param {string} submissionId - ID of the submission to delete
         */
        function deleteSubmission(submissionId) {
            chrome.storage.sync.get('submissions', (result) => {
                let submissions = result.submissions || [];

                submissions = submissions.filter(s => s.id !== submissionId);

                chrome.storage.sync.set({ submissions }, () => {
                    loadSubmissions();
                    showNotification('Submission deleted successfully.');
                });
            });
        }

        /**
         * Export submissions as CSV
         */
        function exportAsCsv() {
            chrome.storage.sync.get('submissions', (result) => {
                const submissions = result.submissions || [];

                if (submissions.length === 0) {
                    showNotification('No submissions to export.');
                    return;
                }

                // Create CSV header
                let csvContent = 'Website,Submission Date,Profile Used,Birthday Field,Reward Likelihood,URL\n';

                // Add each submission
                submissions.forEach(s => {
                    const row = [
                        s.domain,
                        new Date(s.submissionDate).toLocaleDateString(),
                        s.profileName || 'Unknown',
                        s.birthdayFieldDetected ? 'Detected' : 'Not Detected',
                        s.birthdayFieldDetected ? 'High' : 'Low',
                        s.url
                    ];

                    // Escape fields with commas
                    const escapedRow = row.map(field => {
                        if (field.includes(',')) {
                            return `"${field}"`;
                        }
                        return field;
                    });

                    csvContent += escapedRow.join(',') + '\n';
                });

                // Create and download the file
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `loyaltyfill-submissions-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();

                showNotification('CSV exported successfully.');
            });
        }

        /**
         * Export submissions as JSON
         */
        function exportAsJson() {
            chrome.storage.sync.get('submissions', (result) => {
                const submissions = result.submissions || [];

                if (submissions.length === 0) {
                    showNotification('No submissions to export.');
                    return;
                }

                // Create and download the file
                const jsonContent = JSON.stringify(submissions, null, 2);
                const blob = new Blob([jsonContent], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `loyaltyfill-submissions-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();

                showNotification('JSON exported successfully.');
            });
        }
    }

    /**
     * Display a temporary notification
     * @param {string} message - The message to display
     */
    function showNotification(message) {
        // Check if notification already exists
        let notification = document.querySelector('.notification');

        if (!notification) {
            // Create new notification
            notification = document.createElement('div');
            notification.className = 'notification';
            document.body.appendChild(notification);
        }

        // Set message and show
        notification.textContent = message;
        notification.classList.add('show');

        // Hide after delay
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
});