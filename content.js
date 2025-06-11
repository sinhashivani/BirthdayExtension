// Use an Immediately Invoked Function Expression (IIFE) to avoid polluting the global scope of the webpage
(function () {
  // Configuration Variables
  // These variables need to be loaded with actual data/settings, typically from the popup or background script
  let autofillActive = false; // State for autofill highlighting toggle (controlled by popup)
  let currentProfile = null; // Stores the profile data loaded from storage (sent by popup/background)

  let cspErrorDetected = false;

  console.log("Content script: Injecting error_monitor.js");
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('error_monitor.js');
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove(); // Clean up script tag after loading

  window.addEventListener('message', function (event) {
    // We only accept messages from ourselves
    if (event.source !== window) {
      return;
    }

    if (event.data.type && event.data.type === 'EXTENSION_DETECTED_CSP_ERROR') {
      console.error("Content script: Received CSP error notification from main world:", event.data.message);
      cspErrorDetected = true; // Set the flag
    }
  });


  // Field Identification Mapping
  // Map our internal field types to common name/ID patterns found in HTML forms
  // IMPORTANT: Ensure the keys here match the property names in your profile objects!
  let fieldMapping = {
    // Common field name and ID patterns (using regex format)
    firstName: ['first[-_]?name', 'fname', 'first', 'given[-_]?name'],
    lastName: ['last[-_]?name', 'lname', 'last', 'surname', 'family[-_]?name'],
    email: ['email', 'e[-_]?mail', 'mail'],
    password: ['password', 'Password', 'current-password'], // Consider adding patterns for 'new-password', 'confirm-password' if you fill those
    // Add patterns for phone number components if stored separately
    phoneCountryCode: ['country[-_]?code', 'dialing[-_]?code', 'intl[-_]?code', 'international[-_]?code', 'cc', 'phone[-_]?cc', 'prefix', 'phone[-_]?prefix'], // Added more patterns
    phoneAreaCode: ['area[-_]?code', 'ac', 'phone[-_]?ac', 'prefix', 'phone[-_]?prefix'], // Added more patterns
    phone: ['phone', 'telephone', 'tel', 'mobile', 'cell', 'phone[-_]?number'], // Main phone number
    birthdate: ['birth[-_]?day', 'birth[-_]?date', 'dob', 'date[-_]?of[-_]?birth', 'bday'],
    address: ['address', 'street', 'addr', 'address[-_]?line[-_]?1', 'street[-_]?address'], // Added street-address
    city: ['city', 'town', 'locality', 'address[-_]?level2'], // address-level2 is often city
    state: ['state', 'province', 'region', 'address[-_]?level1'], // address-level1 is often state
    zip: ['zip', 'postal[-_]?code', 'post[-_]?code', 'zip[-_]?code'],
    // Add other field types as needed (e.g., country, company, etc.)
  };

  // Fuzzy matching patterns for labels, placeholders, and aria-labels (used by identifyField)
  // These are simpler strings for case-insensitive substring matching
  const labelPatterns = {
    firstName: ['first name', 'given name', 'first'],
    lastName: ['last name', 'surname', 'family name', 'last'],
    email: ['email', 'e-mail', 'email address'],
    password: ['password', 'create password', 'new password', 'confirm password', 'current password'], // Keep password patterns
    // Add label patterns for phone number components if stored separately
    phoneCountryCode: ['country code', 'dialing code', 'international code', 'intl code', 'country', 'phone prefix', 'prefix'], // Added patterns
    phoneAreaCode: ['area code', 'phone prefix', 'prefix'], // Added patterns
    phone: ['phone', 'telephone', 'mobile', 'cell', 'phone number'],
    birthdate: ['birth date', 'birthday', 'date of birth', 'dateofbirth', 'birth', 'dob', 'mm/dd/yyyy', 'dd/mm/yyyy'],
    address: ['address', 'street address', 'street', 'address line 1'],
    city: ['city', 'town', 'locality'],
    state: ['state', 'province', 'region'],
    zip: ['zip', 'zip code', 'postal code', 'post code'],
    // Add other field types as needed
  };


  // --- Content Script Initialization ---
  // These functions are called when the content script is injected and starts running.
  initMessageListeners(); // Set up message handling
  initMutationObserver(); // Start observing for DOM changes
  addStyles(); // Inject necessary CSS for highlighting/overlays

  // Note: Initial settings and profile should be sent from popup.js
  // using the 'setInitialSettings' action shortly after content script loads.

  // --- Mutation Observer ---
  // Set up mutation observer to detect new forms or form fields added dynamically to the DOM
  function initMutationObserver() {
    const observerCallback = (mutations) => {
      console.log("Content script: Mutation observer triggered.");
      let relevantChangeDetected = false;
      for (const mutation of mutations) {
        // Look for added nodes that are forms, inputs, selects, or textareas, or contain them
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            // Check if added node is an element and is or contains a form/input
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Use .matches() for efficiency and to check the node itself
              if (node.matches('form, input, select, textarea') || node.querySelector('form, input, select, textarea')) {
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
      if (relevantChangeDetected && autofillActive && currentProfile) {
        // Wait a bit for the form/inputs to be fully rendered/interactive
        setTimeout(() => {
          console.log("Content script: Mutation observer detected potential form change, re-highlighting.");
          detectAndHighlightForms(); // Re-run highlighting
        }, 500); // Small delay to allow rendering
      }
    }; // <-- End of the observerCallback function definition

    // Create the observer instance with the callback
    const observer = new MutationObserver(observerCallback);

    // Start observing the document body for childList and subtree changes
    // We observe childList to catch elements being added/removed directly to the body
    // We observe subtree to catch changes within descendants of the body
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log("Content script: Mutation observer initialized.");
  }
  // --- End Mutation Observer ---


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
      if (currentProfile) {
        setTimeout(detectAndHighlightForms, 100); // Small delay
      }
    } else {
      // If turning highlighting OFF, remove all existing highlights
      removeHighlights();
    }
  }

  /**
   * Detects form fields on the page and highlights them if a profile is loaded
   * and autofill highlighting is active.
   */
  function detectAndHighlightForms() {
    console.log("Content script: Detecting and highlighting forms.");
    // Only highlight if autofill is active AND we have profile data
    if (!autofillActive || !currentProfile) {
      console.log("Content script: Highlighting is off or no profile loaded. Removing any existing highlights.");
      removeHighlights(); // Ensure no lingering highlights if conditions aren't met
      return;
    }

    const inputs = document.querySelectorAll('input, select, textarea');
    let fieldsHighlighted = 0;

    // It's often good practice to clear existing highlights before re-applying,
    // especially after DOM changes detected by the Mutation Observer.
    removeHighlights();

    inputs.forEach(input => {
      // --- Add try...catch around processing each input to catch specific errors ---
      try {
        // Ensure input is visible and interactive before attempting to highlight
        if (input.offsetParent === null || input.disabled || input.readOnly) {
          return; // Skip hidden, disabled, or read-only fields
        }

        const fieldType = identifyField(input); // Identify the field type

        // Highlight if a field type was identified AND we have a value for that field in the profile
        // (We highlight based on having data, even if the field isn't currently filled)
        if (fieldType && currentProfile[fieldType] !== undefined && currentProfile[fieldType] !== null && currentProfile[fieldType] !== '') {
          highlightField(input, fieldType); // Apply highlight style and tooltip
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
    console.log("Content script: Removing highlights.");
    // Select elements based on the specific highlight class added by your extension
    document.querySelectorAll('.loyalty-form-highlight').forEach(el => {
      el.classList.remove('loyalty-form-highlight', 'loyalty-filled-field');
      // Optionally remove the title attribute if you added it for the tooltip
      if (el.hasAttribute('title') && el.getAttribute('title').startsWith('Identified as: ')) {
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
    // Avoid adding the class multiple times
    if (!input.classList.contains('loyalty-form-highlight')) {
      input.classList.add('loyalty-form-highlight');
      // Add a title attribute for a simple tooltip (can be enhanced with a custom tooltip later)
      input.title = `Identified as: ${fieldType}`;
    }
    if (isFilled) {
      input.classList.add('loyalty-filled-field');
      input.title = `Filled as: ${fieldType}`; // Update tooltip for filled state
    } else {
      input.classList.remove('loyalty-filled-field'); // Ensure filled class is removed if not filled
    }
  }


  // --- Form Filling Logic ---
  /**
   * Detects potential form fields and fills them with the current profile data.
   * Does NOT automatically submit the form.
   * @returns {Object|null} An object containing the fieldType and value for fields that were filled (excluding sensitive data), or null if no fields were detected/filled.
   */
  function initMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("Content script: Received message:", request.action);

      // We are planning to send a response for most handled actions to prevent "message port closed" errors.
      // The try...catch ensures sendResponse is called even if an error occurs within a case.
      let asyncResponse = true; // Assume we will send a response for handled cases


      switch (request.action) {
        case 'setInitialSettings':
          try {
            // Receive initial settings and profile from popup on page load
            autofillActive = request.settings.autofillHighlightEnabled; // Assuming this setting exists
            currentProfile = request.activeProfile;
            console.log("Content script: Initial settings and profile received.", { autofillActive, currentProfile });
            // Perform initial highlighting if needed
            if (autofillActive) {
              // Use a slight delay to wait for the page content to render
              setTimeout(detectAndHighlightForms, 500);
            }
            sendResponse({ success: true, message: 'Initial settings applied' });
          } catch (error) {
            console.error("Content script: Error applying initial settings:", error);
            // Send back an error response
            sendResponse({ success: false, error: error.message, action: request.action });
          }
          break;

        case 'toggleAutofillHighlighting':
          try {
            autofillActive = request.isActive;
            handleAutofillToggle(); // Assuming handleAutofillToggle exists and applies/removes highlighting
            sendResponse({ success: true, message: 'Autofill highlighting toggled' });
          } catch (error) {
            console.error("Content script: Error toggling highlighting:", error);
            sendResponse({ success: false, error: error.message, action: request.action });
          }
          break;

        case 'fillForm':
        case 'autofill':
        case 'autofillForm':
        case 'executeAutofill':
          console.log("Content.js: Received executeAutofill command for", request.retailerInfo?.name);
          const profile = request.profile;
          const source = request.source;
          cspErrorDetected = false;

          if (!profile) {
            console.warn("Content.js: Autofill profile not provided or empty.");
            sendResponse({ status: 'error', message: 'Autofill profile not provided.' });
            return true;
          }

          (async () => { // Use an async IIFE to handle async operations within listener
            try {
              // IMPORTANT: The detectAndFillForms function MUST be implemented
              // to return an object like { fieldsFilledCount: number, filledFormData: object }
              // or similar structure that your `sendResponse` expects.
              const autofillResult = detectAndFillForms(profile, request.retailerInfo?.selectors); // Pass selectors if needed

              // Check if autofillResult is properly structured
              if (typeof autofillResult !== 'object' || autofillResult === null || !('fieldsFilledCount' in autofillResult)) {
                console.error("Content.js: detectAndFillForms did not return expected result format.");
                autofillResult = { fieldsFilledCount: 0, filledFormData: {} }; // Default to prevent errors
              }

              if (autofillResult.fieldsFilledCount > 0) { // Check fieldsFilledCount
                console.log(`Content.js: Autofill successful. Filled ${autofillResult.fieldsFilledCount} fields.`);
                sendResponse({
                  status: 'success', // Use a consistent status string
                  message: "Autofill successful.",
                  fieldsFilledCount: autofillResult.fieldsFilledCount,
                  formData: autofillResult.filledFormData // This should be an object of filled data
                });

                console.log("Content.js: Attempting to submit form...");
                if (source === 'bulkAutofill') { // Only attempt submission if source is 'bulkAutofill'
                  console.log("Content.js: Call originated from bulk autofill. Attempting to submit form...");
                  try {
                    submissionSuccess = await submitForm(); // Call submitForm, ensure it's async if needed
                    console.log(`Content.js: Form submission: ${submissionSuccess ? 'Successful' : 'Failed'}.`);
                  } catch (submitError) {
                    console.error("Content.js: Error during form submission:", submitError);
                    submissionSuccess = false;
                  }
                } else {
                  // If not from 'bulkAutofill' (e.g., from 'popup'), skip submission
                  console.log(`Content.js: Call originated from '${source}'. Skipping automatic form submission.`);
                  submissionSuccess = false; // Ensure submissionSuccess is false if not attempted
                }
              } else {
                console.warn("Content.js: Autofill failed. No fields found or filled.");
                sendResponse({
                  status: 'warning', // Use 'warning' for no fields filled
                  message: "Autofill failed. No fields found/filled or page structure might have changed.",
                  fieldsFilledCount: 0,
                  formData: {}
                });
              }
            } catch (error) {
              console.error("Content.js: Error during autofill:", error);
              sendResponse({
                status: 'error', // Consistent status string
                message: `Autofill error: ${error.message}`,
                fieldsFilledCount: 0,
                formData: {}, // Send empty formData on error
                cspErrorDetected: cspErrorDetected // Include current CSP status

              });

              //return; // Exit early on error
            }

            if (cspErrorDetected) {
              console.warn("Content.js: Final check: CSP 'unsafe-eval' error was detected during this operation.");
              sendResponse({
                status: 'error', // Status is 'error' due to CSP violation
                message: `Page Error: Content Security Policy violation detected.`,
                fieldsFilledCount: autofillResult.fieldsFilledCount,
                formData: autofillResult.filledFormData,
                submissionSuccess: false, // Assume submission failed if CSP error occurred
                hasBirthdayField: hasBirthdayField,
                cspErrorDetected: true // Confirm CSP error was detected
              });
            } else if (autofillResult.fieldsFilledCount > 0 && submissionSuccess) {
              // Autofill successful AND submission successful AND no CSP error
              sendResponse({
                status: 'success',
                message: "Autofill and submission successful.",
                fieldsFilledCount: autofillResult.fieldsFilledCount,
                formData: autofillResult.filledFormData,
                submissionSuccess: true,
                hasBirthdayField: hasBirthdayField,
                cspErrorDetected: false
              });
            } else if (autofillResult.fieldsFilledCount > 0 && !submissionSuccess) {
              // Autofill successful BUT submission failed/not confirmed AND no CSP error
              sendResponse({
                status: 'warning',
                message: "Autofill successful, but form submission failed or was not confirmed.",
                fieldsFilledCount: autofillResult.fieldsFilledCount,
                formData: autofillResult.filledFormData,
                submissionSuccess: false,
                hasBirthdayField: hasBirthdayField,
                cspErrorDetected: false
              });
            } else {
              // No fields filled AND no CSP error
              sendResponse({
                status: 'warning',
                message: "Autofill failed. No fields found or filled.",
                fieldsFilledCount: 0,
                formData: {},
                submissionSuccess: false,
                hasBirthdayField: hasBirthdayField,
                cspErrorDetected: false
              });
            }
          })(); // End of async IIFE
          return true; // IMPORTANT: Indicate that sendResponse will be called asynchronously

        case 'getFormStatus':
          try {
            console.log("Content script: Received getFormStatus request.");
            const inputs = document.querySelectorAll('input, select, textarea');
            let detectedFieldCount = 0;
            let formDetected = false;

            inputs.forEach(input => {
              // --- Add try...catch around processing each input to catch specific errors ---
              try {
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

          } catch (error) {
            // This outer catch block captures errors that happen outside the forEach loop
            console.error("Content script: Error getting form status (outer catch):", error);
            sendResponse({ success: false, error: error.message, action: request.action });
          }
          break;

        default:
          console.warn("Content script: Unknown message action:", request.action);
          // For unknown actions, we don't expect a response, so no need to call sendResponse.
          asyncResponse = false; // Indicate no response is planned for unhandled actions
          break;
      }

      // Return true to indicate that sendResponse will be called asynchronously for handled cases.
      // Return false for unhandled cases (where asyncResponse is false).
      return asyncResponse;
    });
  }


  // --- Mutation Observer ---
  // Set up mutation observer to detect new forms or form fields added dynamically to the DOM
  function initMutationObserver() {
    const observerCallback = (mutations) => {
      console.log("Content script: Mutation observer triggered.");
      let relevantChangeDetected = false;
      for (const mutation of mutations) {
        // Look for added nodes that are forms, inputs, selects, or textareas, or contain them
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            // Check if added node is an element and is or contains a form/input
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Use .matches() for efficiency and to check the node itself
              if (node.matches('form, input, select, textarea') || node.querySelector('form, input, select, textarea')) {
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
      if (relevantChangeDetected && autofillActive && currentProfile) {
        // Wait a bit for the form/inputs to be fully rendered/interactive
        setTimeout(() => {
          console.log("Content script: Mutation observer detected potential form change, re-highlighting.");
          detectAndHighlightForms(); // Re-run highlighting
        }, 500); // Small delay to allow rendering
      }
    }; // <-- End of the observerCallback function definition

    // Create the observer instance with the callback
    const observer = new MutationObserver(observerCallback);

    // Start observing the document body for childList and subtree changes
    // We observe childList to catch elements being added/removed directly to the body
    // We observe subtree to catch changes within descendants of the body
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log("Content script: Mutation observer initialized.");
  }
  // --- End Mutation Observer ---


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
      if (currentProfile) {
        setTimeout(detectAndHighlightForms, 100); // Small delay
      }
    } else {
      // If turning highlighting OFF, remove all existing highlights
      removeHighlights();
    }
  }

  /**
   * Detects form fields on the page and highlights them if a profile is loaded
   * and autofill highlighting is active.
   */
  function detectAndHighlightForms() {
    console.log("Content script: Detecting and highlighting forms.");
    // Only highlight if autofill is active AND we have profile data
    if (!autofillActive || !currentProfile) {
      console.log("Content script: Highlighting is off or no profile loaded. Removing any existing highlights.");
      removeHighlights(); // Ensure no lingering highlights if conditions aren't met
      return;
    }

    const inputs = document.querySelectorAll('input, select, textarea');
    let fieldsHighlighted = 0;

    // It's often good practice to clear existing highlights before re-applying,
    // especially after DOM changes detected by the Mutation Observer.
    removeHighlights();

    inputs.forEach(input => {
      // --- Add try...catch around processing each input to catch specific errors ---
      try {
        // Ensure input is visible and interactive before attempting to highlight
        if (input.offsetParent === null || input.disabled || input.readOnly) {
          return; // Skip hidden, disabled, or read-only fields
        }

        const fieldType = identifyField(input); // Identify the field type

        // Highlight if a field type was identified AND we have a value for that field in the profile
        // (We highlight based on having data, even if the field isn't currently filled)
        if (fieldType && currentProfile[fieldType] !== undefined && currentProfile[fieldType] !== null && currentProfile[fieldType] !== '') {
          highlightField(input, fieldType); // Apply highlight style and tooltip
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
    console.log("Content script: Removing highlights.");
    // Select elements based on the specific highlight class added by your extension
    document.querySelectorAll('.loyalty-form-highlight').forEach(el => {
      el.classList.remove('loyalty-form-highlight', 'loyalty-filled-field');
      // Optionally remove the title attribute if you added it for the tooltip
      if (el.hasAttribute('title') && el.getAttribute('title').startsWith('Identified as: ')) {
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
    // Avoid adding the class multiple times
    if (!input.classList.contains('loyalty-form-highlight')) {
      input.classList.add('loyalty-form-highlight');
      // Add a title attribute for a simple tooltip (can be enhanced with a custom tooltip later)
      input.title = `Identified as: ${fieldType}`;
    }
    if (isFilled) {
      input.classList.add('loyalty-filled-field');
      input.title = `Filled as: ${fieldType}`; // Update tooltip for filled state
    } else {
      input.classList.remove('loyalty-filled-field'); // Ensure filled class is removed if not filled
    }
  }


  // --- Form Filling Logic ---
  /**
   * Detects potential form fields and fills them with the current profile data.
   * Does NOT automatically submit the form.
   * @returns {Object|null} An object containing the fieldType and value for fields that were filled (excluding sensitive data), or null if no fields were detected/filled.
   */
  function detectAndFillForms(profile) {
    let fieldsFilledCount = 0;
    let filledFormData = {}; // Object to store data that was actually filled

    console.log("Content script: Detecting and filling forms.");
    // Ensure we have a profile to fill with
    if (!profile || Object.keys(profile).length === 0) {
      console.warn("Content script: No current profile to fill forms with.");
      return null; // Cannot fill if no profile
    }

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
        if (fieldType && profile && profile[fieldType] !== undefined && profile[fieldType] !== null && profile[fieldType] !== '') {
          const valueToFill = profile[fieldType];

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

        if (fieldsFilledCount > 0) {
          console.log(`Content.js: Successfully filled ${fieldsFilledCount} fields.`);
          return {
            success: true,
            message: "Autofill successful.",
            fieldsFilledCount: fieldsFilledCount,
            filledFormData: filledFormData
          };
        } else {
          console.warn("Content.js: No fields were filled. Page might not be an autofill target or selectors are incorrect.");
          return {
            success: false,
            message: "Autofill failed. No fields were found or filled. Page structure might have changed or CAPTCHA present."
          };
        }

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

  // The identifyField function (using the one from our previous successful step)
  /**
   * Identifies the likely type of a form input element based on various attributes and associated labels.
   * Uses the fieldMapping and labelPatterns defined in the content script.
   * @param {Element} input - The input, select, or textarea element.
   * @returns {string|null} The identified field type (e.g., 'firstName', 'email', 'birthdate') or null if not identified.
   */
  function identifyField(input) {
    // Skip irrelevant fields
    if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button' ||
      input.type === 'image' || input.type === 'file' || input.type === 'reset') {
      return null;
    }

    // Normalize attribute values for easier matching
    const nameAttr = input.name ? input.name.toLowerCase() : '';
    const idAttr = input.id ? input.id.toLowerCase() : '';
    const placeholderAttr = input.placeholder ? input.placeholder.toLowerCase() : '';
    const typeAttr = input.type ? input.type.toLowerCase() : '';
    const autocompleteAttr = input.autocomplete ? input.autocomplete.toLowerCase() : '';
    const ariaLabelAttr = input.getAttribute('aria-label') ? input.getAttribute('aria-label').toLowerCase() : '';


    // 1. Check standard HTML5 autofill attribute (autocomplete)
    // These are often the most reliable
    if (autocompleteAttr) {
      // Map common autocomplete values to our field types
      if (autocompleteAttr.includes('given-name')) return 'firstName';
      if (autocompleteAttr.includes('family-name')) return 'lastName';
      if (autocompleteAttr.includes('email')) return 'email';
      if (autocompleteAttr.includes('password')) return 'password'; // Matches 'current-password', 'new-password' etc.
      if (autocompleteAttr.includes('tel-country-code')) return 'phoneCountryCode';
      if (autocompleteAttr.includes('tel-area-code')) return 'phoneAreaCode';
      if (autocompleteAttr.includes('tel')) return 'phone'; // General phone number
      if (autocompleteAttr.includes('bday')) return 'birthdate';
      if (autocompleteAttr.includes('street-address')) return 'address';
      if (autocompleteAttr.includes('address-level2')) return 'city'; // city
      if (autocompleteAttr.includes('address-level1')) return 'state'; // state/province
      if (autocompleteAttr.includes('postal-code')) return 'zip';
      // Add other relevant autocomplete mappings from https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete
    }

    // 2. Check type attribute for known types before checking name/id patterns
    if (typeAttr === 'email') return 'email';
    if (typeAttr === 'tel') return 'phone'; // tel input type
    if (typeAttr === 'date') return 'birthdate'; // date input type
    // For password type, we still want to check names/ids for new/confirm differentiation if needed, so skip here

    // 3. Check name and id attributes using regex patterns from fieldMapping
    for (const [fieldType, patterns] of Object.entries(fieldMapping)) {
      for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'i'); // Case-insensitive regex test
        if (regex.test(nameAttr) || regex.test(idAttr)) {
          return fieldType;
        }
      }
    }

    // 4. Check associated labels, placeholder text, and aria-label using simple string inclusion from labelPatterns
    const labelText = getLabelTextForInput(input).toLowerCase(); // Assuming getLabelTextForInput is defined

    for (const [fieldType, patterns] of Object.entries(labelPatterns)) {
      for (const pattern of patterns) {
        const lowerPattern = pattern.toLowerCase();
        if (labelText.includes(lowerPattern) ||
          placeholderAttr.includes(lowerPattern) ||
          ariaLabelAttr.includes(lowerPattern)) {
          return fieldType;
        }
      }
    }

    // If no match found after all checks
    return null;
  }


  /**
   * Helper function to find the text content of a label associated with an input element.
   * Checks for both explicit <label for="..."> and wrapping <label> elements.
   * Adapted from user's previous code.
   * @param {Element} input - The input element.
   * @returns {string} The label text, or an empty string if no label found.
   */
  function getLabelTextForInput(input) {
    let labelText = '';

    // Check for explicit label using 'for' attribute
    if (input.id) { // Only check if input has an ID
      const labels = document.querySelectorAll(`label[for="${input.id}"]`);
      if (labels.length > 0) {
        labelText = labels[0].textContent.trim();
      }
    }

    // If no explicit label found, check for a parent label element
    if (!labelText) {
      const parentLabel = input.closest('label');
      if (parentLabel) {
        // Get text content, excluding text within any nested input values
        const clone = parentLabel.cloneNode(true);
        const inputs = clone.querySelectorAll('input, select, textarea');
        inputs.forEach(input => input.remove()); // Remove nested inputs before getting text
        labelText = clone.textContent.trim();
      }
    }

    // If still no label text, check for aria-label as a last resort for "label-like" text
    // This was also handled in identifyField, but including here provides the source for identifyField
    if (!labelText && input.getAttribute('aria-label')) {
      labelText = input.getAttribute('aria-label').trim();
    }

    // Note: This version does not include the "check nearby text" logic from your previous identifyFieldType.
    // That can be added if needed, but is less reliable.

    return labelText;
  }


  /**
   * Fills a form field with the given value and attempts to trigger common events.
   * Returns true if the value was set, false otherwise (e.g., readOnly).
   * @param {Element} input - The input, select, or textarea element.
   * @param {string} value - The value to fill.
   * @param {string} [fieldType] - Optional field type hint (e.g., 'birthdate' for date inputs).
   * @returns {boolean} True if the value was set, false if read-only or unsupported type.
   */
  function fillField(input, value, fieldType) {
    if (input.readOnly || input.disabled) {
      console.warn("Content script: Skipping fill for read-only or disabled input:", input);
      return false;
    }

    const inputType = input.type.toLowerCase();

    try {
      switch (input.tagName.toLowerCase()) {
        case 'input':
          switch (inputType) {
            case 'text':
            case 'email':
            case 'password':
            case 'tel':
            case 'url':
            case 'search':
            case 'number':
              input.value = value;
              break;

            case 'date':
              // Ensure value is in 'YYYY-MM-DD' format for date inputs
              if (fieldType === 'birthdate' && typeof value === 'string') {
                // Simple attempt to convert common formats (MM/DD/YYYY, DD/MM/YYYY) to YYYY-MM-DD
                const parts = value.split(/[-\/\.]/); // Split by -, /, or .
                if (parts.length === 3) {
                  // Assume MM/DD/YYYY or DD/MM/YYYY and try to rearrange for YYYY-MM-DD
                  // This is a very basic conversion; more robust parsing might be needed.
                  const year = parts[2];
                  const month = parts[0].padStart(2, '0'); // Assume MM is first or second
                  const day = parts[1].padStart(2, '0'); // Assume DD is first or second
                  input.value = `${year}-${month}-${day}`; // YYYY-MM-DD format
                } else {
                  // If not in a recognized format, try setting directly
                  input.value = value;
                }
                break;
              } else {
                input.value = value; // For other date-like types, set directly
                break;
              }

            case 'checkbox':
              // Check the checkbox if the value is truthy (e.g., "true", "yes", 1)
              input.checked = Boolean(value && value !== 'false' && value !== '0');
              break;

            case 'radio':
              // Check the radio button if its value matches the profile value
              input.checked = (input.value === value);
              break;

            // Add other input types like 'color', 'range', 'time', etc. if needed
            default:
              // For unsupported input types, just try setting the value directly
              input.value = value;
              console.warn(`Content script: Attempting to fill unsupported input type "${inputType}"`, input);
              break;
          }
          break; // End of case 'input'

        case 'select':
          // For select elements, find the option with a matching value or text
          const selectElement = input; // Rename for clarity
          let optionFound = false;
          for (let i = 0; i < selectElement.options.length; i++) {
            const option = selectElement.options[i];
            // Match by value or text content (case-insensitive, trimmed)
            if (option.value.toLowerCase() === value.toLowerCase() || option.text.toLowerCase() === value.toLowerCase()) {
              selectElement.value = option.value; // Set the select value to the matched option's value
              optionFound = true;
              break;
            }
          }
          if (!optionFound) {
            console.warn(`Content script: No matching option found for select field with value "${value}"`, selectElement);
            return false; // Indicate filling failed if no option matched
          }
          break; // End of case 'select'

        case 'textarea':
          input.value = value;
          break; // End of case 'textarea'

        default:
          console.warn(`Content script: Unsupported element tag for filling "${input.tagName}"`, input);
          return false; // Indicate filling failed for unsupported tag
      }

      // --- Attempt to trigger events after setting the value ---
      // Websites often use JavaScript to react to input changes.
      // Manually dispatching events can help trigger these reactions.
      // Common events are 'input', 'change', 'blur'.
      const eventsToDispatch = ['input', 'change', 'blur'];
      eventsToDispatch.forEach(eventType => {
        try {
          const event = new Event(eventType, { bubbles: true });
          input.dispatchEvent(event);
          // console.log(`Content script: Dispatched "${eventType}" event for`, input);
        } catch (e) {
          console.error(`Content script: Failed to dispatch "${eventType}" event for`, input, e);
        }
      });
      // --- End Event Triggering ---

      return true; // Indicate successful filling attempt
    } catch (e) {
      console.error(`Content script: Exception during fillField for input ${input.id || input.name || input.tagName}:`, e);
      return false; // Indicate filling failed due to error
    }
  }


  // --- Submit Form Logic ---
  /**
   * Attempts to submit the form that contains the fields previously filled,
   * or clicks a likely submit button. This is a basic implementation and may not work on all websites.
   * Returns true if a submission action was attempted, false otherwise.
   * (Ensure this function is defined if the 'submitForm' message action is used)
   */
  function submitForm() {
    console.log("Content script: Attempting to submit form.");

    const filledInputs = document.querySelectorAll('.loyalty-filled-field');
    if (filledInputs.length === 0) {
      console.warn("Content script: No filled fields found to determine which form to submit. Falling back to button search.");
      // Fall through to button clicking logic if no filled fields found
    }

    let targetForm = null;
    if (filledInputs.length > 0) {
      targetForm = filledInputs[0].closest('form');
      if (targetForm) {
        for (let i = 1; i < filledInputs.length; i++) {
          if (!targetForm.contains(filledInputs[i])) {
            console.warn("Content script: Filled fields belong to different forms. Cannot confidently submit a single form. Falling back to button search.");
            targetForm = null;
            break;
          }
        }
      }
    }

    if (targetForm) {
      console.log("Content script: Found a common form to submit:", targetForm);
      try {
        // Attempt native form submission
        targetForm.submit();
        console.log("Content script: Form submitted successfully via form.submit().");
        return true; // Indicate submission was attempted and likely successful
      } catch (e) {
        console.error("Content script: Error submitting form via form.submit():", e);
        // Fall through to button clicking if form.submit() fails (e.g., due to validation)
      }
    } else {
      console.log("Content script: No single form found or form.submit() failed. Looking for a submit button.");
    }

    // Fallback: If no single form was confidently identified or submitted, look for a likely submit button
    const submitButtons = [...document.querySelectorAll('button, input[type="submit"], input[type="button"], a')]
      .filter(el => {
        const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').toLowerCase();
        return el.offsetParent !== null && // Ensure the element is visible
          (text.includes('submit') || text.includes('join') || text.includes('sign up') ||
            text.includes('register') || text.includes('continue') || text.includes('next') ||
            text.includes('create account') || text.includes('save') || text.includes('proceed') || text.includes('done'));
      });

    let buttonToClick = submitButtons.find(button => button.closest('form'));
    if (!buttonToClick && submitButtons.length > 0) {
      buttonToClick = submitButtons[0];
    }

    if (buttonToClick) {
      console.log("Content script: Found a submit button to click:", buttonToClick);
      try {
        // Attempt to click the button
        buttonToClick.click();

        // --- ADDITION: Dispatch common events to mimic real user interaction ---
        // These can sometimes be crucial for modern JS frameworks
        buttonToClick.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        buttonToClick.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        buttonToClick.dispatchEvent(new MouseEvent('click', { bubbles: true })); // Already called by .click() but good to explicitly dispatch if needed

        // If the button is an input, it might also have a change event, though less common for buttons
        if (buttonToClick.tagName === 'INPUT') {
          buttonToClick.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // --- END ADDITION ---

        console.log("Content script: Submit button clicked successfully with additional events.");
        return true; // Indicate submission was attempted
      } catch (e) {
        console.error("Content script: Error clicking submit button:", e);
        return false; // Indicate failure
      }
    } else {
      console.warn("Content script: Could not find a form or a likely submit button to click.");
      return false; // No submission action was attempted
    }
  }


  /**
   * Checks if a birthday field is present on the page by re-scanning inputs.
   * This is used to inform the tracker if a birthday was relevant on this page.
   * @returns {boolean} True if a birthdate field was identified, false otherwise.
   */
  function hasBirthdayField() {
    console.log("Content script: Checking for birthday field.");
    // Re-scan for input/select elements
    const inputs = document.querySelectorAll('input, select');

    for (const input of inputs) {
      // Use identifyField to check if it's a birthdate field
      try { // Add try/catch here too just in case identifyField fails
        const fieldType = identifyField(input);
        if (fieldType === 'birthdate') {
          console.log("Content script: Birthdate field detected.");
          return true;
        }
      } catch (e) {
        console.error(`Content script: Error checking birthday field for input ${input.id || input.name || input.tagName}:`, e);
        // Continue checking other inputs even if one causes an error
      }
    }

    console.log("Content script: No birthdate field detected.");
    return false;
  }


  // --- Preview Overlay Logic (Basic Placeholder) ---
  // These functions are assumed to exist based on your popup's interaction,
  // but require implementation to create and manage the actual overlay HTML.

  /**
   * Displays a preview overlay on the page with the data that was filled.
   * Requires implementation to create and style the overlay element dynamically.
   * @param {object} formData - The data that was filled { fieldType: value }.
   */
  function displayFieldPreview(formData) {
    console.log("Content script: Placeholder - Displaying field preview with data:", formData);
    // TODO: Implement logic to create/update and show an overlay element on the page
    // This would typically involve creating a div, adding content based on formData,
    // applying styles to position and display it, and potentially adding a close button.
    const overlay = document.getElementById('loyalty-form-preview-overlay');
    if (overlay) {
      // Update content and show
      const fieldList = overlay.querySelector('.field-list');
      if (fieldList) {
        fieldList.innerHTML = ''; // Clear previous content
        for (const fieldType in formData) {
          const fieldItem = document.createElement('li');
          fieldItem.classList.add('field-item');
          fieldItem.innerHTML = `<span class="field-name">${fieldType}:</span> <span class="field-value">${formData[fieldType]}</span>`;
          fieldList.appendChild(fieldItem);
        }
      }
      overlay.classList.add('active'); // Use CSS class to show
      console.log("Content script: Placeholder - Overlay content updated and shown.");
    } else {
      console.warn("Content script: Placeholder - Preview overlay element not found.");
      // You might want to create the overlay here if it doesn't exist
      createPreviewOverlay(); // Call a function to create it
      // Then call displayFieldPreview again or update/show it here
      displayFieldPreview(formData); // Recursive call after creating
    }
  }

  /**
   * Hides the preview overlay.
   * Requires implementation to hide the overlay element.
   */
  function hideFieldPreview() {
    console.log("Content script: Placeholder - Hiding field preview.");
    // TODO: Implement logic to hide the overlay element dynamically.
    const overlay = document.getElementById('loyalty-form-preview-overlay');
    if (overlay) {
      overlay.classList.remove('active'); // Use CSS class to hide
      // Consider clearing content or removing from DOM if needed
    }
  }

  /**
   * Helper function to create the preview overlay element and add it to the body.
   * Should be called once during initialization or when displayFieldPreview is first called and finds no overlay.
   */
  function createPreviewOverlay() {
    if (document.getElementById('loyalty-form-preview-overlay')) {
      return; // Already exists
    }

    const overlay = document.createElement('div');
    overlay.id = 'loyalty-form-preview-overlay';
    overlay.classList.add('loyalty-form-overlay'); // Apply base styles
    overlay.innerHTML = `
      <h3>Autofill Preview</h3>
      <ul class="field-list"></ul>
      <button class="close-button">×</button>
    `;

    document.body.appendChild(overlay);

    // Add event listener to close button
    const closeButton = overlay.querySelector('.close-button');
    if (closeButton) {
      closeButton.addEventListener('click', hideFieldPreview);
    }

    console.log("Content script: Preview overlay element created.");
  }


  // --- Basic Style Injection ---
  // This function injects CSS into the page's head.
  /**
   * Injects necessary CSS styles into the page's head for highlighting and overlays.
   */
  function addStyles() {
    // Check if styles are already added to avoid duplication
    if (document.getElementById('loyalty-autofill-styles')) {
      console.log("Content script: Styles already added.");
      return;
    }

    const style = document.createElement('style');
    style.id = 'loyalty-autofill-styles'; // Add an ID to check if already added
    // Use !important carefully to override website's styles for highlighting/overlay
    style.textContent = `
        /* Styles for highlighting form fields identified by the extension */
        .loyalty-form-highlight {
          border: 2px solid #4285f4 !important; /* Google Blue border */
          box-shadow: 0 0 5px rgba(66, 133, 244, 0.5) !important; /* Subtle blue glow */
          transition: all 0.3s ease-in-out !important; /* Smooth transition for visual feedback */
          /* Ensure highlight is visible on top of page elements */
          z-index: 9990 !important;
          position: relative !important; /* Needed for z-index to work reliably */
        }

        /* Style for fields that have been filled by the extension */
        .loyalty-filled-field {
          background-color: rgba(52, 168, 83, 0.15) !important; /* Light green background */
          border-color: #34a853 !important; /* Google Green border */
          /* Add subtle text color change if needed, but !important might override page styles */
          /* color: #1b5e20 !important; */
        }

        /* Remove outline on highlight to avoid double outlines */
        .loyalty-form-highlight:focus {
            outline: none !important;
        }


        /* Styles for the preview overlay */
        .loyalty-form-overlay {
          position: fixed !important; /* Stay fixed in the viewport */
          top: 0 !important;
          right: 0 !important;
          width: 300px !important; /* Fixed width for the overlay */
          height: 100vh !important; /* Full viewport height */
          background-color: rgba(255, 255, 255, 0.98) !important; /* White with slight transparency */
          border-left: 1px solid #dadce0 !important; /* Light gray border */
          box-shadow: -4px 0 10px rgba(0, 0, 0, 0.1) !important; /* Shadow on the left */
          z-index: 9999 !important; /* High z-index to be on top of page content */
          overflow-y: auto !important; /* Allow content inside overlay to scroll */
          padding: 16px !important; /* Padding inside the overlay */

          /* Ensure consistent typography within the overlay */
          font-family: 'Roboto', Arial, sans-serif !important;
          color: #202124 !important;
          font-size: 14px !important;
          line-height: 1.5 !important;

          /* Transition for the slide effect */
          transform: translateX(100%) !important; /* Start off-screen to the right */
          transition: transform 0.3s ease !important;

          /* Hide from layout when not active */
          display: none !important; /* Use display none when not active to remove from layout */
        }

        .loyalty-form-overlay.active {
          transform: translateX(0) !important; /* Slide in */
          display: block !important; /* Make it visible (and part of render tree) when active */
        }

        /* Styles for elements inside the preview overlay (adjust selectors as needed) */
        .loyalty-form-overlay h3 {
          font-size: 16px !important;
          margin: 0 0 10px 0 !important;
          color: #202124 !important;
          font-weight: 500 !important;
        }

        .loyalty-form-overlay .field-list {
          list-style: none !important;
          padding: 0 !important;
          margin-bottom: 15px !important;
        }

        .loyalty-form-overlay .field-item {
          margin-bottom: 8px !important;
          padding-bottom: 8px !important;
          border-bottom: 1px solid #eee !important;
          display: flex !important; /* Use flex for name/value layout */
          justify-content: space-between !important;
        }

        .loyalty-form-overlay .field-name {
          font-weight: 500 !important;
          margin-right: 5px !important;
          color: #5f6368 !important;
          flex-shrink: 0 !important; /* Prevent name from shrinking */
        }
        .loyalty-form-overlay .field-value {
            color: #202124 !important;
            word-break: break-all !important; /* Prevent long values from overflowing */
            text-align: right !important; /* Align value to the right */
        }

        /* Add styles for buttons within the overlay if you have them */
        /* .loyalty-form-overlay .button-container { ... } */
        /* .loyalty-form-overlay .submit-button { ... } */
        /* .loyalty-form-overlay .cancel-button { ... } */

        /* Add styles for your close button within the overlay if you have one */
        .loyalty-form-overlay .close-button { /* Match the class used in your content.js addStyles */
          position: absolute !important;
          top: 10px !important;
          right: 10px !important;
          background: none !important;
          border: none !important;
          font-size: 18px !important;
          cursor: pointer !important;
          color: #5f6368 !important;
          padding: 4px !important;
          border-radius: 4px !important;
        }

        .loyalty-form-overlay .close-button:hover {
          background-color: #f8f9fa !important; /* Use a background color on hover */
        }


        /* Birthday field detection indication */
        /* These match the classes used in your content.js */
        .loyalty-birthday-icon {
          display: inline-block !important;
          width: 16px !important;
          height: 16px !important;
          background-color: #fbbc05 !important;
          border-radius: 50% !important;
          margin-left: 8px !important;
          position: relative !important;
        }

        .loyalty-birthday-icon::before {
          content: "🎂" !important;
          font-size: 10px !important;
          position: absolute !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
        }


        /* Accessibility (High Contrast) for injected elements */
        /* Ensure these styles provide sufficient contrast and visual cues */
        /* Apply these rules to the specific classes of your injected elements */

        body.high-contrast .loyalty-form-highlight {
            border-color: yellow !important;
            box-shadow: 0 0 5px yellow !important;
        }

        body.high-contrast .loyalty-filled-field {
            background-color: rgba(0, 255, 0, 0.2) !important; /* Green with transparency */
            border-color: lime !important;
        }

        body.high-contrast .loyalty-form-overlay {
            background-color: black !important;
            color: white !important;
            border-color: white !important;
            box-shadow: -4px 0 10px rgba(255, 255, 255, 0.2) !important;
        }

        body.high-contrast .loyalty-form-overlay h3 {
            color: white !important;
        }

        body.high-contrast .loyalty-form-overlay .field-item {
            border-color: #555 !important; /* Lighter border in HC */
        }

        body.high-contrast .loyalty-form-overlay .field-name {
            color: yellow !important;
        }

        body.high-contrast .loyalty-form-overlay .field-value {
            color: white !important;
        }

        body.high-contrast .loyalty-form-overlay .close-button {
            color: white !important;
        }

        body.high-contrast .loyalty-form-overlay .close-button:hover {
            background-color: #333 !important;
        }

        body.high-contrast .loyalty-birthday-icon {
            background-color: yellow !important;
        }

        body.high-contrast .loyalty-birthday-icon::before {
            /* Emoji color might not change with CSS, but background is HC */
        }

    `; // <-- End of style.textContent

    // Append the style element to the document head
    document.head.appendChild(style);
    console.log("Content script: Styles added to head.");
  }
  // --- End Add Styles ---


})(); // End of IIFE