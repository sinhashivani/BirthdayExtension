// content.js

// Use an Immediately Invoked Function Expression (IIFE) to avoid polluting the global scope of the webpage
(function () {
  // Configuration Variables
  // These variables need to be loaded with actual data/settings, typically from the popup or background script
  let autofillActive = false;
  let currentProfile = null;
  let contentSettings = {};
  let retailerId = null;

  // Field Identification Mapping
  // Map our internal field types to common name/ID patterns found in HTML forms
  // IMPORTANT: Ensure the keys here match the property names in your profile objects!
  let fieldMapping = {
    // Common field name and ID patterns (using regex format)
    firstName: ['first[-_]?name', 'fname', 'first', 'given[-_]?name'],
    lastName: ['last[-_]?name', 'lname', 'last', 'surname', 'family[-_]?name'],
    email: ['email', 'e[-_]?mail', 'mail'],
    password: ['password', 'Password', 'current-password', 'new-password'], // Added new-password
    confirmPassword: ['confirm[-_]?password', 'password[-_]?confirm'], // Added confirm password
    // Add patterns for phone number components if stored separately
    phoneCountryCode: ['country[-_]?code', 'dialing[-_]?code', 'intl[-_]?code', 'international[-_]?code', 'cc', 'phone[-_]?cc', 'prefix', 'phone[-_]?prefix'],
    phone: ['phone', 'telephone', 'tel', 'mobile', 'cell', 'phone[-_]?number'], // Main phone number
    birthday: ['birth[-_]?day', 'birth[-_]?date', 'dob', 'date[-_]?of[-_]?birth', 'bday'], // For single date inputs (type="date" or text expecting YYYY-MM-DD)
    birthdayDay: ['day', 'dd', 'birth[-_]?day', 'bday[-_]?day'], // For split date inputs
    birthdayMonth: ['month', 'mm', 'birth[-_]?month', 'bday[-_]?month'], // For split date inputs
    birthdayYear: ['year', 'yy', 'yyyy', 'birth[-_]?year', 'bday[-_]?year'], // For split date inputs
    address: ['address', 'street', 'addr', 'address[-_]?line[-_]?1', 'street[-_]?address'],
    address2: ['address[-_]?line[-_]?2', 'addr2'], // Added address line 2
    city: ['city', 'town', 'locality', 'address[-_]?level2'],
    state: ['state', 'province', 'region', 'address[-_]?level1'],
    zip: ['zip', 'postal[-_]?code', 'post[-_]?code', 'zip[-_]?code'],
    country: ['country'], // Added country
    // Add consent checkbox types here
    termsConsent: ['terms', 'conditions', 'agree', 'accept', 'service', 'legal', 'privacy'],
    subscriptionConsent: ['subscribe', 'newsletter', 'sms', 'email', 'updates', 'promotions', 'offers', 'marketing'],
    // Add other field types as needed (e.g., company, etc.)
  };

  // Fuzzy matching patterns for labels, placeholders, and aria-labels (used by identifyField)
  // These are simpler strings for case-insensitive substring matching
  const labelPatterns = {
    firstName: ['first name', 'given name', 'first'],
    lastName: ['last name', 'surname', 'family name', 'last'],
    email: ['email', 'e-mail', 'email address'],
    password: ['password', 'create password', 'new password', 'confirm password', 'current password'],
    phoneCountryCode: ['country code', 'dialing code', 'international code', 'intl code', 'country prefix', 'prefix'],
    phone: ['phone', 'telephone', 'mobile', 'cell', 'phone number'],
    birthday: ['birth date', 'birthday', 'date of birth', 'dateofbirth', 'birth', 'dob', 'mm/dd/yyyy', 'dd/mm/yyyy'],
    birthdayDay: ['day'],
    birthdayMonth: ['month'],
    birthdayYear: ['year'],
    address: ['address', 'street address', 'street', 'address line 1'],
    address2: ['address line 2'],
    city: ['city', 'town', 'locality'],
    state: ['state', 'province', 'region'],
    zip: ['zip', 'zip code', 'postal code', 'post code'],
    country: ['country'],
    termsConsent: ['terms and conditions', 'terms of service', 'privacy policy', 'agree to', 'accept'],
    subscriptionConsent: ['subscribe', 'newsletter', 'sms', 'email updates', 'promotions', 'offers', 'marketing emails'],
    // Add other field types as needed
  };


  // --- Content Script Initialization Calls ---
  // These functions are called immediately when the content script is injected

  initMessageListeners(); // Set up message handling
  initMutationObserver(); // Start observing for DOM changes
  addStyles(); // Inject necessary CSS for highlighting/overlays


  // --- Helper Functions ---

  /**
   * Dispatches standard DOM events on an element to simulate user interaction.
   * Useful for triggering site-specific JavaScript listeners after filling a field.
   * @param {Element} element - The DOM element to dispatch events on.
   * @param {Array<string>} events - An array of event type names (e.g., ['input', 'change', 'blur']).
   */
  function triggerEvents(element, events) {
    events.forEach(eventType => {
      try {
        const event = new Event(eventType, { bubbles: true, cancelable: true });
        element.dispatchEvent(event);
        // console.log(`Content script: Dispatched ${eventType} event on`, element); // Optional log
      } catch (e) {
        console.error(`Content script: Error dispatching ${eventType} event:`, e);
      }
    });
  }

  async function autofillForm(profile, settings, receivedRetailerId) { // Accept retailerId
    retailerId = receivedRetailerId; // Store retailer ID
    addStyles(); // Ensure styles are added for highlighting

    let filledFieldsCount = 0;
    let identifiedFieldsCount = 0;

    for (const fieldType in fieldMapping) {
      const patterns = fieldMapping[fieldType];
      const profileValue = profile[fieldType];

      if (profileValue) {
        // Find all matching fields for this field type
        const fields = findMatchingFields(patterns);
        if (fields.length > 0) {
          identifiedFieldsCount++; // At least one field was identified for this type
          const success = fillField(patterns, profileValue, fieldType);
          if (success) {
            filledFieldsCount++;
          }
        }
      }
    }

    // Handle email opt-out checkbox if settings allow
    if (settings.autoOptOutEmailSubscription) {
      // Add robust logic here for email opt-out. This is highly site-specific.
      // Example: look for checkboxes with common opt-out labels/ids.
      const optOutCheckboxes = document.querySelectorAll(
        'input[type="checkbox"][id*="opt"], input[type="checkbox"][name*="opt"], input[type="checkbox"][id*="newsletter"], input[type="checkbox"][name*="newsletter"]'
      );
      optOutCheckboxes.forEach(checkbox => {
        // Only uncheck if it's currently checked
        if (checkbox.checked) {
          checkbox.click(); // Simulate a click to uncheck
          console.log("Content script: Attempted to opt out of email subscription.");
        }
      });
    }

    // --- Report status back to background script ---
    let status = 'filled';
    let message = 'Form filled successfully.';

    if (identifiedFieldsCount === 0) {
      status = 'attention';
      message = 'No relevant fields were found on the page.';
    } else if (filledFieldsCount < identifiedFieldsCount) {
      status = 'attention';
      message = `Partial fill: ${filledFieldsCount}/${identifiedFieldsCount} field types filled.`;
    }
    // Further advanced logic for 'success' (account created) is highly site-specific.
    // It would involve checking for success messages, URL changes (e.g., redirect to dashboard),
    // or disappearance of the signup form. This is a complex task.
    // For now, 'filled' implies a successful form submission unless an error is reported.

    await chrome.runtime.sendMessage({
      action: 'reportAutofillStatus',
      retailerId: retailerId, // Use the passed retailerId
      status: status,
      message: message
    }).catch(e => console.error("Content script: Error reporting status:", e));

    // Return a basic success/failure for the immediate response to background.js
    return { success: filledFieldsCount > 0, message: message };
  }

  /**
   * Attempts to find associated label text for an input element by its ID or proximity.
   * @param {Element} input - The input element.
   * @returns {string | null} The label text, or null if not found.
   */
  function getLabelTextForInput(input) {
    // 1. Check for <label> element with 'for' attribute matching input's ID
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent.trim();
    }

    // 2. Check parent elements for label text (e.g., common in some frameworks)
    // Limit the search depth to avoid traversing too high in the DOM
    let parent = input.parentElement;
    let searchDepth = 0;
    while (parent && searchDepth < 5) { // Limit depth
      // Look for text nodes directly within the parent
      for (const node of parent.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
          // Be cautious: this might pick up unrelated text
          return node.textContent.trim();
        }
      }
      // Look for label elements within the parent's children
      const labelInChildren = parent.querySelector('label');
      if (labelInChildren) return labelInChildren.textContent.trim();

      parent = parent.parentElement;
      searchDepth++;
    }


    // 3. Check for aria-label attribute
    if (input.getAttribute('aria-label')) {
      return input.getAttribute('aria-label').trim();
    }

    // 4. Check for placeholder text
    if (input.placeholder) {
      return input.placeholder.trim();
    }

    // Could add more heuristic checks here if needed

    return null; // No label text found
  }


  /**
   * Attempts to identify the type of form field based on its attributes (name, id, type, autocomplete)
   * and associated text (label, placeholder, aria-label).
   * @param {Element} input - The input, select, or textarea element.
   * @returns {string | null} The identified field type (e.g., 'firstName', 'email', 'birthdayMonth'), or null if not identified.
   */
  function identifyField(input) {
    const nameAttr = (input.name || '').toLowerCase();
    const idAttr = (input.id || '').toLowerCase();
    const typeAttr = (input.type || '').toLowerCase();
    const autocompleteAttr = (input.getAttribute('autocomplete') || '').toLowerCase();
    const labelText = (getLabelTextForInput(input) || '').toLowerCase();


    // Check autocomplete attribute first - it's often the most semantic hint
    if (autocompleteAttr) {
      // Map common autocomplete values to our field types
      if (autocompleteAttr.includes('given-name')) return 'firstName';
      if (autocompleteAttr.includes('family-name')) return 'lastName';
      if (autocompleteAttr.includes('email')) return 'email';
      if (autocompleteAttr.includes('new-password')) return 'password'; // Use 'password' for new passwords too
      if (autocompleteAttr.includes('current-password')) return 'password'; // Use 'password' for current passwords
      if (autocompleteAttr.includes('phone-number')) return 'phone';
      if (autocompleteAttr.includes('street-address')) return 'address';
      if (autocompleteAttr.includes('address-line1')) return 'address';
      if (autocompleteAttr.includes('address-line2')) return 'address2';
      if (autocompleteAttr.includes('address-level2')) return 'city'; // address-level2 is often city
      if (autocompleteAttr.includes('address-level1')) return 'state'; // address-level1 is often state/province
      if (autocompleteAttr.includes('postal-code')) return 'zip';
      if (autocompleteAttr.includes('country')) return 'country';
      if (autocompleteAttr.includes('tel')) return 'phone'; // Covers tel, tel-national, etc.
      if (autocompleteAttr.includes('bday-day')) return 'birthdayDay';
      if (autocompleteAttr.includes('bday-month')) return 'birthdayMonth';
      if (autocompleteAttr.includes('bday-year')) return 'birthdayYear';
      if (autocompleteAttr.includes('bday')) return 'birthday'; // For single date inputs
    }

    // Check input type attribute (less specific for identity, but useful)
    if (typeAttr === 'email') return 'email';
    if (typeAttr === 'password') return 'password'; // Catches both 'password' and 'new-password' if autocomplete missed
    if (typeAttr === 'tel') return 'phone';
    if (typeAttr === 'date') return 'birthday'; // HTML5 date input

    // Check name and ID attributes using regex patterns from fieldMapping
    // Iterate through fieldMapping keys (our internal types)
    for (const fieldType in fieldMapping) {
      // Skip consent types here, they are handled separately later or based on label/type
      if (fieldType === 'termsConsent' || fieldType === 'subscriptionConsent') continue;

      const patterns = fieldMapping[fieldType];
      for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'i'); // Case-insensitive regex
        if (regex.test(nameAttr) || regex.test(idAttr)) {
          // Special handling for birthday components based on common names/IDs
          if (fieldType === 'birthdayDay' && (nameAttr === 'day' || idAttr === 'day')) return 'birthdayDay';
          if (fieldType === 'birthdayMonth' && (nameAttr === 'month' || idAttr === 'month')) return 'birthdayMonth';
          if (fieldType === 'birthdayYear' && (nameAttr === 'year' || idAttr === 'year')) return 'birthdayYear';

          // For general matches, return the field type
          return fieldType;
        }
      }
    }

    // Check associated label text, placeholder, or aria-label using fuzzy patterns
    if (labelText) {
      for (const fieldType in labelPatterns) {
        // Skip consent types here, handled based on type and label
        if (fieldType === 'termsConsent' || fieldType === 'subscriptionConsent') continue;

        const patterns = labelPatterns[fieldType];
        for (const pattern of patterns) {
          if (labelText.includes(pattern)) {
            // Be specific with birthday parts if label matches
            if (fieldType === 'birthdayDay' && labelText.includes('day')) return 'birthdayDay';
            if (fieldType === 'birthdayMonth' && labelText.includes('month')) return 'birthdayMonth';
            if (fieldType === 'birthdayYear' && labelText.includes('year')) return 'birthdayYear';

            return fieldType;
          }
        }
      }
    }


    // --- Check for Consent Checkboxes/Radios based on type and label/name/id ---
    if (input.type === 'checkbox' || input.type === 'radio') {
      // Check name/id patterns for consent types
      if (nameAttr.includes('terms') || idAttr.includes('terms') || nameAttr.includes('agree') || idAttr.includes('agree')) return 'termsConsent';
      if (nameAttr.includes('marketing') || idAttr.includes('marketing') || nameAttr.includes('subscribe') || idAttr.includes('subscribe')) return 'subscriptionConsent';

      // Check label patterns for consent types
      if (labelText) {
        for (const pattern of labelPatterns.termsConsent) {
          if (labelText.includes(pattern)) return 'termsConsent';
        }
        for (const pattern of labelPatterns.subscriptionConsent) {
          if (labelText.includes(pattern)) return 'subscriptionConsent';
        }
      }
    }


    return null; // Field type not identified
  }


  /**
   * Fills a single form input element with a given value based on its identified type and tag.
   * Handles different input types (text, number, select) and date components.
   * Dispatches input, change, and blur events after filling.
   * @param {Element} input - The input, select, or textarea element to fill.
   * @param {*} value - The value to fill into the input. For birthday components, this is the full<ctrl97>-MM-DD string.
   * @param {string} fieldType - The identified type of the field (e.g., 'firstName', 'email', 'birthdayMonth').
   * @returns {boolean} True if the filling attempt was successful, false otherwise.
   */
  function fillField(input, value, fieldType) {
    // Do not attempt to fill read-only or disabled fields
    if (input.readOnly || input.disabled) {
      // console.warn(`Content script: Skipping fill for read-only or disabled input (Type: ${fieldType}):`, input);
      return false;
    }

    const inputType = input.type ? input.type.toLowerCase() : '';
    const tagName = input.tagName.toLowerCase();

    try {
      // --- Handle Birthday Components (Day, Month, Year) ---
      if (fieldType === 'birthdayDay' || fieldType === 'birthdayMonth' || fieldType === 'birthdayYear') {
        // Expect the full birthday value from the profile (YYYY-MM-DD)
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          console.warn(`Content script: Invalid birthday value format for ${fieldType}: "${value}". Expected<ctrl97>-MM-DD.`, input);
          return false;
        }
        const dateParts = value.split('-'); // ["YYYY", "MM", "DD"]
        const year = dateParts[0]; //<ctrl97>
        const month = dateParts[1]; // MM (01-12)
        const day = dateParts[2]; // DD (01-31)

        let partToFill = ''; // The specific part (Day, Month, or Year string) we need for this input
        if (fieldType === 'birthdayDay') partToFill = day;
        else if (fieldType === 'birthdayMonth') partToFill = month;
        else if (fieldType === 'birthdayYear') partToFill = year;

        if (!partToFill) {
          console.warn(`Content script: Could not extract ${fieldType} part from birthday value "${value}".`);
          return false;
        }

        // Now, fill the specific input based on its tag and type
        if (tagName === 'input') {
          // Handle text or number inputs for date components
          if (inputType === 'text' || inputType === 'number') {
            // Special handling for month text inputs (might expect name or abbreviation)
            if (fieldType === 'birthdayMonth' && inputType === 'text') {
              // Try matching month number first ('01' for Jan)
              input.value = partToFill;
              // TODO: Add more sophisticated logic here if the site expects month names (e.g., "January", "Jan")
              console.log(`Content script: Attempting to fill month text/number input with number: "${partToFill}"`, input);

            } else {
              // Standard fill for day, year, or month number inputs
              input.value = partToFill;
              console.log(`Content script: Filled ${fieldType} input with "${partToFill}"`, input);
            }
          } else if (inputType === 'date' && fieldType === 'birthday') {
            // This case handles input type="date" which expects<ctrl97>-MM-DD
            // The value coming from the profile should already be in<ctrl97>-MM-DD format
            // This block is for the single 'birthday' type, not components
            input.value = value;
            console.log(`Content script: Filled ${fieldType} date input with "${value}".`, input);

          } else {
            console.warn(`Content script: Unsupported input type "${inputType}" for ${fieldType}.`, input);
            return false; // Indicate unsupported input type for date component
          }
        } else if (tagName === 'select') {
          // Handle select dropdowns for date components
          const selectElement = input;
          let optionFound = false;

          for (let i = 0; i < selectElement.options.length; i++) {
            const option = selectElement.options[i];
            const optionValue = option.value.trim().toLowerCase();
            const optionText = option.text.trim().toLowerCase();

            // We need robust matching for the specific date part
            let valueMatches = false;
            let textMatches = false;

            if (fieldType === 'birthdayMonth') {
              // For month selects, match both the 01-12 number and potentially month names/abbreviations
              const monthNumber = parseInt(partToFill, 10); // e.g., 1 for '01'
              // Match by numerical value (e.g., option.value is "1" or "01")
              if (!isNaN(monthNumber) && parseInt(optionValue, 10) === monthNumber) {
                valueMatches = true;
              }

              // Match by month name/abbreviation (e.g., option.text is "January" or "Jan")
              const monthNamesFull = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
              const monthNamesAbbr = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

              if (monthNumber > 0 && monthNumber <= 12) {
                // Check if option text matches full name or abbreviation
                if (optionText === monthNamesFull[monthNumber - 1] || optionText === monthNamesAbbr[monthNumber - 1]) {
                  textMatches = true;
                }
              }
              // Also allow matching the "MM" string directly if that's what the option value is
              if (optionValue === partToFill) valueMatches = true;


            } else if (fieldType === 'birthdayDay' || fieldType === 'birthdayYear') {
              // For day/year selects, typically match the numerical string value
              if (optionValue === partToFill) {
                valueMatches = true;
              }
              // Also check if the option text is the exact numerical string
              if (optionText === partToFill) {
                textMatches = true;
              }
            }

            if (valueMatches || textMatches) {
              selectElement.value = option.value; // Set the select value using the matched option's value
              optionFound = true;
              console.log(`Content script: Filled ${fieldType} select with "${option.value}" (matched "${partToFill}").`, selectElement);
              break; // Stop searching once found
            }
          }

          if (!optionFound) {
            console.warn(`Content script: No matching option found for ${fieldType} select with value "${partToFill}".`, selectElement);
            return false; // Filling failed for this specific date component
          }

        } else {
          console.warn(`Content script: Unsupported element tag "${tagName}" for ${fieldType}.`, input);
          return false; // Unsupported element type for date component
        }

        // If we reached here, setting the value was attempted for this component type
        // Trigger events after filling date components to potentially activate site's JS
        triggerEvents(input, ['input', 'change', 'blur']);
        return true; // Indicate successful filling attempt for this specific date component field

      }
      // --- End Handle Birthday Components ---

      const isDateComponent = ['birthdayDay', 'birthdayMonth', 'birthdayYear', 'birthday'].includes(fieldType);
      // Note: The single 'birthday' type="date" input is handled within the birthday component block now.

      if (isDateComponent) {
        // This case should ideally not be reached for date components if the logic above is correct,
        // but as a safeguard, indicate it wasn't handled by this general block.
        // console.warn(`Content script: Date component type "${fieldType}" unexpectedly reached standard field handling.`);
        return false;
      }


      switch (tagName) {
        case 'input':
          switch (inputType) {
            case 'text':
            case 'email':
            case 'password':
            case 'tel':
            case 'url':
            case 'search':
              // For standard text/string inputs, just set the value
              if (typeof value === 'string') {
                input.value = value;
                console.log(`Content script: Filled ${fieldType} text input.`, input);
              } else {
                console.warn(`Content script: Value is not a string for ${fieldType} text input.`, input);
                return false;
              }
              break;

            case 'number':
              // For number inputs, ensure the value is a number or number string
              if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value))) {
                input.value = value;
                console.log(`Content script: Filled ${fieldType} number input.`, input);
              } else {
                console.warn(`Content script: Value is not a valid number for ${fieldType} number input.`, input);
                return false;
              }
              break;

            default:
              // For other unsupported input types, just try setting the value directly as a fallback
              input.value = value; // Attempt to set the value
              console.warn(`Content script: Attempting to fill unsupported input type "${inputType}" for field type "${fieldType}"`, input);
              break; // Continue to event triggering
          }
          break; // End of case 'input'

        case 'select':
          if (!isDateComponent) { // Make sure it's not a date component select
            const selectElement = input; // Rename for clarity
            let optionFound = false;
            // Ensure value is a string for matching options
            const valueToMatch = String(value).trim().toLowerCase();

            for (let i = 0; i < selectElement.options.length; i++) {
              const option = selectElement.options[i];
              const optionValue = option.value.trim().toLowerCase();
              const optionText = option.text.trim().toLowerCase();

              // Match by value or text content (case-insensitive, trimmed)
              if (optionValue === valueToMatch || optionText === valueToMatch) {
                selectElement.value = option.value; // Set the select value using the matched option's value
                optionFound = true;
                console.log(`Content script: Filled ${fieldType} select with option value "${option.value}" (matched "${value}").`, selectElement);
                break; // Stop searching once found
              }
            }
            if (!optionFound) {
              console.warn(`Content script: No matching option found for select field ${input.id || input.name} (Type: ${fieldType}) with value "${value}".`, selectElement);
              return false; // Indicate filling failed if no option matched
            }
          } else {
            // This should not happen if logic is correct and date selects handled above.
            console.warn(`Content script: Select element unexpectedly reached general select logic for field type ${fieldType}.`, input);
            return false;
          }
          break; // End of case 'select'

        case 'textarea':
          if (typeof value === 'string') {
            input.value = value;
            console.log(`Content script: Filled ${fieldType} textarea.`, input);
          } else {
            console.warn(`Content script: Value is not a string for ${fieldType} textarea.`, input);
            return false;
          }
          break; // End of case 'textarea'

        default:
          console.warn(`Content script: Unsupported element tag for filling "${tagName}" (Type: ${fieldType}).`, input);
          return false; // Indicate filling failed for unsupported tag
      }

      triggerEvents(input, ['input', 'change', 'blur']);

      if (!isDateComponent) { // Avoid double logging success for components
        // console.log(`Content script: Successfully attempted to fill standard field type "${fieldType}".`); // Optional log
      }

      return true; // Indicate successful filling attempt

    } catch (e) {
      console.error(`Content script: Exception during fillField for input ${input.id || input.name || input.tagName} (Type: ${fieldType}):`, e);
      return false; // Indicate filling failed due to error
    }
  }

  /**
   * Attempts to detect if a common captcha element is present on the page.
   * This is a basic heuristic and may not detect all captchas.
   * @returns {boolean} True if a potential captcha is detected, false otherwise.
   */
  function detectCaptcha() {
    console.log("Content script: Attempting to detect captcha.");
    // Basic selectors for common captcha types (reCAPTCHA, hCaptcha, etc.)
    const captchaSelectors = [
      'div.g-recaptcha',                // reCAPTCHA div
      'div.h-captcha',                  // hCaptcha div
      'iframe[title*="captcha"]',       // iframe with "captcha" in title
      'iframe[name*="captcha"]',        // iframe with "captcha" in name
      'div[id*="captcha"]',             // Div with "captcha" in ID
      'div[class*="captcha"]',          // Div with "captcha" in class
      'img[src*="captcha"]',            // Image with "captcha" in src
      'input[name*="captcha"]',         // Input with "captcha" in name
      'input[id*="captcha"]'            // Input with "captcha" in ID
    ];

    for (const selector of captchaSelectors) {
      // Check if any element matching the selector exists and is potentially visible
      try { // Add try...catch around querySelector for robustness
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) { // Check existence and basic visibility
          console.warn(`Content script: Potential captcha detected using selector: ${selector}`, element);
          return true; // Found a potential captcha
        }
      } catch (e) {
        console.error(`Content script: Error querying captcha selector "${selector}": ${e.message}`);
        // Continue checking other selectors
      }
    }

    console.log("Content script: No common captcha elements detected.");
    return false; // No common captcha elements found
  }

  /**
   * Attempts to find and click a submit button for the nearest form.
   * Tries common selectors for submit buttons.
   * @param {Element} [formElement=document] - The form element to search within, defaults to the whole document.
   * @returns {boolean} True if a submit button was found and clicked, false otherwise.
   */
  function submitForm(formElement = document) {
    console.log("Content script: Attempting to submit form.");
    // Common selectors for submit buttons, in order of likelihood/specificity
    const submitSelectors = [
      'button[type="submit"]',          // Standard submit button
      'input[type="submit"]',           // Old-style submit input
      // Note: :contains is not standard CSS. Use querySelector with logic or a helper if needed.
      // Example of a more robust text search (conceptual, might need refinement):
      // () => Array.from(formElement.querySelectorAll('button, input[type="button"]')).find(btn => btn.textContent.toLowerCase().includes('submit') || btn.value.toLowerCase().includes('submit')),
      'input[type="image"]',            // Image inputs used as submit buttons
      'button[type="button"]',          // Button type button used for submit (check text/value if possible)
      'input[type="button"]',           // Input type button used for submit (check text/value if possible)
      'form input[type="button"]',      // Generic button input within a form
      'form button'                     // Generic button within a form
    ];

    let submitButton = null;

    for (const selector of submitSelectors) {
      // If the selector is a function, execute it (for custom text search logic)
      if (typeof selector === 'function') {
        try {
          const foundButton = selector();
          if (foundButton && foundButton.offsetParent !== null && !foundButton.disabled) {
            submitButton = foundButton;
            console.log(`Content script: Found submit button using custom logic.`, submitButton);
            break; // Found a button, stop searching
          }
        } catch (e) {
          console.warn(`Content script: Error in custom submit selector function: ${e.message}`);
        }
        continue; // Move to next selector
      }


      // Handle standard CSS selectors
      try {
        const foundButton = formElement.querySelector(selector);
        if (foundButton && foundButton.offsetParent !== null && !foundButton.disabled) { // Check visibility and enabled state
          // For generic buttons, check if their text/value indicates submission intent
          if (selector.includes('[type="button"]') || selector === 'form input[type="button"]' || selector === 'form button') {
            const text = foundButton.textContent.toLowerCase();
            const value = foundButton.value.toLowerCase();
            // Check for common submit-related text
            if (text.includes('submit') || value.includes('submit') ||
              text.includes('join') || value.includes('join') ||
              text.includes('create') || value.includes('create') ||
              text.includes('sign up') || value.includes('sign up') ||
              text.includes('register') || value.includes('register')) {
              submitButton = foundButton;
              console.log(`Content script: Found likely submit button (type="button") using selector: ${selector}`, submitButton);
              break; // Found a button, stop searching
            } else {
              // If text/value doesn't match submit intent, continue searching
              continue;
            }
          }

          // For type="submit" or type="image", assume it's a submit button
          submitButton = foundButton;
          console.log(`Content script: Found submit button using selector: ${selector}`, submitButton);
          break; // Found a button, stop searching
        }
      } catch (e) {
        console.warn(`Content script: Error querying submit selector "${selector}": ${e.message}`);
        // Continue to next selector if there's a query error
      }
    }

    if (submitButton) {
      try {
        // Attempt to click the button
        submitButton.click();
        console.log("Content script: Submit button clicked.", submitButton);
        // Note: A successful click doesn't guarantee the form submitted successfully or navigation occurred.
        // The background script will need to monitor for URL changes or listen for other signals.
        return true; // Indicate a button was found and clicked
      } catch (e) {
        console.error("Content script: Error clicking submit button:", e);
        return false; // Indicate click failed
      }
    } else {
      let form = document.querySelector('form');
      if (form) {
        console.log("Content Script: No specific submit button found, attempting to submit first form element.");
        form.submit();
        return true;
      }
      console.warn("Content script: No submit button found on the page.");
      return false; // Indicate no button was found
    }
  }

  // Optional: Helper to check if a birthday field is present (if needed by background/popup)
  function hasBirthdayField() {
    const inputs = document.querySelectorAll('input, select');
    for (const input of inputs) {
      if (identifyField(input) === 'birthday' || identifyField(input) === 'birthdayDay' || identifyField(input) === 'birthdayMonth' || identifyField(input) === 'birthdayYear') {
        return true;
      }
    }
    return false;
  }


  /**
   * Detects form fields and consent checkboxes on the page and attempts to fill/interact with them
   * based on the current profile and settings.
   * Does NOT automatically submit the form (that's handled separately in the workflow).
   * @returns {Object} An object containing filledFormData, fieldsFilledCount, and consentBoxesHandledCount.
   */
  function detectAndFillForms() {
    console.log("Content script: Detecting and filling forms.");
    // Ensure we have a profile to fill with
    if (!currentProfile || Object.keys(currentProfile).length === 0) {
      console.warn("Content script: No current profile to fill forms with.");
      return null; // Cannot fill if no profile
    }

    const filledFormData = {}; // Data that was actually filled (for preview/logging, exclude sensitive)
    let fieldsFilledCount = 0;

    // Get all input, select, and textarea elements on the page
    const inputs = document.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
      // --- Add try...catch around processing each input to catch specific errors ---
      try {
        // Ensure input is visible and interactive before attempting to fill
        if (input.offsetParent === null || input.disabled || input.readOnly) {
          return; // Skip hidden, disabled, or read-only fields
        }

        const fieldType = identifyField(input); // Identify the field type

        // If a field type was identified AND we have a corresponding non-empty value in the current profile
        if (fieldType && currentProfile && currentProfile[fieldType] !== undefined && currentProfile[fieldType] !== null && currentProfile[fieldType] !== '') {
          const valueToFill = currentProfile[fieldType];

          // --- Attempt to fill the field ---
          // Pass the fieldType to fillField so it can handle specific types (like select)
          const fillSuccess = fillField(input, valueToFill, fieldType); // Call the fillField function

          if (fillSuccess) {
            highlightField(input, fieldType, true); // Highlight as filled
            fieldsFilledCount++;
            // Add filled data to the response object (exclude sensitive passwords)
            filledFormData[fieldType] = (fieldType === 'password' || fieldType === 'confirmPassword') ? '[*****]' : valueToFill;
          } else {
            console.warn(`Content script: Failed to fill field for type ${fieldType} with value "${valueToFill}"`, input);
          }
          // --- End Attempt to fill the field ---
        }
        // Fields where identifyField returned null are skipped.
        // Fields where we don't have profile data are skipped.
        // Fields where the profile data is empty string, null, or undefined are skipped for filling.

      } catch (inputError) {
        // Log error for a specific input, but continue processing other inputs
        console.error(`Content script: Error processing input ${input.id || input.name || input.tagName} during fillForm:`, inputError);
      }
      // --- End try...catch around processing each input ---
    }); // End of inputs.forEach

    console.log(`Content script: Attempted to fill ${fieldsFilledCount} fields.`);

    // Return the data for the fields that were actually filled (used by popup for preview)
    // Return an object even if 0 fields were filled, so the popup can check fieldsFilledCount
    return { filledFormData, fieldsFilledCount }; // Return object instead of null
  }



  // --- Highlighting Logic ---
  /**
   * Handles toggling autofill highlighting on or off.
   * Called when the 'toggleAutofillHighlighting' message is received or on initial load.
   */
  function handleAutofillToggle() {
    console.log("Content script: Handling autofill toggle. Active:", autofillActive);
    if (autofillActive) {
      // If turning highlighting ON and we have a profile, perform initial highlighting
      // Add a delay to ensure content script has settings/profile data loaded
      if (currentProfile && Object.keys(currentProfile).length > 0) {
        console.log("Content script: Highlighting on and profile available, scheduling highlight.")
        setTimeout(detectAndHighlightForms, 100); // Small delay
      } else {
        console.log("Content script: Highlighting on but no profile, no highlight.")
      }
    } else {
      // If turning highlighting OFF, remove all existing highlights
      console.log("Content script: Highlighting off, removing highlights.")
      removeHighlights();
    }
  }
  // content_script.js

  // IMPORTANT: Ensure sendWorkflowCompletionStatus function is defined above this.
  // (As provided in previous responses)
  async function sendWorkflowCompletionStatus(status, message, retailerId, options = {}) {
    console.log(`Content Script: Sending workflow completion status for ${retailerId}:`, status, message);
    const defaultOptions = {
      needsManualReview: false,
      autofillSuccess: false,
      fieldsFilledCount: 0,
      submissionAttempted: false,
      submissionSuccess: false,
      captchaDetected: false,
      error: null
    };
    const finalOptions = { ...defaultOptions, ...options };
    try {
      await chrome.runtime.sendMessage({
        action: 'autofillWorkflowComplete',
        retailerId: retailerId,
        status: status,
        message: message,
        needsManualReview: finalOptions.needsManualReview,
        autofillSuccess: finalOptions.autofillSuccess,
        fieldsFilledCount: finalOptions.fieldsFilledCount,
        submissionAttempted: finalOptions.submissionAttempted,
        submissionSuccess: finalOptions.submissionSuccess,
        captchaDetected: finalOptions.captchaDetected,
        error: finalOptions.error
      });
      console.log(`Content Script: 'autofillWorkflowComplete' message sent for ${retailerId}.`);
    } catch (error) {
      console.error(`Content Script: Error sending workflow completion message for ${retailerId}:`, error);
    }
  }

  const containsKeyword = (text, keywords) => {
    if (!text) return false;
    return keywords.some(keyword => text.includes(keyword));
  };


  async function performAutofillAndSubmit(profile, retailer) {
    // Initialize all status and tracking variables at the top of the function
    let status = 'failed';
    let message = 'Autofill process initiated.';
    let autofillSuccess = false;
    let fieldsFilledCount = 0;
    let submissionAttempted = false;
    let submissionSuccess = false;
    let captchaDetected = false;
    let error = null;
    let needsManualReview = false;
    const filledFieldsMap = {}; // Tracks which profile fields have been used to fill an input

    try {
      console.log(`Content Script: Attempting autofill for ${retailer.name} (${retailer.id})...`);
      console.log("DEBUG: Profile data received:", profile); // DEBUG: Log the profile data

      // --- Step 1: Initial Page Check & CAPTCHA Detection ---
      if (document.querySelector('div[data-sitekey]') || document.querySelector('iframe[title*="captcha"]')) {
        captchaDetected = true;
        needsManualReview = true;
        status = 'needs_review';
        message = `CAPTCHA detected on ${retailer.name}. Manual review required.`;
        console.warn(`Content Script: ${message}`);
        await sendWorkflowCompletionStatus(status, message, retailer.id, {
          needsManualReview, autofillSuccess, fieldsFilledCount, submissionAttempted, submissionSuccess, captchaDetected, error
        });
        return;
      }

      // Check for specific "skipped" conditions if any
      if (document.body.textContent.toLowerCase().includes('site not found') ||
        document.body.textContent.toLowerCase().includes('page not found') ||
        document.body.textContent.toLowerCase().includes('error 404')) {
        status = 'skipped';
        message = `Page for ${retailer.name} not found or showed an error page.`;
        needsManualReview = true;
        console.error(`Content Script: ${message}`);
        await sendWorkflowCompletionStatus(status, message, retailer.id, {
          needsManualReview, autofillSuccess, fieldsFilledCount, submissionAttempted, submissionSuccess, captchaDetected, error: 'Page load error or not found'
        });
        return;
      }

      // --- Step 2: Form Detection and Autofill ---
      const form = document.querySelector('form');
      if (!form) {
        status = 'failed';
        message = `No form element found on ${retailer.name} page. Manual review required.`;
        needsManualReview = true;
        console.error(`Content Script: ${message}`);
        await sendWorkflowCompletionStatus(status, message, retailer.id, {
          needsManualReview, autofillSuccess, fieldsFilledCount, submissionAttempted, submissionSuccess, captchaDetected, error: 'No form found'
        });
        return;
      }

      // IMPORTANT: Include 'select' elements in the query
      const fields = form.querySelectorAll('input:not([type="hidden"]), textarea, select');
      console.log(`DEBUG: Found ${fields.length} form fields for ${retailer.name}.`);

      // Iterate over each form field (input, textarea, select)
      fields.forEach(field => {
        const name = field.name || '';
        const id = field.id || '';
        const type = field.type || '';
        const placeholder = field.placeholder || '';
        const ariaLabel = field.getAttribute('aria-label') || '';
        const className = field.className || ''; // Added for class-based matching

        // Normalize values for easier matching
        const normalizedName = name.toLowerCase().replace(/[-_]/g, '');
        const normalizedId = id.toLowerCase().replace(/[-_]/g, '');
        const normalizedPlaceholder = placeholder.toLowerCase().replace(/[-_]/g, '');
        const normalizedAriaLabel = ariaLabel.toLowerCase().replace(/[-_]/g, '');

        // DEBUG: Log details of each field being processed
        console.log(`DEBUG: Processing field: Tag=${field.tagName}, ID='${id}', Name='${name}', Type='${type}', Class='${className}'`);

        // Flag to check if this specific field was filled by our script
        let fieldWasFilled = false;

        // --- Specific and complex fields first (e.g., segmented phone, select dropdowns) ---

        // Handle Segmented Phone Number (e.g., (###) ###-####)
        if (profile.phone && field.tagName === 'INPUT' && type === 'tel') {
          const cleanedPhone = profile.phone.replace(/\D/g, ''); // Remove non-digits
          if (cleanedPhone.length === 10) {
            const areaCode = cleanedPhone.substring(0, 3);
            const prefix = cleanedPhone.substring(3, 6);
            const lineNumber = cleanedPhone.substring(6, 10);

            // Check for each specific phone segment ID
            if (id === 'ctl00_plcMain_ucPhoneNumber_txt1st' && !filledFieldsMap['phone_part1']) {
              field.value = areaCode;
              fieldsFilledCount++;
              filledFieldsMap['phone_part1'] = true;
              fieldWasFilled = true;
              console.log(`DEBUG: Filled phone area code (${id}) with: ${areaCode}`);
            } else if (id === 'ctl00_plcMain_ucPhoneNumber_txt2nd' && !filledFieldsMap['phone_part2']) {
              field.value = prefix;
              fieldsFilledCount++;
              filledFieldsMap['phone_part2'] = true;
              fieldWasFilled = true;
              console.log(`DEBUG: Filled phone prefix (${id}) with: ${prefix}`);
            } else if (id === 'ctl00_plcMain_ucPhoneNumber_txt3rd' && !filledFieldsMap['phone_part3']) {
              field.value = lineNumber;
              fieldsFilledCount++;
              filledFieldsMap['phone_part3'] = true;
              fieldWasFilled = true;
              console.log(`DEBUG: Filled phone line number (${id}) with: ${lineNumber}`);
            }
          } else {
            console.warn(`DEBUG: Phone number in profile not 10 digits after cleaning: ${profile.phone}`);
          }
        }

        // Handle Birthday Month (SELECT dropdown)
        if (profile.dob_month && field.tagName === 'SELECT' && (
          normalizedId === 'ctl00_plcmain_ddlbirthdaymm' || // Exact normalized ID
          containsKeyword(normalizedName, ['birthmonth', 'dobmonth', 'month']) ||
          containsKeyword(normalizedId, ['birthmonth', 'dobmonth', 'month']) ||
          className.includes('kk-month') // Specific class
        ) && !filledFieldsMap['dob_month']) {
          const monthValue = String(profile.dob_month).padStart(2, '0'); // e.g., '5' -> '05'
          const options = Array.from(field.options);
          const matchingOption = options.find(option => option.value === monthValue);

          if (matchingOption) {
            field.value = matchingOption.value;
            fieldsFilledCount++;
            filledFieldsMap['dob_month'] = true;
            fieldWasFilled = true;
            console.log(`DEBUG: Filled Birthday Month (${id || name}) with: ${field.value}`);
          } else {
            console.warn(`DEBUG: No matching option found for Birthday Month (${id || name}) with value: '${monthValue}'`);
          }
        }

        // Handle Birthday Day (SELECT dropdown)
        if (profile.dob_day && field.tagName === 'SELECT' && (
          normalizedId === 'ctl00_plcmain_ddlbirthdaydd' || // Exact normalized ID
          containsKeyword(normalizedName, ['birthday', 'dobday', 'day']) ||
          containsKeyword(normalizedId, ['birthday', 'dobday', 'day']) ||
          className.includes('kk-day') // Specific class
        ) && !filledFieldsMap['dob_day']) {
          const dayValue = String(profile.dob_day).padStart(2, '0'); // e.g., '1' -> '01'
          const options = Array.from(field.options);
          const matchingOption = options.find(option => option.value === dayValue);

          if (matchingOption) {
            field.value = matchingOption.value;
            fieldsFilledCount++;
            filledFieldsMap['dob_day'] = true;
            fieldWasFilled = true;
            console.log(`DEBUG: Filled Birthday Day (${id || name}) with: ${field.value}`);
          } else {
            console.warn(`DEBUG: No matching option found for Birthday Day (${id || name}) with value: '${dayValue}'`);
          }
        }

        // --- General purpose input/textarea fields ---
        // These should come AFTER specific handling, and only if `fieldWasFilled` is false.
        if (!fieldWasFilled && (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA')) {
          // First Name
          if (profile.first_name && (
            containsKeyword(normalizedName, ['first', 'fname', 'givenname']) ||
            containsKeyword(normalizedId, ['first', 'fname', 'givenname']) ||
            containsKeyword(normalizedPlaceholder, ['first name', 'given name']) ||
            containsKeyword(normalizedAriaLabel, ['first name', 'given name'])
          ) && !filledFieldsMap['first_name']) {
            field.value = profile.first_name;
            fieldsFilledCount++;
            filledFieldsMap['first_name'] = true;
            fieldWasFilled = true;
            console.log(`DEBUG: Filled First Name (${id || name}) with: ${field.value}`);
          }
          // Last Name
          else if (profile.last_name && (
            containsKeyword(normalizedName, ['last', 'lname', 'surname']) ||
            containsKeyword(normalizedId, ['last', 'lname', 'surname']) ||
            containsKeyword(normalizedPlaceholder, ['last name', 'surname']) ||
            containsKeyword(normalizedAriaLabel, ['last name', 'surname'])
          ) && !filledFieldsMap['last_name']) {
            field.value = profile.last_name;
            fieldsFilledCount++;
            filledFieldsMap['last_name'] = true;
            fieldWasFilled = true;
            console.log(`DEBUG: Filled Last Name (${id || name}) with: ${field.value}`);
          }
          // Email
          else if (profile.email && type === 'email' && (
            containsKeyword(normalizedName, ['email', 'mail']) ||
            containsKeyword(normalizedId, ['email', 'mail']) ||
            containsKeyword(normalizedPlaceholder, ['email', 'e-mail']) ||
            containsKeyword(normalizedAriaLabel, ['email', 'e-mail address'])
          ) && !filledFieldsMap['email']) {
            field.value = profile.email;
            fieldsFilledCount++;
            filledFieldsMap['email'] = true;
            fieldWasFilled = true;
            console.log(`DEBUG: Filled Email (${id || name}) with: ${field.value}`);
          }
          // Password
          else if (profile.password && type === 'password' && (
            containsKeyword(normalizedName, ['password', 'pass']) ||
            containsKeyword(normalizedId, ['password', 'pass']) ||
            containsKeyword(normalizedPlaceholder, ['password']) ||
            containsKeyword(normalizedAriaLabel, ['password'])
          ) && !filledFieldsMap['password']) {
            field.value = profile.password;
            fieldsFilledCount++;
            filledFieldsMap['password'] = true;
            fieldWasFilled = true;
            console.log(`DEBUG: Filled Password (${id || name}) with: ${field.value}`);
          }
          // Confirm Password
          else if (profile.password && type === 'password' && (
            containsKeyword(normalizedName, ['confirm', 'retype', 'verify']) ||
            containsKeyword(normalizedId, ['confirm', 'retype', 'verify']) ||
            containsKeyword(normalizedPlaceholder, ['confirm password', 'retype password']) ||
            containsKeyword(normalizedAriaLabel, ['confirm password'])
          ) && !filledFieldsMap['confirm_password']) {
            field.value = profile.password;
            fieldsFilledCount++;
            filledFieldsMap['confirm_password'] = true;
            fieldWasFilled = true;
            console.log(`DEBUG: Filled Confirm Password (${id || name}) with: ${field.value}`);
          }
          // Phone Number (generic input, if not handled by segmented logic)
          else if (profile.phone && type === 'tel' && ( // Check type for 'tel' for general phone fields
            containsKeyword(normalizedName, ['phone', 'tel', 'mobile', 'cell']) ||
            containsKeyword(normalizedId, ['phone', 'tel', 'mobile', 'cell']) ||
            containsKeyword(normalizedPlaceholder, ['phone number', 'mobile number']) ||
            containsKeyword(normalizedAriaLabel, ['phone number'])
          ) && !filledFieldsMap['phone']) {
            // Only fill if segmented parts were not filled, or if this is the only phone field.
            // If you always want to prefer segmented, make sure phone_part1, phone_part2, phone_part3 are always filled.
            // Or set a flag after segmented fill and check it here.
            if (!filledFieldsMap['phone_part1'] && !filledFieldsMap['phone_part2'] && !filledFieldsMap['phone_part3']) {
              field.value = profile.phone.replace(/\D/g, ''); // Ensure only digits
              fieldsFilledCount++;
              filledFieldsMap['phone'] = true;
              fieldWasFilled = true;
              console.log(`DEBUG: Filled generic phone field (${id || name}) with: ${field.value}`);
            }
          }
          // Address Line 1
          else if (profile.address && (
            containsKeyword(normalizedName, ['address', 'street', 'addr1', 'line1']) ||
            containsKeyword(normalizedId, ['address', 'street', 'addr1', 'line1']) ||
            containsKeyword(normalizedPlaceholder, ['address', 'street address']) ||
            containsKeyword(normalizedAriaLabel, ['address line 1'])
          ) && !filledFieldsMap['address']) {
            field.value = profile.address;
            fieldsFilledCount++;
            filledFieldsMap['address'] = true;
            fieldWasFilled = true;
            console.log(`DEBUG: Filled Address Line 1 (${id || name}) with: ${field.value}`);
          }
          // City
          else if (profile.city && (
            containsKeyword(normalizedName, ['city']) ||
            containsKeyword(normalizedId, ['city']) ||
            containsKeyword(normalizedPlaceholder, ['city']) ||
            containsKeyword(normalizedAriaLabel, ['city'])
          ) && !filledFieldsMap['city']) {
            field.value = profile.city;
            fieldsFilledCount++;
            filledFieldsMap['city'] = true;
            fieldWasFilled = true;
            console.log(`DEBUG: Filled City (${id || name}) with: ${field.value}`);
          }
          // State/Province (Input) - for text inputs, not selects
          else if (profile.state && (
            containsKeyword(normalizedName, ['state', 'province']) ||
            containsKeyword(normalizedId, ['state', 'province']) ||
            containsKeyword(normalizedPlaceholder, ['state', 'province']) ||
            containsKeyword(normalizedAriaLabel, ['state', 'province'])
          ) && !filledFieldsMap['state']) {
            field.value = profile.state;
            fieldsFilledCount++;
            filledFieldsMap['state'] = true;
            fieldWasFilled = true;
            console.log(`DEBUG: Filled State (Input) (${id || name}) with: ${field.value}`);
          }
          // Zip/Postal Code
          else if (profile.zip_code && (
            containsKeyword(normalizedName, ['zip', 'postal', 'postcode']) ||
            containsKeyword(normalizedId, ['zip', 'postal', 'postcode']) ||
            containsKeyword(normalizedPlaceholder, ['zip code', 'postal code']) ||
            containsKeyword(normalizedAriaLabel, ['zip code', 'postal code'])
          ) && !filledFieldsMap['zip_code']) {
            field.value = profile.zip_code;
            fieldsFilledCount++;
            filledFieldsMap['zip_code'] = true;
            fieldWasFilled = true;
            console.log(`DEBUG: Filled Zip/Postal Code (${id || name}) with: ${field.value}`);
          }
          // Country (Input) - for text inputs, not selects
          else if (profile.country && (
            containsKeyword(normalizedName, ['country']) ||
            containsKeyword(normalizedId, ['country']) ||
            containsKeyword(normalizedPlaceholder, ['country']) ||
            containsKeyword(normalizedAriaLabel, ['country'])
          ) && !filledFieldsMap['country']) {
            field.value = profile.country;
            fieldsFilledCount++;
            filledFieldsMap['country'] = true;
            fieldWasFilled = true;
            console.log(`DEBUG: Filled Country (Input) (${id || name}) with: ${field.value}`);
          }
          // Birthday Year (Input) - assuming it's an input field
          else if (profile.dob_year && (
            containsKeyword(normalizedName, ['birthyear', 'dobyear', 'year']) ||
            containsKeyword(normalizedId, ['birthyear', 'dobyear', 'year']) ||
            containsKeyword(normalizedPlaceholder, ['year']) ||
            containsKeyword(normalizedAriaLabel, ['birth year'])
          ) && !filledFieldsMap['dob_year']) {
            field.value = profile.dob_year;
            fieldsFilledCount++;
            filledFieldsMap['dob_year'] = true;
            fieldWasFilled = true;
            console.log(`DEBUG: Filled Birthday Year (${id || name}) with: ${field.value}`);
          }
        }
        // --- General purpose SELECT fields (if not handled by specific birthday logic) ---
        else if (!fieldWasFilled && field.tagName === 'SELECT') {
          // State/Province (Select)
          if (profile.state && (
            containsKeyword(normalizedName, ['state', 'province']) ||
            containsKeyword(normalizedId, ['state', 'province']) ||
            containsKeyword(normalizedAriaLabel, ['state', 'province'])
          ) && !filledFieldsMap['state']) {
            const options = Array.from(field.options);
            const matchingOption = options.find(option =>
              option.value.toLowerCase() === profile.state.toLowerCase() ||
              option.textContent.toLowerCase() === profile.state.toLowerCase()
            );
            if (matchingOption) {
              field.value = matchingOption.value;
              fieldsFilledCount++;
              filledFieldsMap['state'] = true;
              fieldWasFilled = true;
              console.log(`DEBUG: Filled State (Select) (${id || name}) with: ${field.value}`);
            } else {
              console.warn(`DEBUG: No matching option for State (Select) (${id || name}) for '${profile.state}'`);
            }
          }
          // Country (Select)
          else if (profile.country && (
            containsKeyword(normalizedName, ['country']) ||
            containsKeyword(normalizedId, ['country']) ||
            containsKeyword(normalizedAriaLabel, ['country'])
          ) && !filledFieldsMap['country']) {
            const options = Array.from(field.options);
            const matchingOption = options.find(option =>
              option.value.toLowerCase() === profile.country.toLowerCase() ||
              option.textContent.toLowerCase() === profile.country.toLowerCase()
            );
            if (matchingOption) {
              field.value = matchingOption.value;
              fieldsFilledCount++;
              filledFieldsMap['country'] = true;
              fieldWasFilled = true;
              console.log(`DEBUG: Filled Country (Select) (${id || name}) with: ${field.value}`);
            } else {
              console.warn(`DEBUG: No matching option for Country (Select) (${id || name}) for '${profile.country}'`);
            }
          }
          // If there are other generic selects to fill, add them here
        }

        // --- Trigger Change Events if the field was filled by our script ---
        if (fieldWasFilled) {
          console.log(`DEBUG: Dispatching events for field: ${id || name}`);
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          // Often, triggering a blur event can also help activate validation or other JS
          // field.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }); // End of fields.forEach loop


      // --- After the loop, evaluate autofill success and proceed with submission ---
      autofillSuccess = fieldsFilledCount > 0;

      if (autofillSuccess) {
        message = `Autofill completed for ${retailer.name}. Filled ${fieldsFilledCount} fields.`;
        status = 'partial_success'; // Start with partial, might become success if submission works
        console.log(`Content Script: ${message}`);

        // --- Step 3: Submission Attempt ---
        if (!captchaDetected) {
          submissionAttempted = true;
          message += ' Attempting form submission...';

          const submitButton = form.querySelector('button[type="submit"]') ||
            form.querySelector('input[type="submit"]') ||
            form.querySelector('.submit-button') ||
            Array.from(form.querySelectorAll('button, input[type="button"]'))
              .find(btn => (btn.textContent.toLowerCase().includes('submit') ||
                btn.textContent.toLowerCase().includes('register') ||
                btn.textContent.toLowerCase().includes('sign up')));

          if (submitButton) {
            console.log("Content Script: Clicking submit button.");
            submitButton.click();
            await new Promise(resolve => setTimeout(resolve, 3000));

            if (document.body.textContent.toLowerCase().includes('success') ||
              document.body.textContent.toLowerCase().includes('thank you for registering') ||
              window.location.href.includes('/success') || window.location.href.includes('/confirmation')) {
              submissionSuccess = true;
              status = 'success';
              message = `Autofill and submission successful for ${retailer.name}!`;
              console.log(`Content Script: ${message}`);
            } else {
              if (document.body.textContent.toLowerCase().includes('error') ||
                document.body.textContent.toLowerCase().includes('invalid') ||
                document.body.textContent.toLowerCase().includes('problem')) {
                message = `Form submission failed for ${retailer.name}. Error detected on page. Manual review needed.`;
                error = 'Submission failed, error detected on page.';
              } else if (window.location.href === retailer.signupUrl) {
                message = `Form submission for ${retailer.name} did not result in a page change. Manual review needed.`;
                error = 'Submission likely failed (no page change).';
              } else {
                message = `Form submission for ${retailer.name} completed, but success is unclear. Manual review suggested.`;
                error = 'Unclear submission outcome.';
              }
              status = 'needs_review';
              needsManualReview = true;
              console.warn(`Content Script: ${message}`);
            }
          } else {
            message = `No identifiable submit button found on ${retailer.name}. Manual submission required.`;
            status = 'needs_review';
            needsManualReview = true;
            submissionAttempted = false;
            console.warn(`Content Script: ${message}`);
          }
        } else {
          status = 'needs_review';
          message = `Autofill for ${retailer.name} successful, but CAPTCHA detected. Submission skipped. Manual review required.`;
          needsManualReview = true;
          console.warn(`Content Script: ${message}`);
        }
      } else {
        message = `Autofill attempted for ${retailer.name}, but no relevant fields were filled. Manual review likely needed.`;
        status = 'needs_review';
        needsManualReview = true;
        console.warn(`Content Script: ${message}`);
        error = 'No fields matched for autofill';
      }

    } catch (e) {
      console.error(`Content Script: Unhandled error during autofill for ${retailer.name}:`, e);
      status = 'failed';
      message = `An unexpected error occurred during autofill for ${retailer.name}: ${e.message}`;
      error = e.message;
      needsManualReview = true;
    } finally {
      // Always send a completion message at the end of the workflow
      await sendWorkflowCompletionStatus(status, message, retailer.id, {
        needsManualReview,
        autofillSuccess,
        fieldsFilledCount,
        submissionAttempted,
        submissionSuccess,
        captchaDetected,
        error
      });
    }
  }

  // Your chrome.runtime.onMessage.addListener should be outside this function definition
  // and there should only be one of them.

  // content.js

  console.log("Content script loaded!"); // Already confirmed this one is working

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("Content script received message:", request.action, request); // Log the action and full request

    if (request.action === 'fillForm') {
      console.log("Content script: Received autofillForm request.");
      // Pass all necessary parameters including isBulkAutofill
      autofillForm(request.profile, request.settings, request.retailerId, request.isBulkAutofill)
        .then(response => sendResponse(response))
        .catch(error => {
          console.error("Content script: Error during autofill:", error);
          sendResponse({ success: false, message: error.message });
        });
      return true;
    }

    if (request.action === 'startAutofill' && !autofillAttempted) {
      console.log("Content Script: Received startAutofill message. Initiating delayed autofill.");
      autofillAttempted = true; // Mark as attempted immediately
      autofillForm(request.profile, request.settings, request.retailerId, request.isBulkAutofill)
        .then(response => sendResponse(response))
        .catch(error => {
          console.error("Content script: Error during autofill:", error);
          sendResponse({ success: false, message: error.message });
        });
      sendResponse({ status: 'Autofill initiation attempted' });
      return true; // Keep the message channel open for async response
    }

    // If there are other message types, handle them here.
    // Example for settings updates (as mentioned in the previous popup log warning)
    if (request.action === "updateSettings") {
      console.log("Content script received updated settings:", request.settings);
      // Apply settings changes here (e.g., highlighting, high contrast)
      // ... your settings application logic ...
      sendResponse({ status: "success", message: "Settings updated." });
      return true;
    }

    // Important: Only return true if you intend to call sendResponse asynchronously.
    // If not, return false or nothing. For simple synchronous messages, no return is needed.
    // If you return true and don't call sendResponse, you get the error you're seeing.
  });

  function detectAndHighlightForms() {
    console.log("Content script: Detecting and highlighting forms.");
    // Only highlight if autofill is active AND we have profile data
    if (!autofillActive || !currentProfile || Object.keys(currentProfile).length === 0) {
      console.log("Content script: Highlighting is off or no profile loaded. Removing any existing highlights.");
      removeHighlights(); // Ensure no lingering highlights if conditions aren't met
      return;
    }

    const inputs = form.querySelectorAll('input:not([type="hidden"]), textarea, select');
    let fieldsHighlighted = 0;

    // Clear existing highlights before re-applying, especially after DOM changes
    removeHighlights();

    inputs.forEach(input => {
      // --- Add try...catch around processing each input to catch specific errors ---
      try {
        // Ensure input is visible and interactive before attempting to highlight
        if (input.offsetParent === null || input.disabled || input.readOnly || (input.offsetWidth <= 0 && input.offsetHeight <= 0)) {
          return; // Skip hidden, disabled, or read-only fields
        }

        const fieldType = identifyField(input); // Identify the field type

        // Highlight if a field type was identified AND we have a value for that field in the profile
        // (We highlight based on having data, even if the field isn't currently filled)

        // Special check for birthday components - highlight if the main 'birthday' profile field exists
        const isDateComponent = ['birthdayDay', 'birthdayMonth', 'birthdayYear', 'birthday'].includes(fieldType);
        let hasProfileValue = false;

        if (isDateComponent) {
          if (currentProfile.birthday !== undefined && currentProfile.birthday !== null && currentProfile.birthday !== '') {
            hasProfileValue = true;
          }
        } else if (fieldType) { // For non-date component fields that were identified
          if (currentProfile[fieldType] !== undefined && currentProfile[fieldType] !== null && currentProfile[fieldType] !== '') {
            hasProfileValue = true;
          }
        }

        if (fieldType && hasProfileValue) {
          highlightField(input, fieldType, false); // Apply highlight style and tooltip (not yet filled)
          fieldsHighlighted++;
        }
      } catch (inputError) {
        // Log error for a specific input, but continue processing other inputs
        console.error(`Content script: Error processing input ${input.id || input.name || input.tagName} during highlighting:`, inputError);
      }
      // --- End try...catch around processing each input ---
    });

    console.log(`Content script: Highlighted ${fieldsHighlighted} fields.`);
  }

  /**
   * Removes all field highlights added by the extension from the page.
   */
  function removeHighlights() {
    // console.log("Content script: Removing highlights."); // This can be noisy
    // Select elements based on the specific highlight class added by your extension
    document.querySelectorAll('.loyalty-form-highlight').forEach(el => {
      el.classList.remove('loyalty-form-highlight', 'loyalty-filled-field');
      // Optionally remove the title attribute if you added it for the tooltip
      if (el.hasAttribute('title') && el.getAttribute('title').startsWith('Identified as: ')) {
        el.removeAttribute('title');
      } else if (el.hasAttribute('title') && el.getAttribute('title').startsWith('Filled as: ')) {
        el.removeAttribute('title');
      }
    });
  }

  /**
   * Applies highlight class and potentially a tooltip to an identified input field.
   * @param {Element} input - The input element to highlight.
   * @param {string} fieldType - The identified type of the field.
   * @param {boolean} isFilled - Whether the field has been filled by the extension.
   */
  function highlightField(input, fieldType, isFilled = false) {
    // Avoid adding the class multiple times if already highlighted in the correct state
    if (!input.classList.contains('loyalty-form-highlight')) {
      input.classList.add('loyalty-form-highlight');
    }

    if (isFilled) {
      input.classList.add('loyalty-filled-field');
      input.title = `Filled as: ${fieldType}`; // Update tooltip for filled state
    } else {
      input.classList.remove('loyalty-filled-field'); // Ensure filled class is removed if not filled
      input.title = `Identified as: ${fieldType}`; // Tooltip for identified but not yet filled state
    }
  }


  async function autofillForm(profile, settings, receivedRetailerId, isBulkAutofill = false) {
    console.log("Content Script: Autofill initiated.");

    if (!profile) {
      console.warn("Content Script: No profile data provided for autofill.");
      // Report status for no profile data
      await chrome.runtime.sendMessage({
        action: 'reportAutofillStatus',
        retailerId: receivedRetailerId,
        status: 'attention',
        message: 'No profile data provided for autofill.'
      }).catch(e => console.error("Content script: Error reporting status:", e));
      return { success: false, message: 'No profile data' };
    }

    retailerId = receivedRetailerId; // Store the received retailer ID
    currentProfile = profile; // Set the global currentProfile
    contentSettings = settings; // Set the global contentSettings
    addStyles(); // Ensure styles are added for highlighting

    let filledFieldsCount = 0;
    let identifiedFieldsCount = 0;

    for (const fieldType in fieldMapping) {
      const patterns = fieldMapping[fieldType];
      const profileValue = profile[fieldType];

      if (profileValue) {
        const fields = findMatchingFields(patterns);
        if (fields.length > 0) {
          identifiedFieldsCount++; // At least one field was identified for this type
          const success = fillField(patterns, profileValue, fieldType);
          if (success) {
            filledFieldsCount++;
          }
        }
      }
    }

    if (stopAutofillRequested) {
      console.log("Content Script: Autofill stopped mid-process (opt-out).");
      await chrome.runtime.sendMessage({
        action: 'reportAutofillStatus',
        retailerId: retailerId,
        status: 'stopped',
        message: 'Autofill stopped by user.'
      }).catch(e => console.error("Content script: Error reporting stopped status:", e));
      return { success: false, message: 'Autofill stopped by user.' };
    }

    // Handle email opt-out checkbox based on contentSettings
    // This logic replaces the clickCheckbox call from your snippet for email opt-out.
    if (contentSettings.autoOptOutEmailSubscription) {
      const optOutCheckboxes = document.querySelectorAll(
        'input[type="checkbox"][id*="opt"], input[type="checkbox"][name*="opt"], input[type="checkbox"][id*="newsletter"], input[type="checkbox"][name*="newsletter"]'
      );
      optOutCheckboxes.forEach(checkbox => {
        // If auto-opt-out is true, uncheck if it's currently checked
        if (checkbox.checked) {
          checkbox.click(); // Simulate a click to uncheck
          console.log("Content script: Opted out of email subscription.");
        }
      });
    } else {
      // If auto-opt-out is false, ensure it's checked if it exists
      const optOutCheckboxes = document.querySelectorAll(
        'input[type="checkbox"][id*="opt"], input[type="checkbox"][name*="opt"], input[type="checkbox"][id*="newsletter"], input[type="checkbox"][name*="newsletter"]'
      );
      optOutCheckboxes.forEach(checkbox => {
        if (!checkbox.checked) {
          checkbox.click(); // Simulate a click to check
          console.log("Content script: Ensured email subscription is checked.");
        }
      });
    }

    console.log("Content Script: All fields processed.");

    // --- Report initial fill status back to background script ---
    let status = 'filled';
    let message = 'Form filling completed.';

    if (identifiedFieldsCount === 0) {
      status = 'attention';
      message = 'No relevant fields were found on the page.';
    } else if (filledFieldsCount < identifiedFieldsCount) {
      status = 'attention';
      message = `Partial fill: ${filledFieldsCount}/${identifiedFieldsCount} field types filled.`;
    }

    await chrome.runtime.sendMessage({
      action: 'reportAutofillStatus',
      retailerId: retailerId,
      status: status,
      message: message
    }).catch(e => console.error("Content script: Error reporting initial status:", e));

    // NEW LOGIC FOR CONDITIONAL SUBMISSION:
    if (isBulkAutofill) {
      // NEW: Check stop flag before submission
      if (stopAutofillRequested) {
        console.log("Content Script: Autofill stopped before form submission.");
        await chrome.runtime.sendMessage({
          action: 'reportAutofillStatus',
          retailerId: retailerId,
          status: 'stopped',
          message: 'Autofill stopped by user before submission.'
        }).catch(e => console.error("Content script: Error reporting stopped status:", e));
        return { success: false, message: 'Autofill stopped by user.' };
      }

      console.log("Content Script: Bulk autofill detected, attempting to submit form.");
      const submitted = await submitForm();
      if (submitted) {
        await chrome.runtime.sendMessage({
          action: 'reportAutofillStatus',
          retailerId: retailerId,
          status: 'success',
          message: 'Form submitted successfully.'
        }).catch(e => console.error("Content script: Error reporting submission status:", e));
        return { success: true, message: 'Autofill complete and form submitted' };
      } else {
        await chrome.runtime.sendMessage({
          action: 'reportAutofillStatus',
          retailerId: retailerId,
          status: 'attention',
          message: 'Autofill complete but failed to submit form automatically.'
        }).catch(e => console.error("Content script: Error reporting submission failure status:", e));
        return { success: false, message: 'Autofill complete but failed to submit form automatically' };
      }
    } else {
      console.log("Content Script: Single autofill. Form will not be submitted automatically.");
      return { success: true, message: 'Autofill complete. Manual submission required.' };
    }


  }

  // --- Message Listener ---
  /**
   * Initializes message listeners for communication with the popup script and background script.
   * This function contains the single chrome.runtime.onMessage.addListener.
   * Includes try...catch blocks for robust error handling during message processing.
   */
  function initMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("Content script: Received message:", request.action, "from sender:", sender);

      // Set asyncResponse to true by default for most handled actions,
      // unless explicitly set to false (e.g., for unknown actions or cases
      // where sendResponse is called immediately and no further async response is needed on THIS channel).
      let asyncResponse = false; // Initialize to false, set to true if async sendResponse is used.


      try { // Outer try...catch for synchronous errors in the listener callback
        switch (request.action) {
          case 'autofillForm':
          case 'fillForm':
            try {
              console.log("Content script: Received fillForm request.");
              currentProfile = request.profile; // Ensure profile is up-to-date

              const filledFormData = {}; // Data that was actually filled (for preview/logging, exclude sensitive)
              let fieldsFilledCount = 0;

              const inputs = document.querySelectorAll('input, select, textarea');

              inputs.forEach(input => {
                // --- Add try...catch around processing each input to catch specific errors ---
                try {
                  // Ensure input is visible and interactive before attempting to fill
                  if (input.offsetParent === null || input.disabled || input.readOnly) {
                    return; // Skip hidden, disabled, or read-only fields
                  }

                  const fieldType = identifyField(input); // Identify the field type

                  // If a field type was identified AND we have a corresponding non-empty value in the current profile
                  if (fieldType && currentProfile && currentProfile[fieldType] !== undefined && currentProfile[fieldType] !== null && currentProfile[fieldType] !== '') {
                    const valueToFill = currentProfile[fieldType];

                    // --- Attempt to fill the field ---
                    // Pass the fieldType to fillField so it can handle specific types (like select)
                    const fillSuccess = fillField(input, valueToFill, fieldType); // Call the fillField function

                    if (fillSuccess) {
                      highlightField(input, fieldType, true); // Highlight as filled
                      fieldsFilledCount++;
                      // Add filled data to the response object (exclude sensitive passwords)
                      filledFormData[fieldType] = (fieldType === 'password' || fieldType === 'confirmPassword') ? '[*****]' : valueToFill;
                    } else {
                      console.warn(`Content script: Failed to fill field for type ${fieldType} with value "${valueToFill}"`, input);
                    }
                    // --- End Attempt to fill the field ---
                  }
                  // Fields where identifyField returned null are skipped.
                  // Fields where we don't have profile data are skipped.
                  // Fields where the profile data is empty string, null, or undefined are skipped for filling.

                } catch (inputError) {
                  // Log error for a specific input, but continue processing other inputs
                  console.error(`Content script: Error processing input ${input.id || input.name || input.tagName} during fillForm:`, inputError);
                }
                // --- End try...catch around processing each input ---
              }); // End of inputs.forEach

              console.log(`Content script: Attempted to fill ${fieldsFilledCount} fields.`);

              // Send back the data that was actually filled (used by popup for preview)
              // Send success: true even if 0 fields were filled, but include the count/data
              sendResponse({ success: true, fieldsFilledCount: fieldsFilledCount, formData: filledFormData });

            } catch (error) {
              // This outer catch block captures errors that happen outside the forEach loop
              console.error("Content script: Error during fillForm (outer catch):", error);
              sendResponse({ success: false, error: error.message, action: request.action });
            }
            break;
          case 'autofillActive':
            autofillActive = request.active;
            console.log(`Content script: Autofill active status set to: ${autofillActive}`);
            return false;

          case 'setInitialSettings':
            try {
              // Receive initial settings and profile from popup/background on page load
              autofillActive = request.settings ? request.settings.autofillHighlightEnabled : false; // Safely access property
              currentProfile = request.activeProfile || null; // Default to null
              contentSettings.autoOptOutEmailSubscription = request.settings ? request.settings.autoOptOutEmailSubscription : false; // Default to false if settings is missing

              console.log("Content script: Initial settings and profile received.", { autofillActive, currentProfile, contentSettings });

              // Perform initial highlighting if needed, after a short delay
              // Check if profile is not null/empty before attempting to highlight
              if (autofillActive && currentProfile && Object.keys(currentProfile).length > 0) {
                console.log("Content script: Highlighting enabled and profile available, scheduling initial highlighting.");
                // Use a slightly longer delay to ensure page DOM is ready
                setTimeout(detectAndHighlightForms, 500);
              } else if (!autofillActive) {
                console.log("Content script: Highlighting disabled, removing any existing highlights.");
                removeHighlights(); // If highlighting is explicitly turned off
              } else {
                console.log("Content script: Highlighting enabled but no profile loaded. No initial highlighting.");
                // No action needed, leave highlights off but don't remove if none exist.
              }


              sendResponse({ success: true, message: 'Initial settings applied' });
              // This is a synchronous response within the case, no need to return true for the listener overall.
              // asyncResponse remains false.

            } catch (error) {
              console.error("Content script: Error applying initial settings:", error);
              sendResponse({ success: false, error: error.message, action: request.action });
              // This is a synchronous response within the catch, no need to return true overall.
              // asyncResponse remains false.
            }
            break; // End of case 'setInitialSettings'

          case 'stopAutofill':
            console.log("Content script: Received stop signal from background. Setting stopAutofillRequested.");
            stopAutofillRequested = true; // Set the flag to true
            sendResponse({ success: true, message: "Content script acknowledges stop." });
            break;

          case 'toggleAutofillHighlighting':
            try {
              autofillActive = request.isActive;
              handleAutofillToggle(); // This function should apply/remove highlights synchronously
              sendResponse({ success: true, message: 'Autofill highlighting toggled' });
              // Synchronous response, asyncResponse remains false.
            } catch (error) {
              console.error("Content script: Error toggling highlighting:", error);
              sendResponse({ success: false, error: error.message, action: request.action });
              // Synchronous response, asyncResponse remains false.
            }
            break; // End of case 'toggleAutofillHighlighting'

          case 'clearForm':
            console.log("Content script: Clearing form fields.");
            let clearedCount = 0;
            document.querySelectorAll('input, textarea, select').forEach(field => {
              if (field.type !== 'submit' && field.type !== 'button' && field.type !== 'hidden' && !field.readOnly && !field.disabled) {
                if (field.type === 'checkbox' || field.type === 'radio') {
                  field.checked = false;
                } else if (field.tagName === 'SELECT') {
                  field.selectedIndex = 0;
                } else {
                  field.value = '';
                }
                clearedCount++;
                // Dispatch events for programmatic changes during clear
                const event = new Event('input', { bubbles: true });
                field.dispatchEvent(event);
                const changeEvent = new Event('change', { bubbles: true });
                field.dispatchEvent(changeEvent);
              }
            });
            console.log(`Content script: Cleared ${clearedCount} fields.`);
            sendResponse({ success: true, message: `Cleared ${clearedCount} fields.` });
            return true;

          case 'submitForm':
            try {
              console.log("Content script: Received submitForm request.");
              let submitSuccess = false;
              let captchaDetected = false; // Assume no captcha unless detected before submit

              // Basic check for captcha before attempting submit (can reuse detectCaptcha)
              captchaDetected = detectCaptcha ? detectCaptcha() : false; // Ensure detectCaptcha exists

              if (captchaDetected) {
                console.warn("Content script: Captcha detected, preventing manual submit request.");
                sendResponse({ success: false, message: "Captcha detected, cannot auto-submit." });
              } else {
                // Attempt to submit the form
                submitSuccess = submitForm ? submitForm() : false; // Ensure submitForm exists

                // Determine if a birthday field was present (if needed by popup, optional)
                const hasBirthday = hasBirthdayField ? hasBirthdayField() : false; // Assuming hasBirthdayField exists

                sendResponse({
                  success: submitSuccess, // Indicates if submit button was found and clicked
                  message: submitSuccess ? 'Submit button clicked.' : 'No submit button found.',
                  hasBirthdayField: hasBirthday,
                  captchaDetected: false // Confirm no captcha before this submit
                });
              }
              // Synchronous response, asyncResponse remains false.

            } catch (error) {
              console.error("Content script: Error during submitForm:", error);
              sendResponse({ success: false, error: error.message, action: request.action });
              // Synchronous response, asyncResponse remains false.
            }
            break; // End of case 'submitForm'

          case 'getFormStatus':
            try {
              console.log("Content script: Received getFormStatus request.");
              const inputs = document.querySelectorAll('input, select, textarea');
              let detectedFieldCount = 0;
              let formDetected = false;

              inputs.forEach(input => {
                // --- Add try...catch around processing each input to catch specific errors ---
                try {
                  // Ensure input is potentially visible/interactive before identifying
                  if (input.offsetParent === null || input.disabled || input.readOnly || (input.offsetWidth <= 0 && input.offsetHeight <= 0)) {
                    return; // Skip non-visible, disabled, or read-only fields
                  }
                  const fieldType = identifyField(input); // Identify the field type

                  if (fieldType) {
                    detectedFieldCount++;
                    if (!formDetected && input.closest('form')) {
                      formDetected = true;
                    }
                  }
                } catch (inputError) {
                  // Log error for a specific input, but continue processing other inputs
                  console.error(`Content script: Error processing input ${input.id || input.name || input.tagName} in getFormStatus:`, inputError);
                }
                // --- End try...catch around processing each input ---
              }); // End of inputs.forEach

              // If no fields matched, check if there's at least one <form> element as a fallback for detection
              if (!formDetected) {
                formDetected = document.querySelectorAll('form').length > 0;
              }

              console.log("Content script: getFormStatus response:", { formDetected: formDetected, fieldCount: detectedFieldCount });
              sendResponse({ formDetected: formDetected, fieldCount: detectedFieldCount });
              // Synchronous response, asyncResponse remains false.

            } catch (error) {
              // This outer catch block captures errors that happen outside the forEach loop
              console.error("Content script: Error getting form status (outer catch):", error);
              sendResponse({ success: false, error: error.message, action: request.action });
              // Synchronous response, asyncResponse remains false.
            }
            break; // End of case 'getFormStatus'


          case 'startAutofillWorkflow':
            asyncResponse = false; // Explicitly set to false

            try { // Inner try...catch for workflow execution errors
              console.log(`Content script: Received startAutofillWorkflow request for retailer: ${request.retailerId || 'Unknown'}.`);
              // IMPORTANT: Use the profile data provided in this message for filling!
              currentProfile = request.profile || null; // Use the profile sent from background, default to null
              // Let's explicitly update contentSettings here from the request if available
              if (request.settings) {
                contentSettings.autoOptOutEmailSubscription = request.settings.autoOptOutEmailSubscription !== undefined ? request.settings.autoOptOutEmailSubscription : contentSettings.autoOptOutEmailSubscription;
              }

              let autofillSuccess = false;
              let submissionAttempted = false;
              let submissionSuccess = false; // Let background confirm actual success
              let captchaDetected = false;
              let needsManualReview = false;
              let statusMessage = '';
              let fillResult = null; // Initialize fillResult


              if (!currentProfile || Object.keys(currentProfile).length === 0) {
                statusMessage = "No profile data provided for autofill workflow.";
                needsManualReview = true;
                console.warn("Content script: " + statusMessage);

                // Send status back to background (async)
                chrome.runtime.sendMessage({
                  action: 'autofillWorkflowComplete',
                  retailerId: request.retailerId,
                  status: 'failed', // Indicate failure to start
                  needsManualReview: needsManualReview,
                  message: statusMessage,
                  // Include other flags as false/default
                  autofillSuccess: false, fieldsFilledCount: 0,
                  submissionAttempted: false, submissionSuccess: false, captchaDetected: false,
                }).catch(e => console.error("Content script: Error sending workflow complete message:", e)); // Add catch


              } else {

                // TODO: Add logic here to handle potential cookie consents or other initial obstacles (might need async)
                // If adding async awaits here, this case might need to be async itself,
                // and the message handling function (addListener) might need to return true
                // and call sendResponse only after all awaits are done, which complicates things.
                // Keeping it simple for now with setTimeout.


                // Wait a bit for the page structure to be fully ready before attempting autofill
                setTimeout(() => { // Using setTimeout here makes the inner logic run asynchronously
                  try { // Try...catch inside the setTimeout callback
                    console.log("Content script: Starting autofill after navigation delay...");

                    // Call detectAndFillForms which now handles both fields and checkboxes
                    fillResult = detectAndFillForms();

                    if (fillResult && fillResult.fieldsFilledCount > 0) {
                      autofillSuccess = true;
                      statusMessage = `Autofill attempted and ${fillResult.fieldsFilledCount} fields filled.`;
                      console.log("Content script: " + statusMessage);

                      // --- Attempt Submission ---
                      // Check for common captcha elements before submitting
                      // TODO: Implement a more robust captcha detection function if needed
                      captchaDetected = detectCaptcha ? detectCaptcha() : false; // Ensure detectCaptcha exists

                      if (captchaDetected) {
                        statusMessage += " Captcha detected. Skipping auto-submission.";
                        needsManualReview = true;
                        console.warn("Content script: " + statusMessage);

                      } else {
                        console.log("Content script: No captcha detected, attempting submission.");
                        submissionAttempted = true;
                        const submitResult = submitForm ? submitForm() : false; // Ensure submitForm exists

                        if (submitResult) {
                          // submitForm returns true if it *attempted* to click a button.
                          statusMessage += " Submit button found and clicked.";
                          console.log("Content script: " + statusMessage);
                          // Background script will monitor for navigation to confirm true success.
                        } else {
                          statusMessage += " No submit button found or error clicking.";
                          needsManualReview = true; // Needs review if submission couldn't even be attempted
                          console.warn("Content script: " + statusMessage);
                        }
                      }
                      // --- End Attempt Submission ---

                    } else {
                      // Autofill failed (no fields filled)
                      statusMessage = "Autofill attempted but no fields were filled.";
                      needsManualReview = true; // Needs review if autofill found no fields
                      console.warn("Content script: " + statusMessage);
                    }

                    // Report status back to the background script (async)
                    chrome.runtime.sendMessage({
                      action: 'autofillWorkflowComplete',
                      retailerId: request.retailerId, // Pass retailer ID back
                      status: needsManualReview ? 'needs_review' : (autofillSuccess ? (submissionAttempted ? 'submitted' : 'filled') : 'failed'), // More detailed status
                      autofillSuccess: autofillSuccess,
                      fieldsFilledCount: fillResult ? fillResult.fieldsFilledCount : 0,
                      submissionAttempted: submissionAttempted,
                      submissionSuccess: submissionSuccess, // Still let background confirm actual success
                      captchaDetected: captchaDetected,
                      needsManualReview: needsManualReview, // Explicit flag for background
                      message: statusMessage, // Provide a descriptive message
                    }).catch(e => console.error("Content script: Error sending workflow complete message:", e)); // Add catch

                  } catch (innerError) { // Catch errors within the setTimeout callback
                    console.error("Content script: Error inside workflow setTimeout callback:", innerError);
                    statusMessage = `Error during workflow step: ${innerError.message}`;
                    needsManualReview = true; // Needs review on any error

                    // Report failure back to background script (async)
                    chrome.runtime.sendMessage({
                      action: 'autofillWorkflowComplete',
                      retailerId: request.retailerId,
                      status: 'error', // Specific status for errors during processing
                      autofillSuccess: autofillSuccess, // Report state before error
                      fieldsFilledCount: fillResult ? fillResult.fieldsFilledCount : 0,
                      submissionAttempted: submissionAttempted,
                      submissionSuccess: false,
                      captchaDetected: captchaDetected,
                      needsManualReview: needsManualReview,
                      error: innerError.message,
                      message: statusMessage
                    }).catch(e => console.error("Content script: Error sending workflow complete message:", e)); // Add catch
                  }
                }, 2000); // Adjust delay as needed

                // No sendResponse here for the original 'startAutofillWorkflow' message.
                // We return false below.
              }

            } catch (outerError) { // Catch synchronous errors *before* the setTimeout
              console.error("Content script: Synchronous error during startAutofillWorkflow case:", outerError);
              statusMessage = `Synchronous error in workflow setup: ${outerError.message}`;
              needsManualReview = true; // Needs review on setup errors

              // Report failure back to background script (async)
              chrome.runtime.sendMessage({
                action: 'autofillWorkflowComplete',
                retailerId: request.retailerId,
                status: 'failed', // Specific status for setup errors
                needsManualReview: needsManualReview,
                error: outerError.message,
                message: statusMessage,
                // Include other flags as false/default
                autofillSuccess: false, fieldsFilledCount: 0,
                submissionAttempted: false, submissionSuccess: false, captchaDetected: false,
              }).catch(e => console.error("Content script: Error sending workflow complete message:", e)); // Add catch
              // We already sent the autofillWorkflowComplete message, no need for sendResponse here.
            }
            // This case returns false because we handle the outcome asynchronously via sendMessage.
            return false; // <--- Ensure this case explicitly returns false


          default:
            console.warn("Content script: Unknown message action:", request.action, "from sender:", sender);
            // For unknown actions, we don't expect a response, so no need to call sendResponse.
            sendResponse({ success: true, message: `Cleared ${clearedCount} fields.` });
            asyncResponse = false; // asyncResponse was initialized to false, explicitly keep it false
            return true; // End of default case
        }
      } catch (outerError) {
        // This catch block handles synchronous errors that escape the switch cases.
        // These are unexpected, severe errors.
        console.error("Content script: Uncaught synchronous error in message listener:", outerError);

        // Attempt to send a generic failure response for an uncaught synchronous error.
        // This is a best-effort attempt and might not work if the message channel is already closing/closed.
        // Rely more on the inner try/catches within each case to send responses for specific failures.
        try {
          // Check if sendResponse is still valid (might not be if channel closed)
          sendResponse({ success: false, error: `Uncaught error in content script listener: ${outerError.message}`, action: request.action });
        } catch (e) {
          console.error("Content script: Failed to send uncaught error response from outer catch:", e);
        }

        // Since an uncaught synchronous error occurred, we probably didn't reach a point
        // where an async response was guaranteed. Returning false is generally safer.
        return false; // Indicate no asynchronous response will be sent now.
      }

      // The final return statement after the outer try...catch block.
      // This return is reached if the outer try block completes without throwing an error.
      // `asyncResponse` is handled within the switch cases. For most cases, it remains false.
      // The startAutofillWorkflow case explicitly returns false.
      // So, the listener should generally return false unless a specific case *needed*
      // to return true because sendResponse was called asynchronously *after* the synchronous return.
      // Based on the current message handlers, returning false is correct.
      return asyncResponse; // This will likely be false
    }); // End of chrome.runtime.onMessage.addListener
  } // End of initMessageListeners function definition


  // --- Mutation Observer ---
  // Set up mutation observer to detect new forms or form fields added dynamically to the DOM
  function initMutationObserver() {
    const observerCallback = (mutations) => {
      // console.log("Content script: Mutation observer triggered."); // This can be very noisy
      let relevantChangeDetected = false;
      for (const mutation of mutations) {
        // Look for added nodes that are forms, inputs, selects, or textareas, or contain them
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            // Check if added node is an element and is or contains a form/input
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Use .matches() for efficiency and to check the node itself
              if (node.matches('form, input, select, textarea, button') || node.querySelector('form, input, select, textarea, button')) { // Added button
                relevantChangeDetected = true;
                console.log("Content script: Relevant DOM change detected:", node);
                break; // Found a relevant change, no need to check other added nodes in this mutation
              }
            }
          }
        }
        // If a relevant change was detected in this mutation record, stop checking other records
        if (relevantChangeDetected) break;
      };

      // If a relevant DOM change was detected AND autofill highlighting is currently active AND we have a profile
      if (relevantChangeDetected && autofillActive && currentProfile && Object.keys(currentProfile).length > 0) {
        // Wait a bit for the form/inputs to be fully rendered/interactive
        setTimeout(() => {
          console.log("Content script: Mutation observer detected potential form change, re-highlighting.");
          detectAndHighlightForms(); // Re-run highlighting
        }, 500); // Small delay to allow rendering
      }
    };

    // Create the observer instance with the callback
    const observer = new MutationObserver(observerCallback);
    observer.observe(document.body, {
      childList: true,
      subtree: true // ,
      // attributeFilter: ['value', 'checked', 'disabled', 'readonly'] // Add if needed to react to value changes
    });

    console.log("Content script: Mutation observer initialized.");
    // Keep the observer reference if you need to disconnect it later
    // const pageObserver = observer;
  }
  // --- End Mutation Observer ---


  Object.entries(customRetailers).forEach(([id, customData]) => {
    if (masterRetailerDatabase[id]) {
      console.warn(`Background: Custom retailer ID '${id}' conflicts with master. Skipping custom entry.`);
      // Don't add or update
    } else {
      masterRetailerDatabase[id] = customData; // Or some combined object
    }
  });

  // --- Style Injection ---
  /**
   * Injects CSS styles needed by the content script into the page's head.
   * This includes styles for highlighting fields.
   */
  function addStyles() {
    const styleId = 'loyalty-autofill-styles';
    // Check if styles are already injected
    if (document.getElementById(styleId)) {
      // console.log("Content script: Styles already added."); // Optional log
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
            /* Style for identified fields */
            .loyalty-form-highlight {
                outline: 2px solid #007bff !important; /* Blue outline */
                box-shadow: 0 0 5px rgba(0, 123, 255, 0.5) !important; /* Blue glow */
                transition: outline 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
            }

            /* Style for fields that were filled */
            .loyalty-filled-field {
                outline: 2px solid #28a745 !important; /* Green outline */
                 box-shadow: 0 0 5px rgba(40, 167, 69, 0.5) !important; /* Green glow */
            }

             /* Style for fields where filling might have failed (optional) */
             /* .loyalty-fill-failed {
                 outline: 2px solid #dc3545 !important; // Red outline
                 box-shadow: 0 0 5px rgba(220, 53, 69, 0.5) !important; // Red glow
             } */

            /* Optional: Add styles for tooltips if you use custom tooltips */
         `;
    document.head.appendChild(style);
    console.log("Content script: Styles added to head.");
  }
  // --- End Style Injection ---


})(); // End of IIFE