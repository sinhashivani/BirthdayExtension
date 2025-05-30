let allProfiles = {};
let activeProfile = null; // Stores the currently selected profile object
let currentWorkflowStatuses = new Map(); // Map to store status for each retailer in a workflow
let currentRetailerStatuses = {}; // Crucial for renderStatusLists and updates

let profileIdInput;
let profileNameInput;
let firstNameInput;
let lastNameInput;
let emailInput;
let passwordInput;
let birthdayInput;
let phoneCountryCodeInput;
let phoneNumberInput;
let addressInput;
let address2Input;
let cityInput;
let stateInput;
let zipInput;
let countryInput;
let genderSelect;

let profileForm;
let saveProfileBtn;
let deleteProfileBtn;
let cancelProfileBtn;
let activeProfileForm;
let profileFormSection; // Declared here, assigned in DOMContentLoaded

let customRetailerNameInput;
let customRetailerUrlInput;
let addRetailerBtn;
let customRetailerMessage;

let startBulkAutofillButton;
let stopAutofillButton;
let selectAllVisibleButton;
let deselectAllVisibleButton;

let overallStatusElement;
let retailerListDiv;

// --- Helper Functions (can be global if they don't depend on DOM elements directly, or moved into DOMContentLoaded) ---

// Helper to get elements, but its usage should be *after* DOM is ready.
// Moved element declarations into DOMContentLoaded for safety.
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: Element with ID '${id}' not found.`);
        // Consider more robust error handling or showing a user-facing message
    }
    return element;
}


// --- Functions related to Profile Management and UI Display ---
// These functions will be defined inside the DOMContentLoaded listener
// to ensure they have access to the DOM elements and state variables.

// Function: showStatusMessage
// Shows a temporary status message in the UI.
// This version will be used and declared within DOMContentLoaded scope.
let statusMessageElement; // Declared here, assigned in DOMContentLoaded

function showStatusMessage(message, type = 'info') {
    if (statusMessageElement) {
        statusMessageElement.textContent = message;
        statusMessageElement.className = `status-message ${type}`;
        statusMessageElement.style.display = 'block'; // Ensure it's visible
        setTimeout(() => {
            statusMessageElement.style.display = 'none';
        }, 3000); // Hide after 3 seconds
    } else {
        console.warn(`Attempted to show status message "${message}" but statusMessageElement not found.`);
    }
}


// Function: renderStatusLists
// This function needs access to processingList, successList, attentionList, currentRetailerStatuses,
// and the count elements, all of which are defined within DOMContentLoaded.
// The code for this function was provided and appears logically sound, but its access to DOM elements
// and `currentRetailerStatuses` depends on its scope.
let processingList, successList, attentionList, processingCount, successCount, attentionCount; // Declared here, assigned in DOMContentLoaded

function renderStatusLists() {
    // Ensure elements are available before trying to manipulate them
    if (!processingList || !successList || !attentionList || !processingCount || !successCount || !attentionCount) {
        console.error("renderStatusLists: One or more status list/count elements not found. Skipping render.");
        return;
    }

    processingList.innerHTML = '';
    successList.innerHTML = '';
    attentionList.innerHTML = '';

    let pCount = 0;
    let sCount = 0;
    let aCount = 0;

    for (const retailerId in currentRetailerStatuses) {
        const statusInfo = currentRetailerStatuses[retailerId];
        const listItem = document.createElement('li');
        // Add a class for styling based on status, and a descriptive text
        listItem.textContent = `${statusInfo.retailerName || retailerId}: ${statusInfo.message || statusInfo.status}`;
        listItem.classList.add(statusInfo.status); // Add a class for styling

        // Categorize based on status for the dedicated lists
        if (statusInfo.status === 'processing' || statusInfo.status === 'filled' || statusInfo.status === 'in_progress') {
            processingList.appendChild(listItem);
            pCount++;
        } else if (statusInfo.status === 'success') {
            successList.appendChild(listItem);
            sCount++;
        } else if (statusInfo.status === 'attention' || statusInfo.status === 'stopped' || statusInfo.status === 'needs_review' || statusInfo.status === 'error') { // 'stopped' also needs attention, 'needs_review' and 'error' too
            attentionList.appendChild(listItem);
            aCount++;
        }
    }
    processingCount.textContent = pCount;
    successCount.textContent = sCount;
    attentionCount.textContent = aCount;
}


// Function: clearProfileForm
// Function: clearProfileForm
// Clears the profile form and hides it
function clearProfileForm() {
    if (activeProfileForm) activeProfileForm.reset();
    const profileIdInput = document.getElementById('profileId');
    if (profileIdInput) profileIdInput.value = '';
    if (profileFormTitle) profileFormTitle.textContent = 'Create New Profile';
    if (deleteProfileBtn) deleteProfileBtn.classList.add('hidden'); // Ensure delete button is hidden for new profile
    if (profileFormSection) profileFormSection.classList.add('hidden'); // Hide the form by default
}

// Function: fillProfileForm
// Fills the profile form with data from a selected profile and shows the form
function fillProfileForm(profile) {
    if (!profile) {
        clearProfileForm();
        return;
    }
    // Safely access elements before setting values
    document.getElementById('profileId').value = profile.id || '';
    document.getElementById('profileName').value = profile.name || '';
    document.getElementById('firstName').value = profile.first_name || '';
    document.getElementById('lastName').value = profile.last_name || '';
    document.getElementById('email').value = profile.email || '';
    document.getElementById('password').value = profile.password || '';
    document.getElementById('birthday').value = profile.birthday || '';
    document.getElementById('phoneCountryCode').value = profile.phone_country_code || '';
    document.getElementById('phoneNumber').value = profile.phone || '';
    document.getElementById('address').value = profile.address || '';
    document.getElementById('address2').value = profile.address2 || '';
    document.getElementById('city').value = profile.city || '';
    document.getElementById('state').value = profile.state || '';
    document.getElementById('zip').value = profile.zip || '';
    document.getElementById('country').value = profile.country || '';

    if (profileFormTitle) profileFormTitle.textContent = `Edit Profile: ${profile.name}`;
    if (deleteProfileBtn) deleteProfileBtn.classList.remove('hidden'); // Show delete button for existing profiles
    if (profileFormSection) profileFormSection.classList.remove('hidden'); // Show the form
}

function renderProfileSelect(profiles, activeProfileId) {
    if (!profileSelect) {
        console.error("renderProfileSelect: Profile select element not found.");
        return;
    }
    profileSelect.innerHTML = ''; // Clear existing options

    const fragment = document.createDocumentFragment();
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a profile...';
    fragment.appendChild(defaultOption);

    Object.values(profiles).sort((a, b) => a.profileName.localeCompare(b.profileName)).forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.profileName;
        if (profile.id === activeProfileId) {
            option.selected = true;
        }
        fragment.appendChild(option);
    });
    profileSelect.appendChild(fragment);

    // If an active profile was loaded, also fill the form with its data
    if (activeProfileId && profiles[activeProfileId]) {
        fillProfileForm(profiles[activeProfileId]);
        profileForm.classList.remove('hidden'); // Show the form if a profile is active
        deleteProfileBtn.classList.remove('hidden'); // Show delete button
    } else {
        clearProfileForm(); // Clear the form if no active profile
        profileForm.classList.add('hidden'); // Hide the form
        deleteProfileBtn.classList.add('hidden');
    }
}


// Function: loadProfiles
// Loads profiles from background script and updates UI dropdown
let profileSelect, newProfileBtn; // Declared here, assigned in DOMContentLoaded

async function loadProfiles() {
    console.log("loadProfiles: Sending message to background script...");
    return new Promise((resolve, reject) => { // Wrap the message sending in a Promise
        chrome.runtime.sendMessage({ action: 'loadProfile' }, (response) => {
            console.log("loadProfiles: Received response from background:", response);
            if (response && response.success) {
                allProfiles = response.profiles; // Update the global allProfiles variable
                console.log("loadProfiles: Successfully loaded profiles:", allProfiles);

                if (!profileSelect) {
                    console.error("loadProfiles: 'profileSelect' element reference is undefined. Cannot populate dropdown.");
                    showStatusMessage('Error: Profile dropdown not found.', 'error');
                    // Still resolve, but indicate no profile was set if essential elements are missing
                    activeProfile = null;
                    resolve(null);
                    return;
                }

                profileSelect.innerHTML = ''; // Clear existing options

                // Add a "New Profile" option
                const newOption = document.createElement('option');
                newOption.value = 'new';
                newOption.textContent = '--- Create New Profile ---';
                profileSelect.appendChild(newOption);

                if (Object.keys(allProfiles).length === 0) {
                    profileSelect.value = 'new';
                    profileSelect.disabled = false;
                    if (newProfileBtn) newProfileBtn.textContent = 'Create First Profile';
                    if (newProfileBtn) newProfileBtn.classList.add('hidden');
                    clearProfileForm();
                    if (profileFormSection) profileFormSection.classList.remove('hidden');
                    activeProfile = null; // No active profile if none exist yet
                } else {
                    profileSelect.disabled = false;
                    if (newProfileBtn) newProfileBtn.textContent = 'New Profile';
                    if (newProfileBtn) newProfileBtn.classList.add('hidden');

                    Object.values(allProfiles).forEach(profile => {
                        const option = document.createElement('option');
                        option.value = profile.id;
                        option.textContent = profile.name;
                        profileSelect.appendChild(option);
                    });

                    const initialActiveProfileId = response.activeProfileId;
                    if (initialActiveProfileId && allProfiles[initialActiveProfileId]) {
                        profileSelect.value = initialActiveProfileId;
                        activeProfile = allProfiles[initialActiveProfileId]; // <-- This is where activeProfile is set
                    } else {
                        // Fallback if the active ID from storage is missing or invalid, select the first profile
                        activeProfile = Object.values(allProfiles)[0] || null;
                        if (activeProfile) {
                            profileSelect.value = activeProfile.id;
                            // Inform background to update if fallback occurred
                            chrome.runtime.sendMessage({ action: 'setActiveProfile', profileId: activeProfile.id }).catch(e => console.error("Error setting active profile in background:", e));
                        } else {
                            profileSelect.value = 'new';
                            clearProfileForm();
                            if (profileFormSection) profileFormSection.classList.remove('hidden');
                        }
                    }
                    fillProfileForm(activeProfile); // Fill form with the determined active profile
                }
                resolve(activeProfile); // Resolve the promise with the determined activeProfile
            } else {
                console.error('Failed to load profiles:', response ? response.error : 'Unknown error');
                showStatusMessage('Failed to load profiles: ' + (response ? response.error : 'Unknown error'), 'error');
                if (profileSelect) {
                    profileSelect.innerHTML = '<option value="new">Error Loading Profiles (Create New)</option>';
                    profileSelect.disabled = false;
                }
                if (newProfileBtn) newProfileBtn.classList.add('hidden');
                clearProfileForm();
                if (profileFormSection) profileFormSection.classList.remove('hidden');
                reject(new Error(response?.error || 'Failed to load profiles')); // Reject the promise on error
            }
        });
    });
}
// Function: loadAndDisplayRetailers
// Loads and displays all retailers (master and custom) in the checklist
let allRetailers = {}; // Stores all retailers loaded from background

async function loadAndDisplayRetailers() {
    console.log("Bulk Autofill UI: Loading and displaying retailers...");
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getRetailerDatabase' });
        console.log("Bulk Autofill UI: Retailers loaded (full response object):", response);
        console.log("Bulk Autofill UI: Value of response.retailers:", response?.retailers); // Detailed log
        console.log("Bulk Autofill UI: Type of response.retailers:", typeof response?.retailers); // Is it an array?
        console.log("Bulk Autofill UI: Length of response.retailers:", response?.retailers?.length); // Is length correct?

        if (response && response.retailers && response.retailers.length > 0) {
            // Convert the array back to an object keyed by ID for allRetailers, if that's how it's used elsewhere
            // Assuming allRetailers expects an object:
            allRetailers = response.retailers.reduce((obj, retailer) => {
                obj[retailer.id] = retailer;
                return obj;
            }, {});
            console.log("Bulk Autofill UI: Successfully loaded allRetailers:", allRetailers);
            renderRetailerList(Object.values(allRetailers)); // Assuming you have a render function
            // Fetch active profile separately if loadProfile only sends active
            // const profileResponse = await chrome.runtime.sendMessage({ action: 'loadProfile' });
            // if (profileResponse && profileResponse.activeProfileId && profileResponse.profiles[profileResponse.activeProfileId]) {
            //     activeProfile = profileResponse.profiles[profileResponse.activeProfileId];
            // }
        } else {
            allRetailers = {};
            renderRetailerList({}); // Pass an empty object as renderRetailerList expects an object
            showStatusMessage("No retailers found for bulk autofill.", "info");
        }
    } catch (error) {
        console.error("Bulk Autofill UI: Error loading retailers:", error);
        showStatusMessage("Error loading retailers for bulk autofill. See console for details.", "error");
    }
}

function loadAndDisplayAutofillStatuses() {
    console.log("Bulk Autofill UI: Loading and displaying autofill statuses...");
    chrome.runtime.sendMessage({ action: 'getAutofillStatuses' }, (response) => {
        if (response && response.success && response.autofillStatuses) {
            console.log("UI: Autofill statuses received:", response.autofillStatuses);
            // Update currentRetailerStatuses with the latest data
            currentRetailerStatuses = response.autofillStatuses;
            renderStatusLists(); // Re-render the categorized lists
            renderWorkflowStatuses(); // Re-render the detailed workflow list

        } else {
            console.log("UI: No initial autofill statuses received or error:", response ? response.error : 'undefined');
            showStatusMessage('No autofill statuses yet.', 'info');
            // Clear lists if no statuses
            if (processingList) processingList.innerHTML = '';
            if (successList) successList.innerHTML = '';
            if (attentionList) attentionList.innerHTML = '';
            if (autofillStatusList) autofillStatusList.innerHTML = '';
            if (processingCount) processingCount.textContent = 0;
            if (successCount) successCount.textContent = 0;
            if (attentionCount) attentionCount.textContent = 0;
        }
    });
}

// Function: renderRetailerList
// Renders the retailers into the checklist section
retailerListDiv = 'retailerList'; // Use the global variable declared earlier
function renderRetailerList(retailers) {
    if (!retailerListDiv) { // Use the properly defined element
        console.error("Bulk Autofill UI: Target element with ID 'retailerList' not found. Cannot render retailers.");
        return;
    }

    retailerListDiv.innerHTML = '';

    if (Object.keys(retailers).length === 0) {
        retailerListDiv.innerHTML = '<li>No retailers configured for bulk autofill.</li>';
        return;
    }

    Object.values(retailers).forEach(retailer => {
        const listItem = document.createElement('li');
        listItem.className = 'retailer-list-item';
        // --- FIX: Add name="retailerCheckbox" and use value attribute for ID ---
        listItem.innerHTML = `
            <label>
                <input type="checkbox" class="retailer-checkbox" name="retailerCheckbox" value="${retailer.id}">
                <a href="${retailer.signupUrl}" target="_blank">${retailer.name}</a>
            </label>
        `;
        retailerListDiv.appendChild(listItem);
    });
}


// Function: updateAutofillStatus
// Updates the status display for a single retailer in the workflow
let overallStatusParagraph, autofillStatusList; // Declared here, assigned in DOMContentLoaded

function updateAutofillStatus(statusData) {
    if (statusData.retailerId === 'overall_status') {
        if (overallStatusParagraph) overallStatusParagraph.textContent = statusData.message;
        if (statusData.status === 'complete' && !statusData.needsManualReview) {
            // Only clear currentWorkflowStatuses if the overall workflow is fully complete
            // and no manual review is needed. This allows reviewing past runs.
            // Consider adding a "Clear Log" button for the user to manually clear it.
            // if (autofillStatusList) autofillStatusList.innerHTML = '';
            // currentWorkflowStatuses.clear();
        }
        return;
    }
    // Update the map for the detailed workflow status display
    currentWorkflowStatuses.set(statusData.retailerId, statusData);

    // Update the `currentRetailerStatuses` object for the categorized lists
    currentRetailerStatuses[statusData.retailerId] = {
        status: statusData.status,
        message: statusData.message,
        retailerName: statusData.retailerName // Ensure retailerName is carried over
    };

    renderWorkflowStatuses(); // Update the detailed log
    renderStatusLists(); // Update the categorized lists
}


// Function: renderWorkflowStatuses
// Renders all current workflow statuses
function renderWorkflowStatuses() {
    if (!autofillStatusList) {
        console.error("renderWorkflowStatuses: autofillStatusList element not found. Skipping render.");
        return;
    }

    autofillStatusList.innerHTML = '';
    const sortedStatuses = Array.from(currentWorkflowStatuses.values())
        .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

    sortedStatuses.forEach(status => {
        const li = document.createElement('li');
        li.className = `status-item status-${status.status.toLowerCase().replace(/_/g, '-')}`;

        let message = `<strong>${status.retailerName}</strong>: `;

        switch (status.status) {
            case 'in_progress':
                message += `<span style="color: blue;">${status.message}</span>`;
                break;
            case 'success':
                if (status.submissionSuccess) {
                    message += `<span style="color: green;">${status.message} (Success!)</span>`;
                } else if (status.autofillSuccess && status.submissionAttempted) {
                    message += `<span style="color: orange;">${status.message} (Autofill OK, Submission Failed)</span>`;
                    message += ` <button class="focus-tab-btn" data-tab-id="${status.tabId}">Go to Tab</button>`;
                } else {
                    message += `<span style="color: green;">${status.message}</span>`;
                }
                break;
            case 'needs_review':
                message += `<span style="color: orange;">${status.message} (Needs Manual Review)</span>`;
                if (status.captchaDetected) {
                    message += ' <small>(CAPTCHA detected)</small>';
                }
                message += ` <button class="focus-tab-btn" data-tab-id="${status.tabId}">Go to Tab</button>`;
                break;
            case 'error':
                message += `<span style="color: red;">${status.message} (Error: ${status.error || 'Unknown'})</span>`;
                if (status.tabId) {
                    message += ` <button class="focus-tab-btn" data-tab-id="${status.tabId}">Go to Tab</button>`;
                }
                break;
            case 'skipped':
                message += `<span style="color: gray;">${status.message}</span>`;
                break;
            default:
                message += `<span>${status.message}</span>`;
        }

        li.innerHTML = message;
        autofillStatusList.appendChild(li);
    });

    autofillStatusList.querySelectorAll('.focus-tab-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const tabId = parseInt(event.target.dataset.tabId);
            if (tabId) {
                chrome.tabs.update(tabId, { active: true }).catch(e => console.error("Error focusing tab:", e));
            }
        });
    });
}

// Function: handleSelectAllVisible
// Selects all visible retailer checkboxes.
function handleSelectAllVisible() {
    const checkboxes = document.querySelectorAll('#retailerList .retailer-checkbox');
    let selectedCount = 0;
    checkboxes.forEach(checkbox => {
        const listItem = checkbox.closest('.retailer-list-item');
        if (listItem && window.getComputedStyle(listItem).display !== 'none') {
            checkbox.checked = true;
            selectedCount++;
        }
    });
    showStatusMessage(`${selectedCount} visible retailers selected.`, "info");
}

// Function: handleDeselectAllVisible
// Deselects all visible retailer checkboxes.
function handleDeselectAllVisible() {
    const checkboxes = document.querySelectorAll('#retailerList .retailer-checkbox');
    checkboxes.forEach(checkbox => {
        // Only deselect if it's currently visible
        const listItem = checkbox.closest('.retailer-list-item');
        if (listItem && window.getComputedStyle(listItem).display !== 'none') {
            checkbox.checked = false;
        }
    });
    showStatusMessage("All visible retailers deselected.", "info");
}

// Renamed from handleEditProfile to updateProfileForm for clarity
// This function is intended to populate the form, not initiate an edit action
async function updateProfileForm(profileId) {
    console.log("Bulk Autofill Page: Attempting to update profile form for profile:", profileId);
    // Ensure allProfiles is loaded before trying to find the profile
    if (Object.keys(allProfiles).length === 0) {
        console.warn("allProfiles is empty. Loading profiles before attempting to update form.");
        await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'loadProfile' }, (response) => {
                if (response && response.success) {
                    allProfiles = response.profiles;
                } else {
                    console.error("Failed to load profiles for form update:", response ? response.error : 'Unknown');
                }
                resolve();
            });
        });
    }

    const profileToEdit = allProfiles[profileId];
    if (profileToEdit) {
        fillProfileForm(profileToEdit);
        console.log(`Bulk Autofill Page: Form filled for profile: ${profileToEdit.name}`);
    } else {
        console.error("Bulk Autofill Page: Profile not found for updating form:", profileId);
        // If profile not found, clear the form to indicate a new profile
        clearProfileForm();
    }
}

// --- Main Execution Block: Ensure DOM is fully loaded before manipulating it ---
document.addEventListener('DOMContentLoaded', async () => {

    // --- DOM Elements - Declare and assign here to ensure they exist ---
    // Using global variables declared outside to allow access from other functions
    profileSelect = getElement('profileSelect');
    profileFormTitle = getElement('profileFormTitle');
    profileIdInput = getElement('profileId');
    profileNameInput = getElement('profileName');
    firstNameInput = getElement('firstName');
    lastNameInput = getElement('lastName');
    emailInput = getElement('email');
    passwordInput = getElement('password');
    birthdayInput = getElement('birthday');
    phoneCountryCodeInput = getElement('phoneCountryCode');
    phoneNumberInput = getElement('phoneNumber');
    addressInput = getElement('address');
    address2Input = getElement('address2');
    cityInput = getElement('city');
    stateInput = getElement('state');
    zipInput = getElement('zip');
    countryInput = getElement('country');
    genderSelect = getElement('genderSelect'); // Make sure you added this to HTML

    profileForm = getElement('profileFormSection');
    newProfileBtn = getElement('newProfileBtn');
    saveProfileBtn = getElement('saveProfileBtn');
    deleteProfileBtn = getElement('deleteProfileBtn');
    cancelProfileBtn = getElement('cancelProfileBtn');
    activeProfileForm = getElement('activeProfileForm');

    retailerListDiv = getElement('retailerList'); // The <ul>
    customRetailerNameInput = getElement('customRetailerName');
    customRetailerUrlInput = getElement('customRetailerUrl');
    addRetailerBtn = getElement('addRetailerBtn');
    customRetailerMessage = getElement('customRetailerMessage');

    startBulkAutofillButton = getElement('startBulkAutofillButton');
    stopAutofillButton = getElement('stopAutofillButton');
    selectAllVisibleButton = getElement('selectAllVisibleButton');
    deselectAllVisibleButton = getElement('deselectAllVisibleButton');

    overallStatusElement = getElement('overallStatus');
    statusMessageElement = getElement('statusMessage');
    autofillStatusList = getElement('autofillStatusList');

    processingList = getElement('processingList');
    successList = getElement('successList');
    attentionList = getElement('attentionList');
    processingCount = getElement('processingCount');
    successCount = getElement('successCount');
    attentionCount = getElement('attentionCount');
    // --- Event Listeners - Attach here after elements are ensured to exist ---
    profileFormSection = getElement('profileFormSection'); // <-- Ensure this element exists and is correctly retrieved

    // Profile Management
    if (profileSelect) {
        profileSelect.addEventListener('change', async (event) => { // Made async to allow `await`
            const selectedProfileId = event.target.value;
            if (selectedProfileId === 'new') { // Handle "Create New Profile" option
                activeProfile = null;
                clearProfileForm();
                if (profileFormSection) profileFormSection.classList.remove('hidden'); // Ensure form is visible
                const profileNameInput = getElement('profileName'); // Get specific input for focus
                if (profileNameInput) profileNameInput.focus();
            } else if (selectedProfileId && allProfiles[selectedProfileId]) {
                activeProfile = allProfiles[selectedProfileId];
                fillProfileForm(activeProfile); // Fill form with the selected profile
                // Inform background script about the active profile change
                chrome.runtime.sendMessage({ action: 'setActiveProfile', profileId: selectedProfileId });
                // Hide profile form section after selection
                if (profileFormSection) profileFormSection.classList.add('hidden');
            } else {
                // Fallback for unexpected selection or no profiles
                activeProfile = null;
                clearProfileForm();
                if (profileFormSection) profileFormSection.classList.add('hidden'); // Hide if nothing valid is selected
            }
        });
    }

    // `newProfileBtn` is now largely redundant since "Create New Profile" is in the dropdown.
    // We can either remove this button from HTML or repurpose it.
    // For now, let's keep it and have it explicitly select the "new" option in the dropdown.
    if (newProfileBtn) {
        newProfileBtn.addEventListener('click', () => {
            if (profileSelect) {
                profileSelect.value = 'new'; // Set dropdown to "new"
                profileSelect.dispatchEvent(new Event('change')); // Manually trigger change event
            }
        });
    }

    if (cancelProfileBtn) {
        cancelProfileBtn.addEventListener('click', async () => {
            profileFormSection.classList.add('hidden');
            await loadProfiles(); // Reload profiles to ensure the selection reflects the actual active profile
        });
    }

    // Important: Attach event listener to the form's submit event, not the button's click
    // This allows for form validation and proper submission
    if (activeProfileForm) { // Use the form element directly
        activeProfileForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission

            const profileData = {
                id: document.getElementById('profileId').value || undefined, // Use 'undefined' for new profiles
                name: document.getElementById('profileName').value,
                first_name: document.getElementById('firstName').value,
                last_name: document.getElementById('lastName').value,
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
                birthday: document.getElementById('birthday').value,
                phone_country_code: document.getElementById('phoneCountryCode').value,
                phone: document.getElementById('phoneNumber').value,
                address: document.getElementById('address').value,
                address2: document.getElementById('address2').value,
                city: document.getElementById('city').value,
                state: document.getElementById('state').value,
                zip: document.getElementById('zip').value,
                country: document.getElementById('country').value
                // Assuming you have a 'gender' field, add it here too
                // gender: document.getElementById('genderSelect').value
            };

            if (!profileData.name) {
                showStatusMessage('Profile Name is required.', 'error');
                return;
            }

            chrome.runtime.sendMessage({ action: 'saveProfile', profile: profileData }, (response) => {
                if (response && response.success) {
                    console.log('Profile saved successfully:', response.profileId);
                    showStatusMessage('Profile saved successfully!', 'success');
                    loadProfiles(); // Reload profiles to update dropdown and active profile

                    // --- FIX STARTS HERE ---
                    // Add a check before attempting to use profileFormSection
                    if (profileFormSection) { // Check if profileFormSection is NOT null
                        profileFormSection.classList.add('hidden'); // This is your line 681
                    } else {
                        console.warn("Element 'profileFormSection' not found when trying to hide profile form after save.");
                    }
                    // --- FIX ENDS HERE ---

                } else {
                    console.error('Failed to save profile:', response.error);
                    showStatusMessage('Failed to save profile: ' + (response.error || 'Unknown error'), 'error');
                }
            });
        });
    }

    if (deleteProfileBtn) {
        deleteProfileBtn.addEventListener('click', async () => {
            if (!activeProfile || !activeProfile.id || activeProfile.id === 'default-profile' || !confirm(`Are you sure you want to delete profile "${activeProfile.name}"? This cannot be undone.`)) {
                showStatusMessage('Cannot delete default profile or no profile selected.', 'warning');
                return;
            }

            const response = await chrome.runtime.sendMessage({ action: 'deleteProfile', profileId: activeProfile.id });

            if (response && response.success) {
                showStatusMessage(`Profile "${activeProfile.name}" deleted successfully.`, 'success');
                activeProfile = null; // Clear active profile
                clearProfileForm(); // Clear the form
                await loadProfiles(); // Reload profiles to update the dropdown
            } else {
                showStatusMessage(`Failed to delete profile: ${response.error || 'Unknown error'}`, 'error');
            }
        });
    }

    // Add Custom Retailer
    if (addRetailerBtn) {
        addRetailerBtn.addEventListener('click', () => {
            const name = customRetailerNameInput.value.trim();
            const url = customRetailerUrlInput.value.trim();

            if (!name || !url) {
                if (customRetailerMessage) {
                    customRetailerMessage.textContent = 'Please fill in both name and URL.';
                    customRetailerMessage.style.color = 'red';
                }
                return;
            }

            // Generate a unique ID for custom retailers
            const id = 'custom-' + name.toLowerCase().replace(/\s/g, '-') + '-' + Date.now().toString().slice(-6); // Longer random suffix

            const customRetailer = {
                id: id,
                name: name,
                signupUrl: url,
                isCustom: true // Mark as custom
            };

            chrome.runtime.sendMessage({ action: 'addCustomRetailer', retailer: customRetailer }, (response) => {
                if (response && response.success) {
                    if (customRetailerMessage) {
                        customRetailerMessage.textContent = `Custom retailer "${name}" added successfully!`;
                        customRetailerMessage.style.color = 'green';
                    }
                    customRetailerNameInput.value = '';
                    customRetailerUrlInput.value = '';
                    showStatusMessage(response.message || "Custom retailer added.", "success");
                    loadAndDisplayRetailers(); // Reload to show the new retailer in the list
                } else {
                    if (customRetailerMessage) {
                        customRetailerMessage.textContent = `Failed to add custom retailer: ${response.message || 'Unknown error'}`;
                        customRetailerMessage.style.color = 'red';
                    }
                    console.error('Failed to add custom retailer:', response.error);
                    showStatusMessage("Error saving custom retailer.", "error");
                }
            });
        });
    }

    // Bulk Autofill Submission
    if (bulkAutofillForm) {
        bulkAutofillForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            await handleStartBulkAutofill();
        });
    }

    chrome.runtime.sendMessage({ action: "contentScriptReady" })
        .then(response => {
            if (response && response.success) {
                console.log("Content Script: Ready signal acknowledged by background.");
            } else {
                console.warn("Content Script: Ready signal sent, but no success acknowledgment from background.");
            }
        })
        .catch(error => {
            console.error("Content Script: Error sending ready signal to background:", error);
        });

    // --- Runtime Message Listener (from background script) ---
    // This listener should be set up inside DOMContentLoaded as well
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'retailerDatabaseUpdated') {
            loadAndDisplayRetailers();
            sendResponse({ success: true }); // Acknowledge receipt
        }
        // This is the new, consolidated status update action from background.js
        else if (request.action === 'updateAutofillStatusUI') {
            const { retailerId, status, message } = request.statusUpdate;

            // Update your local state if you're maintaining it
            currentRetailerStatuses[retailerId] = { status, message };

            // Find the specific retailer's status element in your HTML
            const statusElement = document.getElementById(`status-${retailerId}`);

            if (statusElement) {
                // Update the text content
                statusElement.textContent = message; // Display the full message

                // Clear any previous status classes
                statusElement.className = '';

                // Add new classes for styling (you'll need to define these in your CSS)
                if (status === 'success') {
                    statusElement.classList.add('status-success');
                } else if (status === 'partial-success') {
                    statusElement.classList.add('status-partial-success');
                } else if (status === 'needs-attention') {
                    statusElement.classList.add('status-needs-attention');
                } else if (status === 'error') {
                    statusElement.classList.add('status-error');
                } else if (status === 'in-progress') { // Add 'in-progress' if you have it
                    statusElement.classList.add('status-in-progress');
                } else {
                    statusElement.classList.add('status-info'); // Fallback for unknown/default
                }
            } else {
                console.warn(`UI: Status element not found for retailerId: ${retailerId}`);
            }
            sendResponse({ success: true }); // Acknowledge receipt
        }
        // You can remove or refactor your old 'updateBulkStatus' and 'updateAutofillUI'
        // if 'updateAutofillStatusUI' handles all the necessary updates.
        // If you keep them, ensure they don't conflict or cause redundant updates.
        /*
        else if (request.action === 'updateBulkStatus') {
            // Decide if this is still needed or if updateAutofillStatusUI covers it
            updateAutofillStatus(request.statusData); // Assuming this is your existing function
            sendResponse({ success: true });
        } else if (request.action === 'updateAutofillUI') {
            // Decide if this is still needed or if updateAutofillStatusUI covers it
            console.log(`UI: Received general update for ${request.retailerId}: ${request.status}`);
            // ... existing logic ...
            sendResponse({ success: true });
        }
        */
    });

    // IMPORTANT: If you return true here, you must call sendResponse asynchronously
    // If sendResponse is called synchronously, don't return true.
    // If no response is needed, don't call sendResponse at all.
    // For simplicity and common patterns, we're calling it synchronously here.

    // --- Initial Setup on Page Load ---
    // The initial message to check background readiness and load data should be here.
    chrome.runtime.sendMessage({ action: 'isBackgroundReady' }, async (response) => {
        if (response && response.success) {
            console.log("UI: Background script is ready. Proceeding with initial data load.");
            await loadProfiles(); // Load profiles to populate dropdown and select active
            await loadAndDisplayRetailers(); // Then load and display retailers
            // Also, immediately request current statuses to populate lists
            chrome.runtime.sendMessage({ action: 'getAutofillStatuses' }, (statusResponse) => {
                if (statusResponse && statusResponse.statuses) {
                    // Populate both currentRetailerStatuses (for categorized lists)
                    // and currentWorkflowStatuses (for detailed log)
                    currentRetailerStatuses = statusResponse.statuses;
                    Object.values(statusResponse.statuses).forEach(status => {
                        currentWorkflowStatuses.set(status.retailerId, status);
                    });
                    renderStatusLists();
                    renderWorkflowStatuses();
                } else {
                    console.warn("UI: No initial autofill statuses received or error:", statusResponse?.error);
                }
            });
        } else {
            console.error("UI: Background script not ready or error:", response?.error);
            showStatusMessage("Extension background service is not ready. Please try reloading the extension.", "error");
        }

    });
});

// --- handleStartBulkAutofill (Centralized Logic) ---
// This function manages the entire bulk autofill initiation
async function handleStartBulkAutofill() {
    if (!activeProfile || !activeProfile.id || activeProfile.id === 'new') {
        console.log("No valid active profile detected, attempting to load or create from form.");
        showStatusMessage("No active profile selected. Attempting to load or use current form fields...", "info");

        // Try to load profiles again to ensure activeProfile is updated from storage
        // This is important because the user might have just saved a profile
        // or selected one from the dropdown, and `activeProfile` needs to reflect that.
        try {
            await loadProfiles(); // This function should now set the global activeProfile
        } catch (error) {
            console.error("handleStartBulkAutofill: Error during profile load attempt:", error);
            showStatusMessage("Error loading profiles. Cannot proceed with autofill.", "error");
            return; // Exit if loading profiles failed
        }
    }

    // After attempting to load profiles, check if `activeProfile` is now set.
    // If not, it means either no profiles exist, or the one loaded is still invalid.
    if (!activeProfile || !activeProfile.id || activeProfile.id === 'new') {
        // If after loadProfiles(), activeProfile is still not properly set (e.g., no profiles exist)
        // Then, and ONLY THEN, generate a temporary profile from the form fields.
        console.log("Still no valid active profile after load, creating temporary from form fields.");
        activeProfile = { // Use the global activeProfile for consistency
            id: document.getElementById('profileId')?.value || `temp-${Date.now()}`, // Generate a temporary ID
            name: document.getElementById('profileName')?.value || 'Temporary Autofill Profile',
            first_name: document.getElementById('firstName')?.value || '',
            last_name: document.getElementById('lastName')?.value || '',
            email: document.getElementById('email')?.value || '',
            password: document.getElementById('password')?.value || '',
            birthday: document.getElementById('birthday')?.value || '',
            phone_country_code: document.getElementById('phoneCountryCode')?.value || '',
            phone: document.getElementById('phoneNumber')?.value || '',
            address: document.getElementById('address')?.value || '',
            address2: document.getElementById('address2')?.value || '',
            city: document.getElementById('city')?.value || '',
            state: document.getElementById('state')?.value || '',
            zip: document.getElementById('zip')?.value || '',
            country: document.getElementById('country')?.value || '',
            gender: document.getElementById('genderSelect')?.value || '',
            isTemporary: true // Mark as a temporary profile
        };

        // Basic validation for the temporary profile
        if (!activeProfile.name && !activeProfile.first_name && !activeProfile.email) {
            showStatusMessage("Cannot start autofill: No active profile and insufficient data in form fields.", "error");
            if (profileFormSection) profileFormSection.classList.remove('hidden'); // Show form to prompt creation
            return;
        }

        showStatusMessage(`Using data from current form fields as a temporary profile: ${activeProfile.name}`, "warning");
    }

    console.log("Bulk Autofill UI: handleStartBulkAutofill called.");
    console.log("Active Profile being used for autofill (final check):", activeProfile); // Verify here


    const selectedRetailerCheckboxes = document.querySelectorAll('#retailerList .retailer-checkbox:checked');
    const selectedRetailerIds = Array.from(selectedRetailerCheckboxes).map(cb => cb.value); // Use value attribute

    if (selectedRetailerIds.length === 0) {
        showStatusMessage("Please select at least one retailer for bulk autofill.", "warning");
        return;
    }

    showStatusMessage(`Starting bulk autofill for ${selectedRetailerIds.length} retailers...`, "info");

    // Immediately update UI to show retailers as 'processing'
    // Clear previous workflow statuses for a new run
    currentWorkflowStatuses.clear();
    selectedRetailerIds.forEach(retailerId => {
        const retailer = allRetailers[retailerId];
        const retailerName = retailer ? retailer.name : retailerId;
        // Initialize with 'in_progress' and a proper message for the workflow log
        currentWorkflowStatuses.set(retailerId, {
            retailerId: retailerId,
            retailerName: retailerName,
            status: 'in_progress',
            message: 'Queued for processing...',
            startTime: Date.now() // Track start time for sorting
        });
        // Also update currentRetailerStatuses for the categorized lists
        currentRetailerStatuses[retailerId] = {
            status: 'processing',
            message: 'Queued',
            retailerName: retailerName
        };
    });
    renderWorkflowStatuses(); // Update the detailed log
    renderStatusLists(); // Update the categorized lists

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'startBulkAutofill',
            profile: activeProfile, // Send the full activeProfile object
            retailerIds: selectedRetailerIds
        });

        if (response && response.success) {
            showStatusMessage(response.message || "Bulk autofill initiated successfully!", "success");
            // The actual status updates will come via messages from background.js
        } else {
            showStatusMessage(response.error || "Failed to initiate bulk autofill. See console.", "error");
            selectedRetailerIds.forEach(retailerId => {
                const retailer = allRetailers[retailerId];
                const retailerName = retailer ? retailer.name : retailerId;
                // Update to 'attention' on initiation failure
                currentWorkflowStatuses.set(retailerId, {
                    ...currentWorkflowStatuses.get(retailerId),
                    status: 'error',
                    message: `Initialization failed: ${response.error || 'Unknown error'}`
                });
                currentRetailerStatuses[retailerId] = {
                    status: 'attention',
                    message: `Failed to start: ${response.error || 'Unknown error'}`,
                    retailerName: retailerName
                };
            });
            renderWorkflowStatuses();
            renderStatusLists(); // Update status lists immediately on initiation failure
        }
    } catch (error) {
        console.error("Bulk Autofill UI: Error initiating bulk autofill:", error);
        showStatusMessage(`Error initiating bulk autofill: ${error.message}`, "error");
        selectedRetailerIds.forEach(retailerId => {
            const retailer = allRetailers[retailerId];
            const retailerName = retailer ? retailer.name : retailerId;
            currentWorkflowStatuses.set(retailerId, {
                ...currentWorkflowStatuses.get(retailerId),
                status: 'error',
                message: `Initialization failed: ${error.message}`
            });
            currentRetailerStatuses[retailerId] = {
                status: 'attention',
                message: `Failed to start: ${error.message}`,
                retailerName: retailerName
            };
        });
        renderWorkflowStatuses();
        renderStatusLists();
    }
}

/**
 * Renders the categorized lists of autofill statuses (Processing, Success, Attention).
 * This function relies on the globally accessible `currentRetailerStatuses` object.
 * It's called whenever `currentRetailerStatuses` is updated.
 */
function renderStatusLists() {
    // Ensure elements are available before trying to manipulate them
    if (!processingList || !successList || !attentionList || !processingCount || !successCount || !attentionCount) {
        console.error("renderStatusLists: One or more status list/count elements not found. Skipping render.");
        return;
    }

    processingList.innerHTML = '';
    successList.innerHTML = '';
    attentionList.innerHTML = '';

    let pCount = 0; // Processing count
    let sCount = 0; // Success count
    let aCount = 0; // Attention count

    // Iterate through all known retailer statuses
    for (const retailerId in currentRetailerStatuses) {
        const statusInfo = currentRetailerStatuses[retailerId];
        const listItem = document.createElement('li');
        // Use retailerName if available, otherwise fallback to retailerId
        listItem.textContent = `${statusInfo.retailerName || retailerId}: ${statusInfo.message || statusInfo.status}`;
        listItem.classList.add(statusInfo.status.toLowerCase().replace(/_/g, '-')); // Add a class for styling, normalizing name

        // Categorize based on the status type
        if (['processing', 'in_progress', 'filled'].includes(statusInfo.status.toLowerCase())) {
            processingList.appendChild(listItem);
            pCount++;
        } else if (statusInfo.status.toLowerCase() === 'success') {
            successList.appendChild(listItem);
            sCount++;
        } else if (['attention', 'stopped', 'needs_review', 'error'].includes(statusInfo.status.toLowerCase())) {
            attentionList.appendChild(listItem);
            aCount++;
        }
    }
    processingCount.textContent = pCount;
    successCount.textContent = sCount;
    attentionCount.textContent = aCount;
}

/**
 * Initializes the Bulk Autofill page by loading data and setting up event listeners.
 * This is the primary function called once the DOM is fully loaded.
 */
async function initializeBulkAutofillPage() {
    console.log("Bulk Autofill UI: DOM fully loaded, initializing.");

    // Check if the background script is ready before proceeding
    chrome.runtime.sendMessage({ action: 'isBackgroundReady' }, async (response) => {
        if (response && response.success) {
            console.log("UI: Background script is ready. Proceeding with initial data load.");
            await loadProfiles(); // Load profiles first
            await loadAndDisplayRetailers(); // Then load and display retailers

            // Also, immediately request current statuses to populate lists from any ongoing or previous run
            chrome.runtime.sendMessage({ action: 'getAutofillStatuses' }, (statusResponse) => {
                if (statusResponse && statusResponse.statuses) {
                    currentRetailerStatuses = statusResponse.statuses;
                    // Also populate currentWorkflowStatuses for the detailed log
                    Object.values(statusResponse.statuses).forEach(status => {
                        currentWorkflowStatuses.set(status.retailerId, status);
                    });
                    renderStatusLists();
                    renderWorkflowStatuses(); // Render detailed workflow statuses
                } else {
                    console.warn("UI: No initial autofill statuses received or error:", statusResponse?.error);
                }
            });
            setupEventListeners(); // Set up all event listeners AFTER initial data load
        } else {
            console.error("UI: Background script not ready or error:", response?.error);
            showStatusMessage("Extension background service is not ready. Please try reloading the extension.", "error");
        }
    });

    console.log("Bulk Autofill UI: Initial setup sequence initiated.");
}

/**
 * Sets up all necessary event listeners for the UI elements.
 * This function should be called once after all DOM elements are loaded.
 */
function setupEventListeners() {
    console.log("Dashboard: Setting up event listeners.");

    // Select All/Deselect All buttons for retailers
    getElement('selectAllVisibleButton')?.addEventListener('click', handleSelectAllVisible);
    getElement('deselectAllVisibleButton')?.addEventListener('click', handleDeselectAllVisible);

    // Start/Stop Autofill buttons
    // The previous segment already set listeners on startAutofillButton and stopAutofillButton
    // based on their global variable declarations.
    // Ensure these specific IDs match your HTML buttons.
    // If 'startBulkAutofillButton' is a separate button, its listener should be here.
    const startBulkAutofillBtn = getElement('startBulkAutofillButton');
    console.log("startBulkAutofillBtn element:", startBulkAutofillBtn);
    // Check for a specific button ID
    if (startBulkAutofillBtn) {
        startBulkAutofillBtn.addEventListener('click', handleStartBulkAutofill);
    }

    const stopAutofillBtn = getElement('stopAutofillButton'); // Check for a specific button ID
    if (stopAutofillBtn) {
        stopAutofillBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'stopBulkAutofill' }, (response) => { // Correct action name
                console.log("UI: Stop autofill response:", response);
                if (response && response.success) {
                    showStatusMessage("Bulk autofill stopped by user.", "info");
                    // Update current states to 'stopped' to reflect immediately
                    currentWorkflowStatuses.forEach((statusData, retailerId) => {
                        if (statusData.status === 'in_progress' || statusData.status === 'processing') {
                            currentWorkflowStatuses.set(retailerId, {
                                ...statusData,
                                status: 'stopped',
                                message: 'Autofill stopped by user.'
                            });
                            currentRetailerStatuses[retailerId] = {
                                status: 'stopped',
                                message: 'User stopped autofill.',
                                retailerName: statusData.retailerName
                            };
                        }
                    });
                    renderWorkflowStatuses();
                    renderStatusLists();
                } else {
                    showStatusMessage("Failed to stop autofill: " + (response?.error || "Unknown error"), "error");
                }
            });
        });
    }

    console.log("Dashboard: All event listeners set up.");
}

// Initial call to start the page initialization process
document.addEventListener('DOMContentLoaded', initializeBulkAutofillPage);