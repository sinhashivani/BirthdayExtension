const RETAILER_DB_KEY = 'customRetailerDatabase'; // Key for storing only custom retailers
let allRetailers = {}; // Stores the MERGED list of master + custom retailers for UI display
let activeProfile = null; // Placeholder for future profile management

// Global DOM element reference (assigned in DOMContentLoaded)
let retailerListDiv = null;


function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: Element with ID '${id}' not found.`);
    }
    return element;
}









//PROFILES SECTION
function clearProfileForm() {
    profileIdField.value = '';
    profileNameField.value = '';
    firstNameField.value = '';
    lastNameField.value = '';
    emailField.value = '';
    passwordField.value = ''; // Clear password field
    birthdayField.value = ''; // Clear birthday
    phoneCountryCodeField.value = ''; // Clear phone fields
    phoneNumberField.value = '';
    addressField.value = ''; // Clear address fields
    address2Field.value = '';
    cityField.value = '';
    stateField.value = '';
    zipField.value = '';
    countryField.value = '';
    // if (genderSelectField) genderSelectField.value = ''; // Clear gender if applicable

    deleteProfileBtn.classList.add('hidden');
    document.getElementById('saveProfileBtn').textContent = 'Create Profile';
    deleteProfileBtn.disabled = true; // Always disable delete when creating new
}

// Function to fill the profile form with data
function fillProfileForm(profile) {
    if (profile) {
        profileIdField.value = profile.id || '';
        profileNameField.value = profile.name || '';
        firstNameField.value = profile.firstName || '';
        lastNameField.value = profile.lastName || '';
        emailField.value = profile.email || '';
        passwordField.value = profile.password || ''; // Fill password field
        birthdayField.value = profile.birthday || ''; // Fill birthday
        phoneCountryCodeField.value = profile.phoneCountryCode || ''; // Fill phone fields
        phoneNumberField.value = profile.phone || '';
        addressField.value = profile.address || ''; // Fill address fields
        address2Field.value = profile.address2 || '';
        cityField.value = profile.city || '';
        stateField.value = profile.state || '';
        zipField.value = profile.zip || '';
        countryField.value = profile.country || '';
        // if (genderSelectField) genderSelectField.value = profile.gender || ''; // Fill gender if applicable


        deleteProfileBtn.classList.remove('hidden');
        // Prevent deleting the very last profile
        if (Object.keys(allProfiles).length <= 1) {
            deleteProfileBtn.disabled = true;
        } else {
            deleteProfileBtn.disabled = false;
        }
        document.getElementById('saveProfileBtn').textContent = 'Update Profile';
    } else {
        clearProfileForm();
        deleteProfileBtn.disabled = true; // No profile selected, disable delete
    }
}

/**
 * Loads profiles and the active profile ID from the background script.
 * Updates global variables and refreshes the UI.
 */
async function loadProfiles() {
    console.log("Bulk Autofill Page: Loading profiles...");
    try {
        const response = await chrome.runtime.sendMessage({ action: 'loadProfile' });
        if (response && response.success) {
            allProfiles = response.profiles || {};
            const activeProfileId = response.activeProfileId;
            console.log("Bulk Autofill Page: Profiles loaded:", allProfiles);

            if (activeProfileId && allProfiles[activeProfileId]) {
                activeProfile = allProfiles[activeProfileId];
            } else if (Object.keys(allProfiles).length > 0) {
                // If no active profile, or it was deleted, set the first one as active
                const firstProfileId = Object.keys(allProfiles)[0];
                activeProfile = allProfiles[firstProfileId];
                // Also update background script about the new active profile
                await chrome.runtime.sendMessage({ action: 'setActiveProfile', profileId: firstProfileId });
            } else {
                activeProfile = null; // No profiles available
            }

            populateProfileDropdown(); // Always re-populate dropdown after loading
            console.log("Bulk Autofill Page: Profiles loaded and dropdown populated.");

        } else {
            console.error("Bulk Autofill Page: Failed to load profiles:", response ? response.error : 'Unknown error');
            showStatusMessage('Failed to load profiles.', 'error');
        }
    } catch (error) {
        console.error("Bulk Autofill Page: Error during profile loading:", error);
        showStatusMessage('Error loading profiles. Please check console.', 'error');
    }
}

// Function to update the profile form (your provided function)
async function updateProfileForm(profileId) {
    console.log("Bulk Autofill Page: Attempting to update profile form for profile:", profileId);
    // Ensure allProfiles is loaded before trying to find the profile
    if (Object.keys(allProfiles).length === 0) {
        console.warn("Bulk Autofill Page: allProfiles is empty. Loading profiles before attempting to update form.");
        await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'loadProfile' }, (response) => {
                if (response && response.success) {
                    allProfiles = response.profiles;
                } else {
                    console.error("Bulk Autofill Page: Failed to load profiles for form update:", response ? response.error : 'Unknown');
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

/**
 * Populates the profile dropdown with profiles from the allProfiles global object.
 * Selects the active profile if one is set.
 */
function populateProfileDropdown() {
    profileSelect = getElement('profileSelect'); // Ensure profileSelect is assigned here

    if (!profileSelect) {
        console.error("Profile select element not found.");
        return;
    }

    profileSelect.innerHTML = ''; // Clear existing options

    // Add "Create New Profile" option
    const newOption = document.createElement('option');
    newOption.value = 'new';
    newOption.textContent = 'Create New Profile';
    profileSelect.appendChild(newOption);

    // Add existing profiles
    const profileIds = Object.keys(allProfiles);
    if (profileIds.length > 0) {
        // Sort profiles alphabetically by name, case-insensitive
        const sortedProfileIds = profileIds.sort((a, b) => {
            const nameA = allProfiles[a].name ? allProfiles[a].name.toLowerCase() : '';
            const nameB = allProfiles[b].name ? allProfiles[b].name.toLowerCase() : '';
            return nameA.localeCompare(nameB);
        });


        sortedProfileIds.forEach(id => {
            const profile = allProfiles[id];
            if (profile && profile.name) { // Ensure profile and name exist
                const option = document.createElement('option');
                option.value = id;
                option.textContent = profile.name;
                profileSelect.appendChild(option);
            }
        });
    }

    // Set the active profile in the dropdown
    if (activeProfile && activeProfile.id) {
        profileSelect.value = activeProfile.id;
        fillProfileForm(activeProfile); // Also fill the form with the active profile
        if (profileFormSection) profileFormSection.classList.add('hidden'); // Hide form for existing
    } else {
        // If no active profile, or 'new' was selected, ensure 'Create New Profile' is selected
        profileSelect.value = 'new';
        clearProfileForm(); // Clear the form if no active profile or "new" is selected
        if (profileFormSection) profileFormSection.classList.remove('hidden'); // Show form for new
    }
}




//END PROFILES SECTION








//RETAILER SECTION

// --- Master Retailer Database Function ---
// This provides the static, built-in list of retailers.
function getMasterRetailerDatabase() {
    const masterRetailersArray = [
        { id: 'amazon', name: 'Amazon', signupUrl: 'https://www.amazon.com/ap/register/ref=ap_frn_reg', isCustom: false, selectors: {} },
        { id: 'ebay', name: 'eBay', signupUrl: 'https://reg.ebay.com/reg/PartialReg', isCustom: false, selectors: {} },
        { id: 'walmart', name: 'Walmart', signupUrl: 'https://www.walmart.com/account/signup', isCustom: false, selectors: {} },
        { id: 'target', name: 'Target', signupUrl: 'https://www.target.com/account/create', isCustom: false, selectors: {} },
        { id: 'bestbuy', name: 'Best Buy', signupUrl: 'https://www.bestbuy.com/identity/createAccount', isCustom: false, selectors: {} },
        { id: 'homedepot', name: 'Home Depot', signupUrl: 'https://www.homedepot.com/account/create', isCustom: false, selectors: {} },
        { id: 'lowes', name: 'Lowe\'s', signupUrl: 'https://www.lowes.com/login/createAccount', isCustom: false, selectors: {} },
        { id: 'costco', name: 'Costco', signupUrl: 'https://www.costco.com/join-costco.html', isCustom: false, selectors: {} },
        { id: 'kroger', name: 'Kroger', signupUrl: 'https://www.kroger.com/account/create', isCustom: false, selectors: {} },
        { id: 'walgreens', name: 'Walgreens', signupUrl: 'https://www.walgreens.com/register/new-user', isCustom: false, selectors: {} },
        { id: 'cvspharmacy', name: 'CVS Pharmacy', signupUrl: 'https://www.cvs.com/account/create-account', isCustom: false, selectors: {} },
        { id: 'starbucks', name: 'Starbucks', signupUrl: 'https://www.starbucks.com/account/create', isCustom: false, selectors: {} },
        { id: 'dominos', name: 'Domino\'s Pizza', signupUrl: 'https://www.dominos.com/en/pages/customer/#!/customer/login/register/', isCustom: false, selectors: {} },
        { id: 'papajohns', name: 'Papa John\'s', signupUrl: 'https://www.papajohns.com/create-account.html', isCustom: false, selectors: {} },
        { id: 'mcdonalds', name: 'McDonald\'s', signupUrl: 'https://www.mcdonalds.com/us/en-us/mymcdonalds-rewards/register', isCustom: false, selectors: {} },
        { id: 'burgerking', name: 'Burger King', signupUrl: 'https://www.bk.com/rewards/enroll', isCustom: false, selectors: {} },
        { id: 'subway', name: 'Subway', signupUrl: 'https://www.subway.com/en-US/Rewards', isCustom: false, selectors: {} },
        { id: 'chipotle', name: 'Chipotle', signupUrl: 'https://www.chipotle.com/order/create-account', isCustom: false, selectors: {} },
        { id: 'panerabread', name: 'Panera Bread', signupUrl: 'https://www.panerabread.com/en-us/mypanera/join.html', isCustom: false, selectors: {} },
        { id: 'chickfila', name: 'Chick-fil-A', signupUrl: 'https://www.chick-fil-a.com/myaccount/signup', isCustom: false, selectors: {} }
    ];

    return masterRetailersArray.reduce((acc, retailer) => {
        acc[retailer.id] = retailer;
        return acc;
    }, {});
}

// --- Functions to manage CUSTOM retailers in chrome.storage.local ---
async function getCustomRetailers() {
    console.log("Fetching custom retailers from storage...");
    const result = await chrome.storage.local.get([RETAILER_DB_KEY]);
    return result[RETAILER_DB_KEY] || [];
}

async function saveCustomRetailers(customRetailers) {
    console.log("Saving custom retailers to storage:", customRetailers);
    await chrome.storage.local.set({ [RETAILER_DB_KEY]: customRetailers });
}

// --- Add Retailer Function (specifically for custom ones) ---
async function addRetailer(name, url) {
    // First, ensure allRetailers is up-to-date for the duplicate check
    await loadAndDisplayRetailers(); // This populates `allRetailers`

    // Check for duplicates in the combined list (master + custom)
    const isDuplicate = Object.values(allRetailers).some(retailer =>
        retailer.name.toLowerCase() === name.toLowerCase() ||
        retailer.signupUrl.toLowerCase() === url.toLowerCase()
    );

    if (isDuplicate) {
        alert('A retailer with this name or URL already exists in your list.');
        return; // Do not add if it's a duplicate
    }

    const currentCustomRetailers = await getCustomRetailers();
    const newRetailer = {
        id: self.crypto.randomUUID(), // UUID for custom retailers
        name: name,
        signupUrl: url,
        isCustom: true, // Mark as custom
        selectors: {} // Placeholder for selectors
    };
    currentCustomRetailers.push(newRetailer);
    await saveCustomRetailers(currentCustomRetailers); // Save only the custom list

    // After saving, reload and re-render the *combined* list in the UI
    await loadAndDisplayRetailers();
    showStatusMessage(`Retailer "${name}" added successfully!`, "success");
}

// --- Delete Retailer Function (only allows deletion of custom ones) ---
async function deleteRetailer(id) {
    if (allRetailers[id] && allRetailers[id].isCustom) {
        if (confirm(`Are you sure you want to delete "${allRetailers[id]?.name || 'this retailer'}"?`)) {
            let customRetailersInStorage = await getCustomRetailers();
            customRetailersInStorage = customRetailersInStorage.filter(r => r.id !== id);
            await saveCustomRetailers(customRetailersInStorage);
            await loadAndDisplayRetailers();
            showStatusMessage(`Retailer "${allRetailers[id]?.name || 'a retailer'}" deleted successfully.`, "success");
        }
    } else {
        alert("You cannot delete a default master retailer.");
    }
}

// --- Render Retailer List Function (Displays combined list) ---
function renderRetailerList(retailersToDisplay) {
    if (!retailerListDiv) {
        console.error("Bulk Autofill UI: Target element with ID 'retailerList' not found. Cannot render retailers.");
        return;
    }

    retailerListDiv.innerHTML = '';

    if (!retailersToDisplay || retailersToDisplay.length === 0) {
        retailerListDiv.innerHTML = '<p id="noRetailersMessage">No retailers available. Add one above!</p>';
        return;
    }

    retailersToDisplay.forEach(retailer => {
        const listItem = document.createElement('div');
        listItem.className = 'retailer-item';
        listItem.setAttribute('data-retailer-id', retailer.id);

        // REMOVED: checkboxDisabled (now all are selectable)
        const deleteButtonHidden = retailer.isCustom ? '' : 'style="display:none;"';
        const editButtonHidden = retailer.isCustom ? '' : 'style="display:none;"';

        listItem.innerHTML = `
            <div class="retailer-info">
                <input type="checkbox" class="retailer-checkbox" value="${retailer.id}">
                <span><a href="${retailer.signupUrl}" target="_blank" rel="noopener noreferrer">${retailer.name}</a></span>
                <span class="retailer-url-display"> (${retailer.signupUrl})</span>
            </div>
            <div class="retailer-actions">
                <button class="edit-retailer" data-id="${retailer.id}" ${editButtonHidden}>Edit</button>
                <button class="delete-retailer" data-id="${retailer.id}" ${deleteButtonHidden}>Delete</button>
            </div>
            <span class="status-display status-ready">Status: Ready</span>
        `;
        retailerListDiv.appendChild(listItem);
    });

    // Add event listeners for Delete buttons (MUST BE ADDED AFTER ELEMENTS ARE CREATED)
    retailerListDiv.querySelectorAll('.delete-retailer').forEach(button => {
        button.addEventListener('click', async (event) => {
            const idToDelete = event.target.dataset.id;
            await deleteRetailer(idToDelete); // Confirmation is now inside deleteRetailer
        });
    });

    // Add event listeners for Edit buttons (implementation needed)
    retailerListDiv.querySelectorAll('.edit-retailer').forEach(button => {
        button.addEventListener('click', async (event) => {
            const idToEdit = event.target.dataset.id;
            console.log("Edit functionality to be implemented for retailer ID:", idToEdit);
            const retailerToEdit = allRetailers[idToEdit];
            if (retailerToEdit) {
                if (retailerToEdit.isCustom) {
                    alert(`Editing custom retailer: ${retailerToEdit.name}`);
                    // TODO: Implement modal or inline form for editing custom retailer details
                } else {
                    // This alert should ideally not be reachable if the button is hidden
                    alert(`You cannot edit default master retailer: ${retailerToEdit.name}.`);
                }
            }
        });
    });
}

// --- showStatusMessage (helper for UI feedback) ---
function showStatusMessage(message, type = "info") {
    const statusDisplay = document.getElementById('autofillStatusDisplay');
    if (statusDisplay) {
        statusDisplay.innerHTML = `<p class="status-${type}">${message}</p>`;
        setTimeout(() => {
            // Only clear if the current message is still the one we set
            if (statusDisplay.innerHTML === `<p class="status-${type}">${message}</p>`) {
                statusDisplay.innerHTML = '';
            }
        }, 5000); // Clear after 5 seconds
    } else {
        console.warn("Status display element not found:", message);
    }
}

// --- Load and Display ALL Retailers (Master + Custom) ---
async function loadAndDisplayRetailers() {
    console.log("Bulk Autofill UI: Loading and displaying retailers...");
    try {
        const masterRetailers = getMasterRetailerDatabase();
        const customRetailersArray = await getCustomRetailers();

        const customRetailersObject = customRetailersArray.reduce((obj, retailer) => {
            obj[retailer.id] = retailer;
            return obj;
        }, {});

        allRetailers = { ...masterRetailers, ...customRetailersObject };

        console.log("Bulk Autofill UI: Combined allRetailers:", allRetailers);

        renderRetailerList(Object.values(allRetailers));

        if (Object.keys(allRetailers).length === 0) {
            showStatusMessage("No retailers found. Add one above!", "info");
        }

    } catch (error) {
        console.error("Bulk Autofill UI: Error loading retailers:", error);
        showStatusMessage("Error loading retailers for bulk autofill. See console for details.", "error");
    }
}

//END RETAILER SECTION




// --- Main DOMContentLoaded Listener ---
document.addEventListener('DOMContentLoaded', async () => {
    // --- Initialize global DOM element references here ---
    retailerListDiv = getElement('retailerList');
    profileSelect = getElement('profileSelect');
    profileSelect = getElement('profileSelect');
    profileFormSection = getElement('profileFormSection'); // Ensure you have this ID in your HTML

    // Profile fields (ensure IDs match your HTML)
    profileIdField = getElement('profileId');
    profileNameField = getElement('profileName');
    firstNameField = getElement('firstName');
    lastNameField = getElement('lastName');
    emailField = getElement('email');
    passwordField = getElement('password'); // Added
    birthdayField = getElement('birthday'); // Added
    phoneCountryCodeField = getElement('phoneCountryCode'); // Added
    phoneNumberField = getElement('phoneNumber'); // Added
    addressField = getElement('address'); // Added
    address2Field = getElement('address2'); // Added
    cityField = getElement('city'); // Added
    stateField = getElement('state'); // Added
    zipField = getElement('zip'); // Added
    countryField = getElement('country'); // Added
    genderSelectField = getElement('genderSelect');


    await loadProfiles();

    // Event listener for profile selection change
    if (profileSelect) {
        profileSelect.addEventListener('change', async (event) => {
            const selectedProfileId = event.target.value;
            if (selectedProfileId === 'new') {
                activeProfile = null;
                clearProfileForm();
                if (profileFormSection) profileFormSection.classList.remove('hidden');
                const profileNameInput = getElement('profileName');
                if (profileNameInput) profileNameInput.focus();
                await chrome.runtime.sendMessage({ action: 'setActiveProfile', profileId: null })
                    .catch(e => console.error("Bulk Autofill Page: Error setting active profile to null in background:", e));
                showStatusMessage('Creating a new profile.', 'info');
            } else if (selectedProfileId && allProfiles[selectedProfileId]) {
                activeProfile = allProfiles[selectedProfileId];
                fillProfileForm(activeProfile);
                await chrome.runtime.sendMessage({ action: 'setActiveProfile', profileId: selectedProfileId })
                    .catch(e => console.error("Bulk Autofill Page: Error setting active profile in background:", e));
                if (profileFormSection) profileFormSection.classList.add('hidden');
                showStatusMessage(`Profile "${activeProfile.name}" selected.`, 'info');
            } else {
                activeProfile = null;
                clearProfileForm();
                if (profileFormSection) profileFormSection.classList.add('hidden');
                showStatusMessage('No valid profile selected.', 'warning');
            }
        });
    }

    // `newProfileBtn` is now largely redundant since "Create New Profile" is in the dropdown.
    // For now, let's keep it and have it explicitly select the "new" option in the dropdown.
    // Event listener for the SAVE button (Corrected)
    const saveProfileBtn = getElement('saveProfileBtn'); // Make sure you have this ID
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async (event) => {
            // Trigger the form's submit event, which handles sending the message to background
            if (activeProfileForm) {
                activeProfileForm.dispatchEvent(new Event('submit'));
            } else {
                console.error("Bulk Autofill Page: activeProfileForm not found for save button click.");
                showStatusMessage('Error: Profile form not found.', 'error');
            }
        });
    }

    // Event listener for the NEW PROFILE button (optional, as "Create New" is in dropdown)
    const newProfileBtn = getElement('newProfileBtn');
    if (newProfileBtn) {
        newProfileBtn.addEventListener('click', () => {
            if (profileSelect) {
                profileSelect.value = 'new';
                profileSelect.dispatchEvent(new Event('change')); // Trigger change event
            }
        });
    }

    // Event listener for the EDIT PROFILE button
    const editProfileBtn = getElement('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            if (activeProfile) {
                fillProfileForm(activeProfile); // Populate form for editing
                if (profileFormSection) profileFormSection.classList.remove('hidden'); // Show form
                showStatusMessage(`Editing profile: "${activeProfile.name}"`, 'info');
            } else {
                showStatusMessage('Please select a profile to edit, or create a new one.', 'warning');
            }
        });
    }

    // Event listener for the CANCEL button
    const cancelProfileEditBtn = getElement('cancelProfileEditBtn');
    if (cancelProfileEditBtn) {
        cancelProfileEditBtn.addEventListener('click', async () => {
            if (profileFormSection) profileFormSection.classList.add('hidden');
            await loadProfiles(); // Reload to ensure dropdown state is consistent
            showStatusMessage('Profile edit cancelled.', 'info');
        });
    }

    // Event listener for the Profile Form submission
    const activeProfileForm = getElement('activeProfileForm');
    if (activeProfileForm) {
        activeProfileForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission
            console.log("Bulk Autofill Page: Profile Form submitted");

            const profileData = {
                id: getElement('profileId').value || undefined,
                name: getElement('profileName').value.trim(),
                firstName: getElement('firstName').value.trim(),
                lastName: getElement('lastName').value.trim(),
                email: getElement('email').value.trim(),
                password: getElement('password').value.trim(),
                birthday: getElement('birthday').value.trim(),
                phoneCountryCode: getElement('phoneCountryCode').value.trim(),
                phone: getElement('phoneNumber').value.trim(),
                address: getElement('address').value.trim(),
                address2: getElement('address2').value.trim(),
                city: getElement('city').value.trim(),
                state: getElement('state').value.trim(),
                zip: getElement('zip').value.trim(),
                country: getElement('country').value.trim(),
                gender: getElement('genderSelect') ? getElement('genderSelect').value.trim() : '' // Added gender safely
            };

            if (!profileData.name) {
                showStatusMessage('Profile Name is required.', 'error');
                return;
            }

            chrome.runtime.sendMessage({ action: 'saveProfile', profile: profileData }, (response) => {
                if (response && response.success) {
                    console.log('Bulk Autofill Page: Profile saved successfully:', response.profileId);
                    showStatusMessage('Profile saved successfully!', 'success');
                    // Reload profiles to update dropdown and active profile
                    loadProfiles().then(() => {
                        // After profiles are loaded, select the newly saved/updated one
                        if (response.profileId) {
                            profileSelect.value = response.profileId;
                            // Manually trigger change event to update the activeProfile and form
                            profileSelect.dispatchEvent(new Event('change'));
                        }
                    });

                    if (profileFormSection) {
                        profileFormSection.classList.add('hidden');
                    }

                } else {
                    console.error('Bulk Autofill Page: Failed to save profile:', response ? response.error : 'Unknown error');
                    showStatusMessage('Failed to save profile: ' + (response ? response.error : 'Unknown error'), 'error');
                }
            });
        });
    }

    // Event listener for DELETE button
    const deleteProfileBtn = getElement('deleteProfileBtn');
    if (deleteProfileBtn) {
        deleteProfileBtn.addEventListener('click', async () => {
            if (Object.keys(allProfiles).length <= 1) {
                showStatusMessage('Cannot delete the last remaining profile. Create a new one first if you wish to replace it.', 'warning');
                return;
            }

            if (!activeProfile || !activeProfile.id || !confirm(`Are you sure you want to delete profile "${activeProfile.name}"? This cannot be undone.`)) {
                showStatusMessage('No profile selected or cancellation.', 'warning');
                return;
            }

            const response = await chrome.runtime.sendMessage({ action: 'deleteProfile', profileId: activeProfile.id });

            if (response && response.success) {
                showStatusMessage(`Profile "${activeProfile.name}" deleted successfully.`, 'success');
                activeProfile = null;
                clearProfileForm();
                await loadProfiles(); // Reload profiles to update dropdown and set new active one
            } else {
                showStatusMessage(`Failed to delete profile: ${response ? response.error : 'Unknown error'}`, 'error');
            }
        });
    }




    // Event listener for adding a new retailer
    document.getElementById('addRetailerForm').addEventListener('submit', async (event) => {
        console.log("Add Retailer Form submitted");
        event.preventDefault();
        const name = event.target.retailerName.value.trim();
        const url = event.target.retailerUrl.value.trim();

        if (name && url) {
            await addRetailer(name, url);
            event.target.reset();
        } else {
            alert('Please provide both name and URL.');
        }
    });

    // Event listener for clearing all CUSTOM retailers
    document.getElementById('clearAllRetailers').addEventListener('click', async () => {
        if (confirm("Are you sure you want to clear ALL CUSTOM retailers? Master retailers will remain.")) {
            await saveCustomRetailers([]);
            await loadAndDisplayRetailers();
            showStatusMessage("All custom retailers cleared.", "info");
        }
    });

    // --- Select All Visible Checkboxes ---
    document.getElementById('selectAllVisible').addEventListener('click', () => {
        if (!retailerListDiv) return;
        // Now selects all checkboxes, as none are disabled
        retailerListDiv.querySelectorAll('.retailer-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });
    });

    // --- Deselect All Visible Checkboxes ---
    document.getElementById('deselectAllVisible').addEventListener('click', () => {
        if (!retailerListDiv) return;
        // Now deselects all checkboxes
        retailerListDiv.querySelectorAll('.retailer-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
    });


    // Connect to background script for status updates
    const port = chrome.runtime.connect({ name: "bulkAutofillUI" });

    port.onMessage.addListener((msg) => {
        console.log("Message from background:", msg);
        if (msg.action === 'bulkProcessUpdate' || msg.action === 'bulkProcessComplete') {
            updateRetailerStatusesInUI(msg.statuses);
        }
        if (msg.action === 'bulkProcessComplete') {
            alert('Bulk autofill process finished!');
            // Re-enable start button here if it was disabled
            // document.getElementById('startBulkAutofillButton').disabled = false;
        }
    });

    // Event listener for the "Start Autofill" button
    document.getElementById('startBulkAutofillButton').addEventListener('click', async () => {
        const selectedRetailerIds = Array.from(document.querySelectorAll('.retailer-checkbox:checked'))
            .map(cb => cb.value);
        if (selectedRetailerIds.length === 0) {
            alert("Please select at least one retailer to start autofill.");
            return;
        }
        // document.getElementById('startBulkAutofillButton').disabled = true;
        showStatusMessage("Starting bulk autofill...", "info");

        // When starting autofill, reset statuses to 'Ready' for selected, 'Skipped' for unselected
        const initialStatuses = {};
        Object.values(allRetailers).forEach(retailer => {
            if (selectedRetailerIds.includes(retailer.id)) {
                initialStatuses[retailer.id] = { status: 'pending', message: 'In Queue' }; // Change to 'pending' once process starts
            } else {
                initialStatuses[retailer.id] = { status: 'ready', message: 'Skipped' }; // Keep as 'ready' if not selected for this run
            }
        });
        updateRetailerStatusesInUI(initialStatuses); // Update UI immediately

        // Send selected retailer IDs to background script
        port.postMessage({ action: "startBulkAutofill", selectedRetailerIds: selectedRetailerIds });
    });

    // Function to render/update the status list in the HTML
    function updateRetailerStatusesInUI(statuses) {
        if (!retailerListDiv) return;

        Object.keys(statuses).forEach(retailerId => {
            const retailerDiv = retailerListDiv.querySelector(`[data-retailer-id="${retailerId}"]`);
            if (retailerDiv) {
                let statusText = `Status: ${statuses[retailerId].status}`;
                if (statuses[retailerId].message) {
                    statusText += ` - ${statuses[retailerId].message}`;
                }
                const statusEl = retailerDiv.querySelector('.status-display') || document.createElement('span');
                statusEl.className = 'status-display';
                statusEl.textContent = statusText;
                statusEl.classList.remove('status-ready', 'status-pending', 'status-in_progress', 'status-complete', 'status-error'); // Added status-ready
                statusEl.classList.add(`status-${statuses[retailerId].status}`);

                if (!retailerDiv.querySelector('.status-display')) {
                    retailerDiv.appendChild(statusEl);
                }

                let retryButton = retailerDiv.querySelector('.retry-button');
                if (statuses[retailerId].status === 'error' && !retryButton) {
                    retryButton = document.createElement('button');
                    retryButton.textContent = 'Retry';
                    retryButton.className = 'retry-button';
                    retryButton.onclick = () => {
                        port.postMessage({ action: 'retryRetailer', retailerId: retailerId });
                        statusEl.textContent = 'Status: pending - Retrying...';
                        statusEl.classList.remove('status-error'); // Remove error class on retry
                        statusEl.classList.add('status-pending');
                        retryButton.remove();
                    };
                    retailerDiv.appendChild(retryButton);
                } else if (statuses[retailerId].status !== 'error' && retryButton) {
                    retryButton.remove();
                }
            }
        });
    }

    // --- Initial load and display of retailers when the page loads ---
    loadAndDisplayRetailers();
});