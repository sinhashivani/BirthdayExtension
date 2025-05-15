// content.js
(function () {
  // Configuration
  let autofillActive = true;
  let currentProfile = null;
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

  // Fuzzy matching patterns for labels
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

  // Initialize listeners
  initMessageListeners();
  initMutationObserver();

  /**
 * Shows the field preview overlay with data from the fill process.
 * @param {Object} formData - Object containing the field types and values that were filled.
 */
  function displayFieldPreview(formData) {
    if (!fieldPreviewTemplate) {
      console.error("Content script: Field preview template not found!");
      return;
    }
    console.log("Content script: Displaying field preview.");

    // Remove any existing preview overlay
    const existingPreview = document.querySelector('.loyalty-form-overlay');
    if (existingPreview) {
      existingPreview.remove(); // Remove from DOM
    }

    // Clone the template
    const previewOverlay = fieldPreviewTemplate.content.cloneNode(true).firstElementChild;

    // ... (populate previewOverlay with data and setup internal button listeners) ...
    // Ensure listeners for closeBtn, cancelBtn, confirmBtn are set up here
    // IMPORTANT: Update the close/cancel button listeners to set display: none immediately on click


    // Add the populated overlay to the body
    document.body.appendChild(previewOverlay);

    // --- ADD THIS ---
    // Make the element a block element *before* adding the active class
    // This allows the CSS transition to work from display: none to display: block + transform
    previewOverlay.style.display = 'block';
    // --- END ADD THIS ---

    // Add 'active' class to trigger CSS transition (slide-in effect)
    // Use a slight timeout to ensure the element is added to the DOM before transition
    setTimeout(() => {
      previewOverlay.classList.add('active');
      console.log("Content script: Preview overlay should now be visible.");
    }, 10); // Small delay


    // --- Update Close/Cancel Button Listeners Here ---
    // Inside displayFieldPreview function, after getting closeBtn and cancelBtn:
    closeBtn.addEventListener('click', () => {
      console.log("Content script: Preview overlay closed.");
      const overlay = document.querySelector('.loyalty-form-overlay');
      if (overlay) {
        overlay.style.display = 'none'; // Hide immediately
        overlay.remove(); // Remove from DOM
        formPreviewData = null; // Clear stored data
      }
    });

    cancelBtn.addEventListener('click', () => {
      console.log("Content script: Field preview cancelled.");
      const overlay = document.querySelector('.loyalty-form-overlay');
      if (overlay) {
        overlay.style.display = 'none'; // Hide immediately
        overlay.remove(); // Remove from DOM
        formPreviewData = null;
      }
      showStatus('Form filling cancelled.', 'info'); // Show status on popup
    });
    // --- End Update Close/Cancel Button Listeners ---


  }


  /**
   * Hides the field preview overlay.
   */
  function hideFieldPreview() {
    console.log("Content script: Hiding field preview.");
    const previewOverlay = document.querySelector('.loyalty-form-overlay');
    if (previewOverlay) {
      // Trigger CSS transition (slide-out effect)
      previewOverlay.classList.remove('active');

      // --- MODIFIED ---
      // Listen for the end of the transition
      previewOverlay.addEventListener('transitionend', function handler() {
        // Check if the 'active' class was removed (ensures it's the closing transition)
        if (!previewOverlay.classList.contains('active')) {
          previewOverlay.style.display = 'none'; // Hide element from layout
          previewOverlay.remove(); // Remove from DOM
          formPreviewData = null; // Clear stored data
          console.log("Content script: Field preview element hidden and removed after transition.");
        }
        // Remove the event listener itself after it runs once
        previewOverlay.removeEventListener('transitionend', handler);
      });
      // --- END MODIFIED ---

      // If transitionend doesn't fire (e.g., display was already none, or error),
      // you might need a fallback mechanism or rely on the immediate display: none on close/cancel clicks.
    }
  }



  // Listen for messages from the popup
  function initMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'toggleAutofill':
          autofillActive = message.isActive;
          handleAutofillToggle();
          sendResponse({ success: true });
          break;

        case 'fillForm':
          currentProfile = message.profile;
          const formData = detectAndFillForms();
          sendResponse({ formData: formData });
          break;

        case 'submitForm':
          submitForm(message.formData);
          sendResponse({
            success: true,
            hasBirthdayField: hasBirthdayField()
          });
          break;

        default:
          sendResponse({ error: 'Unknown action' });
      }
      return true; // Keep the message channel open for async response
    });
  }

  // Set up mutation observer to detect new forms
  function initMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      if (autofillActive && currentProfile) {
        // Check if new forms were added
        const formAdded = mutations.some(mutation => {
          return Array.from(mutation.addedNodes).some(node => {
            return node.nodeName === 'FORM' ||
              (node.nodeType === Node.ELEMENT_NODE && node.querySelector('form, input, select, textarea'));
          });
        });

        if (formAdded) {
          // Wait a bit for the form to be fully loaded
          setTimeout(() => {
            detectAndHighlightForms();
          }, 500);
        }
      }
    });

    // Start observing the document
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // Handle autofill toggle
  function handleAutofillToggle() {
    if (autofillActive) {
      detectAndHighlightForms();
    } else {
      removeHighlights();
    }
  }

  // Detect forms and highlight fields
  function detectAndHighlightForms() {
    if (!currentProfile) return;

    const forms = document.querySelectorAll('form');
    const inputs = document.querySelectorAll('input, select, textarea');

    // Clear existing highlights
    removeHighlights();

    // Highlight form fields
    inputs.forEach(input => {
      const fieldType = identifyField(input);
      if (fieldType) {
        highlightField(input, fieldType);
      }
    });
  }

  // Remove field highlights
  function removeHighlights() {
    document.querySelectorAll('.loyalty-form-highlight').forEach(el => {
      el.classList.remove('loyalty-form-highlight', 'loyalty-filled-field');
    });
  }

  // Detect and fill forms
  function detectAndFillForms() {
    if (!currentProfile) return null;

    const formData = {};
    let fieldsDetected = false;

    // Get all input fields
    const inputs = document.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
      const fieldType = identifyField(input);
      if (fieldType && currentProfile[fieldType]) {
        // Track field data for confirmation
        formData[fieldType] = currentProfile[fieldType];
        fieldsDetected = true;

        // Fill the field (but don't submit yet)
        fillField(input, currentProfile[fieldType]);
        highlightField(input, fieldType, true);
      }
    });

    return fieldsDetected ? formData : null;
  }

  // Identify field type based on attributes and labels
  function identifyField(input) {
    // Skip hidden fields, submit buttons, etc.
    if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button' ||
      input.type === 'image' || input.type === 'file' || input.type === 'reset') {
      return null;
    }

    // Check name and id attributes
    const nameAttr = input.name ? input.name.toLowerCase() : '';
    const idAttr = input.id ? input.id.toLowerCase() : '';

    for (const [fieldType, patterns] of Object.entries(fieldMapping)) {
      for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'i');
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
          if (labelText.includes(pattern.toLowerCase())) {
            return fieldType;
          }
        }
      }
    }

    // Check for placeholder text
    const placeholder = input.placeholder ? input.placeholder.toLowerCase() : '';
    if (placeholder) {
      for (const [fieldType, patterns] of Object.entries(labelPatterns)) {
        for (const pattern of patterns) {
          if (placeholder.includes(pattern.toLowerCase())) {
            return fieldType;
          }
        }
      }
    }

    // No match found
    return null;
  }

  // Get label text for an input
  function getLabelTextForInput(input) {
    // Check for explicit label
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) {
        return label.textContent.trim();
      }
    }

    // Check for wrapping label
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

    // Check for nearby text nodes (previous siblings, parents)
    const prevSibling = input.previousElementSibling;
    if (prevSibling && !prevSibling.querySelector('input, select, textarea')) {
      return prevSibling.textContent.trim();
    }

    // Check for table-based forms
    if (input.parentElement && input.parentElement.tagName === 'TD') {
      const row = input.parentElement.parentElement;
      const cellIndex = Array.from(row.cells).indexOf(input.parentElement);
      if (cellIndex > 0) {
        return row.cells[cellIndex - 1].textContent.trim();
      }
    }

    return '';
  }

  // Fill a field with value
  function fillField(input, value) {
    // Handle different input types
    switch (input.type) {
      case 'checkbox':
        input.checked = !!value;
        break;

      case 'radio':
        // For radio buttons, only check if the value matches
        if (input.value && input.value.toLowerCase() === String(value).toLowerCase()) {
          input.checked = true;
        }
        break;

      case 'select-one':
        // For select dropdowns, find the option with matching text or value
        if (input.tagName === 'SELECT') {
          for (let i = 0; i < input.options.length; i++) {
            const option = input.options[i];
            if (option.value.toLowerCase() === String(value).toLowerCase() ||
              option.text.toLowerCase() === String(value).toLowerCase()) {
              input.selectedIndex = i;
              break;
            }
          }
        }
        break;

      case 'date':
        // Ensure date is in YYYY-MM-DD format
        if (value && typeof value === 'string') {
          // Try to convert from MM/DD/YYYY or DD/MM/YYYY to YYYY-MM-DD
          let formattedDate = value;

          if (value.includes('/')) {
            const parts = value.split('/');
            if (parts.length === 3) {
              // Assume MM/DD/YYYY format
              const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              const month = parts[0].padStart(2, '0');
              const day = parts[1].padStart(2, '0');
              formattedDate = `${year}-${month}-${day}`;
            }
          }

          input.value = formattedDate;
        }
        break;

      default:
        // Text inputs, textarea, etc.
        input.value = value;
    }

    // Dispatch input and change events to trigger form validation
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Highlight a field
  function highlightField(input, fieldType, filled = false) {
    input.classList.add('loyalty-form-highlight');
    if (filled) {
      input.classList.add('loyalty-filled-field');
    }

    // Add tooltip showing the identified field type
    input.setAttribute('title', `Identified as: ${fieldType}`);
  }

  // Submit the form after confirmation
  function submitForm(formData) {
    if (!formData) return false;

    // Find the form that contains the filled fields
    const filledInputs = document.querySelectorAll('.loyalty-filled-field');
    if (filledInputs.length === 0) return false;

    // Get the form containing the inputs
    let form = null;
    for (const input of filledInputs) {
      const parentForm = input.closest('form');
      if (parentForm) {
        form = parentForm;
        break;
      }
    }

    if (form) {
      // Submit the form
      form.submit();
      return true;
    } else {
      // If no form is found, look for submit buttons
      const submitButtons = [...document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, .button, [role="button"]')]
        .filter(el => {
          const text = el.textContent.toLowerCase();
          return text.includes('submit') || text.includes('join') || text.includes('sign up') ||
            text.includes('register') || text.includes('continue') || text.includes('next');
        });

      if (submitButtons.length > 0) {
        // Click the first submit button
        submitButtons[0].click();
        return true;
      }
    }

    return false;
  }

  // Check if page has a birthday field
  function hasBirthdayField() {
    const inputs = document.querySelectorAll('input, select');

    for (const input of inputs) {
      const fieldType = identifyField(input);
      if (fieldType === 'birthdate') {
        return true;
      }
    }

    return false;
  }

  // Add CSS for highlighting
  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .loyalty-form-highlight {
        border: 2px solid #4285f4 !important;
        box-shadow: 0 0 3px rgba(66, 133, 244, 0.5) !important;
        transition: all 0.2s ease-in-out !important;
      }

      .loyalty-filled-field {
        background-color: rgba(52, 168, 83, 0.1) !important;
        border-color: #34a853 !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Initialize styles
  addStyles();
})();