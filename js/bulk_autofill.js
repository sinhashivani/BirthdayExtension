const RETAILER_DB_KEY = 'customRetailerDatabase'; // Key for storing only custom retailers
let allRetailers = {}; // Stores the MERGED list of master + custom retailers for UI display
let activeProfile = null; // Placeholder for future profile management

// Global DOM element reference (assigned in DOMContentLoaded)
let retailerListDiv = null;
let stopBulkAutofill = null;
const WEBSCRAPED_RETAILERS_KEY = 'webscrapedRetailersDb'; // Choose a distinct key
const FAILED_RETAILER_IDS_KEY = 'failedRetailerIds';


function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: Element with ID '${id}' not found.`);
    }
    return element;
}

// This function needs to be in your background script (bulk_autofill.js or background.js)
async function sendMessageToContentScript(tabId, message) {
    const maxPingRetries = 20; // Allow more time for slow pages
    const pingRetryDelayMs = 250; // Increased delay
    let attempts = 0;
    let contentScriptReady = false;

    // First, ensure the content script is ready to receive messages
    while (!contentScriptReady && attempts < maxPingRetries) {
        attempts++;
        try {
            const pingResponse = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
            if (pingResponse && pingResponse.status === 'pong') {
                contentScriptReady = true;
                console.log(`Bulk Autofill: Content script in tab ${tabId} is ready after ${attempts} attempts.`);
            } else {
                console.warn(`Bulk Autofill: Ping received unexpected response from tab ${tabId}:`, pingResponse, `(Attempt ${attempts})`);
            }
        } catch (e) {
            // Error here often means content script isn't loaded yet. Suppress frequent logs.
            // console.warn(`Bulk Autofill: Ping failed for tab ${tabId} (attempt ${attempts}):`, e.message);
        }

        if (!contentScriptReady) {
            await new Promise(resolve => setTimeout(resolve, pingRetryDelayMs));
        }
    }

    if (!contentScriptReady) {
        throw new Error(`Content script in tab ${tabId} did not become ready after ${maxPingRetries} attempts.`);
    }

    // Now that we know content.js is ready, send the actual command message
    try {
        const response = await chrome.tabs.sendMessage(tabId, message);
        console.log(`Bulk Autofill: Message sent to tab ${tabId}, response received for action '${message.action}':`, response);
        return response;
    } catch (error) {
        console.error(`Bulk Autofill: Error sending command message to tab ${tabId} for action '${message.action}':`, error);
        throw error; // Re-throw to be caught by the bulk processing loop
    }
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

// Add or copy the validateFormData function here from popup.js
// Make sure it includes the password validation logic we just added.
function validateFormData(profile) {
    const errors = {};

    if (!profile.firstName) {
        errors.firstName = 'First Name is required.';
    }
    if (!profile.lastName) {
        errors.lastName = 'Last Name is required.';
    }
    if (!profile.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
        errors.email = 'Valid Email is required.';
    }

    const password = profile.password;
    if (password) {
        if (password.length < 8 || password.length > 25) {
            errors.password = (errors.password ? errors.password + ' ' : '') + 'Password must be between 8 and 25 characters.';
        }
        if (!/\d/.test(password)) {
            errors.password = (errors.password ? errors.password + ' ' : '') + 'Password must contain at least one number.';
        }
        if (!/[A-Z]/.test(password)) {
            errors.password = (errors.password ? errors.password + ' ' : '') + 'Password must contain at least one capital letter.';
        }
        if (!/[a-z]/.test(password)) {
            errors.password = (errors.password ? errors.password + ' ' : '') + 'Password must contain at least one lowercase letter.';
        }
        if (!/[^a-zA-Z0-9]/.test(password)) {
            errors.password = (errors.password ? errors.password + ' ' : '') + 'Password must contain at least one special character (e.g., !@#$).';
        }
    }
    // If password is required even when empty, uncomment:
    // else {
    //     errors.password = 'Password is required.';
    // }

    return {
        valid: Object.keys(errors).length === 0,
        errors: errors
    };
}

async function sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, response => {
            if (chrome.runtime.lastError) {
                console.error("sendMessageToBackground error:", chrome.runtime.lastError.message);
                return reject(chrome.runtime.lastError);
            }
            resolve(response);
        });
    });
}

// Modify the saveProfileFromForm function (from your popup.js)
// Assuming this function is now also present in bulk_autofill.js or imported.
async function saveProfileFromForm() {
    console.log("Bulk Autofill Page: Saving profile data from form.");
    const profileFormSection = getElement('profileFormSection'); // Get the profile form element
    if (!profileFormSection) {
        console.error("Bulk Autofill Page: Profile form element not found during save.");
        showStatusMessage('Error: Profile form missing.', 'error');
        return;
    }

    // Get input elements by their IDs (assuming these match your HTML)
    const profileIdField = getElement('profileId');
    const profileNameField = getElement('profileName');
    const firstNameField = getElement('firstName');
    const lastNameField = getElement('lastName');
    const emailField = getElement('email');
    const passwordField = getElement('password'); // Added
    const birthdayField = getElement('birthday'); // Added
    const phoneCountryCodeField = getElement('phoneCountryCode'); // Added
    const phoneNumberField = getElement('phoneNumber'); // Added
    const addressField = getElement('address'); // Added
    const address2Field = getElement('address2'); // Added
    const cityField = getElement('city'); // Added
    const stateField = getElement('state'); // Added
    const zipField = getElement('zip'); // Added
    const countryField = getElement('country'); // Added
    const genderSelectField = getElement('genderSelect');

    const updatedProfile = {
        id: profileIdField ? profileIdField.value.trim() : (activeProfile?.id || generateUniqueId()),
        name: profileNameField ? profileNameField.value.trim() : (activeProfile?.name || "My Profile"),
        firstName: firstNameField ? firstNameField.value.trim() : '',
        lastName: lastNameField ? lastNameField.value.trim() : '',
        email: emailField ? emailField.value.trim() : '',
        password: passwordField ? passwordField.value.trim() : '', // Get password value
        birthday: birthdayField ? birthdayField.value : '',
        countryCode: phoneCountryCodeField ? phoneCountryCodeField.value.trim() : '',
        phone: phoneNumberField ? phoneNumberField.value.trim() : '',
        address: addressField ? addressField.value.trim() : '',
        city: cityField ? cityField.value.trim() : '',
        state: stateField ? stateField.value.trim() : '',
        zip: zipField ? zipField.value.trim() : '',
    };

    const validationResult = validateFormData(updatedProfile);
    if (!validationResult.valid) {
        console.warn("Bulk Autofill Page: Profile validation failed:", validationResult.errors);
        let errorMessage = 'Validation errors:';
        // Build a more readable error message for the user
        for (const field in validationResult.errors) {
            errorMessage += ` ${field.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}: ${validationResult.errors[field]};`;
        }
        showStatusMessage(errorMessage, 'warning', 8000); // Display the detailed error
        return; // STOP execution if validation fails
    }

    activeProfile = updatedProfile;
    console.log("Bulk Autofill Page: Active profile updated in memory:", activeProfile);

    try {
        const response = await sendMessageToBackground({
            action: 'saveProfileFromPopup', // Action to background script
            profile: activeProfile
        });

        if (response && response.success) {
            console.log("Bulk Autofill Page: Profile saved successfully by background script. Profile ID:", response.profileId);
            activeProfile.id = response.profileId; // Update ID if new profile
            showStatusMessage('Profile saved successfully!', 'success', 3000);
            // Re-render the select to update profile names/IDs if necessary
            await loadProfilesAndRender(); // Assuming this function reloads profiles and updates the dropdown
        } else {
            console.error("Bulk Autofill Page: Error saving profile via background:", response ? response.error : 'Unknown error');
            showStatusMessage(`Error saving profile: ${response ? response.error : 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error("Bulk Autofill Page: Communication error during profile save:", error);
        showStatusMessage('Error communicating with background script during save.', 'error');
    }
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
async function getMasterRetailerDatabase() {
    console.log("Fetching master retailers from local JSON file...");
    try {
        const response = await fetch(chrome.runtime.getURL('data/webscrapedRetailers.json'));
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for webscrapedRetailers.json`);
        }
        const masterRetailersArray = await response.json(); // This will be an array from your JSON file

        // Convert the array to an object keyed by retailer ID, as expected by the rest of your code
        return masterRetailersArray.reduce((acc, retailer) => {
            // Ensure retailer has an ID before adding to the object
            if (retailer && retailer.id) {
                acc[retailer.id] = retailer;
            } else {
                console.warn("Master retailer entry missing ID, skipping:", retailer);
            }
            return acc;
        }, {});

    } catch (error) {
        console.error("Failed to fetch master retailers from file:", error);
        return {}; // Return empty object on error
    }
}
// function getMasterRetailerDatabase() {
//     const masterRetailersArray = [
//         { id: 'aw', name: 'A&W', signupUrl: 'https://awrestaurants.com/deals/', isCustom: false, selectors: {} },
//         { id: 'abuelos', name: 'Abuelo\'s', signupUrl: 'https://www.abuelos.com/rewards/', isCustom: false, selectors: {} },
//         { id: 'aceHardware', name: 'Ace Hardware', signupUrl: 'https://acehardware.dttq.net/oDgqO', isCustom: false, selectors: {} },
//         { id: 'adidas', name: 'adidas', signupUrl: 'https://go.skimresources.com?id=26893X855785&xs=1&url=https%3A%2F%2Fwww.adidas.com%2Fus%2Fcreatorsclubrewards&xcust=bday', isCustom: false, selectors: {} },
//         { id: 'aerie', name: 'Aerie', signupUrl: 'https://go.skimresources.com?id=26893X855785&xs=1&url=https%3A%2F%2Fwww.ae.com%2Fus%2Fen%2Fmyaccount%2Freal-rewards&xcust=bday-aerie', isCustom: false, selectors: {} },
//         { id: 'alamoDrafthouseCinema', name: 'Alamo Drafthouse Cinema', signupUrl: 'https://drafthouse.com/victory', isCustom: false, selectors: {} },
//         { id: 'amcTheatres', name: 'AMC Theatres', signupUrl: 'https://www.amctheatres.com/amcstubs', isCustom: false, selectors: {} },
//         { id: 'americanEagle', name: 'American Eagle', signupUrl: 'https://go.skimresources.com?id=26893X855785&xs=1&url=https%3A%2F%2Fwww.ae.com%2Fus%2Fen%2Fmyaccount%2Freal-rewards&xcust=bday-ae', isCustom: false, selectors: {} },
//         { id: 'andysFrozenCustard', name: 'Andy\'s Frozen Custard', signupUrl: 'https://eatandys.myguestaccount.com/en-us/guest/enroll?card-template=gz6U71JdL9Y', isCustom: false, selectors: {} },
//         { id: 'anthonysCoalFiredPizza', name: 'Anthony\'s Coal Fired Pizza', signupUrl: 'https://acfp.com/rewards/', isCustom: false, selectors: {} },
//         { id: 'applebees', name: 'Applebee\'s', signupUrl: 'https://www.applebees.com/en/sign-up', isCustom: false, selectors: {} },
//         { id: 'arbys', name: 'Arby\'s', signupUrl: 'https://www.arbys.com/deals/', isCustom: false, selectors: {} },
//         { id: 'athleta', name: 'Athleta', signupUrl: 'https://go.skimresources.com?id=26893X855785&xs=1&url=https%3A%2F%2Fathleta.gap.com%2Fbrowse%2Finfo.do%3Fcid%3D1098761&xcust=bday', isCustom: false, selectors: {} },
//         { id: 'atlantaBread', name: 'Atlanta Bread', signupUrl: 'https://atlantabread.com/rewards-and-gifting/', isCustom: false, selectors: {} },
//         { id: 'auBonPain', name: 'Au Bon Pain', signupUrl: 'https://www.aubonpain.com/bon-rewards', isCustom: false, selectors: {} },
//         { id: 'auntieAnnesPretzels', name: 'Auntie Anne\'s Pretzels', signupUrl: 'https://www.auntieannes.com/rewards/', isCustom: false, selectors: {} },
//         { id: 'aveda', name: 'Aveda', signupUrl: 'https://go.skimresources.com?id=26893X855785&xs=1&url=https%3A%2F%2Fwww.aveda.com%2Fav-loyalty-page%23tier1&xcust=bday', isCustom: false, selectors: {} },
//         { id: 'backYardBurgers', name: 'Back Yard Burgers', signupUrl: 'https://www.backyardburgers.com/clubhouse/', isCustom: false, selectors: {} },
//         { id: 'bahamaBreeze', name: 'Bahama Breeze', signupUrl: 'https://www.anrdoezrs.net/click-2745940-13032584?sid=bday&url=https%3A%2F%2Fwww.bahamabreeze.com', isCustom: false, selectors: {} },
//         { id: 'bajaFresh', name: 'Baja Fresh', signupUrl: 'https://www.bajafresh.com/clubbaja/', isCustom: false, selectors: {} },
//         { id: 'bakersSquare', name: 'Bakers Square', signupUrl: 'https://www.bakerssquare.com/promotions/', isCustom: false, selectors: {} },
//         { id: 'bananaRepublic', name: 'Banana Republic', signupUrl: 'https://go.skimresources.com?id=26893X855785&xs=1&url=https%3A%2F%2Fbananarepublic.gap.com%2FcustomerService%2Finfo.do%3Fcid%3D1098875&xcust=bday', isCustom: false, selectors: {} },
//         { id: 'bareminerals', name: 'bareMinerals', signupUrl: 'https://click.linksynergy.com/deeplink?id=96nyqW322pM&mid=42594&murl=https%3A%2F%2Fwww.bareminerals.com%2Fpages%2Frewards&u1=bday', isCustom: false, selectors: {} },
//         { id: 'barkbox', name: 'BarkBox', signupUrl: 'https://www.dpbolvw.net/click-2745940-15736531?sid=bday&url=https%3A%2F%2Fwww.barkbox.com%2Fjoin%2Ffextgeneric', isCustom: false, selectors: {} },
//         { id: 'barnesNoble', name: 'Barnes & Noble', signupUrl: 'https://www.anrdoezrs.net/click-2745940-12354093?sid=bday&url=https%3A%2F%2Fwww.barnesandnoble.com%2Fmembership%2F', isCustom: false, selectors: {} },
//         { id: 'baskinRobbins', name: 'Baskin-Robbins', signupUrl: 'https://www.baskinrobbins.com/en/sign-up', isCustom: false, selectors: {} },
//         { id: 'bassProShop', name: 'Bass Pro Shop', signupUrl: 'https://go.skimresources.com?id=26893X855785&xs=1&url=https%3A%2F%2Fwww.basspro.com%2Fshop%2FOutdoorRewardsApplication&xcust=bday', isCustom: false, selectors: {} },
//         { id: 'bdsMongolianGrill', name: 'BD\'s Mongolian Grill', signupUrl: 'https://www.bdsgrill.com/rewards', isCustom: false, selectors: {} },
//         { id: 'bebe', name: 'Bebe', signupUrl: 'https://www.anrdoezrs.net/click-2745940-15735597?sid=bday&url=https%3A%2F%2Fwww.bebe.com%2Faccount%2Flogin', isCustom: false, selectors: {} },
//         { id: 'beefObradys', name: 'Beef \'O\' Brady\'s', signupUrl: 'https://beefobradys.myguestaccount.com/guest/enroll?card-template=1DLP0KWE8FA&template=2&referral_code=gNmrAeDHjmMPrnCaFJNcdJDBJJAjCPPja', isCustom: false, selectors: {} },
//         { id: 'belk', name: 'Belk', signupUrl: 'https://www.jdoqocy.com/click-2745940-11602493?sid=bday&url=https%3A%2F%2Fwww.belk.com%2Femail-signup%2F', isCustom: false, selectors: {} },
//         { id: 'benJerrysIceCream', name: 'Ben & Jerry\'s Ice Cream', signupUrl: 'https://www.benjerry.com/scoop-shops/flavor-fanatics', isCustom: false, selectors: {} },
//         { id: 'benihana', name: 'Benihana', signupUrl: 'https://www.benihana.com/the-chefs-table/', isCustom: false, selectors: {} },
//         { id: 'bennigans', name: 'Bennigans', signupUrl: 'https://bennigans.fbmta.com/members/UpdateProfile.aspx?Action=Subscribe&_Theme=23622320311&InputSource=W', isCustom: false, selectors: {} },
//         { id: 'bertuccis', name: 'Bertucci\'s', signupUrl: 'https://www.bertuccis.com/eclub/', isCustom: false, selectors: {} },
//         { id: 'biaggis', name: 'Biaggi\'s', signupUrl: 'https://biaggis.com/club-biaggis/', isCustom: false, selectors: {} },
//         { id: 'bibibop', name: 'Bibibop', signupUrl: 'https://www.bibibop.com/rewards/', isCustom: false, selectors: {} },
//         { id: 'bigBoy', name: 'Big Boy', signupUrl: 'https://www.bigboy.com/', isCustom: false, selectors: {} },
//         { id: 'biggbyCoffee', name: 'Biggby Coffee', signupUrl: 'https://www.biggby.com/e-wards', isCustom: false, selectors: {} },
//         { id: 'bjsRestaurant', name: 'BJ\'s Restaurant', signupUrl: 'https://www.bjsrestaurants.com/rewards', isCustom: false, selectors: {} },
//         { id: 'blackAngusSteakhouse', name: 'Black Angus Steakhouse', signupUrl: 'https://blackangus.myguestaccount.com/guest/enroll?card-template=a4veuMKLoS4&template=19&referral_code=jmQGgiNeGkjanFdmGfGKerhdPmPJhQpka', isCustom: false, selectors: {} },
//         { id: 'blackBearDiner', name: 'Black Bear Diner', signupUrl: 'https://blackbeardiner.com/clubs/', isCustom: false, selectors: {} },
//         { id: 'bojangles', name: 'Bojangles\'', signupUrl: 'https://www.bojangles.com/', isCustom: false, selectors: {} },
//         { id: 'bonanzaSteakhouse', name: 'Bonanza Steakhouse', signupUrl: 'https://pon-bon.com/e-club#bonanza', isCustom: false, selectors: {} },
//         { id: 'bonefishGrill', name: 'Bonefish Grill', signupUrl: 'https://www.bonefishgrill.com/insider', isCustom: false, selectors: {} },
//         { id: 'booksAMillion', name: 'Books-A-Million', signupUrl: 'https://www.tkqlhce.com/click-2745940-15734439?sid=bday&url=https%3A%2F%2Fwww.booksamillion.com%2Femail_preferences%2Findex.html', isCustom: false, selectors: {} },
//         { id: 'bostonsPizza', name: 'Boston\'s Pizza', signupUrl: 'https://www.bostons.com/my-rewards/index.html', isCustom: false, selectors: {} },
//         { id: 'bricktownBrewery', name: 'Bricktown Brewery', signupUrl: 'https://bricktownbrewery.com/rewards/', isCustom: false, selectors: {} },
//         { id: 'brioItalianGrille', name: 'Brio Italian Grille', signupUrl: 'https://www.brioitalian.com/eclub/', isCustom: false, selectors: {} },
//         { id: 'brueggersBagels', name: 'Bruegger\'s Bagels', signupUrl: 'https://www.brueggers.com/rewards-program/', isCustom: false, selectors: {} },
//         { id: 'brusters', name: 'Bruster\'s', signupUrl: 'https://brusters.myguestaccount.com/guest/enroll?card-template=gz6U71JdL9Y&template=0&referral_code=AJjHACBKEkEDHrDpkLrKQNkGfDGDgNCEa', isCustom: false, selectors: {} },
//         { id: 'bubbaGumpShrimp', name: 'Bubba Gump Shrimp', signupUrl: 'http://assets.fbmta.com/clt/bbsgmp/lp/join/3/join.asp', isCustom: false, selectors: {} },
//         { id: 'bucaDiBeppo', name: 'Buca di Beppo', signupUrl: 'https://dineatbuca.com/eclub/', isCustom: false, selectors: {} },
//         { id: 'buffaloWildWings', name: 'Buffalo Wild Wings', signupUrl: 'https://www.buffalowildwings.com/rewards/', isCustom: false, selectors: {} }
//     ];

//     return masterRetailersArray.reduce((acc, retailer) => {
//         acc[retailer.id] = retailer;
//         return acc;
//     }, {});
// }


// --- Functions to manage CUSTOM retailers in chrome.storage.local ---
async function getWebscrapedRetailersFromFile() { // Renamed for clarity
    console.log("Fetching web scraped retailers from local JSON file...");
    try {
        // Ensure webscrapedRetailers.json is in your manifest.json's web_accessible_resources
        // as explained in the previous answer.
        const response = await fetch(chrome.runtime.getURL('data/webscrapedRetailers.json'));
        if (!response.ok) { // Check if the fetch was successful (e.g., 404, 500)
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const scrapedRetailers = await response.json();
        return scrapedRetailers; // This will be an array
    } catch (error) {
        console.error("Failed to fetch webscraped retailers from file:", error);
        return []; // Return empty array on error
    }
}

chrome.runtime.onInstalled.addListener(async () => {
    console.log("Extension installed or updated. Initializing webscraped retailers in storage...");
    try {
        const scrapedRetailers = await getWebscrapedRetailersFromFile(); // Use the dedicated function
        // Store the webscraped retailers using their own distinct key
        await chrome.storage.local.set({ [WEBSCRAPED_RETAILERS_KEY]: scrapedRetailers });
        console.log("Webscraped retailers initialized in storage.");
    } catch (error) {
        console.error("Error initializing webscraped retailers on install:", error);
    }
});

async function getWebscrapedRetailersFromStorage() { // New function to read from storage
    console.log("Fetching web scraped retailers from local storage...");
    const result = await chrome.storage.local.get([WEBSCRAPED_RETAILERS_KEY]);
    return result[WEBSCRAPED_RETAILERS_KEY] || [];
}



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
        // Get all base data sources
        const masterRetailers = await getMasterRetailerDatabase(); // This is typically an object {id: retailer}
        const webscrapedRetailersArray = await getWebscrapedRetailersFromStorage(); // This is typically an array
        const customRetailersArray = await getCustomRetailers(); // This is typically an array

        // Retrieve the universal list of failed retailer IDs from storage
        const failedIdsResult = await chrome.storage.local.get([FAILED_RETAILER_IDS_KEY]);
        const failedRetailerIds = new Set(failedIdsResult[FAILED_RETAILER_IDS_KEY] || []);
        console.log("DEBUG: Loaded all failed retailer IDs from storage:", Array.from(failedRetailerIds));

        // --- Step 1: Filter Master Retailers ---
        const filteredMasterRetailersObject = {};
        for (const id in masterRetailers) {
            // If the master retailer's ID is NOT in the failed list, include it
            if (!failedRetailerIds.has(id)) {
                filteredMasterRetailersObject[id] = masterRetailers[id];
            }
        }
        console.log("DEBUG: Filtered Master Retailers (count):", Object.keys(filteredMasterRetailersObject).length);

        // --- Step 2: Filter Webscraped Retailers ---
        // Filter the array directly
        const filteredWebscrapedRetailersArray = webscrapedRetailersArray.filter(retailer => {
            // If the webscraped retailer's ID is NOT in the failed list, include it
            return !failedRetailerIds.has(retailer.id);
        });
        // Convert the filtered array back to an object for consistent merging
        const webscrapedRetailersObject = filteredWebscrapedRetailersArray.reduce((obj, retailer) => {
            if (retailer && retailer.id) { // Basic check for valid retailer object
                obj[retailer.id] = retailer;
            }
            return obj;
        }, {});
        console.log("DEBUG: Filtered Webscraped Retailers (count):", Object.keys(webscrapedRetailersObject).length);

        // --- Step 3: Filter Custom Retailers ---
        // Filter the array directly
        const filteredCustomRetailersArray = customRetailersArray.filter(retailer => {
            // If the custom retailer's ID is NOT in the failed list, include it
            return !failedRetailerIds.has(retailer.id);
        });
        // Convert the filtered array back to an object for consistent merging
        const customRetailersObject = filteredCustomRetailersArray.reduce((obj, retailer) => {
            if (retailer && retailer.id) { // Basic check for valid retailer object
                obj[retailer.id] = retailer;
            }
            return obj;
        }, {});
        console.log("DEBUG: Filtered Custom Retailers (count):", Object.keys(customRetailersObject).length);


        // --- Step 4: Combine all filtered retailers ---
        // The order of spread syntax here determines priority for overwriting if IDs conflict:
        // custom > webscraped > master (meaning custom will override webscraped, which will override master)
        allRetailers = {
            ...filteredMasterRetailersObject,
            ...webscrapedRetailersObject, // This will override master if IDs overlap
            ...customRetailersObject      // This will override both master and webscraped if IDs overlap
        };
        console.log("DEBUG: Final combined (and filtered) allRetailers object (total count):", Object.keys(allRetailers).length);

        // Render the list using the values of the combined object
        renderRetailerList(Object.values(allRetailers));

        if (Object.keys(allRetailers).length === 0) {
            showStatusMessage("No retailers found. Add one above!", "info");
            console.log("DEBUG: showStatusMessage 'No retailers found' called.");
        }

    } catch (error) {
        console.error("Bulk Autofill UI: Error loading retailers:", error);
        showStatusMessage("Error loading retailers for bulk autofill. See console for details.", "error");
    }
}

//END RETAILER SECTION

//MISC
function setupPasswordToggle() {
    const passwordInput = getElement('password');
    const toggleButton = getElement('togglePasswordVisibility');
    const toggleIcon = getElement('passwordToggleIcon'); // The <img> tag for the icon

    if (passwordInput && toggleButton && toggleIcon) {
        toggleButton.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            // Change the icon based on the new type
            if (type === 'password') {
                toggleIcon.src = 'icons/eye-slash.svg'; // Path to your hidden icon
                toggleButton.title = 'Show password';
            } else {
                toggleIcon.src = 'icons/eye.svg'; // Path to your visible icon
                toggleButton.title = 'Hide password';
            }
        });
    } else {
        console.warn("Password input or toggle elements not found. Password toggle not set up.");
    }
}

function updatePasswordRequirementsDisplay() {
    const passwordInput = getElement('password');
    if (!passwordInput) return;

    const password = passwordInput.value;

    const reqLength = getElement('reqLength');
    const reqNumber = getElement('reqNumber');
    const reqCapital = getElement('reqCapital');
    const reqLowercase = getElement('reqLowercase');
    const reqSpecial = getElement('reqSpecial');

    // Helper to update status class
    const setStatus = (element, isSatisfied) => {
        if (element) {
            element.classList.remove('satisfied', 'not-satisfied');
            element.classList.add(isSatisfied ? 'satisfied' : 'not-satisfied');
        }
    };

    // 1. Length (8 to 25 characters)
    const isLengthSatisfied = password.length >= 8 && password.length <= 25;
    setStatus(reqLength, isLengthSatisfied);

    // 2. At least one number
    const hasNumber = /\d/.test(password);
    setStatus(reqNumber, hasNumber);

    // 3. At least one capital letter
    const hasCapital = /[A-Z]/.test(password);
    setStatus(reqCapital, hasCapital);

    // 4. At least one lowercase letter
    const hasLowercase = /[a-z]/.test(password);
    setStatus(reqLowercase, hasLowercase);

    // 5. At least one special character
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    setStatus(reqSpecial, hasSpecial);
}


//END MISC


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
    setupPasswordToggle();


    if (passwordField) {
        passwordField.addEventListener('input', updatePasswordRequirementsDisplay);
        // Also call it once on load if a password is pre-filled (e.g., when editing an existing profile)
        updatePasswordRequirementsDisplay();
    }

    // Event listener for the Save Profile button
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', saveProfileFromForm);
    } else {
        console.error("Save Profile button (ID: 'saveProfileBtn') not found.");
    }

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
                    console.log("Bulk Autofill Page: Active profile updated to:", activeProfile);
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

            const checkedRetailerCheckboxes = document.querySelectorAll('.retailer-checkbox:checked');
            const selectedRetailerIds = Array.from(checkedRetailerCheckboxes).map(checkbox => checkbox.value);
            const selectedRetailers = selectedRetailerIds.map(id => allRetailers[id]).filter(retailer => retailer !== undefined);

            if (selectedRetailers.length === 0) {
                showStatusMessage('Please select at least one retailer to autofill.', 'warning', 5000);
                startBulkAutofillButton.style.display = 'block'; // Show start button again
                return;
            }

            showStatusMessage(`Starting autofill for ${selectedRetailers.length} selected retailers...`, 'info', 0);

            let autofillResults = {};
            // Temporarily hold failed IDs from this specific autofill run
            const currentFailedRetailerIds = new Set();

            for (const retailer of selectedRetailers) {
                if (stopBulkAutofill) {
                    console.log("Bulk Autofill: Stopping process due to stop flag.");
                    showStatusMessage('Autofill process stopped by user.', 'info', 5000);
                    autofillResults[retailer.name] = 'Stopped by User'; // Mark remaining as stopped
                    updateAutofillStatusDisplay(autofillResults); // Update display with stopped status
                    break; // Exit the loop
                }

                let tab = null;

                // --- DEBUG POINT 1: Check for invalid URL ---
                if (!retailer.signupUrl || (!retailer.signupUrl.startsWith('http://') && !retailer.signupUrl.startsWith('https://'))) {
                    console.warn(`Bulk Autofill: Skipping invalid or non-http/https signup URL for retailer: ${retailer.name} (${retailer.signupUrl || 'No URL'})`);
                    autofillResults[retailer.name] = 'Skipped (Invalid URL)';
                    updateAutofillStatusDisplay(autofillResults);
                    showStatusMessage(`Skipped ${retailer.name} due to invalid URL.`, 'warning', 3000);
                    currentFailedRetailerIds.add(retailer.id); // Mark as failed due to invalid URL
                    console.log(`DEBUG: Added ${retailer.id} to currentFailedRetailerIds (Invalid URL).`);
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
                                // --- DEBUG POINT 2: Tab creation error ---
                                console.error(`DEBUG: chrome.tabs.create error for ${retailer.name}:`, chrome.runtime.lastError.message);
                                return reject(new Error(chrome.runtime.lastError.message));
                            }
                            resolve(newTab);
                        });
                    });

                    // Wait for the tab to load.
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second for page to load

                    // Inject the content script
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js'] // Assuming your content script is named content.js
                    });

                    // Send the autofill message to the content script in the new tab
                    const response = await sendMessageToContentScript(tab.id, { action: 'fillForm', profile: activeProfile, source: 'bulkAutofill' });

                    if (response && response.status === 'success' && response.fieldsFilledCount > 0) {
                        autofillResults[retailer.name] = `Success (${response.fieldsFilledCount} fields filled, awaiting submission)`;
                        showStatusMessage(`Autofill successful for ${retailer.name} and submitted.`, 'success', 3000);
                    } else if (response && response.cspErrorDetected) {
                        autofillResults[retailer.name] = `Failed (Page Error: CSP Violation)`;
                        showStatusMessage(`Autofill for ${retailer.name} failed due to a page error (CSP).`, 'error', 5000);
                        currentFailedRetailerIds.add(retailer.id); // Add to current failed list
                        console.log(`DEBUG: Added ${retailer.id} to currentFailedRetailerIds (CSP Violation).`);
                    } else if (response && response.status === 'error') {
                        autofillResults[retailer.name] = `Failed (${response.message})`;
                        showStatusMessage(`Autofill for ${retailer.name} failed: ${response.message}.`, 'error', 5000);
                        currentFailedRetailerIds.add(retailer.id); // Add to current failed list
                        console.log(`DEBUG: Added ${retailer.id} to currentFailedRetailerIds (Content Script Error).`);
                    } else if (response && response.status === 'warning') {
                        // Treat specific warnings (like no fields found) as failures
                        if (response.message.includes("No fields found or filled")) {
                            autofillResults[retailer.name] = `Failed: ${response.message}`; // Mark as failed
                            showStatusMessage(`Autofill for ${retailer.name} failed: ${response.message}.`, 'error', 5000);
                            currentFailedRetailerIds.add(retailer.id); // Add to current failed list
                            console.log(`DEBUG: Added ${retailer.id} to currentFailedRetailerIds (Warning: No fields filled).`);
                        } else {
                            autofillResults[retailer.name] = `Warning: ${response.message}`;
                            showStatusMessage(`Autofill for ${retailer.name} resulted in a warning: ${response.message}.`, 'warning', 3000);
                        }
                    } else {
                        autofillResults[retailer.name] = `Failed (Unexpected response or internal error)`;
                        showStatusMessage(`Autofill for ${retailer.name} failed due to an unexpected issue.`, 'error', 5000);
                        currentFailedRetailerIds.add(retailer.id); // Add to current failed list
                        console.log(`DEBUG: Added ${retailer.id} to currentFailedRetailerIds (Unexpected Response).`);
                    }

                } catch (error) {
                    // --- DEBUG POINT 3: General error during tab creation or message sending ---
                    console.error(`Bulk Autofill: Error processing ${retailer.name} (Tab/Messaging):`, error);
                    autofillResults[retailer.name] = `Error: ${error.message || 'Unknown error'}`;
                    showStatusMessage(`Error during autofill for ${retailer.name}.`, 'error', 5000);
                    currentFailedRetailerIds.add(retailer.id); // Add to current failed list
                    console.log(`DEBUG: Added ${retailer.id} to currentFailedRetailerIds (General Catch Error).`);
                } finally {
                    updateAutofillStatusDisplay(autofillResults);
                    // Optional: Close tab after processing
                    if (tab && tab.id) { // Only attempt to remove if a tab was successfully created
                        // chrome.tabs.remove(tab.id);
                    }
                }
            } // End of selectedRetailers loop

            showStatusMessage('Bulk autofill process completed.', 'info', 5000);
            updateAutofillStatusDisplay(autofillResults); // Final update of statuses

            // --- Start of New Functionality for Saving Failed Retailers ---
            console.log("Bulk Autofill: Saving failed retailer IDs to storage and re-rendering list.");

            // 1. Get any existing failed IDs from storage
            const existingFailedResult = await chrome.storage.local.get([FAILED_RETAILER_IDS_KEY]);
            const existingFailedIds = new Set(existingFailedResult[FAILED_RETAILER_IDS_KEY] || []);

            // 2. Merge the newly failed IDs from this run with the existing ones
            const allFailedIds = new Set([...existingFailedIds, ...currentFailedRetailerIds]);
            console.log("DEBUG: Merged allFailedIds to save:", Array.from(allFailedIds));

            // 3. Save the updated set of all failed IDs back to storage
            await chrome.storage.local.set({ [FAILED_RETAILER_IDS_KEY]: Array.from(allFailedIds) });
            console.log("DEBUG: Updated list of failed retailer IDs successfully saved to storage.");

            // 4. Trigger a re-load and re-display of retailers.
            // This will now use the updated 'failedRetailerIds' from storage to filter.
            await loadAndDisplayRetailers();
            // --- End of New Functionality ---
        });
    }

    if (stopBulkAutofillButton) {
        stopBulkAutofillButton.addEventListener('click', async () => {
            console.log("Bulk Autofill: Stop Autofill button clicked.");
            stopBulkAutofill = true; // Set the flag to true
            // Optionally save to storage if you want it to persist across popup closes
            // await chrome.storage.local.set({ stopAutofillFlag: true });
            showStatusMessage('Autofill process will stop after the current site.', 'warning', 3000);
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