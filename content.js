// content.js
(function () {
  // Configuration
  let autofillActive = true; // Needs to be loaded from storage/popup settings
  let currentProfile = null; // Needs to be loaded from storage/popup
  let fieldMapping = {
    // Common field name and ID patterns
    firstName: ['first[-_]?name', 'fname', 'first', 'given[-_]?name'],
    lastName: ['last[-_]?name', 'lname', 'last', 'surname', 'family[-_]?name'],
    email: ['email', 'e[-_]?mail', 'mail'],
    phone: ['phone', 'telephone', 'tel', 'mobile', 'cell'],
    birthdate: ['birth[-_]?day', 'birth[-_]?date', 'dob', 'date[-_]?of[-_]?birth', 'bday'],
    address: ['address', 'street', 'addr', 'address[-_]?line[-_]?1'],
    city: ['city', 'town', 'locality'],
    state: ['state', 'province', 'region'],
    zip: ['zip', 'postal[-_]?code', 'post[-_]?code', 'zip[-_]?code']
  };

  // Fuzzy matching patterns for labels (used by identifyField)
  const labelPatterns = {
    firstName: ['first name', 'given name', 'first'],
    lastName: ['last name', 'surname', 'family name', 'last'],
    email: ['email', 'e-mail', 'email address'],
    phone: ['phone', 'telephone', 'mobile', 'cell', 'phone number'],
    birthdate: ['birth date', 'birthday', 'date of birth', 'birth', 'dob', 'mm/dd/yyyy', 'dd/mm/yyyy'],
    address: ['address', 'street address', 'street', 'address line 1'],
    city: ['city', 'town', 'locality'],
    state: ['state', 'province', 'region'],
    zip: ['zip', 'zip code', 'postal code', 'post code']
  };

  // Initialize listeners and observers when the script starts running
  initMessageListeners();
  initMutationObserver();
  addStyles(); // Add necessary CSS styles for highlighting/overlays

  // Note: Initial settings and profile should be sent from popup.js
  // using the 'setInitialSettings' action shortly after content script loads.

  /**
   * Initializes message listeners for communication with the popup script.
   */
  function initMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("Content script: Received message:", request.action);
      // Indicate that the response will be sent asynchronously
      let responseSent = false;

      switch (request.action) {
        case 'setInitialSettings':
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
          responseSent = true;
          break;

        case 'toggleAutofillHighlighting':
          autofillActive = request.isActive;
          handleAutofillToggle();
          sendResponse({ success: true, message: 'Autofill highlighting toggled' });
          responseSent = true;
          break;

        case 'fillForm':
          console.log("Content script: Received fillForm request.");
          currentProfile = request.profile; // Ensure profile is up-to-date
          const formData = detectAndFillForms(); // Fill the form fields
          // Send back the data that was filled for preview
          sendResponse({ formData: formData });
          responseSent = true;
          break;

        case 'submitForm':
          console.log("Content script: Received submitForm request.");
          // The submitForm function in popup.js doesn't send formData in the message
          // We need to rely on the fields that were already filled and highlighted
          const submitSuccess = submitForm(); // Call the local submit function
          // Determine if a birthday field was present on the page (for tracking)
          const hasBirthday = hasBirthdayField(); // Check if the page had a birthday field

          // Send response indicating success and potentially other info (like captcha detection)
          // Note: Simple captcha detection is complex. For now, just indicate if submit was *attempted*.
          // You might add more sophisticated checks here or in the background script later.
          sendResponse({
            success: submitSuccess, // Was a form submitted or button clicked?
            hasBirthdayField: hasBirthday, // Was a birthday field found on this page?
            captchaDetected: false // Placeholder - implement actual detection if needed
          });
          responseSent = true;
          break;

        case 'getFormStatus':
          console.log("Content script: Received getFormStatus request.");
          // Scan the page for relevant form fields
          const inputs = document.querySelectorAll('input, select, textarea');
          let detectedFieldCount = 0;
          let formDetected = false;

          // Check if any relevant form fields exist
          inputs.forEach(input => {
            const fieldType = identifyField(input);
            // Consider a form detected if we find any input fields that match our criteria
            if (fieldType) {
              detectedFieldCount++;
              // Also consider a form detected if at least one input is found within a <form> tag
              if (!formDetected && input.closest('form')) {
                formDetected = true;
              }
            }
          });

          // If no fields matched, check if there's at least one <form> element
          if (!formDetected) {
            formDetected = document.querySelectorAll('form').length > 0;
          }

          console.log("Content script: getFormStatus response:", { formDetected, fieldCount: detectedFieldCount });
          // Send the status back to the popup
          sendResponse({ formDetected: formDetected, fieldCount: detectedFieldCount });
          responseSent = true;
          break;

        default:
          console.warn("Content script: Unknown message action:", request.action);
          // Don't send a response for unknown actions unless explicitly required by the sender
          // return false is often sufficient if no response is ever needed for this case.
          break;
      }

      // Return true to indicate that sendResponse will be called asynchronously
      // (only if responseSent was set to true in one of the cases)
      return responseSent;
    });
  }

  // Set up mutation observer to detect new forms
  function initMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      // Optimization: Check mutations more efficiently if performance is an issue on complex pages
      let relevantChange = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          if (mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
              // Check if added node is a form or contains form-like elements
              if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName === 'FORM' || node.querySelector('form, input, select, textarea')) {
                  relevantChange = true;
                  break;
                }
              }
            }
          }
          // If we found a relevant change in added nodes, no need to check further mutations
          if (relevantChange) break;
        }
      }
      // Add other mutation types if necessary (e.g., attributes if form properties change)
    });


    if (relevantChange && autofillActive && currentProfile) {
      // Wait a bit for the form/inputs to be fully rendered/interactive
      setTimeout(() => {
        console.log("Content script: Mutation observer detected potential form change, re-highlighting.");
        detectAndHighlightForms();
      }, 500); // Small delay
    }
  };

  // Start observing the document body (or document.documentElement) for childList and subtree changes
  observer.observe(document.body, { // Observing body is usually sufficient
    childList: true,
    subtree: true
  });
  console.log("Content script: Mutation observer initialized.");



  function handleAutofillToggle() {
    console.log("Content script: Handling autofill toggle. Active:", autofillActive);
    if (autofillActive) {
      // Perform highlighting if already on a relevant page
      // Add a delay to ensure content script has settings/profile
      if (currentProfile) {
        setTimeout(detectAndHighlightForms, 100); // Small delay
      }
    } else {
      removeHighlights();
    }
  }

  /**
   * Detects potential form fields and highlights them if a profile is loaded.
   */
  function detectAndHighlightForms() {
    console.log("Content script: Detecting and highlighting forms.");
    // Only highlight if autofill is active AND we have profile data
    if (!autofillActive || !currentProfile) {
      console.log("Content script: Highlighting is off or no profile loaded.");
      removeHighlights(); // Ensure no lingering highlights
      return;
    }

    const inputs = document.querySelectorAll('input, select, textarea');
    let fieldsHighlighted = 0;

    // Clear existing highlights before adding new ones
    removeHighlights();

    inputs.forEach(input => {
      const fieldType = identifyField(input);
      // Highlight if a field type was identified AND we have a value for that field in the profile
      if (fieldType && currentProfile[fieldType]) {
        highlightField(input, fieldType);
        fieldsHighlighted++;
      }
    });

    console.log(`Content script: Highlighted ${fieldsHighlighted} fields.`);
  }


  /**
   * Removes all field highlights from the page.
   */
  function removeHighlights() {
    console.log("Content script: Removing highlights.");
    document.querySelectorAll('.loyalty-form-highlight').forEach(el => {
      el.classList.remove('loyalty-form-highlight', 'loyalty-filled-field');
      el.removeAttribute('title'); // Remove tooltip as well
    });
  }


  /**
   * Detects potential form fields and fills them with the current profile data.
   * Does NOT submit the form.
   * @returns {Object|null} An object containing the fieldType and value for fields that were filled, or null if no fields were detected/filled.
   */
  function detectAndFillForms() {
    console.log("Content script: Detecting and filling forms.");
    // Ensure we have a profile to fill with
    if (!currentProfile || Object.keys(currentProfile).length === 0) {
      console.warn("Content script: No current profile to fill forms with.");
      return null; // Cannot fill if no profile
    }

    const formData = {}; // Data that was actually filled
    let fieldsFilledCount = 0;

    // Get all input fields
    const inputs = document.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
      const fieldType = identifyField(input);
      // If a field type was identified AND we have a value for it in the current profile
      if (fieldType && currentProfile[fieldType]) {
        const valueToFill = currentProfile[fieldType];
        // Only fill if the value is not empty
        if (valueToFill !== '') {
          // Track field data for confirmation
          formData[fieldType] = valueToFill;
          fieldsFilledCount++;

          // Fill the field (but don't submit yet)
          fillField(input, valueToFill);
          highlightField(input, fieldType, true); // Highlight as filled
        }
      }
    });

    console.log(`Content script: Attempted to fill ${fieldsFilledCount} fields.`);

    // Return the data for the fields that were actually filled
    return fieldsFilledCount > 0 ? formData : null;
  }

  /**
   * Identifies the likely type of a form input element based on various attributes and associated labels.
   * @param {Element} input - The input, select, or textarea element.
   * @returns {string|null} The identified field type (e.g., 'firstName', 'email', 'birthdate') or null if not identified.
   */
  function identifyField(input) {
    // Skip irrelevant fields
    if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button' ||
      input.type === 'image' || input.type === 'file' || input.type === 'reset') {
      return null;
    }

    // Standard HTML5 autofill attribute (autocomplete)
    if (input.autocomplete) {
      // Map common autocomplete values to our field types
      const autocomplete = input.autocomplete.toLowerCase();
      if (autocomplete.includes('given-name')) return 'firstName';
      if (autocomplete.includes('family-name')) return 'lastName';
      if (autocomplete.includes('email')) return 'email';
      if (autocomplete.includes('tel')) return 'phone'; // Or 'tel-national', etc.
      if (autocomplete.includes('bday')) return 'birthdate';
      if (autocomplete.includes('street-address')) return 'address';
      if (autocomplete.includes('address-level2')) return 'city'; // address-level2 is often city
      if (autocomplete.includes('address-level1')) return 'state'; // address-level1 is often state
      if (autocomplete.includes('postal-code')) return 'zip';
      // Add other autocomplete mappings as needed
    }


    // Check name and id attributes using regex patterns
    const nameAttr = input.name ? input.name.toLowerCase() : '';
    const idAttr = input.id ? input.id.toLowerCase() : '';

    for (const [fieldType, patterns] of Object.entries(fieldMapping)) {
      for (const pattern of patterns) {
        // Use word boundaries (\b) to avoid matching "email" within "myemailfield" unintentionally
        // Also consider patterns that might not have boundaries like simple 'email'
        const regex = new RegExp(`\\b${pattern}\\b|${pattern}`, 'i'); // Try with boundary, then without
        if (regex.test(nameAttr) || regex.test(idAttr)) {
          return fieldType;
        }
      }
    }

    // Check for associated labels
    const labelText = getLabelTextForInput(input).toLowerCase();
    if (labelText) {
      for (const [fieldType, patterns] of Object.entries(labelPatterns)) {
        for (const pattern of patterns) {
          // Check if the label text includes the pattern (simple substring check)
          if (labelText.includes(pattern.toLowerCase())) {
            return fieldType;
          }
        }
      }
    }

    // Check for placeholder text
    const placeholder = input.placeholder ? input.placeholder.toLowerCase() : '';
    if (placeholder) {
      // Use label patterns for placeholder matching
      for (const [fieldType, patterns] of Object.entries(labelPatterns)) {
        for (const pattern of patterns) {
          // Check if the placeholder text includes the pattern
          if (placeholder.includes(pattern.toLowerCase())) {
            return fieldType;
          }
        }
      }
    }

    // No match found
    return null;
  }

  /**
   * Attempts to find the text content of a label associated with the given input element.
   * @param {Element} input - The input element.
   * @returns {string} The label text, or an empty string if no label is found.
   */
  function getLabelTextForInput(input) {
    // Check for explicit label using 'for' attribute
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) {
        return label.textContent.trim();
      }
    }

    // Check for wrapping label element
    let parent = input.parentElement;
    while (parent && parent !== document.body) {
      if (parent.tagName === 'LABEL') {
        // Remove any hidden text or nested form elements from the label text
        const clone = parent.cloneNode(true);
        Array.from(clone.querySelectorAll('input, select, textarea, button, style, script'))
          .forEach(el => el.remove());
        return clone.textContent.trim();
      }
      parent = parent.parentElement;
    }

    // Fallback: Check for nearby text nodes or previous siblings that might act as labels
    // This is less reliable but can help with poorly structured forms.
    // Check the previous sibling element if it's not another input
    const prevSibling = input.previousElementSibling;
    if (prevSibling && !prevSibling.querySelector('input, select, textarea')) {
      return prevSibling.textContent.trim();
    }

    // Check for table-based forms where the label might be in the previous cell (TD)
    if (input.parentElement && input.parentElement.tagName === 'TD') {
      const row = input.parentElement.parentElement; // Get the parent TR
      if (row && row.tagName === 'TR') {
        const cells = Array.from(row.cells);
        const cellIndex = cells.indexOf(input.parentElement);
        if (cellIndex > 0) {
          return cells[cellIndex - 1].textContent.trim(); // Text from the cell before the input's cell
        }
      }
    }


    // No identifiable label found
    return '';
  }


  /**
   * Fills a specific form input element with the given value, handling different input types.
   * Dispatches input and change events after filling.
   * @param {Element} input - The input, select, or textarea element.
   * @param {string|boolean} value - The value to fill.
   */
  function fillField(input, value) {
    console.log(`Content script: Attempting to fill field ${input.id || input.name || input.type} with value: "${value}"`);
    // Handle different input types
    switch (input.type) {
      case 'checkbox':
        input.checked = !!value; // Set checked based on truthiness of value
        break;

      case 'radio':
        // For radio buttons, only check if the input's specific value matches the value to fill
        if (input.value && input.value.toLowerCase() === String(value).toLowerCase()) {
          input.checked = true;
        }
        break;

      case 'select-one':
        // For select dropdowns, find the option with matching text or value
        if (input.tagName === 'SELECT') {
          let optionFound = false;
          for (let i = 0; i < input.options.length; i++) {
            const option = input.options[i];
            // Compare against option value or text
            if (option.value.toLowerCase() === String(value).toLowerCase() ||
              option.text.toLowerCase() === String(value).toLowerCase()) {
              input.selectedIndex = i;
              optionFound = true;
              break;
            }
          }
          if (!optionFound) {
            console.warn(`Content script: Value "${value}" not found in select options for field ${input.id || input.name}.`);
          }
        }
        break;

      case 'date':
        // Ensure date is in YYYY-MM-DD format expected by date inputs
        if (value && typeof value === 'string') {
          // Basic attempt to handle common formats like MM/DD/YYYY or DD/MM/YYYY
          let formattedDate = value;

          if (value.includes('/')) {
            const parts = value.split('/');
            if (parts.length === 3) {
              // Assume MM/DD/YYYY format for simplicity, but this can be ambiguous
              const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]; // Simple 2-digit year handling
              const month = parts[0].padStart(2, '0');
              const day = parts[1].padStart(2, '0');
              formattedDate = `${year}-${month}-${day}`;
              if (isNaN(new Date(formattedDate).getTime())) { // Check if valid date after formatting
                console.warn(`Content script: Invalid date format after conversion for "${value}". Attempting to fill as is.`);
                formattedDate = value; // Fallback
              }
            } else {
              console.warn(`Content script: Unexpected date format "${value}". Attempting to fill as is.`);
            }
          }
          // If value is already in YYYY-MM-DD or another valid format, setting input.value works directly.
          input.value = formattedDate;

        } else {
          console.warn(`Content script: Cannot fill date input with non-string value: "${value}"`);
          input.value = ''; // Clear value if input is invalid
        }
        break;

      default:
        // Text inputs, textarea, etc.
        // Ensure value is treated as a string for non-string input types
        input.value = String(value);
    }

    // Dispatch input and change events to trigger form validation and reactions on the page
    // Use try...catch because dispatchEvent can sometimes fail on specific input types or page handlers
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // Add other common events like 'blur' if needed for page validation
      // input.dispatchEvent(new Event('blur', { bubbles: true }));
    } catch (e) {
      console.warn(`Content script: Failed to dispatch events for input ${input.id || input.name}:`, e);
    }

    console.log(`Content script: Filled field ${input.id || input.name || input.type}.`);
  }


  /**
   * Adds CSS classes to an input element to highlight it.
   * @param {Element} input - The input element to highlight.
   * @param {string} fieldType - The identified type of the field (for tooltip).
   * @param {boolean} [filled=false] - Whether the field has been filled with profile data.
   */
  function highlightField(input, fieldType, filled = false) {
    // Add the base highlight class
    input.classList.add('loyalty-form-highlight');
    // Add the filled class if applicable
    if (filled) {
      input.classList.add('loyalty-filled-field');
    }

    // Add or update the tooltip showing the identified field type
    // Use setAttribute for title to avoid overwriting other attributes
    input.setAttribute('title', `Identified as: ${fieldType}`);
  }


  /**
   * Attempts to submit the form that contains the fields previously filled,
   * or clicks a likely submit button.
   * @returns {boolean} True if a submission action was attempted, false otherwise.
   */
  function submitForm() {
    console.log("Content script: Attempting to submit form.");

    // Find the form that contains the fields we previously filled
    const filledInputs = document.querySelectorAll('.loyalty-filled-field');
    if (filledInputs.length === 0) {
      console.warn("Content script: No filled fields found to determine which form to submit.");
      // Fall through to button clicking logic if no filled fields found
    }

    // Try to find a common parent form among the filled inputs
    let form = null;
    if (filledInputs.length > 0) {
      // Get the form of the first filled input as a starting point
      form = filledInputs[0].closest('form');

      // Verify if all other filled inputs are also within this form
      if (form) {
        for (let i = 1; i < filledInputs.length; i++) {
          if (!form.contains(filledInputs[i])) {
            console.warn("Content script: Filled fields belong to different forms. Cannot confidently submit a single form.");
            form = null; // Clear form if inputs are scattered
            break;
          }
        }
      }
    }


    if (form) {
      console.log("Content script: Found a common form to submit:", form);
      // Trigger the form's native submit method
      try {
        form.submit();
        console.log("Content script: Form submitted successfully via form.submit().");
        return true; // Indicate submission was attempted
      } catch (e) {
        console.error("Content script: Error submitting form via form.submit():", e);
        // Fall through to button clicking if form.submit() fails
      }
    } else {
      console.log("Content script: No single form found or form.submit() failed. Looking for a submit button.");
    }


    // Fallback: If no form was found or submitted successfully, look for a likely submit button
    // This is less reliable and might submit the wrong form or do nothing.
    const submitButtons = [...document.querySelectorAll('button, input[type="submit"], input[type="button"], a')] // Include links that look like buttons
      .filter(el => {
        // Check for common text patterns in buttons or links
        const text = (el.textContent || el.value || '').toLowerCase(); // Check textContent, value, or aria-label if needed
        return el.offsetParent !== null && // Ensure the element is visible
          (text.includes('submit') || text.includes('join') || text.includes('sign up') ||
            text.includes('register') || text.includes('continue') || text.includes('next') ||
            text.includes('create account') || text.includes('save') || text.includes('proceed')); // More keywords
      });

    // Prioritize buttons that are actually within a form, even if not the primary one
    let buttonToClick = submitButtons.find(button => button.closest('form'));

    // If no button within a form, just take the first visible button found
    if (!buttonToClick && submitButtons.length > 0) {
      buttonToClick = submitButtons[0];
    }


    if (buttonToClick) {
      console.log("Content script: Found a submit button to click:", buttonToClick);
      try {
        // Use a standard click event
        buttonToClick.click();
        console.log("Content script: Submit button clicked successfully.");
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
   * Checks if the currently detected form fields included a birthdate field.
   * This is used to inform the tracker if a birthday was relevant on this page.
   * @returns {boolean} True if a birthdate field was identified, false otherwise.
   */
  function hasBirthdayField() {
    // Re-scan or check the previously identified fields if stored
    const inputs = document.querySelectorAll('input, select'); // Rescan for simplicity

    for (const input of inputs) {
      const fieldType = identifyField(input);
      if (fieldType === 'birthdate') {
        console.log("Content script: Birthdate field detected on page.");
        return true;
      }
    }

    console.log("Content script: No birthdate field detected on page.");
    return false;
  }


  /**
   * Injects necessary CSS styles into the page's head for highlighting and overlays.
   */
  function addStyles() {
    // Check if styles are already added to avoid duplication
    if (document.getElementById('loyalty-autofill-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'loyalty-autofill-styles'; // Add an ID to check if already added
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

        /* Styles for the preview overlay (moved from popup CSS as content script manages it) */
        .loyalty-form-overlay {
          position: fixed !important; /* Stay fixed in the viewport */
          top: 0 !important;
          right: 0 !important;
          width: 300px !important;
          height: 100vh !important; /* Full viewport height */
          background-color: rgba(255, 255, 255, 0.98) !important; /* White with slight transparency */
          border-left: 1px solid #dadce0 !important; /* Light gray border */
          box-shadow: -4px 0 10px rgba(0, 0, 0, 0.1) !important; /* Shadow on the left */
          z-index: 9999 !important; /* High z-index to be on top of page content */
          overflow-y: auto !important; /* Allow content inside overlay to scroll */
          padding: 16px !important;

          /* Ensure consistent typography within the overlay */
          font-family: 'Roboto', Arial, sans-serif !important;
          color: #202124 !important;
          font-size: 14px !important;
          line-height: 1.5 !important;

          /* Transition for the slide effect */
          transform: translateX(100%) !important; /* Start off-screen to the right */
          transition: transform 0.3s ease !important;

          /* Hide from layout when not active */
          display: none !important;
        }

        .loyalty-form-overlay.active {
          transform: translateX(0) !important; /* Slide in */
          display: block !important; /* Make it visible (and part of render tree) when active */
        }

        /* Styles for elements inside the preview overlay */
        .loyalty-form-overlay h3 {
          font-size: 16px !important;
          margin: 0 0 10px 0 !important;
          color: #202124 !important;
          font-weight: 500 !important;
        }

        .loyalty-form-overlay .field-list {
          margin-bottom: 15px !important;
        }

        .loyalty-form-overlay .field-item {
          margin-bottom: 8px !important;
          padding-bottom: 8px !important;
          border-bottom: 1px solid #eee !important;
          line-height: 1.4 !important;
        }

        .loyalty-form-overlay .field-item:last-child {
          border-bottom: none !important;
          padding-bottom: 0 !important;
          margin-bottom: 0 !important;
        }

        .loyalty-form-overlay .field-name {
          font-weight: 500 !important;
          font-size: 0.9em !important; /* Slightly smaller than base */
          display: inline-block !important;
          margin-right: 5px !important;
          color: #4285f4 !important; /* Blue */
        }

        .loyalty-form-overlay .field-value {
          font-size: 0.9em !important;
          color: #5f6368 !important; /* Dark gray */
          word-break: break-word !important; /* Prevent long values from overflowing */
          display: inline !important;
        }

        .loyalty-form-overlay .field-preview-actions {
          display: flex !important;
          gap: 10px !important;
          justify-content: flex-end !important;
          margin-top: 15px !important;
        }

        .loyalty-form-overlay button {
          /* Basic button reset/style */
          padding: 8px 16px !important;
          border-radius: 4px !important;
          cursor: pointer !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          transition: all 0.2s ease !important;
        }

        .loyalty-form-overlay .btn-primary {
          background-color: #4285f4 !important; /* Google Blue */
          color: white !important;
          border: none !important;
        }
        .loyalty-form-overlay .btn-primary:hover {
          background-color: #3367d6 !important; /* Darker blue */
        }

        .loyalty-form-overlay .btn-secondary {
          background-color: #f8f9fa !important; /* Very light gray */
          color: #5f6368 !important; /* Dark gray */
          border: 1px solid #dadce0 !important; /* Light gray border */
        }
        .loyalty-form-overlay .btn-secondary:hover {
          background-color: #eef1f5 !important; /* Light blue-gray */
          border-color: #bdc1c6 !important; /* Slightly darker gray */
        }

        .loyalty-form-overlay .close-preview {
          background: none !important;
          border: none !important;
          font-size: 18px !important;
          cursor: pointer !important;
          color: #5f6368 !important;
          padding: 5px !important;
          border-radius: 50% !important;
          width: 30px !important;
          height: 30px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .loyalty-form-overlay .close-preview:hover {
          background-color: rgba(0, 0, 0, 0.05) !important;
        }

      `;
    document.head.appendChild(style);
  }


  /**
   * Creates and displays the field preview overlay.
   * NOTE: This function relies on receiving the template HTML or structure
   * from the popup, as content scripts cannot access popup DOM directly.
   * The current implementation assumes the template structure can be queried
   * which is incorrect if the template is in popup.html.
   * A better approach is for the popup to send the fully rendered HTML or
   * the template's innerHTML to content.js.
   * @param {Object} formData - Object containing the field types and values that were filled.
   * @param {string} [previewTemplateHtml] - Optional: The HTML string of the field preview template.
   */
  function displayFieldPreview(formData, previewTemplateHtml = null) {
    // This content script cannot directly access fieldPreviewTemplate from popup.html.
    // It should receive the template HTML or pre-built structure from the popup.
    // For demonstration, let's assume the popup sends the template HTML string.
    // If not provided, this part of the functionality won't work correctly.
    if (!previewTemplateHtml) {
      console.error("Content script: Field preview template HTML not provided!");
      // Potentially send an error message back to the popup
      return;
    }
    console.log("Content script: Displaying field preview.");

    // Remove any existing preview overlay to avoid duplicates
    const existingPreview = document.querySelector('.loyalty-form-overlay');
    if (existingPreview) {
      existingPreview.remove(); // Remove from DOM completely
    }

    // Create a temporary element to parse the template HTML string
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = previewTemplateHtml;
    const previewOverlay = tempDiv.firstElementChild; // Get the root element from the template

    if (!previewOverlay || !previewOverlay.classList.contains('loyalty-form-overlay')) {
      console.error("Content script: Invalid field preview template HTML provided!");
      return;
    }


    // Get references to elements within the cloned template for adding listeners
    const fieldList = previewOverlay.querySelector('.field-list');
    const closeBtn = previewOverlay.querySelector('.close-preview');
    const cancelBtn = previewOverlay.querySelector('.cancel-fill');
    const confirmBtn = previewOverlay.querySelector('.confirm-fill');


    // Clear any default content in the field list
    if (fieldList) fieldList.innerHTML = '';

    // Populate the field list with the data that was filled
    if (fieldList && formData && Object.keys(formData).length > 0) {
      for (const fieldType in formData) {
        if (formData.hasOwnProperty(fieldType)) {
          const fieldItem = document.createElement('div');
          fieldItem.className = 'field-item';

          const fieldName = document.createElement('div');
          fieldName.className = 'field-name';
          // Format the field type name nicely (e.g., "firstName" -> "First Name")
          fieldName.textContent = fieldType.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase());

          const fieldValue = document.createElement('div');
          fieldValue.className = 'field-value';
          const value = formData[fieldType];
          fieldValue.textContent = (value === '' || value === null || value === undefined) ? '[Empty]' : value;

          fieldItem.appendChild(fieldName);
          fieldItem.appendChild(fieldValue);
          fieldList.appendChild(fieldItem);
        }
      }
    } else if (fieldList) {
      // Handle case where no fields were filled
      const noFieldsMessage = document.createElement('div');
      noFieldsMessage.textContent = 'No recognizable fields were filled.';
      noFieldsMessage.style.fontStyle = 'italic';
      noFieldsMessage.style.color = '#666';
      fieldList.appendChild(noFieldsMessage);
      // Disable confirm button if nothing was filled
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'No fields to confirm';
        // Assuming btn-secondary style exists
        if (confirmBtn.classList.contains('btn-primary')) confirmBtn.classList.remove('btn-primary');
        confirmBtn.classList.add('btn-secondary');
      }
    }


    // --- Add Event Listeners to Preview Overlay Buttons ---
    if (closeBtn) closeBtn.addEventListener('click', () => { hideFieldPreview(); });
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      console.log("Content script: Field preview cancelled.");
      hideFieldPreview(); // Hide the overlay
      // Optionally message popup to show a status message
      chrome.runtime.sendMessage({ action: 'autofillCancelled' }).catch(e => console.warn("Content script: Failed to message popup:", e));
    });
    if (confirmBtn) confirmBtn.addEventListener('click', (event) => {
      console.log("Content script: Confirm & Submit button clicked.");
      if (event) event.preventDefault(); // Prevent default button behavior
      hideFieldPreview(); // Hide the overlay
      // Message popup to initiate submission (popup handles consent dialog if needed)
      // The popup needs to handle the 'submitForm' action and then send the *actual* submit trigger back to content.js
      // This flow seems a bit circular. A simpler flow might be:
      // Popup -> 'fillForm' -> Content.js fills & sends formData back -> Popup displays preview -> User confirms -> Popup sends 'submitForm' -> Content.js submits.
      // Let's stick to the implied flow where the popup just needs confirmation before content.js submits.
      chrome.runtime.sendMessage({ action: 'submitFormTriggered' }).catch(e => console.warn("Content script: Failed to message popup:", e));
    });
    // --- End Event Listeners Setup ---


    // Add the populated overlay to the body of the web page
    document.body.appendChild(previewOverlay);

    // Add 'active' class to trigger CSS transition (slide-in effect from translateX(100%))
    // Use a slight timeout to ensure the element is in the DOM and rendered before transition starts
    setTimeout(() => {
      if (previewOverlay) { // Check if the element still exists
        previewOverlay.classList.add('active');
        console.log("Content script: Field preview overlay should now be sliding in.");
      }
    }, 10); // Small delay
  }


  /**
   * Hides the field preview overlay.
   */
  function hideFieldPreview() {
    console.log("Content script: Hiding field preview.");
    const previewOverlay = document.querySelector('.loyalty-form-overlay');
    if (previewOverlay) {
      // Trigger the CSS transition (slide-out effect) by removing the 'active' class
      previewOverlay.classList.remove('active');

      // Listen for the end of the transition
      // Use a named function to ensure the listener can be removed properly
      previewOverlay.addEventListener('transitionend', function handler(event) {
        // Check if the event is for the 'transform' property (in case other properties transition)
        // and if the 'active' class was indeed removed (ensures this is the closing transition)
        if (event.propertyName === 'transform' && !previewOverlay.classList.contains('active')) {
          previewOverlay.style.display = 'none'; // Hide from layout after transition
          previewOverlay.remove(); // Remove the element from the DOM
          console.log("Content script: Field preview element hidden and removed after transition.");
        }
        // Remove the event listener itself after it fires once
        previewOverlay.removeEventListener('transitionend', handler);
      });

      // Fallback timeout to remove the element if transitionend doesn't fire
      setTimeout(() => {
        if (document.body.contains(previewOverlay)) {
          console.warn("Content script: Fallback removing field preview after timeout.");
          previewOverlay.remove();
        }
      }, 400); // Slightly longer than the transition duration
    }
  }


})(); // End of IIFE