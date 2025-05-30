// websiteNavigator.js

// Database of popular retailers and their loyalty program signup URLs
// Changed to an ARRAY of objects for easier iteration in the background script.
const retailerDatabase = [
    {
        id: "victoriaSecret", // Added a unique ID for each retailer
        name: "Victoria's Secret",
        signupUrl: "https://www.victoriassecret.com/us/vs/rewards-signup",
        // Optional: Add site-specific notes or instructions
        // notes: "Might have a popup. Requires email confirmation.",
        // fieldOverrides: { email: 'vs_email_field_id', firstName: 'vs_first_name_name_attr' } // Example
    },
    {
        id: "starbucks",
        name: "Starbucks",
        signupUrl: "https://www.starbucks.com/account/create", // Example URL, verify actual
        // notes: "Multi-step form.",
        // steps: [ { action: 'fill', fields: ['email', 'password'] }, { action: 'click', selector: '#nextButton' }, ... ] // Example
    },
    {
        id: "sephora",
        name: "Sephora",
        signupUrl: "https://www.sephora.com/beautyinsider/signup", // Example URL, verify actual
        // notes: "Check for cookie consent.",
    },
    // Add more retailers here following the same structure
    // { id: "retailerId", name: "Display Name", signupUrl: "..." },
];

/**
 * Returns the retailer database.
 * @returns {Array<object>} The retailer database (now an array).
 */
function getRetailerDatabase() {
    return retailerDatabase;
}

/**
 * Returns a retailer object by its ID.
 * @param {string} retailerId - The ID of the retailer.
 * @returns {object|null} The retailer object or null if not found.
 */
function getRetailerById(retailerId) {
    return retailerDatabase.find(retailer => retailer.id === retailerId) || null;
}

// Make functions accessible if imported via importScripts in service worker
if (typeof importScripts !== 'undefined') {
    this.getRetailerDatabase = getRetailerDatabase;
    this.getRetailerById = getRetailerById;
} else {
    // For use in other scripts that import this directly (e.g., content script if needed)
    // Or if using ES Modules in background.js (Manifest V3 supports this for background)
    // export { getRetailerDatabase, getRetailerById };
}

/**
 * Initiates the navigation to a specific retailer's signup page.
 * Sends a message to the background script to handle tab creation and navigation.
 * @param {string} retailerId - The ID of the retailer from the database.
 * @param {object} profileData - The user's profile data to be used for autofill.
 */
function navigateToSignup(retailerId, profileData) {
    const retailer = retailerDatabase.find(r => r.id === retailerId); // Use find on the array
    if (!retailer) {
        console.error(`Website Navigator: Retailer with ID "${retailerId}" not found.`);
        // TODO: Notify popup or user of error
        return;
    }

    console.log(`Website Navigator: Initiating navigation to ${retailer.name} signup page.`);

    // Send a message to the background script to open the new tab and handle subsequent steps
    chrome.runtime.sendMessage({
        action: 'openRetailerSignupPage',
        url: retailer.signupUrl,
        retailerId: retailerId, // Pass retailer ID for potential site-specific logic later
        profile: profileData // Pass the profile data
    }, (response) => {
        if (response && response.success) {
            console.log(`Website Navigator: Background script confirmed opening tab for ${retailer.name}.`);
            // Background script will handle injecting content script and triggering autofill
        } else {
            console.error(`Website Navigator: Failed to send message to background script to open tab for ${retailer.name}.`, response ? response.error : 'No response');
            // TODO: Notify popup or user of error
        }
    });
}

// Note: This file does NOT need to be declared in content_scripts in manifest.json.
// It will be included in the background script or potentially in popup.js if needed there.
// Let's plan to include it in background.js as the background script will manage tabs.