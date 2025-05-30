// autofill_content_script.js

console.log("Content Script: Script is initializing...");


const FIELD_MATCHERS = {
    firstName: {
        patterns: ['input[name*="first_name"]', 'input[id*="firstName"]', 'input[autocomplete="given-name"]'],
        keywords: /(first|given)[_]?name/i, // Matches 'firstName', 'first_name', 'givenName', 'given_name'
        autocomplete: /given-name/i,
        type: 'text'
    },
    lastName: {
        patterns: ['input[name*="last_name"]', 'input[id*="lastName"]', 'input[autocomplete="family-name"]'],
        keywords: /(last|family)[_]?name/i, // Matches 'lastName', 'last_name', 'familyName', 'family_name'
        autocomplete: /family-name/i,
        type: 'text'
    },
    email: {
        patterns: ['input[type="email"]', 'input[name*="email"]', 'input[id*="email"]', 'input[autocomplete="email"]'],
        keywords: /e-?mail/i,
        autocomplete: /email/i,
        type: 'email'
    },
    // password: {
    //     patterns: ['input[type="password"][name*="password"]', 'input[type="password"][id*="password"]', 'input[autocomplete="new-password"]'],
    //     keywords: /pass(word)?/i,
    //     autocomplete: /(new-)?password/i,
    //     type: 'password'
    // },
    // ... and so on for other fields like dob, address1, etc.
};
// const FIELD_MATCHERS = {
//     'firstName': {
//         patterns: [
//             'input[id*="first_name"]', 'input[name*="first_name"]',
//             'input[id*="firstName"]', 'input[name*="firstName"]',
//             'input[id*="firstname"]', 'input[name*="firstname"]',
//             'input[id*="fname"]', 'input[name*="fname"]',
//             'input[id*="givenname"]', 'input[name*="givenname"]',
//             'input[id*="first_name_"]', // common on some sites like Salesforce
//             'input[id*="billing_first_name"]', 'input[name*="billing_first_name"]', // common in e-commerce
//             'input[id*="shipping_first_name"]', 'input[name*="shipping_first_name"]'
//         ],
//         keywords: /(first|given|f|bill_f|ship_f|f\s?name)/i, // f name handles "f name" or "fname"
//         autocomplete: /given-name|name/i, // 'name' alone is less specific but often used as fallback
//         type: 'text'
//     },
//     'lastName': {
//         patterns: [
//             'input[id*="last_name"]', 'input[name*="last_name"]',
//             'input[id*="lastname"]', 'input[name*="lastname"]',
//             'input[id*="lastName"]', 'input[name*="lastName"]',
//             'input[id*="lname"]', 'input[name*="lname"]',
//             'input[id*="familyname"]', 'input[name*="familyname"]',
//             'input[id*="last_name_"]',
//             'input[id*="billing_last_name"]', 'input[name*="billing_last_name"]',
//             'input[id*="shipping_last_name"]', 'input[name*="shipping_last_name"]'
//         ],
//         keywords: /(last|family|l|bill_l|ship_l|l\s?name)/i,
//         autocomplete: /family-name/i,
//         type: 'text'
//     },
//     'email': {
//         patterns: [
//             '[type="email"]', '[autocomplete="email"]',
//             '#email', '#emailAddress', '#user_email', '#username',
//             '[name="email"]', '[name="emailAddress"]', '[name="user_email"]', '[name="username"]'
//         ],
//         keywords: /email|e-mail|mail|username/i
//     },
//     'password': {
//         patterns: [
//             '[type="password"]', '[autocomplete="new-password"]', '[autocomplete="current-password"]',
//             '#password', '#pass', '#user_password', '#new_password', '#pwd',
//             '[name="password"]', '[name="pass"]', '[name="user_password"]', '[name="new_password"]', '[name="pwd"]'
//         ],
//         keywords: /password|passcode|new ?password/i
//     },
//     'passwordConfirm': { // Use 'passwordConfirm' as key for profile consistency
//         patterns: [
//             '[type="password"][autocomplete="new-password"]', // Often same autocomplete as new password
//             '#confirmPassword', '#passwordConfirm', '#password2', '#reEnterPassword', '#password_confirmation',
//             '[name="confirmPassword"]', '[name="passwordConfirm"]', '[name="password2"]', '[name="reEnterPassword"]', '[name="password_confirmation"]'
//         ],
//         keywords: /(confirm|re-enter|reenter) ?password/i
//     },
//     'phone': {
//         patterns: [
//             '[type="tel"]', '[autocomplete="tel"]',
//             '#phone', '#phoneNumber', '#mobileNumber',
//             '[name="phone"]', '[name="phoneNumber"]', '[name="mobileNumber"]',
//             'input[type="text"][id*="phone"]', 'input[type="text"][name*="phone"]'
//         ],
//         keywords: /phone|mobile|telephone|tel/i
//     },
//     'dob': { // Date of Birth
//         patterns: [
//             '[type="date"]', '[autocomplete="bday"]',
//             '#dob', '#birthday', '#dateOfBirth',
//             '[name="dob"]', '[name="birthday"]', '[name="dateOfBirth"]'
//         ],
//         keywords: /(date of birth|dob|birthday)/i
//     },
//     'address1': {
//         patterns: [
//             '[autocomplete="address-line1"]',
//             '#address1', '#addressLine1', '#streetAddress',
//             '[name="address1"]', '[name="addressLine1"]', '[name="streetAddress"]'
//         ],
//         keywords: /(address|street|line) ?1/i
//     },
//     'address2': {
//         patterns: [
//             '[autocomplete="address-line2"]',
//             '#address2', '#addressLine2', '#apartmentUnit',
//             '[name="address2"]', '[name="addressLine2"]', '[name="apartmentUnit"]'
//         ],
//         keywords: /(address|street|line) ?2|apt|unit|suite/i
//     },
//     'city': {
//         patterns: [
//             '[autocomplete="address-level2"]',
//             '#city', '[name="city"]'
//         ],
//         keywords: /city/i
//     },
//     'state': {
//         patterns: [
//             '[autocomplete="address-level1"]',
//             '#state', '[name="state"]', 'select#state', 'select[name="state"]'
//         ],
//         keywords: /state|province/i
//     },
//     'zip': { // Postal Code
//         patterns: [
//             '[autocomplete="postal-code"]',
//             '#zipCode', '#postalCode', '#zip',
//             '[name="zipCode"]', '[name="postalCode"]', '[name="zip"]'
//         ],
//         keywords: /zip|postal ?code/i
//     },
//     'country': {
//         patterns: [
//             '[autocomplete="country"]',
//             '#country', 'select#country', '[name="country"]', 'select[name="country"]'
//         ],
//         keywords: /country/i
//     },
//     'gender': {
//         patterns: [
//             'select#gender', 'select[name="gender"]',
//             '[name="gender"]', '[type="radio"][name="gender"]', // If radio, we find specific value
//             'input[type="radio"][id*="gender"][value="male"]', // More specific for common values
//             'input[type="radio"][id*="gender"][value="female"]',
//             'input[type="radio"][id*="gender"][value="other"]'
//         ],
//         keywords: /gender/i
//     }
// };

function dispatchEvents(element) {
    if (element) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true })); // Blur can trigger validation
    }
}

function fillAndDispatch(field, value, fieldKey) {
    if (field.value === value) {
        console.log(`Content Script: Field ${fieldKey} already has correct value, skipping.`);
        return true; // Already correct, count as filled
    }

    if (field.tagName === 'SELECT') {
        let optionFound = false;
        // Try to find option by value first, then by text content
        for (let i = 0; i < field.options.length; i++) {
            if (field.options[i].value === value) {
                field.value = value;
                optionFound = true;
                break;
            }
        }
        if (!optionFound) {
            // Fallback to text content matching if value not found
            for (let i = 0; i < field.options.length; i++) {
                if (field.options[i].textContent.toLowerCase().trim() === String(value).toLowerCase().trim()) {
                    field.value = field.options[i].value;
                    optionFound = true;
                    break;
                }
            }
        }
        if (!optionFound) {
            console.warn(`Content Script: Option for '${fieldKey}' with value/text '${value}' not found in select with selector '${field.id || field.name || field.className}'.`);
            return false; // Could not fill this select
        }
    } else if (field.type === 'radio' || field.type === 'checkbox') {
        // For radio/checkbox, we need to ensure it's the correct option
        if (String(field.value).toLowerCase() === String(value).toLowerCase()) {
            field.checked = true;
        } else {
            // If it's a radio button group and this isn't the one to select, skip.
            // If it's a checkbox and value doesn't match, or it's implicitly true/false, we might need more logic.
            // For now, assuming profile value directly matches the radio/checkbox 'value' attribute for selection.
            // Or if profile value is boolean, check/uncheck directly.
            if (typeof value === 'boolean') {
                field.checked = value;
            } else if (field.type === 'checkbox' && value) { // For generic checkboxes, just check if value is truthy
                field.checked = true;
            }
            // If it's a radio and doesn't match, it means another radio in the group is intended.
            // So we don't return false, but rather continue loop if this wasn't the target.
            return false; // Did not fill this specific radio/checkbox
        }
    } else {
        // For text, email, password, number, textarea, date inputs
        field.value = value;
    }

    dispatchEvents(field); // Dispatch events

    // Add highlight for visibility (optional, remove or make configurable later)
    field.style.border = '2px solid #4CAF50'; // Green border
    field.style.boxShadow = '0 0 5px rgba(76, 175, 80, 0.5)';
    field.style.transition = 'border 0.3s, box-shadow 0.3s';

    console.log(`Content Script: Filled ${fieldKey} (${field.id || field.name || field.placeholder || 'unnamed'}): ${value}`);
    return true; // Successfully filled
}

async function autofillForm(profile, settings, retailer, isBulkAutofill = false) {
    console.log("Content Script: Autofill initiated.");
    console.log("Content Script: Profile data:", profile);

    if (!profile) {
        console.warn("Content Script: No profile data provided for autofill.");
        await chrome.runtime.sendMessage({
            action: 'reportAutofillStatus',
            retailerId: retailer ? retailer.id : null,
            status: 'attention',
            message: 'No profile data provided for autofill.'
        }).catch(e => console.error("Content Script: Error reporting status:", e));
        return { success: false, message: 'No profile data' };
    }

    let filledFieldsCount = 0;
    let identifiedFieldsCount = 0; // Number of fields on the page that match a profile field
    let termsAccepted = false;
    let missingFields = new Set(); // To track fields that weren't filled but were present
    let filledProfileFields = new Set(); // Track which profile properties were successfully used

    // Collect all relevant form elements once at the start
    // Filter for visible and enabled elements.
    const allFormElements = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'))
        .filter(el => {
            const style = window.getComputedStyle(el);
            return el.offsetParent !== null &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                !el.disabled &&
                !el.readOnly; // Also exclude readOnly fields from the start
        });
    console.log(`Content Script: Found ${allFormElements.length} visible/enabled form elements on page.`);

    // First pass: Try to fill fields using specific CSS selectors (more precise)
    for (const key in FIELD_MATCHERS) {
        const profileValue = profile[key];
        console.log(`Content Script: Processing field '${key}' with value:`, profileValue);
        if (!profileValue || filledProfileFields.has(key)) {
            if (profileValue) { // If there's a value but it's already filled, it's not 'missing'
                // This `continue` means we skip to the next profile key if already handled
                continue;
            } else {
                // If there's no profileValue for this key, it's genuinely missing from the profile
                console.log(`Content Script: No profile value for '${key}', skipping.`);
                missingFields.add(key);
                continue;
            }
        }

        const matchInfo = FIELD_MATCHERS[key];
        let fieldFilledForThisProfileKey = false;

        // Try direct selectors first
        for (const selector of matchInfo.patterns) {
            const field = document.querySelector(selector);
            console.log(`Content Script: Trying direct selector '${selector}' for field '${key}'`);
            console.log(`Content Script: Field found by selector '${selector}':`, field);
            if (field && !field.disabled && !field.readOnly && field.offsetParent !== null) {
                // Perform strict type checks for specific fields even with direct selectors
                let typeMatches = true;
                if (matchInfo.type === 'password' && field.type !== 'password') typeMatches = false;
                else if (matchInfo.type === 'email' && field.type !== 'email' && field.type !== 'text') typeMatches = false; // Email can be text
                else if (matchInfo.type === 'tel' && field.type !== 'tel' && field.type !== 'text') typeMatches = false; // Phone can be text
                else if (matchInfo.type === 'text' && field.type !== 'text' && field.tagName.toLowerCase() !== 'textarea' && field.tagName.toLowerCase() !== 'select') typeMatches = false;

                if (!typeMatches) {
                    console.log(`Content Script: Selector match for ${key} found but type mismatch: ${field.type} vs expected ${matchInfo.type}`);
                    continue;
                }
                console.log(`Content Script: Identified field for '${key}' via direct selector:`, {
                    id: field.id,
                    name: field.name,
                    type: field.type,
                    autocomplete: field.autocomplete
                });

                identifiedFieldsCount++;
                if (fillAndDispatch(field, profileValue, key)) {
                    filledFieldsCount++;
                    filledProfileFields.add(key);
                    fieldFilledForThisProfileKey = true;
                    break; // Move to next profile key if a field is filled
                }
            }
        }
        // If field was filled by direct pattern, move to next profile key.
        if (fieldFilledForThisProfileKey) {
            continue;
        }

        // --- SECOND PASS: If not filled by direct pattern, try keyword matching on other attributes ---
        // Iterate through all found form elements to find a match for the current 'key'
        for (const field of allFormElements) {
            // If the current profile key has already been filled by THIS loop, break inner loop for fields
            if (fieldFilledForThisProfileKey) break;

            // Skip if the field is disabled, readOnly, or not visible (already filtered mostly by querySelectorAll)
            // But doing it again here ensures no edge cases if DOM changes dynamically
            if (field.disabled || field.readOnly || field.offsetParent === null) continue;

            // Normalize field attributes to lowercase for consistent matching
            const fieldName = field.name ? field.name.toLowerCase() : '';
            const fieldId = field.id ? field.id.toLowerCase() : '';
            const fieldPlaceholder = field.placeholder ? field.placeholder.toLowerCase() : '';
            let fieldLabelText = field.labels && field.labels.length > 0 ? field.labels[0].textContent.toLowerCase().trim() : '';
            if (field.labels && field.labels.length > 0) {
                fieldLabelText = field.labels[0].textContent.toLowerCase().trim();
            } else {
                const parentLabel = field.closest('label');
                if (parentLabel) fieldLabelText = parentLabel.textContent.toLowerCase().trim();
            }
            const fieldAriaLabel = field.ariaLabel ? field.ariaLabel.toLowerCase() : '';
            const fieldAutocomplete = field.autocomplete ? field.autocomplete.toLowerCase() : '';
            const fieldType = field.type ? field.type.toLowerCase() : '';

            // This `if (filledProfileFields.has(key)) continue;` is redundant here
            // because we already check `if (!profileValue || filledProfileFields.has(key))`
            // at the beginning of the *outer* loop (`for (const key in FIELD_MATCHERS)`).
            // Removing it here simplifies the inner loop logic.

            // Use keywords to match (name, id, placeholder, label, aria-label, autocomplete)
            // Prioritize autocomplete if available and matches pattern
            const hasAutocompleteMatch = matchInfo.autocomplete && matchInfo.autocomplete.test(fieldAutocomplete);
            const hasKeywordMatch = matchInfo.keywords && (
                matchInfo.keywords.test(fieldName) ||
                matchInfo.keywords.test(fieldId) ||
                matchInfo.keywords.test(fieldPlaceholder) ||
                matchInfo.keywords.test(fieldLabelText) ||
                matchInfo.keywords.test(fieldAriaLabel)
            );

            if (hasAutocompleteMatch || hasKeywordMatch) {
                // --- REFINED SPECIAL HANDLING FOR ALL FIELD TYPES ---
                // This ensures strict type matching similar to email/password, but generalized.
                let typeMatches = true;
                if (matchInfo.type === 'password') {
                    if (fieldType !== 'password') typeMatches = false;
                } else if (matchInfo.type === 'email') {
                    // Email can be type 'email' or 'text'
                    if (fieldType !== 'email' && fieldType !== 'text') typeMatches = false;
                } else if (matchInfo.type === 'tel') {
                    // Phone can be type 'tel' or 'text'
                    if (fieldType !== 'tel' && fieldType !== 'text') typeMatches = false;
                } else if (matchInfo.type === 'text') {
                    // Most other fields (names, addresses, city, state, zip, country) are type 'text' or a textarea/select
                    if (fieldType !== 'text' && field.tagName.toLowerCase() !== 'textarea' && field.tagName.toLowerCase() !== 'select') {
                        typeMatches = false;
                    }
                }
                // Add checks for other specific types if you have them, e.g., 'number', 'date'

                if (!typeMatches) {
                    console.log(`Content Script: Keyword/Autocomplete match for ${key} found but type mismatch: ${fieldType} vs expected ${matchInfo.type}`);
                    continue; // Skip this field if type doesn't match
                }

                console.log(`Content Script: Identified field for '${key}' via keyword/autocomplete match:`, {
                    id: field.id,
                    name: field.name,
                    type: field.type,
                    autocomplete: field.autocomplete,
                    matchedBy: hasAutocompleteMatch ? 'autocomplete' : 'keyword'
                });

                // If type matches and we have a strong attribute match
                identifiedFieldsCount++;
                if (fillAndDispatch(field, profileValue, key)) {
                    filledFieldsCount++;
                    filledProfileFields.add(key);
                    fieldFilledForThisProfileKey = true; // Mark as filled for this profile key
                    break; // Break the inner `for (const field of allFormElements)` loop
                }
            }
        }

        //If after both passes, the current profile key still wasn't filled, add to missing.
        //But only if there was a `profileValue` to begin with.
        if (!fieldFilledForThisProfileKey && profileValue) {
            missingFields.add(key);
        }
    }

    // --- Terms and Conditions / Opt-Out Logic ---
    // This section remains largely the same, but ensure `dispatchEvents` is defined
    // (it's the same logic as the events inside `fillAndDispatch`).
    // It's good to iterate `allFormElements` again for checkboxes/radios as they
    // might not be associated with a specific profile field key.

    // Helper function for dispatching events (can be merged into fillAndDispatch if not used separately)
    function dispatchEvents(field) {
        const eventNames = ['input', 'change', 'blur'];
        eventNames.forEach(eventName => {
            try {
                const event = new Event(eventName, { bubbles: true });
                field.dispatchEvent(event);
            } catch (e) {
                console.warn(`Content Script: Error dispatching '${eventName}' for checkbox:`, e);
            }
        });
    }

    allFormElements.forEach(field => {
        const fieldName = field.name ? field.name.toLowerCase() : '';
        const fieldId = field.id ? field.id.toLowerCase() : '';
        // Use .trim() for label text
        let fieldLabelText = '';
        if (field.labels && field.labels.length > 0) {
            fieldLabelText = field.labels[0].textContent.toLowerCase().trim();
        } else {
            const parentLabel = field.closest('label');
            if (parentLabel) fieldLabelText = parentLabel.textContent.toLowerCase().trim();
        }
        const fieldType = field.type ? field.type.toLowerCase() : '';

        // Terms and Conditions checkbox
        if (!termsAccepted && (fieldType === 'checkbox' || fieldType === 'radio') &&
            (fieldName.includes('terms') || fieldId.includes('terms') ||
                fieldName.includes('agree') || fieldId.includes('agree') ||
                fieldLabelText.includes('terms of use') || fieldLabelText.includes('terms & conditions') || fieldLabelText.includes('agree to the terms') ||
                field.ariaLabel?.toLowerCase().includes('terms'))) {

            console.log(`Content Script: Identified T&C field:`, {
                id: field.id,
                name: field.name,
                type: field.type,
                checked: field.checked
            });

            if (!field.checked) {
                console.log("Content Script: Attempting to click T&C checkbox:", field.id || fieldName);
                field.click(); // Standard click first
                dispatchEvents(field); // Dispatch events

                setTimeout(() => {
                    if (field.type === 'checkbox' && !field.checked) {
                        console.log("Content Script: T&C input still not checked after click. Forcing `field.checked = true`.");
                        field.checked = true;
                        dispatchEvents(field); // Force events after direct assignment
                    }
                }, 100);
                termsAccepted = true;
                identifiedFieldsCount++;
                filledFieldsCount++;
                console.log("Content Script: Accepted Terms and Conditions.");
            } else {
                console.log("Content Script: T&C already checked, skipping click:", field.id || fieldName);
                termsAccepted = true; // Still mark as handled
                identifiedFieldsCount++; // Still identified
            }
        }

        // Email opt-out/subscription checkbox
        if (settings && typeof settings.autoOptOutEmailSubscription !== 'undefined' && fieldType === 'checkbox' &&
            (fieldName.includes('opt') || fieldId.includes('opt') ||
                fieldName.includes('newsletter') || fieldId.includes('newsletter') ||
                fieldLabelText.includes('newsletter') || fieldLabelText.includes('updates') ||
                field.ariaLabel?.toLowerCase().includes('newsletter') || field.ariaLabel?.toLowerCase().includes('updates'))) {

            // if (settings.autoOptOutEmailSubscription) { // User wants to opt out (checkbox unchecked)
            //     if (field.checked) {
            //         console.log("Content Script: Clicking to opt out of email subscription.");
            //         field.click();
            //         dispatchEvents(field);
            //     }
            // } else { // User wants to remain opted in (checkbox checked)
            //     if (!field.checked) {
            //         console.log("Content Script: Clicking to opt in to email subscription.");
            //         field.click();
            //         dispatchEvents(field);
            //     }
            // }
            console.log(`Content Script: Identified Email Opt-out field:`, {
                id: field.id,
                name: field.name,
                type: field.type,
                checked: field.checked
            });
            fillAndDispatch(field, !settings.autoOptOutEmailSubscription, 'email_subscription_opt_out');

            console.log("Content Script: Handled email subscription preference.");
        }
    });


    // --- Determine Final Status ---
    let status = 'success';
    let message = 'Form filling completed.';

    if (filledFieldsCount === 0 && identifiedFieldsCount === 0) {
        status = 'attention';
        message = 'No relevant form fields were found on the page or no profile data was available.';
    } else if (missingFields.size > 0 && filledFieldsCount > 0) {
        status = 'partial-success';
        message = `Partial fill: ${filledFieldsCount} fields filled. Missing data for: ${Array.from(missingFields).join(', ')}.`;
    } else if (filledFieldsCount === 0 && identifiedFieldsCount > 0) {
        status = 'needs-attention';
        message = `Fields were identified but none filled. Missing all: ${Array.from(missingFields).join(', ')}.`;
    } else if (filledFieldsCount > 0 && missingFields.size === 0 && !termsAccepted && document.querySelector('input[type="checkbox"][id*="terms"],input[name*="terms"],label:has(input[id*="terms"]),label:has(input[name*="terms"])')) {
        // Special case: all data fields filled, but T&C was present and not auto-accepted (can happen if label text doesn't match well)
        status = 'partial-success';
        message += ' Please check for Terms and Conditions checkbox.';
    }

    console.log(`Content Script: Final status for ${retailer?.name || 'current page'}: ${status} - ${message}`);

    await chrome.runtime.sendMessage({
        action: 'reportAutofillStatus',
        retailerId: retailer ? retailer.id : null,
        status: status,
        message: message,
        filledFields: Array.from(filledProfileFields),
        missingFields: Array.from(missingFields)
    }).catch(e => console.error("Content Script: Error reporting final status:", e));

    if (isBulkAutofill && settings.autoclickSubmit) {
        console.log("Content Script: Bulk autofill with auto-submit enabled, attempting to submit form.");
        const submitted = await submitForm(); // Assuming submitForm() is defined elsewhere
        if (submitted) {
            console.log("Content Script: Form submitted successfully.");
            await chrome.runtime.sendMessage({
                action: 'reportAutofillStatus',
                retailerId: retailer ? retailer.id : null,
                status: 'submitted',
                message: 'Autofill complete and form submitted successfully.'
            }).catch(e => console.error("Content Script: Error reporting submission success:", e));
            return { success: true, status: 'submitted', message: 'Autofill complete and form submitted' };
        } else {
            console.warn("Content Script: Failed to submit form automatically.");
            await chrome.runtime.sendMessage({
                action: 'reportAutofillStatus',
                retailerId: retailer ? retailer.id : null,
                status: 'attention',
                message: 'Autofill complete but failed to submit form automatically.'
            }).catch(e => console.error("Content Script: Error reporting submission failure:", e));
            return { success: false, status: 'submission_failed', message: 'Autofill complete but failed to submit form automatically' };
        }
    } else {
        console.log("Content Script: Form will not be submitted automatically (not bulk or auto-submit disabled).");
        return { success: true, status: status, message: message };
    }
}

async function submitForm() {
    console.log("Content Script: Attempting to submit form...");

    const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        // Common IDs and names for submit buttons
        'button#submitButton', 'button#submitBtn', 'input#submitButton', 'input#submitBtn',
        'button[name="submit"]', 'input[name="submit"]',
        // Common classes for submit buttons
        '.submit-button', '.btn-submit', '.button-primary', '.btn.btn-primary',
        // Buttons with specific text content (more robust search) - case-insensitive
        'button:not([type="button"]):not([type="reset"]):is([aria-label*="sign up" i],[aria-label*="create account" i],[aria-label*="register" i],[value*="sign up" i],[value*="create account" i],[value*="register" i]):not([disabled])',
        'input[type="submit"]:is([aria-label*="sign up" i],[aria-label*="create account" i],[aria-label*="register" i],[value*="sign up" i],[value*="create account" i],[value*="register" i]):not([disabled])',
        'button:not([type="button"]):not([type="reset"]):is([id*="signup" i],[name*="signup" i],[class*="signup" i],[id*="register" i],[name*="register" i],[class*="register" i]):not([disabled])',
        'input[type="button"]:is([id*="signup" i],[name*="signup" i],[class*="signup" i],[id*="register" i],[name*="register" i],[class*="register" i]):not([disabled])', // Sometimes type="button" is used for submit
        'form' // Fallback: if no button, try submitting the first form directly
    ];

    for (const selector of submitSelectors) {
        let submitButtonOrForm = null;
        let isFormDirectSubmit = false;

        try {
            if (selector === 'form') {
                submitButtonOrForm = document.querySelector(selector);
                isFormDirectSubmit = true;
            } else {
                // Use a more specific query for elements based on text content
                const potentialElements = document.querySelectorAll(selector);
                for (const elem of potentialElements) {
                    if (elem.offsetParent !== null && !elem.disabled && !elem.hidden) { // Ensure visible and enabled
                        // Check text content, value, or aria-label for common submit phrases
                        const textContent = elem.textContent?.toLowerCase() || '';
                        const valueContent = elem.value?.toLowerCase() || '';
                        const ariaLabelContent = elem.ariaLabel?.toLowerCase() || '';

                        if (selector.includes(':is(')) { // For complex selectors with :is()
                            // This part of the logic relies on the CSS selector already doing the filtering.
                            // If the selector contains text-based checks (like [value*="sign up"]), it's already specific.
                            submitButtonOrForm = elem;
                            break;
                        } else if (textContent.includes('submit') || valueContent.includes('submit') || ariaLabelContent.includes('submit') ||
                            textContent.includes('sign up') || valueContent.includes('sign up') || ariaLabelContent.includes('sign up') ||
                            textContent.includes('create account') || valueContent.includes('create account') || ariaLabelContent.includes('create account') ||
                            textContent.includes('register') || valueContent.includes('register') || ariaLabelContent.includes('register')) {
                            submitButtonOrForm = elem;
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn(`Content Script: Invalid submit selector '${selector}': ${e.message}`);
            continue;
        }

        if (submitButtonOrForm) {
            if (isFormDirectSubmit) {
                console.log("Content Script: Attempting direct form submission:", submitButtonOrForm);
                try {
                    submitButtonOrForm.submit();
                    console.log("Content Script: Direct form.submit() successful.");
                    await new Promise(r => setTimeout(r, 500)); // Small delay for navigation
                    return true;
                } catch (e) {
                    console.warn("Content Script: Direct form.submit() failed:", e);
                    continue; // Try next selector
                }
            } else {
                if (submitButtonOrForm.offsetParent === null || submitButtonOrForm.disabled || submitButtonOrForm.hidden) {
                    console.log(`Content Script: Found submit button/element with selector '${selector}', but it's not visible or is disabled/hidden.`);
                    continue;
                }

                console.log("Content Script: Attempting robust click on submit button:", submitButtonOrForm.id || submitButtonOrForm.className || submitButtonOrForm.tagName);

                // Simulate a robust click sequence
                const eventOptions = { bubbles: true, cancelable: true, view: window };
                submitButtonOrForm.dispatchEvent(new MouseEvent('mousedown', eventOptions));
                submitButtonOrForm.dispatchEvent(new MouseEvent('mouseup', eventOptions));
                submitButtonOrForm.dispatchEvent(new MouseEvent('click', eventOptions));

                // Attempt to submit the parent form if the button is part of one and click didn't work immediately
                if (submitButtonOrForm.form) {
                    try {
                        submitButtonOrForm.form.submit();
                        console.log("Content Script: Also attempted form.submit() via button's parent form.");
                    } catch (e) {
                        console.warn("Content Script: Error attempting form.submit() via button's parent form:", e);
                    }
                }

                await new Promise(r => setTimeout(r, 500)); // Small delay for navigation
                console.log("Content Script: Simulated robust click on submit button.");
                return true; // Button found and clicked
            }
        }
    }
    console.log("Content Script: No suitable submit button found or clicked.");
    return false;
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // This is the direct message from background.js or popup.js
    if (request.action === 'autofillForm' || request.action === 'autofillFormBulk' || request.action === 'fillForm') {
        console.log("Content Script: Received autofill message.", request);
        // Ensure all expected properties are present, even if empty objects
        const profile = request.profile || {};
        const settings = request.settings || {};
        const retailer = request.retailer || {};
        const isBulkAutofill = request.isBulkAutofill || false; // This typically comes from bulk process

        autofillForm(profile, settings, retailer, isBulkAutofill)
            .then(response => sendResponse(response))
            .catch(error => {
                console.error("Content Script: Error during autofill execution:", error);
                sendResponse({ success: false, message: error.message, status: 'error' });
            });
        return true; // Indicate asynchronous response
    }

    // This listener should be kept if your background script sends it
    // Example: For background script to know when it's safe to send autofill commands after injection
    if (request.action === "contentScriptReadyAck") {
        console.log("Content Script: Background acknowledged ready.");
    }
    // No other listeners needed here if the background script is sending full data directly.

    return false; // For messages not handled by this listener
});

console.log("Content Script: 'autofill_content_script.js' loaded and signaling readiness.");
chrome.runtime.sendMessage({ action: "contentScriptReady" })
    .then(response => {
        // This might be null or { acknowledged: true }
    })
    .catch(error => {
        // This can happen if the background script hasn't loaded yet or is being reloaded
        console.warn("Content Script: Error sending ready message (background might not be ready yet):", error);
    });