/**
 * Content script for Loyalty Program Autofill & Tracker
 * Handles form detection, field matching, and autofill functionality
 */

// Global constants for form field detection
const FIELD_TYPES = {
  FIRST_NAME: 'firstName',
  LAST_NAME: 'lastName',
  EMAIL: 'email',
  BIRTHDAY: 'birthday',
  PHONE: 'phone',
  ADDRESS: 'address',
  CITY: 'city',
  STATE: 'state',
  ZIP: 'zip'
};

const FIELD_KEYWORDS = {
  [FIELD_TYPES.FIRST_NAME]: ['first name', 'firstname', 'given name', 'fname'],
  [FIELD_TYPES.LAST_NAME]: ['last name', 'lastname', 'surname', 'lname', 'family name'],
  [FIELD_TYPES.EMAIL]: ['email', 'e-mail', 'mail'],
  [FIELD_TYPES.BIRTHDAY]: ['birthday', 'birth date', 'date of birth', 'dob', 'bday', 'birth day'],
  [FIELD_TYPES.PHONE]: ['phone', 'mobile', 'cell', 'telephone'],
  [FIELD_TYPES.ADDRESS]: ['address', 'street', 'addr'],
  [FIELD_TYPES.CITY]: ['city', 'town'],
  [FIELD_TYPES.STATE]: ['state', 'province', 'region'],
  [FIELD_TYPES.ZIP]: ['zip', 'postal', 'postcode', 'zip code']
};

const FORM_ATTRIBUTES = ['name', 'id', 'class', 'aria-label', 'placeholder'];

let highlightedElements = [];
let userProfile = null;
let manualOverride = false;

/**
 * Initializes the content script
 */
function init() {
  // Listen for messages from popup or background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'scanForForms':
        const formInfo = scanForForms();
        sendResponse({ formInfo });
        break;
      case 'autofill':
        userProfile = message.profile;
        manualOverride = message.manualOverride || false;
        autofillForms(message.profile);
        sendResponse({ success: true });
        break;
      case 'submitForm':
        submitForm(message.formSelector);
        sendResponse({ success: true });
        break;
      case 'clearHighlights':
        clearHighlights();
        sendResponse({ success: true });
        break;
    }
    return true; // Keep the message channel open for async response
  });
}

/**
 * Scans the page for forms and identifies fillable fields
 * @returns {Object} Information about detected forms and fields
 */
function scanForForms() {
  const forms = document.querySelectorAll('form');
  const formlessInputs = document.querySelectorAll('input:not(form input), select:not(form select), textarea:not(form textarea)');

  const formData = [];

  // Process regular forms
  forms.forEach((form, formIndex) => {
    const formInfo = analyzeForm(form, formIndex);
    if (formInfo.fields.length > 0) {
      formData.push(formInfo);
    }
  });

  // Process formless inputs (common in modern websites)
  if (formlessInputs.length > 0) {
    const formlessInfo = {
      id: 'formless-inputs',
      selector: 'formless',
      fields: []
    };

    formlessInputs.forEach(input => {
      const fieldType = identifyFieldType(input);
      if (fieldType) {
        formlessInfo.fields.push({
          element: input,
          type: fieldType,
          id: input.id || '',
          name: input.name || ''
        });
      }
    });

    if (formlessInfo.fields.length > 0) {
      formData.push(formlessInfo);
    }
  }

  return {
    totalForms: formData.length,
    forms: formData,
    hasBirthdayField: formData.some(form => form.fields.some(field => field.type === FIELD_TYPES.BIRTHDAY)),
    currentUrl: window.location.href,
    domain: window.location.hostname
  };
}

/**
 * Analyzes a form to extract its fields and detect their types
 * @param {HTMLElement} form The form element to analyze
 * @param {Number} formIndex Index of the form on the page
 * @returns {Object} Form information including detected fields
 */
function analyzeForm(form, formIndex) {
  const formInfo = {
    id: form.id || `form-${formIndex}`,
    selector: form.id ? `#${form.id}` : `form:nth-of-type(${formIndex + 1})`,
    fields: []
  };

  // Get all input, select, and textarea elements
  const inputElements = form.querySelectorAll('input, select, textarea');

  inputElements.forEach(input => {
    const fieldType = identifyFieldType(input);

    if (fieldType) {
      formInfo.fields.push({
        element: input,
        type: fieldType,
        id: input.id || '',
        name: input.name || ''
      });
    }
  });

  return formInfo;
}

/**
 * Identifies the type of a form field based on attributes and surrounding text
 * @param {HTMLElement} element The form field element
 * @returns {String|null} The identified field type or null if not identified
 */
function identifyFieldType(element) {
  // Skip hidden, submit, button inputs
  if (element.type === 'hidden' || element.type === 'submit' || element.type === 'button') {
    return null;
  }

  // Check through attributes like name, id, placeholder
  for (const attr of FORM_ATTRIBUTES) {
    if (!element[attr]) continue;

    const attrValue = element[attr].toLowerCase();
    for (const [fieldType, keywords] of Object.entries(FIELD_KEYWORDS)) {
      if (keywords.some(keyword => attrValue.includes(keyword))) {
        return fieldType;
      }
    }
  }

  // Check for associated label text
  const labelElement = findLabelForElement(element);
  if (labelElement) {
    const labelText = labelElement.textContent.toLowerCase();
    for (const [fieldType, keywords] of Object.entries(FIELD_KEYWORDS)) {
      if (keywords.some(keyword => labelText.includes(keyword))) {
        return fieldType;
      }
    }
  }

  // Check for placeholder text
  if (element.placeholder) {
    const placeholderText = element.placeholder.toLowerCase();
    for (const [fieldType, keywords] of Object.entries(FIELD_KEYWORDS)) {
      if (keywords.some(keyword => placeholderText.includes(keyword))) {
        return fieldType;
      }
    }
  }

  // Implement fuzzy matching for more complex cases
  // This is a simple implementation, consider using a proper fuzzy matching library
  for (const [fieldType, keywords] of Object.entries(FIELD_KEYWORDS)) {
    // Check nearby text nodes
    const nearbyText = getNearbyText(element).toLowerCase();
    if (keywords.some(keyword => nearbyText.includes(keyword))) {
      return fieldType;
    }
  }

  return null;
}

/**
 * Finds the label element associated with a form field
 * @param {HTMLElement} element The form field element
 * @returns {HTMLElement|null} The associated label element or null
 */
function findLabelForElement(element) {
  // Check for explicit label with 'for' attribute
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label;
  }

  // Check for implicit label (element is inside a label)
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === 'LABEL') {
      return parent;
    }
    parent = parent.parentElement;
  }

  return null;
}

/**
 * Gets text surrounding a form field element
 * @param {HTMLElement} element The form field element
 * @returns {String} Concatenated nearby text
 */
function getNearbyText(element) {
  // Get the parent element to look for nearby text nodes
  const parent = element.parentElement;
  if (!parent) return '';

  // Get all text nodes within the parent
  const textNodes = [];
  const walker = document.createTreeWalker(
    parent,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    // Skip empty text nodes
    if (node.nodeValue.trim()) {
      textNodes.push(node.nodeValue);
    }
  }

  return textNodes.join(' ');
}

/**
 * Autofills forms with the provided profile data
 * @param {Object} profile User profile data
 */
function autofillForms(profile) {
  clearHighlights();

  const formInfo = scanForForms();
  let hasBirthdayField = false;

  formInfo.forms.forEach(form => {
    form.fields.forEach(field => {
      let value = '';

      switch (field.type) {
        case FIELD_TYPES.FIRST_NAME:
          value = profile.firstName || '';
          break;
        case FIELD_TYPES.LAST_NAME:
          value = profile.lastName || '';
          break;
        case FIELD_TYPES.EMAIL:
          value = profile.email || '';
          break;
        case FIELD_TYPES.BIRTHDAY:
          hasBirthdayField = true;
          value = formatBirthday(profile.birthday, field.element);
          break;
        case FIELD_TYPES.PHONE:
          value = profile.phone || '';
          break;
        case FIELD_TYPES.ADDRESS:
          value = profile.address || '';
          break;
        case FIELD_TYPES.CITY:
          value = profile.city || '';
          break;
        case FIELD_TYPES.STATE:
          value = profile.state || '';
          break;
        case FIELD_TYPES.ZIP:
          value = profile.zip || '';
          break;
      }

      if (value) {
        fillField(field.element, value);
        highlightElement(field.element, field.type, value);
      }
    });
  });

  // Notify the background script about the form submission details
  chrome.runtime.sendMessage({
    action: 'updateTracker',
    data: {
      domain: window.location.hostname,
      url: window.location.href,
      date: new Date().toISOString(),
      hasBirthdayField: hasBirthdayField,
      rewardLikelihood: hasBirthdayField ? 'high' : 'low'
    }
  });
}

/**
 * Formats a birthday value based on the target input type
 * @param {String} birthday Birthday in ISO format (YYYY-MM-DD)
 * @param {HTMLElement} element The target form field element
 * @returns {String} Properly formatted birthday
 */
function formatBirthday(birthday, element) {
  if (!birthday) return '';

  try {
    const date = new Date(birthday);

    // For date inputs, return ISO format
    if (element.type === 'date') {
      return birthday; // Already in YYYY-MM-DD format
    }

    // For select elements (typically separate month/day/year dropdowns)
    if (element.tagName === 'SELECT') {
      // Try to determine if this is month, day, or year select
      const id = (element.id || '').toLowerCase();
      const name = (element.name || '').toLowerCase();

      if (id.includes('month') || name.includes('month')) {
        return (date.getMonth() + 1).toString(); // Month as number (1-12)
      } else if (id.includes('day') || name.includes('day')) {
        return date.getDate().toString(); // Day of month (1-31)
      } else if (id.includes('year') || name.includes('year')) {
        return date.getFullYear().toString(); // Full year (e.g., 1990)
      }
    }

    // Default to MM/DD/YYYY format for text inputs
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${month}/${day}/${year}`;
  } catch (error) {
    console.error('Error formatting birthday:', error);
    return birthday;
  }
}

/**
 * Fills a form field with the provided value
 * @param {HTMLElement} element The form field element
 * @param {String} value The value to fill
 */
function fillField(element, value) {
  if (!element) return;

  // Handle different input types
  if (element.tagName === 'SELECT') {
    // For select elements, find the matching option
    const options = Array.from(element.options);
    const option = options.find(opt =>
      opt.value.toLowerCase() === value.toLowerCase() ||
      opt.text.toLowerCase() === value.toLowerCase()
    );

    if (option) {
      element.value = option.value;
    } else if (options.length > 0 && manualOverride) {
      // With manual override, try best effort matching
      for (const opt of options) {
        if (opt.value.includes(value) || opt.text.includes(value) ||
          value.includes(opt.value) || value.includes(opt.text)) {
          element.value = opt.value;
          break;
        }
      }
    }
  } else if (element.type === 'checkbox') {
    // For checkboxes, check if value is truthy
    element.checked = Boolean(value);
  } else if (element.type === 'radio') {
    // For radio buttons, check if value matches
    element.checked = element.value.toLowerCase() === value.toLowerCase();
  } else {
    // For text inputs, textareas, etc.
    element.value = value;
  }

  // Trigger events to ensure the site's JavaScript recognizes the change
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Highlights a form field to show it's been identified and filled
 * @param {HTMLElement} element The form field element
 * @param {String} fieldType The type of field
 * @param {String} value The value filled
 */
function highlightElement(element, fieldType, value) {
  // Create a highlight effect
  const originalBorder = element.style.border;
  const originalBackground = element.style.backgroundColor;

  // Different colors for different field types
  let highlightColor;
  switch (fieldType) {
    case FIELD_TYPES.BIRTHDAY:
      highlightColor = 'rgba(50, 205, 50, 0.2)'; // Green for birthday fields
      break;
    case FIELD_TYPES.EMAIL:
      highlightColor = 'rgba(30, 144, 255, 0.2)'; // Blue for email
      break;
    default:
      highlightColor = 'rgba(255, 165, 0, 0.2)'; // Orange for others
  }

  element.style.border = `2px solid ${highlightColor.replace('0.2', '0.8')}`;
  element.style.backgroundColor = highlightColor;

  // Create tooltip to show field type and value
  const tooltip = document.createElement('div');
  tooltip.textContent = `${fieldType}: ${value}`;
  tooltip.style.position = 'absolute';
  tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  tooltip.style.color = 'white';
  tooltip.style.padding = '5px';
  tooltip.style.borderRadius = '3px';
  tooltip.style.fontSize = '12px';
  tooltip.style.zIndex = '10000';
  tooltip.style.pointerEvents = 'none';

  // Position the tooltip above the element
  const rect = element.getBoundingClientRect();
  tooltip.style.top = `${rect.top - 30 + window.scrollY}px`;
  tooltip.style.left = `${rect.left + window.scrollX}px`;

  document.body.appendChild(tooltip);

  // Add to the list of highlighted elements for later cleanup
  highlightedElements.push({
    element,
    originalBorder,
    originalBackground,
    tooltip
  });

  // Set timeout to remove highlight after 5 seconds
  setTimeout(() => {
    // Check if element is still in highlightedElements before removing
    const index = highlightedElements.findIndex(item => item.element === element);
    if (index !== -1) {
      const { element, originalBorder, originalBackground, tooltip } = highlightedElements[index];
      element.style.border = originalBorder;
      element.style.backgroundColor = originalBackground;
      tooltip.remove();
      highlightedElements.splice(index, 1);
    }
  }, 5000);
}

/**
 * Clears all highlighting and tooltips
 */
function clearHighlights() {
  highlightedElements.forEach(({ element, originalBorder, originalBackground, tooltip }) => {
    if (element) {
      element.style.border = originalBorder;
      element.style.backgroundColor = originalBackground;
    }
    if (tooltip) {
      tooltip.remove();
    }
  });

  highlightedElements = [];
}

/**
 * Submits a form after confirmation
 * @param {String} formSelector The selector for the form to submit
 */
function submitForm(formSelector) {
  // Look for captcha elements
  const potentialCaptchas = document.querySelectorAll(
    '[class*="captcha"], [id*="captcha"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]'
  );

  if (potentialCaptchas.length > 0) {
    // Notify user about captcha
    chrome.runtime.sendMessage({
      action: 'captchaDetected',
      url: window.location.href
    });
    return; // Don't submit automatically
  }

  let form;
  if (formSelector === 'formless') {
    // For formless inputs, find a submit button
    const submitButtons = Array.from(document.querySelectorAll('button, input[type="submit"]'))
      .filter(el => {
        const text = el.textContent.toLowerCase();
        return text.includes('submit') || text.includes('sign up') ||
          text.includes('register') || text.includes('join');
      });

    if (submitButtons.length > 0) {
      submitButtons[0].click();
    }
  } else {
    form = document.querySelector(formSelector);
    if (form) {
      // Try to find the submit button in the form
      const submitButton = form.querySelector('input[type="submit"], button[type="submit"]');
      if (submitButton) {
        submitButton.click();
      } else {
        form.submit();
      }
    }
  }

  // Track submission regardless of method
  chrome.runtime.sendMessage({
    action: 'formSubmitted',
    url: window.location.href,
    domain: window.location.hostname
  });
}

/**
 * Detects if the page has pagination for multi-page forms
 * @returns {Boolean} True if pagination is detected
 */
function detectPagination() {
  // Common pagination indicators
  const paginationSelectors = [
    '.pagination',
    '[role="progressbar"]',
    '.progress-indicator',
    '.step-indicator',
    'ul.steps',
    '[class*="step"][class*="indicator"]'
  ];

  return paginationSelectors.some(selector => document.querySelector(selector) !== null);
}

// Initialize the content script
init();