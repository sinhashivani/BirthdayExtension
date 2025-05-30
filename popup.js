// popup.js

// --- Constants (Keep these at the top) ---
const UI_STATE_KEYS = [
    'autofillHighlightToggle',
    'autoclickSubmitCheckbox',
    'showNotificationsCheckbox'
];

// --- Helper Functions ---
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: Element with ID '${id}' not found in popup.html`);
    }
    return element;
}

function showStatusMessage(message, type = 'info') {
    const statusMessageElement = getElement('statusMessage');
    if (statusMessageElement) {
        statusMessageElement.textContent = message;
        statusMessageElement.className = `status-message ${type}`;
        statusMessageElement.style.display = 'block'; // Ensure it's visible
        setTimeout(() => {
            statusMessageElement.style.display = 'none';
        }, 3000); // Hide after 3 seconds
    }
}

// --- View/Tab Management ---
function showView(viewId) {
    console.log("Popup: Switching to view:", viewId);
    document.querySelectorAll('.view-container').forEach(view => {
        view.style.display = 'none'; // Hide all views
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active'); // Deactivate all tab buttons
    });

    const targetView = getElement(viewId);
    if (targetView) {
        targetView.style.display = 'block'; // Show the target view
    }

    // Activate the corresponding tab button
    const tabButton = getElement(`${viewId.replace('View', '')}TabBtn`); // e.g., 'profileView' -> 'profileTabBtn'
    if (tabButton) {
        tabButton.classList.add('active');
    }
}

function updateProfileActionsButtons(currentActiveProfileId, allLoadedProfiles) {
    const autofillCurrentPageBtn = getElement('fillFormButton', 'popup.html');
    const editProfileBtn = getElement('editProfileBtn', 'popup.html'); // This button should open bulk_autofill.html for editing

    const hasProfiles = Object.keys(allLoadedProfiles).length > 0;
    const isDefaultProfile = currentActiveProfileId === 'default-profile';

    if (autofillCurrentPageBtn) {
        autofillCurrentPageBtn.disabled = !hasProfiles || !currentActiveProfileId;
    }

    if (editProfileBtn) {
        editProfileBtn.disabled = !hasProfiles || !currentActiveProfileId || isDefaultProfile;
        // Event listener for edit button - will open bulk_autofill.html
        editProfileBtn.onclick = () => {
            // We can pass the activeProfileId to the options page via query parameters if needed
            // But often, the options page just loads all profiles itself.
            chrome.runtime.openOptionsPage();
            window.close(); // Close the popup
        };
    }

    // Ensure the 'openBulkAutofillBtn' is always available if you want it to be
    const openBulkAutofillBtn = getElement('openBulkAutofillBtn', 'popup.html');
    if (openBulkAutofillBtn) {
        openBulkAutofillBtn.disabled = false;
        openBulkAutofillBtn.onclick = () => {
            chrome.runtime.openOptionsPage();
            window.close();
        };
    }
}

function setAutofillButtonState(enabled) {
    const autofillButton = getElement('fillFormButton');
    if (autofillButton) {
        autofillButton.disabled = !enabled;
        if (enabled) {
            autofillButton.classList.remove('disabled');
        } else {
            autofillButton.classList.add('disabled');
        }
    }
}

// --- Profile Management Functions ---

let allProfiles = {}; // Store all profiles loaded from background
let activeProfileId = null;

async function loadAndDisplayProfiles() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'loadProfile' });
        if (response && response.success) { // Check for success flag
            // Update global variables for popup.js
            profiles = response.profiles || {};
            activeProfileId = response.activeProfileId;
            console.log("Popup: All profiles loaded:", profiles);
            console.log("Popup: Active profile ID:", activeProfileId);

            // 1. Render the <select> dropdown with all profiles
            renderProfileList(profiles, activeProfileId);

            // 2. Update display elements for the currently selected profile (if any)
            //    This function should only update text/labels, not form inputs.
            updateCurrentSelectedProfileDisplay(activeProfileId, profiles); // Pass ID and full profiles obj

            // 3. Enable/disable buttons based on whether profiles exist and active selection
            updateProfileActionsButtons(activeProfileId, profiles); // Pass ID and full profiles obj

            // *** REMOVED: Interactions with profileFormContainer, updateProfileForm ***
            // The popup should NOT hide/show a profile form or call updateProfileForm.
            // That logic belongs in bulk_autofill.js.

        } else {
            const errorMsg = response ? response.error : "No response or success flag missing.";
            console.error("Popup: Error loading profiles:", errorMsg);
            showStatusMessage(`Error loading profiles: ${errorMsg}`, 'error');
            // If no profiles loaded, disable everything
            renderProfileList({}, ''); // Render empty list
            updateCurrentSelectedProfileDisplay('', {});
            updateProfileActionsButtons('', {});
        }
    } catch (error) {
        console.error("Popup: Error loading profiles:", error);
        showStatusMessage(`Error communicating with background: ${error.message}`, 'error');
        // If error, disable everything
        renderProfileList({}, ''); // Render empty list
        updateCurrentSelectedProfileDisplay('', {});
        updateProfileActionsButtons('', {});
    }
}

function renderProfileList(loadedProfiles, currentActiveProfileId) {
    const profileSelect = getElement('profileSelect', 'popup.html');
    if (!profileSelect) {
        console.error("Popup: 'profileSelect' element not found. Cannot render profile list.");
        return;
    }

    // Clear existing options
    profileSelect.innerHTML = '';

    // Add a default "Select a Profile" option if desired, or if no profiles exist
    if (Object.keys(loadedProfiles).length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No Profiles Available';
        option.disabled = true;
        profileSelect.appendChild(option);
        profileSelect.value = ''; // Ensure nothing is selected
        profileSelect.disabled = true; // Disable the select if no profiles
    } else {
        // Populate with actual profiles
        for (const id in loadedProfiles) {
            const profile = loadedProfiles[id];
            const option = document.createElement('option');
            option.value = id;
            option.textContent = profile.name;
            profileSelect.appendChild(option);
        }
        // Set the selected value to the active profile ID
        profileSelect.value = currentActiveProfileId;
        profileSelect.disabled = false; // Enable the select if profiles exist
    }

    // Add event listener for when the user changes the selection
    profileSelect.onchange = async () => {
        const newActiveProfileId = profileSelect.value;
        if (newActiveProfileId && newActiveProfileId !== activeProfileId) {
            // Send message to background script to update the active profile in storage
            const response = await chrome.runtime.sendMessage({
                action: 'setActiveProfile',
                profileId: newActiveProfileId
            });
            if (response && response.success) {
                activeProfileId = newActiveProfileId; // Update local state
                console.log("Popup: Active profile set to:", activeProfileId);
                showStatusMessage(`Active profile set to: ${loadedProfiles[activeProfileId].name}`, 'success');
                // Re-run UI updates to reflect the new active profile if needed
                updateCurrentSelectedProfileDisplay(activeProfileId, profiles);
                updateProfileActionsButtons(activeProfileId, profiles);
            } else {
                console.error("Popup: Failed to set active profile:", response ? response.error : "Unknown error");
                showStatusMessage(`Error setting active profile: ${response ? response.error : 'Unknown error'}`, 'error');
                // Revert select back to old value if setting failed
                profileSelect.value = activeProfileId;
            }
        }
    };
}


function updateCurrentSelectedProfileDisplay(currentActiveProfileId, allLoadedProfiles) {
    const profileNameDisplay = getElement('profileNameDisplay', 'popup.html'); // Assuming you have an element to show the name
    const profileEmailDisplay = getElement('profileEmailDisplay', 'popup.html'); // Assuming you have an element to show the email

    const activeProfile = allLoadedProfiles[currentActiveProfileId];

    if (activeProfile) {
        if (profileNameDisplay) profileNameDisplay.textContent = `Selected: ${activeProfile.name}`;
        if (profileEmailDisplay) profileEmailDisplay.textContent = `Email: ${activeProfile.email}`; // Example
    } else {
        if (profileNameDisplay) profileNameDisplay.textContent = 'No profile selected';
        if (profileEmailDisplay) profileEmailDisplay.textContent = '';
    }

}

async function handleAddProfile() {
    console.log("Popup: Adding new profile.");
    updateProfileForm(null); // Clear the form for a new entry
    getElement('profileNameInput').focus(); // Set focus to the first field
    showStatusMessage("Enter details for a new profile.", "info");
}

async function handleSaveProfile() {
    console.log("Popup: Saving profile...");
    const profileId = getElement('profileIdHidden').value;
    const profileName = getElement('profileNameInput').value;
    const firstName = getElement('firstNameInput').value;
    const lastName = getElement('lastNameInput').value;
    const email = getElement('emailInput').value;
    const phoneCountryCode = getElement('phoneCountryCode').value;
    const phone = getElement('phoneInput').value;
    const dob = getElement('dobInput').value;
    const address1 = getElement('address1Input').value;
    const address2 = getElement('address2Input').value;
    const city = getElement('cityInput').value;
    const state = getElement('stateInput').value;
    const zip = getElement('zipInput').value;
    const password = getElement('passwordInput').value;
    const gender = getElement('genderSelect').value;

    if (!profileName) {
        showStatusMessage("Profile Name is required!", "error");
        return;
    }

    const profileData = {
        id: profileId || `profile_${Date.now()}`, // Generate new ID if not existing
        name: profileName,
        firstName, lastName, email, phoneCountryCode, phone, dob, address1, address2, city, state, zip, password, gender
    };

    try {
        const response = await chrome.runtime.sendMessage({ action: 'saveProfile', profile: profileData });
        if (response && response.success) {
            console.log("Profile saved successfully:", response.profiles);
            allProfiles = response.profiles; // Update local profiles object
            showStatusMessage("Profile saved successfully!", "success");
            loadAndDisplayProfiles(); // Re-render the list and update UI
            // Optionally, you might want to switch back to just showing the list
            // without an active form, or keep the just-saved profile active.
            // For now, it will load the previously active profile or default.
            updateProfileForm(null); // Hide form after saving
        } else {
            throw new Error(response.error || "Unknown error saving profile.");
        }
    } catch (error) {
        console.error("Error saving profile:", error);
        showStatusMessage(`Error saving profile: ${error.message}`, "error");
    }
}

async function handleDeleteProfile() {
    const profileId = getElement('profileIdHidden').value;
    if (!profileId || profileId === 'default-profile') {
        showStatusMessage("Cannot delete default or unsaved profile.", "warning");
        return;
    }

    if (!confirm(`Are you sure you want to delete profile "${allProfiles[profileId]?.name}"?`)) {
        return;
    }

    try {
        const response = await chrome.runtime.sendMessage({ action: 'deleteProfile', profileId });
        if (response && response.success) {
            console.log("Profile deleted successfully:", response.profiles);
            allProfiles = response.profiles; // Update local profiles object
            showStatusMessage("Profile deleted successfully!", "success");
            loadAndDisplayProfiles(); // Re-render list
            updateProfileForm(null); // Clear/hide form
        } else {
            throw new Error(response.error || "Unknown error deleting profile.");
        }
    } catch (error) {
        console.error("Error deleting profile:", error);
        showStatusMessage(`Error deleting profile: ${error.message}`, "error");
    }
}

async function handleActivateProfile(profileId) {
    console.log("Popup: Activating profile:", profileId);
    if (!allProfiles[profileId]) {
        showStatusMessage("Profile not found to activate.", "error");
        return;
    }
    try {
        const response = await chrome.runtime.sendMessage({ action: 'setActiveProfile', profileId });
        if (response && response.success) {
            activeProfileId = response.activeProfileId; // Update local active ID
            console.log("Popup: Active profile set to:", activeProfileId);
            showStatusMessage(`Profile "${allProfiles[activeProfileId]?.name}" activated!`, "success");
            loadAndDisplayProfiles(); // Re-render list to show active state
            updateProfileForm(null); // Hide form
        } else {
            throw new Error(response.error || "Unknown error activating profile.");
        }
    } catch (error) {
        console.error("Popup: Error activating profile:", error);
        showStatusMessage(`Error activating profile: ${error.message}`, "error");
    }
}

function handleCancelEdit() {
    console.log("Popup: Cancelling profile edit.");
    updateProfileForm(null); // Clear/hide the form
    showStatusMessage("Profile editing cancelled.", "info");
}

// --- Autofill Functions ---

async function handleFillForm() {
    console.log("Popup: Autofill Page button clicked.");

    // Crucial Check: Ensure activeProfile has loaded and contains data
    if (!activeProfile || Object.keys(activeProfile).length === 0) { // Check if profile is empty
        showStatusMessage('Please save your profile information first.', 'warning', 5000);
        return; // Stop if no profile data
    }

    showStatusMessage('Scanning page for forms...', 'info');

    try {
        // Ensure content.js is injected. This is a common pattern for single autofill.
        // If content.js is already declared in manifest.json for 'matches' on all URLs,
        // this executeScript might not be strictly necessary, but it acts as a safeguard.
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.id) {
            await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                files: ['content.js']
            }).catch(e => {
                // This catch handles cases where content.js might already be injected (e.g., manifest declared)
                // or if there's a permission issue.
                console.warn("Popup: Content script injection might be redundant or failed:", e.message);
            });

            // Send message to content script (using your provided sendMessageToContentScript helper)
            const response = await sendMessageToContentScript({ action: 'fillForm', profile: activeProfile });

            console.log("Popup: Fill form response received:", response);

            if (response && response.formData && Object.keys(response.formData).length > 0) {
                formPreviewData = response.formData; // Store this data
                displayFieldPreview(formPreviewData); // Show the preview overlay
                showStatusMessage('Fields found and filled. Review and confirm on the page.', 'success', 5000);
            } else {
                formPreviewData = null; // Clear preview data
                hideFieldPreview(); // Ensure preview is hidden
                showStatusMessage('No recognizable fields could be filled on this page with your profile data.', 'warning', 5000);
            }
        } else {
            showStatusMessage("No active tab found.", "warning");
        }
    } catch (error) {
        console.error("Popup: Error during autofill process:", error);
        // The sendMessageToContentScript already handles showing errors, so this might be redundant,
        // but it's good for overall catch-all for `executeScript` or other issues.
        showStatusMessage(`Autofill failed: ${error.message}.`, 'error', 5000);
        formPreviewData = null;
        hideFieldPreview();
        // Re-check content script status, as an error might mean it's unreachable
        getCurrentTabStatus();
    }
}

async function handleClearForm() {
    console.log("Popup: Clear Form clicked.");
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.id) {
            // Ensure content.js is injected
            await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                files: ['content.js']
            }).catch(e => {
                console.warn("Content script might already be injected or injection failed:", e.message);
            });

            const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'clearForm' });
            console.log('Response from content script (clearForm):', response);
            if (response && response.success) {
                showStatusMessage("Form cleared successfully!", "success");
            } else {
                showStatusMessage(response.error || "Clearing form failed. No fields found or unknown error.", "error");
            }
        } else {
            showStatusMessage("No active tab found.", "warning");
        }
    } catch (error) {
        console.error("Popup: Error clearing form:", error);
        showStatusMessage(`Error clearing form: ${error.message}. Is content.js loaded?`, "error");
    }
}

async function handleOpenBulkAutofillDashboard() {
    console.log("Popup: Opening Bulk Autofill Dashboard.");
    try {
        await chrome.tabs.create({ url: 'bulk_autofill.html' }); // Assuming you have a dashboard.html
        showStatusMessage("Bulk Autofill Dashboard opened.", "info");
    } catch (error) {
        console.error("Error opening dashboard:", error);
        showStatusMessage("Could not open Bulk Autofill Dashboard.", "error");
    }
}

// --- Settings Functions ---

async function loadSettings() {
    console.log("Popup: Loading settings.");
    try {
        const response = await chrome.runtime.sendMessage({ action: 'loadSettings' });
        console.log("Popup: Settings loaded and applied.", response);
        if (response && response.settings) {
            const settings = response.settings;
            // Apply loaded settings to UI elements
            getElement('autofillHighlightToggle').checked = settings.autofillHighlight || false;
            getElement('autoclickSubmitCheckbox').checked = settings.autoclickSubmit || false;
            getElement('showNotificationsCheckbox').checked = settings.showNotifications || false;

            console.log("Popup: Settings applied to UI.");
        }
    } catch (error) {
        console.error("Popup: Error loading settings:", error);
        showStatusMessage("Error loading settings.", "error");
    }
}

async function handleSaveSettings() {
    console.log("Popup: Saving settings.");
    const settings = {
        autofillHighlight: getElement('autofillHighlightToggle').checked,
        autoclickSubmit: getElement('autoclickSubmitCheckbox').checked,
        showNotifications: getElement('showNotificationsCheckbox').checked
    };
    try {
        const response = await chrome.runtime.sendMessage({ action: 'saveSettings', settings });
        if (response && response.success) {
            console.log("Settings saved successfully:", response.settings);
            showStatusMessage("Settings saved successfully!", "success");
        } else {
            throw new Error(response.error || "Unknown error saving settings.");
        }
    } catch (error) {
        console.error("Popup: Error saving settings:", error);
        showStatusMessage(`Error saving settings: ${error.message}`, "error");
    }
}

async function handleSubmitForm() {
    console.log("Popup: Submit Form clicked.");
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.id) {
            // It's good practice to ensure content.js is injected even for simple actions,
            // as the executeScript function below runs in the isolated world.
            await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                files: ['content.js']
            }).catch(e => {
                console.warn("Content script might already be injected for submitForm:", e.message);
            });

            const results = await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                function: () => {
                    // --- IMPORTANT: You need to customize the selector below ---
                    // Find the actual submit button for the form.
                    // Try these selectors one by one, inspecting the Starbucks page to find the correct one.

                    // Example 1: By ID (most reliable if it has one)
                    let submitButton = document.getElementById('createAccountButton'); // Replace with actual ID
                    if (!submitButton) {
                        // Example 2: By type="submit" within a form
                        submitButton = document.querySelector('form button[type="submit"], form input[type="submit"]');
                    }
                    if (!submitButton) {
                        // Example 3: By specific class name (common for primary buttons)
                        submitButton = document.querySelector('.some-submit-button-class'); // Replace with actual class
                    }
                    if (!submitButton) {
                        // Example 4: By text content (less reliable, but sometimes necessary)
                        // This is more complex and might need iterating over all buttons
                        const buttons = document.querySelectorAll('button, input[type="submit"]');
                        for (let i = 0; i < buttons.length; i++) {
                            if (buttons[i].textContent.toLowerCase().includes('create account') || buttons[i].value.toLowerCase().includes('create account') || buttons[i].ariaLabel && buttons[i].ariaLabel.toLowerCase().includes('create account')) {
                                submitButton = buttons[i];
                                break;
                            }
                        }
                    }
                    // --- END IMPORTANT SECTION ---


                    if (submitButton) {
                        // Use robust click simulation for the submit button as well
                        console.log("Content script: Attempting robust click on submit button:", submitButton.id || submitButton.className || submitButton.tagName);

                        const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
                        const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
                        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });

                        submitButton.dispatchEvent(mouseDownEvent);
                        submitButton.dispatchEvent(mouseUpEvent);
                        submitButton.dispatchEvent(clickEvent);

                        console.log("Content script: Simulated robust click on submit button.");
                        return { success: true, message: "Submit button clicked." };
                    } else {
                        console.log("Content script: Submit button not found on page.");
                        return { success: false, message: "Submit button not found." };
                    }
                }
            });

            const response = results && results[0] && results[0].result;
            console.log('Response from content script (submitForm):', response);
            if (response && response.success) {
                showStatusMessage(response.message, "success");
            } else {
                showStatusMessage(response.message || "Failed to submit form due to an unknown error.", "error");
            }
        } else {
            showStatusMessage("No active tab found.", "warning");
        }
    } catch (error) {
        console.error("Popup: Error submitting form:", error);
        showStatusMessage(`Error submitting form: ${error.message}.`, "error");
    }
}

// --- NEW CODE FOR BULK AUTOFILL MANAGEMENT ---
let allRetailers = {}; // Stores all retailers loaded from background

async function loadAndDisplayRetailers() {
    console.log("Popup: Loading and displaying retailers for bulk autofill...");
    try {
        const response = await chrome.runtime.sendMessage({ action: 'loadRetailers' });
        console.log("Popup: All retailers loaded:", response);
        if (response && response.retailers) {
            allRetailers = response.retailers; // Store all retailers
            renderRetailerList(allRetailers);
        } else {
            allRetailers = {};
            renderRetailerList({});
            showStatusMessage("No retailers found for bulk autofill.", "info");
        }
    } catch (error) {
        console.error("Popup: Error loading retailers:", error);
        showStatusMessage("Error loading retailers for bulk autofill. See console for details.", "error");
    }
}

function renderRetailerList(retailers) {
    const retailerListElement = getElement('retailerList'); // Assuming an element with this ID in popup.html
    if (!retailerListElement) return;

    retailerListElement.innerHTML = ''; // Clear existing list

    if (Object.keys(retailers).length === 0) {
        retailerListElement.innerHTML = '<li>No retailers configured for bulk autofill.</li>';
        return;
    }

    Object.values(retailers).forEach(retailer => {
        const listItem = document.createElement('li');
        listItem.className = 'retailer-list-item';
        listItem.innerHTML = `
            <label>
                <input type="checkbox" class="retailer-checkbox" data-retailer-id="${retailer.id}">
                ${retailer.name} (${retailer.url})
            </label>
        `;
        retailerListElement.appendChild(listItem);
    });
}

// --- Initialization ---

async function initializeDashboard() {
    console.log("Dashboard: Initializing...");
    setupEventListeners(); // Set up interaction listeners

    try {
        // 1. Fetch and render retailers
        const retailerResponse = await chrome.runtime.sendMessage({ action: 'getRetailerDatabase' });
        if (retailerResponse && retailerResponse.retailers) { // Assuming 'retailers' key from background.js
            renderRetailerList(retailerResponse.retailers);
        } else {
            showStatusMessage("No retailer data found for dashboard.", "info");
        }

        // 2. Fetch and render profiles
        const profileResponse = await chrome.runtime.sendMessage({ action: 'loadProfile' }); // This typically loads all profiles and the active one
        if (profileResponse && profileResponse.profiles) {
            renderProfilesList(profileResponse.profiles, profileResponse.activeProfileId);
            // You might also display the active profile name prominently
            const activeProfileNameElement = getElement('activeProfileName');
            if (activeProfileNameElement) {
                const activeProfile = profileResponse.profiles[profileResponse.activeProfileId];
                activeProfileNameElement.textContent = activeProfile ? `Active: ${activeProfile.name}` : 'No active profile';
            }
        } else {
            showStatusMessage("No profile data found for dashboard.", "info");
        }

        // 3. (Optional) Fetch and display general settings
        const settingsResponse = await chrome.runtime.sendMessage({ action: 'loadSettings' });
        if (settingsResponse && settingsResponse.settings) {
            // Populate settings form fields, e.g., getElement('optOutEmailCheckbox').checked = settingsResponse.settings.autoOptOutEmailSubscription;
            console.log("Dashboard: Loaded settings:", settingsResponse.settings);
        }

        // ... other dashboard specific data loading or component initialization
        console.log("Dashboard: All initializations complete.");

    } catch (error) {
        console.error("Dashboard: Error during initialization:", error);
        showStatusMessage(`Error loading dashboard data: ${error.message}`, "error");
    }
}

async function initializePopup() {
    console.log("Popup: DOM fully loaded, initializing.");
    console.log("Popup: Initializing popup.");

    showView('profileView'); // Initial view is profiles

    // Load initial data
    await loadAndDisplayProfiles();
    // REMOVE await loadAndPopulateRetailerDropdown(); // REMOVE THIS LINE
    await loadSettings();

    setupEventListeners();


    console.log("Popup: All initializations complete.");
}

function displayFieldPreview(formData) {
    const previewArea = document.getElementById('formPreviewArea'); // Assuming you have a div for this
    if (!previewArea) {
        console.warn("Popup: No 'formPreviewArea' element found for preview.");
        return;
    }
    previewArea.innerHTML = '<h4>Filled Fields:</h4>';
    if (Object.keys(formData).length === 0) {
        previewArea.innerHTML += '<p>No fields were filled.</p>';
    } else {
        const ul = document.createElement('ul');
        for (const key in formData) {
            const li = document.createElement('li');
            li.textContent = `${key}: ${formData[key]}`;
            ul.appendChild(li);
        }
        previewArea.appendChild(ul);
    }
    previewArea.style.display = 'block'; // Show the preview area
}

function hideFieldPreview() {
    const previewArea = document.getElementById('formPreviewArea'); // Assuming you have a div for this
    if (previewArea) {
        previewArea.style.display = 'none';
        previewArea.innerHTML = ''; // Clear content
    }
}

async function getCurrentTabStatus() {
    try {
        const response = await sendMessageToContentScript({ action: 'ping' });
        if (response && response.status === 'pong') {
            setAutofillButtonState(true); // Content script is ready
        } else {
            setAutofillButtonState(false); // Content script responded but not as expected
        }
    } catch (error) {
        console.log("Popup: Content script not reachable/responsive for status check.", error.message);
        setAutofillButtonState(false); // Content script not ready or error
    }
}

function setupPopupEventListeners() {
    // Listener for the button to open the bulk autofill page
    const autofillCurrentPageBtn = getElement('fillFormButton');
    if (autofillCurrentPageBtn) {
        autofillCurrentPageBtn.addEventListener('click', handleFillForm);
    } else {
        console.warn("Popup: Autofill Current Page button (ID: 'fillFormButton') not found.");
    }

    // 2. Edit Profile Button (Opens options page for editing)
    const editProfileBtn = getElement('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            console.log("Popup: Edit Profile button clicked. Opening options page.");
            chrome.runtime.openOptionsPage(); // This opens bulk_autofill.html (your options page)
            window.close(); // Close the popup immediately
        });
    } else {
        console.warn("Popup: Edit Profile button (ID: 'editProfileBtn') not found.");
    }
    // Add other event listeners for your popup.html elements here
    // e.g., autofillCurrentPageBtn, profileSelect change listener, etc.
    const openBulkAutofillBtn = getElement('openBulkAutofillBtn');
    if (openBulkAutofillBtn) {
        openBulkAutofillBtn.addEventListener('click', () => {
            console.log("Popup: Opening Bulk Autofill / Manage Profiles page.");
            chrome.runtime.openOptionsPage(); // This opens bulk_autofill.html in a new tab
            window.close(); // Close the popup immediately
        });
    } else {
        console.warn("Popup: Button with ID 'openBulkAutofillBtn' not found. Cannot set up link to Bulk Autofill page.");
    }
    console.log("Popup: All event listeners set up.");
}

function setAutofillButtonState(enabled) {
    const autofillButton = document.getElementById('fillFormButton'); t
    if (autofillButton) {
        autofillButton.disabled = !enabled;
        // Optionally add/remove a class for visual feedback
        if (enabled) {
            autofillButton.classList.remove('disabled');
        } else {
            autofillButton.classList.add('disabled');
        }
    }
}

async function sendMessageToContentScript(message) {
    console.log("Popup: Sending message to content script:", message.action);
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0 || !tabs[0]) {
                console.warn("Popup: No active tab found to send message to.");
                showStatusMessage('No active tab available.', 'warning', 3000);
                setAutofillButtonState(false);
                reject(new Error('No active tab'));
                return;
            }
            const tabId = tabs[0].id;

            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    const error = chrome.runtime.lastError;
                    console.error(`Popup: Error sending message to tab ${tabId}:`, error.message);
                    let statusMsg = `Error interacting with page.`;
                    if (error.message.includes('Could not establish connection')) {
                        statusMsg = 'Content script not loaded on this page.';
                        setAutofillButtonState(false);
                    }
                    showStatusMessage(statusMsg, 'error', 5000);
                    reject(error);
                } else {
                    console.log(`Popup: Response from content script (tab ${tabId}) for ${message.action}:`, response);
                    resolve(response);
                }
            });
        });
    });
}


function setupEventListeners() {
    console.log("Popup: Setting up event listeners.");

    // Tab buttons
    getElement('profileTabBtn')?.addEventListener('click', () => showView('profileView'));
    getElement('autofillTabBtn')?.addEventListener('click', () => showView('autofillView'));
    getElement('autoSignupTabBtn')?.addEventListener('click', () => showView('autoSignupView'));
    getElement('settingsTabBtn')?.addEventListener('click', () => showView('settingsView'));

    // Profile Management Buttons
    getElement('addNewProfileButton')?.addEventListener('click', handleAddProfile);
    getElement('saveProfileButton')?.addEventListener('click', handleSaveProfile);
    getElement('deleteProfileButton')?.addEventListener('click', handleDeleteProfile);
    getElement('cancelEditButton')?.addEventListener('click', handleCancelEdit);

    // Delegated listeners for dynamic profile list items
    getElement('profileList')?.addEventListener('click', (event) => {
        const target = event.target;
        const profileId = target.dataset.profileId;
        if (target.classList.contains('activate-profile-button') && profileId) {
            handleActivateProfile(profileId);
        } else if (target.classList.contains('edit-profile-button') && profileId) {
            handleEditProfile(profileId);
        }
    });

    // Autofill Buttons
    // REMOVE getElement('retailerSelect')?.addEventListener('change', handleRetailerSelectChange); // REMOVE THIS LINE
    getElement('fillFormButton')?.addEventListener('click', handleFillForm);
    getElement('clearFormButton')?.addEventListener('click', handleClearForm);
    getElement('submitFormButton')?.addEventListener('click', handleSubmitForm);
    getElement('openBulkAutofillDashboardBtn')?.addEventListener('click', handleOpenBulkAutofillDashboard);

    // Settings Buttons
    getElement('saveSettingsButton')?.addEventListener('click', handleSaveSettings);

    console.log("Popup: All event listeners set up.");
}

// Initializing the popup when the DOM content is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("Popup: DOM fully loaded, initializing.");
    initializePopup();
    setupPopupEventListeners(); // Call a dedicated function for listeners
});