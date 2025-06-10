const RETAILER_DB_KEY = 'customRetailerDatabase'; // Key for storing only custom retailers
let allRetailers = {}; // Stores the MERGED list of master + custom retailers for UI display
let activeProfile = null; // Placeholder for future profile management

// Global DOM element reference (assigned in DOMContentLoaded)
let retailerListDiv = null;
let stopBulkAutofill = null;


function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: Element with ID '${id}' not found.`);
    }
    return element;
}

/**
 * Sends a message to a content script in a specific tab and awaits a response.
 * @param { number } tabId - The ID of the tab to send the message to.
 * @param { object } message - The message object to send.
 * @returns { Promise < any >} A promise that resolves with the response from the content script.
 */
function sendMessageToContentScript(tabId, message) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
                // Handle errors during message sending (e.g., content script not ready, tab closed)
                console.error("Error sending message to content script:", chrome.runtime.lastError.message);
                return reject(new Error(chrome.runtime.lastError.message));
            }
            resolve(response);
        });
    });
}






//PROFILES SECTION
function clearProfileForm() {
    console.log("Bulk Autofill Page: Clearing profile form for new profile.");
    getElement('profileId').value = '';
    getElement('profileName').value = '';
    getElement('firstName').value = '';
    getElement('lastName').value = '';
    getElement('email').value = '';
    getElement('password').value = '';
    getElement('birthday').value = '';
    getElement('phoneCountryCode').value = '';
    getElement('phoneNumber').value = '';
    getElement('address').value = '';
    getElement('address2').value = '';
    getElement('city').value = '';
    getElement('state').value = '';
    getElement('zip').value = '';
    getElement('country').value = '';
    if (getElement('genderSelect')) getElement('genderSelect').value = 'prefer-not-to-say';

    const profileFormTitle = getElement('profileFormTitle');
    if (profileFormTitle) {
        profileFormTitle.textContent = 'Add New Profile'; // Set title for new profile mode
    }

    const deleteProfileBtn = getElement('deleteProfileBtn');
    if (deleteProfileBtn) deleteProfileBtn.classList.add('hidden'); // Hide delete button for new profile
}

function fillProfileForm(profile) {
    console.log("fillProfileForm: Function called.");
    console.log("fillProfileForm: Profile object received:", profile);

    if (!profile) {
        console.warn("fillProfileForm: No profile object received, clearing form.");
        clearProfileForm();
        return;
    }

    const profileIdElement = getElement('profileId');
    if (profileIdElement) profileIdElement.value = profile.id || '';
    else console.error("fillProfileForm: Element 'profileId' not found.");

    const profileNameElement = getElement('profileName');
    if (profileNameElement) profileNameElement.value = profile.name || '';
    else console.error("fillProfileForm: Element 'profileName' not found.");

    const firstNameElement = getElement('firstName');
    if (firstNameElement) firstNameElement.value = profile.firstName || '';
    else console.error("fillProfileForm: Element 'firstName' not found.");

    const lastNameElement = getElement('lastName');
    if (lastNameElement) lastNameElement.value = profile.lastName || '';
    else console.error("fillProfileForm: Element 'lastName' not found.");

    const emailElement = getElement('email');
    if (emailElement) emailElement.value = profile.email || '';
    else console.error("fillProfileForm: Element 'email' not found.");

    const passwordElement = getElement('password');
    if (passwordElement) passwordElement.value = profile.password || '';
    else console.error("fillProfileForm: Element 'password' not found.");

    const birthdayElement = getElement('birthday');
    if (birthdayElement) birthdayElement.value = profile.birthday || '';
    else console.error("fillProfileForm: Element 'birthday' not found.");

    const phoneCountryCodeElement = getElement('phoneCountryCode');
    if (phoneCountryCodeElement) phoneCountryCodeElement.value = profile.phoneCountryCode || '';
    else console.error("fillProfileForm: Element 'phoneCountryCode' not found.");

    const phoneNumberElement = getElement('phoneNumber');
    // Pay close attention here: is your profile object's property named 'phone' or 'phoneNumber'?
    if (phoneNumberElement) phoneNumberElement.value = profile.phone || ''; // Or profile.phoneNumber if that's what your profile object has
    else console.error("fillProfileForm: Element 'phoneNumber' not found.");

    const addressElement = getElement('address');
    if (addressElement) addressElement.value = profile.address || '';
    else console.error("fillProfileForm: Element 'address' not found.");

    const address2Element = getElement('address2');
    if (address2Element) address2Element.value = profile.address2 || '';
    else console.error("fillProfileForm: Element 'address2' not found.");

    const cityElement = getElement('city');
    if (cityElement) cityElement.value = profile.city || '';
    else console.error("fillProfileForm: Element 'city' not found.");

    const stateElement = getElement('state');
    if (stateElement) stateElement.value = profile.state || '';
    else console.error("fillProfileForm: Element 'state' not found.");

    const zipElement = getElement('zip');
    if (zipElement) zipElement.value = profile.zip || '';
    else console.error("fillProfileForm: Element 'zip' not found.");

    const countryElement = getElement('country');
    if (countryElement) countryElement.value = profile.country || '';
    else console.error("fillProfileForm: Element 'country' not found.");

    const genderSelectElement = getElement('genderSelect');
    if (genderSelectElement) genderSelectElement.value = profile.gender || 'prefer-not-to-say';
    else console.error("fillProfileForm: Element 'genderSelect' not found.");


    // Update UI title
    const profileFormTitle = getElement('profileFormTitle');
    if (profileFormTitle) {
        profileFormTitle.textContent = `Edit Profile: ${profile.name || 'Unnamed'}`;
    } else {
        console.error("fillProfileForm: Element 'profileFormTitle' not found.");
    }

    // Show delete button
    const deleteProfileBtn = getElement('deleteProfileBtn');
    if (deleteProfileBtn) deleteProfileBtn.classList.remove('hidden');
    else console.error("fillProfileForm: Element 'deleteProfileBtn' not found.");

    // Ensure the profile form section is visible
    const profileFormSection = getElement('profileFormSection');
    if (profileFormSection) {
        profileFormSection.classList.remove('hidden');
    } else {
        console.error("fillProfileForm: Element 'profileFormSection' not found.");
    }
}

// Your renderProfileSelect function (ensure it populates the dropdown correctly)
// function renderProfileSelect(profiles, activeProfileId) {
//     const profileSelect = getElement('profileSelect');
//     if (!profileSelect) return;

//     profileSelect.innerHTML = ''; // Clear existing options

//     // Add a "New Profile" option if desired (optional but good UX)
//     const newProfileOption = document.createElement('option');
//     newProfileOption.value = 'new-profile'; // A special value for new profile
//     newProfileOption.textContent = 'Add New Profile...';
//     profileSelect.appendChild(newProfileOption);

//     // Populate with actual profiles
//     for (const id in profiles) {
//         const profile = profiles[id];
//         const option = document.createElement('option');
//         option.value = profile.id;
//         option.textContent = profile.name;
//         profileSelect.appendChild(option);
//     }

//     // Set the selected value in the dropdown
//     if (activeProfileId && profiles[activeProfileId]) {
//         profileSelect.value = activeProfileId;
//     } else {
//         profileSelect.value = 'new-profile'; // Select 'Add New Profile' if no active profile
//         clearProfileForm(); // Clear form when 'Add New Profile' is selected initially
//     }
//     console.log("Bulk Autofill Page: Dropdown updated. Selected:", profileSelect.value);
// }

function renderProfileSelect(profiles, activeProfileIdFromStorage) { // Renamed parameter for clarity
    const profileSelect = getElement('profileSelect');
    if (!profileSelect) return;

    profileSelect.innerHTML = ''; // Clear existing options

    // Add a "New Profile" option
    const newProfileOption = document.createElement('option');
    newProfileOption.value = 'new-profile';
    newProfileOption.textContent = 'Add New Profile...';
    profileSelect.appendChild(newProfileOption);

    // Populate with actual profiles
    const profileIds = Object.keys(profiles);
    if (profileIds.length > 0) {
        const sortedProfileIds = profileIds.sort((a, b) => {
            const nameA = profiles[a].name ? profiles[a].name.toLowerCase() : '';
            const nameB = profiles[b].name ? profiles[b].name.toLowerCase() : '';
            return nameA.localeCompare(nameB);
        });

        sortedProfileIds.forEach(id => {
            const profile = profiles[id];
            if (profile && profile.name) {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = profile.name;
                profileSelect.appendChild(option);
            }
        });
    }

    // Set the selected value in the dropdown based on what was active in storage
    if (activeProfileIdFromStorage && profiles[activeProfileIdFromStorage]) {
        profileSelect.value = activeProfileIdFromStorage;
        // **CRUCIAL:** When loading profiles, set the global activeProfile
        activeProfile = profiles[activeProfileIdFromStorage];
        console.log("Bulk Autofill Page: Initial active profile set to:", activeProfile.name);
    } else {
        profileSelect.value = 'new-profile';
        // **CRUCIAL:** Clear global activeProfile if no valid one is set from storage
        activeProfile = null;
        clearProfileForm();
        // For new profile, ensure form is visible
        const profileFormSection = getElement('profileFormSection');
        if (profileFormSection) {
            profileFormSection.classList.remove('hidden');
        }
        console.log("Bulk Autofill Page: No active profile found, set to 'Add New Profile'.");
    }
    console.log("Bulk Autofill Page: Dropdown updated. Selected:", profileSelect.value);
}


/**
 * Loads profiles and the active profile ID from the background script.
 * Updates global variables and refreshes the UI.
 */
async function loadProfiles() {
    console.log("loadProfiles: Sending message to background script...");
    chrome.runtime.sendMessage({ action: 'loadProfile' }, (response) => {
        console.log("loadProfiles: Received response from background:", response);
        if (response && response.success) {
            console.log("loadProfiles: Successfully loaded profiles:", response.profiles, "Active ID from BG:", response.activeProfileId);
            // Store profiles globally if you need them elsewhere (e.g., for dropdown change listener)
            window.allProfiles = response.profiles; // Assign to a global variable if needed

            // Populate the dropdown with all loaded profiles
            renderProfileSelect(response.profiles, response.activeProfileId);

            // Populate the form with the active profile's data
            if (response.activeProfileId && response.profiles[response.activeProfileId]) {
                fillProfileForm(response.profiles[response.activeProfileId]);
                // --- CRUCIAL: SHOW THE FORM HERE ---
                const profileFormSection = getElement('profileFormSection');
                if (profileFormSection) {
                    profileFormSection.classList.remove('hidden'); // Make sure the form is visible
                }
            } else {
                // If no active profile, or active profile invalid, clear form and hide/show new profile option
                clearProfileForm();
                const profileFormSection = getElement('profileFormSection');
                if (profileFormSection) {
                    profileFormSection.classList.add('hidden'); // Hide if no profile to show
                }
            }
        } else {
            console.error("Failed to load profiles:", response ? response.error : 'Unknown error');
            // Show an error message to the user
            showStatusMessage('Error loading profiles.', 'error');
            clearProfileForm(); // Clear the form on error
        }
    });
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
        { id: 'amazon', name: 'Amazon', signupUrl: 'https://www.amazon.com/ap/register?openid.return_to=https%3A%2F%2Ftrack.amazon.com%2F&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=amzn_shippingrecipientcentral_us&openid.mode=checkid_setup&language=en_US&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0', isCustom: false, selectors: {} },
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

/**
 * Updates the display area with the current autofill status for each retailer.
 * Expects an object where keys are retailer names and values are their statuses.
 * @param {object} results - An object containing retailer names as keys and their statuses as values.
 */
function updateAutofillStatusDisplay(results) {
    // Get the HTML element where the status list will be displayed
    const statusList = document.getElementById('autofillStatusDisplay');

    // If the element doesn't exist, log an error and exit
    if (!statusList) {
        console.error("Element with ID 'autofillStatusDisplay' not found in the DOM. Cannot update autofill status.");
        return;
    }

    // Clear any previous status items to show the updated list
    statusList.innerHTML = '';

    // Loop through each retailer and its status in the results object
    for (const retailerName in results) {
        // Create a new list item (<li>) for each retailer
        const listItem = document.createElement('li');
        // Set the text content of the list item
        listItem.textContent = `${retailerName}: ${results[retailerName]}`;

        // Optional: Add styling based on the status for better visual feedback
        if (results[retailerName].includes('Success')) {
            listItem.style.color = 'green';
            listItem.style.fontWeight = 'bold';
        } else if (results[retailerName].includes('Error')) {
            listItem.style.color = 'red';
            listItem.style.fontWeight = 'bold';
        } else if (results[retailerName].includes('Skipped')) {
            listItem.style.color = 'orange';
            listItem.style.fontStyle = 'italic';
        } else if (results[retailerName].includes('Pending')) {
            listItem.style.color = 'gray';
        }

        // Append the new list item to the status display list
        statusList.appendChild(listItem);
    }
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
    profileSelect = getElement('profileSelect');
    profileFormSection = getElement('profileFormSection');
    saveProfileBtn = getElement('saveProfileBtn');
    newProfileBtn = getElement('newProfileBtn');
    editProfileBtn = getElement('editProfileBtn');
    cancelProfileEditBtn = getElement('cancelProfileBtn'); // Corrected ID from html
    deleteProfileBtn = getElement('deleteProfileBtn');
    activeProfileForm = getElement('activeProfileForm');
    statusMessageDiv = getElement('statusMessage');
    startBulkAutofillButton = getElement('startBulkAutofillButton'); // Ensure this is assigned here
    stopBulkAutofillButton = getElement('stopBulkAutofillButton'); // Ensure this is assigned here

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

    retailerListDiv = getElement('retailerList'); // Ensure this is assigned here

    const storedData = await chrome.storage.local.get(['activeProfileId', 'profiles']);
    if (storedData.activeProfileId && storedData.profiles) {
        activeProfile = storedData.profiles[storedData.activeProfileId];
        if (activeProfile) {
            console.log("Bulk Autofill: Active profile loaded:", activeProfile.name);
            fillProfileForm(activeProfile); // Assuming you have a function to display it
        } else {
            console.warn("Bulk Autofill: Active profile ID found, but profile data missing.");
        }
    } else {
        console.log("Bulk Autofill: No active profile ID or profiles found in storage.");
    }

    loadProfiles();

    // Event listener for profile selection change
    if (profileSelect) {
        profileSelect.addEventListener('change', () => {
            const selectedProfileId = profileSelect.value;
            if (selectedProfileId === 'new-profile') {
                clearProfileForm();
                // Ensure form is visible if hidden
                const profileFormSection = getElement('profileFormSection');
                if (profileFormSection) {
                    profileFormSection.classList.remove('hidden');
                }
                activeProfile = null; // Set active profile to 'new-profile'
            } else if (selectedProfileId && window.allProfiles && window.allProfiles[selectedProfileId]) {
                const selectedProfile = window.allProfiles[selectedProfileId];
                fillProfileForm(selectedProfile); // Populate form
                const profileFormSection = getElement('profileFormSection');
                if (profileFormSection) {
                    profileFormSection.classList.remove('hidden');
                }
                // **CRUCIAL:** Set activeProfile to the selected one
                activeProfile = selectedProfile;
                console.log("Bulk Autofill Page: Active profile set to:", activeProfile.name);

                // Persist the active profile ID to storage immediately on change
                chrome.runtime.sendMessage({ action: 'setActiveProfileId', profileId: activeProfile.id }, (response) => {
                    if (response && response.success) {
                        console.log("Active profile ID saved to storage:", activeProfile.id);
                    } else {
                        console.error("Failed to save active profile ID to storage:", response ? response.error : 'Unknown error');
                    }
                });
            } else {
                // If a blank option or invalid selection, clear and hide form
                clearProfileForm();
                const profileFormSection = getElement('profileFormSection');
                if (profileFormSection) {
                    profileFormSection.classList.add('hidden');
                }
                activeProfile = null; // Clear active profile
                console.log("Bulk Autofill Page: Active profile cleared.");

            }
        });
    }

    // This button now simply triggers the form's submit event
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', () => {
            console.log("Bulk Autofill Page: Save button clicked, triggering form submission.");
            if (activeProfileForm) {
                console.log("Bulk Autofill Page: activeProfileForm found, submitting form.");
                activeProfileForm.dispatchEvent(new Event('submit'));

            } else {
                console.error("Bulk Autofill Page: activeProfileForm not found for save button click.");
                showStatusMessage('Error: Profile form not found.', 'error');
            }
        });
    }

    if (newProfileBtn) {
        newProfileBtn.addEventListener('click', () => {
            if (profileSelect) {
                profileSelect.value = 'new';
                profileSelect.dispatchEvent(new Event('change')); // Manually trigger change event
                showStatusMessage('Creating a new profile.', 'info');
            }
        });
    }

    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => { // Removed async here, as updateProfileForm isn't async
            if (activeProfile && activeProfile.id) {
                fillProfileForm(activeProfile); // Simply fill form with active profile data
                if (profileFormSection) profileFormSection.classList.remove('hidden');
            } else {
                showStatusMessage('Please select a profile to edit, or create a new one.', 'warning');
            }
        });
    }

    if (cancelProfileEditBtn) {
        cancelProfileEditBtn.addEventListener('click', async () => {
            if (profileFormSection) profileFormSection.classList.add('hidden');
            await loadProfiles(); // Reload profiles to ensure the selection reflects the actual active profile
            showStatusMessage('Profile edit cancelled.', 'info');
        });
    }

    if (activeProfileForm) {
        activeProfileForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission
            console.log("Bulk Autofill Page: Profile Form submitted");

            // Use getElement for consistency and error checking
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
                gender: getElement('genderSelect') ? getElement('genderSelect').value.trim() : ''
            };
            console.log("Bulk Autofill Page: Profile data to save:", profileData);

            if (!profileData.name) {
                showStatusMessage('Profile Name is required.', 'error');
                return;
            }

            try {
                // Send message to background script to save the profile
                const response = await chrome.runtime.sendMessage({
                    action: 'saveProfile',
                    profile: profileData
                });

                console.log("Bulk Autofill Page: Response from saveProfile message:", response);

                if (response && response.success) {
                    showStatusMessage('Profile saved successfully!', 'success');
                    // --- THIS IS THE KEY CHANGE ---
                    // After a successful save, reload all profiles and update the UI.
                    // This will automatically select the newly saved profile as active,
                    // because your background script's save logic sets it as active.
                    activeProfile = response.profile; // Update the active profile in the UI
                    console.log("Bulk Autofill Page: Active profile updated to:", activeProfile.name);
                    await loadProfiles();
                } else {
                    showStatusMessage(`Error saving profile: ${response.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error("Bulk Autofill Page: Error sending saveProfile message:", error);
                showStatusMessage('Error communicating with background script.', 'error');
            }
        });
    }

    if (deleteProfileBtn) {
        deleteProfileBtn.addEventListener('click', async () => {
            // Check if there's only one profile left (prevent deleting the last one)
            if (Object.keys(allProfiles).length <= 1) {
                showStatusMessage('Cannot delete the last remaining profile. Create a new one first if you wish to replace it.', 'warning');
                return;
            }

            if (!activeProfile || !activeProfile.id || !confirm(`Are you sure you want to delete profile "${activeProfile.name || 'this profile'}"? This cannot be undone.`)) {
                showStatusMessage('No profile selected or cancellation.', 'info');
                return;
            }

            try {
                const response = await chrome.runtime.sendMessage({ action: 'deleteProfile', profileId: activeProfile.id });
                if (response && response.success) {
                    showStatusMessage(`Profile "${activeProfile.name || 'selected profile'}" deleted successfully.`, 'success');
                    activeProfile = null; // Clear active profile
                    clearProfileForm(); // Clear the form
                    await loadProfiles(); // Reload profiles to update the dropdown and set a new active one
                } else {
                    showStatusMessage(`Failed to delete profile: ${response ? response.error : 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error("Bulk Autofill Page: Error sending delete message to background:", error);
                showStatusMessage('Error communicating with background script to delete profile.', 'error');
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
    if (startBulkAutofillButton) {
        startBulkAutofillButton.addEventListener('click', async () => {
            stopBulkAutofill = false;
            console.log("Bulk Autofill: Start Autofill for Selected button clicked.");

            if (!activeProfile || !activeProfile.firstName) {
                console.warn("Bulk Autofill: No active profile selected or profile is incomplete.");
                showStatusMessage('Please select and save a profile first.', 'warning', 5000);
                return;
            }

            const selectedRetailers = Object.values(allRetailers);
            if (selectedRetailers.length === 0) {
                showStatusMessage('Please select at least one retailer to autofill.', 'warning', 5000);
                return;
            }

            showStatusMessage(`Starting autofill for ${selectedRetailers.length} selected retailers...`, 'info', 0); // Show indefinitely

            let autofillResults = {};

            for (const retailer of selectedRetailers) {
                if (stopBulkAutofill) {
                    console.log("Bulk Autofill: Stopping process due to stop flag.");
                    showStatusMessage('Autofill process stopped by user.', 'info', 5000);
                    autofillResults[retailer.name] = 'Stopped by User'; // Mark remaining as stopped
                    updateAutofillStatusDisplay(autofillResults); // Update display with stopped status
                    break; // Exit the loop
                }

                let tab = null;

                if (!retailer.signupUrl || (!retailer.signupUrl.startsWith('http://') && !retailer.signupUrl.startsWith('https://'))) {
                    console.warn(`Bulk Autofill: Skipping invalid or non-http/https signup URL for retailer: ${retailer.name} (${retailer.signupUrl || 'No URL'})`);
                    autofillResults[retailer.name] = 'Skipped (Invalid URL)';
                    updateAutofillStatusDisplay(autofillResults); // Use the correct function here
                    showStatusMessage(`Skipped ${retailer.name} due to invalid URL.`, 'warning', 3000);
                    continue; // Skip to the next retailer in the loop
                }

                showStatusMessage(`Attempting autofill for: ${retailer.name}...`, 'info', 0);
                autofillResults[retailer.name] = 'Pending...';
                updateAutofillStatusDisplay(autofillResults);

                try {
                    // Open a new tab for the retailer's URL
                    tab = await new Promise((resolve, reject) => {
                        chrome.tabs.create({ url: retailer.signupUrl, active: false }, (newTab) => {
                            if (chrome.runtime.lastError) {
                                return reject(new Error(chrome.runtime.lastError.message));
                            }
                            resolve(newTab);
                        });
                    });

                    // Wait for the tab to load. You might need a more robust way to detect page load completion.
                    // For simplicity, we'll use a small delay here.
                    // In a real scenario, you might listen to chrome.tabs.onUpdated and check status.
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds for page to load

                    // Inject the content script if it's not already there (only for the first time or if it somehow got removed)
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js'] // Assuming your content script is named content.js
                    });

                    // Send the autofill message to the content script in the new tab
                    const response = await sendMessageToContentScript(tab.id, { action: 'fillForm', profile: activeProfile });

                    if (response && response.formData && Object.keys(response.formData).length > 0) {
                        autofillResults[retailer.name] = 'Success (fields filled)';
                        showStatusMessage(`Autofill successful for ${retailer.name}.`, 'success', 3000);
                    } else {
                        autofillResults[retailer.name] = 'No fields found/filled';
                        showStatusMessage(`No fields filled for ${retailer.name}.`, 'warning', 3000);
                    }
                } catch (error) {
                    console.error(`Bulk Autofill: Error processing ${retailer.name}:`, error);
                    autofillResults[retailer.name] = `Error: ${error.message || 'Unknown error'}`;
                    showStatusMessage(`Error during autofill for ${retailer.name}.`, 'error', 5000);
                } finally {
                    updateAutofillStatusDisplay(autofillResults);
                    // You might want to close the tab after processing, or leave it open
                    // if (tab && tab.id) { // Check if tab was successfully created before trying to remove
                    //     chrome.tabs.remove(tab.id); // Uncomment if you want to close tabs automatically
                    // }
                }
            }
            showStatusMessage('Bulk autofill process completed.', 'info', 5000);
            updateAutofillStatusDisplay(autofillResults);
        });
    }

    if (stopBulkAutofillButton) {
        stopBulkAutofillButton.addEventListener('click', async () => {
            console.log("Bulk Autofill: Stop Autofill button clicked.");
            stopBulkAutofill = true; // Set the flag to true
            // Optionally save to storage if you want it to persist across popup closes
            // await chrome.storage.local.set({ stopAutofillFlag: true });
            showStatusMessage('Autofill process will stop after the current site.', 'warning', 3000);
            stopBulkAutofillButton.style.display = 'none'; // Hide stop button
            startBulkAutofillButton.style.display = 'block'; // Show start button again
        });
    }


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