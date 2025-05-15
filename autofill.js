// autoFill.js - Handles form detection and auto-filling functionality

class AutoFill {
    /**
     * Initialize the AutoFill system
     * @param {Object} options - Configuration options
     * @param {Object} options.profile - User profile data for filling forms
     * @param {Object} options.settings - Settings for field detection
     */
    constructor(options = {}) {
        this.profile = options.profile || {};
        this.settings = options.settings || this.getDefaultSettings();
        this.detectedFields = [];
        this.detectedForm = null;
        this.birthdayFieldDetected = false;
        this.captchaDetected = false;
        this.multiPageFormDetected = false;
    }

    /**
     * Get default settings when none are provided
     * @returns {Object} - Default settings
     */
    getDefaultSettings() {
        return {
            customKeywords: [],
            validationRules: {
                email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                phone: /^[0-9()\-\s+]+$/,
                zipCode: /^[0-9\-]+$/
            },
            highlightColor: 'rgba(97, 175, 254, 0.3)',
            highlightBorderColor: 'rgba(97, 175, 254, 1)',
            fuzzyMatchThreshold: 0.7, // 0-1 scale for fuzzy matching
            autoSubmit: false
        };
    }

    /**
     * Start form detection and autofill process
     * @returns {Promise<Object>} - Detection results
     */
    async detectAndFill() {
        // Reset detection state
        this.detectedFields = [];
        this.detectedForm = null;
        this.birthdayFieldDetected = false;
        this.captchaDetected = false;
        this.multiPageFormDetected = false;

        // Detect forms in the page
        const forms = this.detectForms();

        if (forms.length === 0) {
            return {
                success: false,
                message: 'No forms detected on this page',
                fields: []
            };
        }

        // We'll focus on the most likely form (first one with multiple fields)
        this.detectedForm = this.selectBestForm(forms);

        // Detect fields in the selected form
        this.detectedFields = this.detectFields(this.detectedForm);

        // Check for captcha
        this.captchaDetected = this.detectCaptcha();

        // Check for multi-page form
        this.multiPageFormDetected = this.detectMultiPageForm();

        // Pre-fill the detected fields
        await this.fillDetectedFields();

        return {
            success: true,
            message: `Detected ${this.detectedFields.length} fields`,
            fields: this.detectedFields,
            form: this.detectedForm,
            birthdayFieldDetected: this.birthdayFieldDetected,
            captchaDetected: this.captchaDetected,
            multiPageFormDetected: this.multiPageFormDetected
        };
    }

    /**
     * Detect forms on the page
     * @returns {Array} - Array of form elements
     */
    detectForms() {
        // Get all forms on the page
        const forms = Array.from(document.querySelectorAll('form'));

        // If no formal forms are found, try to identify div containers that might function as forms
        if (forms.length === 0) {
            const possibleFormContainers = Array.from(document.querySelectorAll('div, section')).filter(container => {
                const inputs = container.querySelectorAll('input, select, textarea');
                const button = container.querySelector('button, input[type="submit"]');
                return inputs.length >= 3 && button !== null;
            });

            if (possibleFormContainers.length > 0) {
                return possibleFormContainers;
            }
        }

        return forms;
    }

    /**
     * Select the best form from multiple detected forms
     * @param {Array} forms - Array of detected form elements
     * @returns {Element} - The best form element
     */
    selectBestForm(forms) {
        if (forms.length === 1) {
            return forms[0];
        }

        // Score each form based on various heuristics
        const scoredForms = forms.map(form => {
            let score = 0;

            // Check for relevant input types
            const inputTypes = {
                text: form.querySelectorAll('input[type="text"]').length,
                email: form.querySelectorAll('input[type="email"]').length,
                tel: form.querySelectorAll('input[type="tel"]').length,
                password: form.querySelectorAll('input[type="password"]').length,
                checkbox: form.querySelectorAll('input[type="checkbox"]').length,
                date: form.querySelectorAll('input[type="date"]').length,
                select: form.querySelectorAll('select').length
            };

            // Forms with email fields are likely to be signup/loyalty forms
            score += inputTypes.email * 3;

            // Forms with text inputs are common for signup forms
            score += inputTypes.text * 1;

            // Birth date fields are highly valuable
            score += inputTypes.date * 3;

            // Forms with password fields are likely registration forms
            score += inputTypes.password * 2;

            // Forms with submit buttons are more likely to be valid forms
            score += form.querySelectorAll('button[type="submit"], input[type="submit"]').length * 2;

            // Forms with "signup", "register", "join", "loyalty" in the text are likely loyalty program forms
            const formText = form.innerText.toLowerCase();
            const keywords = ['signup', 'sign up', 'register', 'join', 'loyalty', 'rewards', 'member', 'subscribe'];
            keywords.forEach(keyword => {
                if (formText.includes(keyword)) {
                    score += 3;
                }
            });

            return { form, score };
        });

        // Return the form with the highest score
        scoredForms.sort((a, b) => b.score - a.score);
        return scoredForms[0].form;
    }

    /**
     * Detect fields in a form
     * @param {Element} form - Form element to analyze
     * @returns {Array} - Array of detected field objects
     */
    detectFields(form) {
        if (!form) return [];

        const fields = [];
        const inputs = form.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            const fieldInfo = this.identifyField(input);

            if (fieldInfo.type !== 'unknown') {
                // Check if this field is a birthday field
                if (fieldInfo.type === 'birthday' || fieldInfo.type === 'dob' || fieldInfo.type === 'birthdate') {
                    this.birthdayFieldDetected = true;
                }

                fields.push({
                    element: input,
                    type: fieldInfo.type,
                    id: input.id,
                    name: input.name,
                    confidence: fieldInfo.confidence,
                    profileKey: fieldInfo.profileKey,
                    value: this.profile[fieldInfo.profileKey] || ''
                });
            }
        });

        return fields;
    }

    /**
     * Identify the type of a field and corresponding profile key
     * @param {Element} input - Input element to analyze
     * @returns {Object} - Field identification info
     */
    identifyField(input) {
        // Skip hidden or disabled fields
        if (input.type === 'hidden' || input.disabled) {
            return { type: 'unknown', confidence: 0, profileKey: null };
        }

        // Direct attribute matching (most reliable)
        const id = (input.id || '').toLowerCase();
        const name = (input.name || '').toLowerCase();
        const className = (input.className || '').toLowerCase();
        const placeholder = (input.placeholder || '').toLowerCase();

        // Get the label text if available
        let labelText = '';
        const labelElement = this.findLabelForInput(input);
        if (labelElement) {
            labelText = labelElement.textContent.toLowerCase().trim();
        }

        // Common field patterns
        const fieldPatterns = [
            {
                type: 'firstName',
                profileKey: 'firstName',
                patterns: ['first[_\\s-]*name', 'first', 'fname', 'given[_\\s-]*name', 'forename'],
                keywords: ['first name', 'first', 'given name']
            },
            {
                type: 'lastName',
                profileKey: 'lastName',
                patterns: ['last[_\\s-]*name', 'last', 'lname', 'surname', 'family[_\\s-]*name'],
                keywords: ['last name', 'last', 'surname', 'family name']
            },
            {
                type: 'email',
                profileKey: 'email',
                patterns: ['email', 'e[_\\s-]*mail', 'email[_\\s-]*address'],
                keywords: ['email', 'e-mail', 'email address']
            },
            {
                type: 'phone',
                profileKey: 'phone',
                patterns: ['phone', 'telephone', 'mobile', 'cell', 'phone[_\\s-]*number'],
                keywords: ['phone', 'telephone', 'mobile', 'cell', 'phone number']
            },
            {
                type: 'birthday',
                profileKey: 'birthday',
                patterns: ['birth[_\\s-]*day', 'birth[_\\s-]*date', 'dob', 'date[_\\s-]*of[_\\s-]*birth', 'birthday'],
                keywords: ['birthday', 'birth date', 'date of birth', 'dob']
            },
            {
                type: 'address',
                profileKey: 'address',
                patterns: ['address', 'street', 'street[_\\s-]*address', 'addr'],
                keywords: ['address', 'street', 'street address']
            },
            {
                type: 'city',
                profileKey: 'city',
                patterns: ['city', 'town', 'municipality'],
                keywords: ['city', 'town']
            },
            {
                type: 'state',
                profileKey: 'state',
                patterns: ['state', 'province', 'region'],
                keywords: ['state', 'province', 'region']
            },
            {
                type: 'zipCode',
                profileKey: 'zipCode',
                patterns: ['zip', 'postal[_\\s-]*code', 'zip[_\\s-]*code', 'postcode'],
                keywords: ['zip', 'postal code', 'zip code', 'postcode']
            },
            {
                type: 'country',
                profileKey: 'country',
                patterns: ['country', 'nation'],
                keywords: ['country', 'nation']
            }
        ];

        // Add custom keywords from settings
        if (this.settings.customKeywords && this.settings.customKeywords.length > 0) {
            this.settings.customKeywords.forEach(customKeyword => {
                const existingIndex = fieldPatterns.findIndex(pattern => pattern.type === customKeyword.type);
                if (existingIndex >= 0) {
                    fieldPatterns[existingIndex].keywords.push(...customKeyword.keywords);
                } else {
                    fieldPatterns.push({
                        type: customKeyword.type,
                        profileKey: customKeyword.profileKey || customKeyword.type,
                        patterns: customKeyword.patterns || [customKeyword.type],
                        keywords: customKeyword.keywords || []
                    });
                }
            });
        }

        // Check each field pattern
        for (const pattern of fieldPatterns) {
            let confidence = 0;

            // Check element attributes
            for (const patternRegex of pattern.patterns) {
                const regex = new RegExp(patternRegex, 'i');

                if (regex.test(id)) confidence = Math.max(confidence, 0.9);
                if (regex.test(name)) confidence = Math.max(confidence, 0.9);
                if (regex.test(className)) confidence = Math.max(confidence, 0.7);
                if (regex.test(placeholder)) confidence = Math.max(confidence, 0.8);
            }

            // Check input type
            if (input.type === 'email' && pattern.type === 'email') confidence = Math.max(confidence, 0.95);
            if (input.type === 'tel' && pattern.type === 'phone') confidence = Math.max(confidence, 0.95);
            if (input.type === 'date' && pattern.type === 'birthday') confidence = Math.max(confidence, 0.9);

            // Check label text
            if (labelText) {
                for (const keyword of pattern.keywords) {
                    if (labelText.includes(keyword)) {
                        confidence = Math.max(confidence, 0.85);
                        break;
                    }
                }
            }

            // If we found a match with good confidence, return the field type
            if (confidence >= this.settings.fuzzyMatchThreshold) {
                return {
                    type: pattern.type,
                    confidence: confidence,
                    profileKey: pattern.profileKey
                };
            }
        }

        // No match found
        return { type: 'unknown', confidence: 0, profileKey: null };
    }

    /**
     * Find label element associated with an input
     * @param {Element} input - Input element
     * @returns {Element|null} - Associated label or null if not found
     */
    findLabelForInput(input) {
        // First try the 'for' attribute (most reliable)
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label;
        }

        // Check for parent label (wrapped input)
        let parent = input.parentElement;
        while (parent && parent.tagName !== 'FORM' && parent.tagName !== 'BODY') {
            if (parent.tagName === 'LABEL') {
                return parent;
            }
            parent = parent.parentElement;
        }

        // Look for nearby labels (less reliable)
        const inputRect = input.getBoundingClientRect();
        const labels = Array.from(document.querySelectorAll('label'));

        // Sort labels by proximity to input
        labels.sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();

            const distA = Math.sqrt(
                Math.pow(rectA.left - inputRect.left, 2) +
                Math.pow(rectA.top - inputRect.top, 2)
            );

            const distB = Math.sqrt(
                Math.pow(rectB.left - inputRect.left, 2) +
                Math.pow(rectB.top - inputRect.top, 2)
            );

            return distA - distB;
        });

        // Return the closest label if it's reasonably close (within 100px)
        if (labels.length > 0) {
            const closestLabel = labels[0];
            const rect = closestLabel.getBoundingClientRect();
            const distance = Math.sqrt(
                Math.pow(rect.left - inputRect.left, 2) +
                Math.pow(rect.top - inputRect.top, 2)
            );

            if (distance < 100) {
                return closestLabel;
            }
        }

        return null;
    }

    /**
     * Check if a captcha is present in the form
     * @returns {boolean} - Whether a captcha was detected
     */
    detectCaptcha() {
        if (!this.detectedForm) return false;

        // Common captcha identifiers
        const captchaIdentifiers = [
            'captcha',
            'recaptcha',
            'g-recaptcha',
            'h-captcha',
            'cf-turnstile'
        ];

        // Check for common captcha elements
        for (const identifier of captchaIdentifiers) {
            const elements = this.detectedForm.querySelectorAll(`[class*="${identifier}"], [id*="${identifier}"], iframe[src*="${identifier}"]`);
            if (elements.length > 0) {
                return true;
            }
        }

        // Check for captcha images
        const images = this.detectedForm.querySelectorAll('img');
        for (const img of images) {
            const src = img.src.toLowerCase();
            const alt = (img.alt || '').toLowerCase();

            if (src.includes('captcha') || alt.includes('captcha')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if the form appears to be multi-page
     * @returns {boolean} - Whether a multi-page form was detected
     */
    detectMultiPageForm() {
        if (!this.detectedForm) return false;

        // Look for pagination indicators
        const paginationIndicators = [
            'step',
            'page',
            'wizard',
            'multi-step',
            'pagination',
            'progress-bar',
            'progress-indicator'
        ];

        for (const indicator of paginationIndicators) {
            const elements = this.detectedForm.querySelectorAll(`[class*="${indicator}"], [id*="${indicator}"]`);
            if (elements.length > 0) {
                return true;
            }
        }

        // Check for "next" or "continue" buttons instead of submit
        const buttons = this.detectedForm.querySelectorAll('button, input[type="button"]');
        for (const button of buttons) {
            const text = button.textContent.toLowerCase() || button.value?.toLowerCase() || '';

            if (text.includes('next') || text.includes('continue') || text.includes('proceed')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Fill detected form fields with profile data
     * @returns {Promise<void>}
     */
    async fillDetectedFields() {
        if (!this.detectedFields.length) return;

        for (const field of this.detectedFields) {
            if (field.value && field.element) {
                this.fillField(field.element, field.value);
                this.highlightField(field.element);
            }
        }
    }

    /**
     * Fill a specific field with a value
     * @param {Element} element - Input element
     * @param {string} value - Value to fill
     */
    fillField(element, value) {
        // Different handling based on element type
        if (element.tagName === 'SELECT') {
            // For select elements, find the option that matches the value
            const options = Array.from(element.options);

            // Try to find an exact match
            const exactMatch = options.find(option =>
                option.value.toLowerCase() === value.toLowerCase() ||
                option.textContent.toLowerCase() === value.toLowerCase()
            );

            if (exactMatch) {
                element.value = exactMatch.value;
            } else {
                // Try to find a partial match
                const partialMatch = options.find(option =>
                    option.value.toLowerCase().includes(value.toLowerCase()) ||
                    option.textContent.toLowerCase().includes(value.toLowerCase())
                );

                if (partialMatch) {
                    element.value = partialMatch.value;
                }
            }
        } else if (element.type === 'checkbox') {
            // For checkboxes, check if the value is truthy
            element.checked = !!value;
        } else if (element.type === 'radio') {
            // For radio buttons, check if the value matches
            element.checked = element.value.toLowerCase() === value.toLowerCase();
        } else if (element.type === 'date') {
            // For date inputs, format the date correctly
            try {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    // Format as YYYY-MM-DD for date inputs
                    const year = date.getFullYear();
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const day = date.getDate().toString().padStart(2, '0');
                    element.value = `${year}-${month}-${day}`;
                }
            } catch (e) {
                console.error('Error formatting date:', e);
            }
        } else {
            // For text inputs, just set the value
            element.value = value;
        }

        // Dispatch events to trigger any listeners
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Highlight a field to show it's been filled
     * @param {Element} element - Input element to highlight
     */
    highlightField(element) {
        const originalBackgroundColor = element.style.backgroundColor;
        const originalBorder = element.style.border;

        // Store original styles so we can restore them
        element.dataset.originalBackgroundColor = originalBackgroundColor;
        element.dataset.originalBorder = originalBorder;

        // Apply highlight styles
        element.style.backgroundColor = this.settings.highlightColor;
        element.style.border = `1px solid ${this.settings.highlightBorderColor}`;

        // Add a subtle transition
        element.style.transition = 'background-color 0.3s, border 0.3s';

        // Remove highlight after 1.5 seconds
        setTimeout(() => {
            element.style.backgroundColor = element.dataset.originalBackgroundColor;
            element.style.border = element.dataset.originalBorder;

            // Clean up after transition
            setTimeout(() => {
                element.style.transition = '';
            }, 300);
        }, 1500);
    }

    /**
     * Submit the form if autoSubmit is enabled
     * @returns {Promise<boolean>} - Whether submission was attempted
     */
    async submitForm() {
        if (!this.detectedForm || !this.settings.autoSubmit) {
            return false;
        }

        // Don't auto-submit if captcha detected
        if (this.captchaDetected) {
            return false;
        }

        // Find the submit button
        const submitButton = this.detectedForm.querySelector('button[type="submit"], input[type="submit"]');

        if (submitButton) {
            submitButton.click();
            return true;
        }

        // If no submit button found, try form.submit()
        if (typeof this.detectedForm.submit === 'function') {
            try {
                this.detectedForm.submit();
                return true;
            } catch (e) {
                console.error('Error submitting form:', e);
                return false;
            }
        }

        return false;
    }

    /**
     * Get a summary of the form detection and autofill process
     * @returns {Object} - Detection summary
     */
    getSummary() {
        return {
            formDetected: !!this.detectedForm,
            fieldsDetected: this.detectedFields.length,
            birthdayFieldDetected: this.birthdayFieldDetected,
            captchaDetected: this.captchaDetected,
            multiPageFormDetected: this.multiPageFormDetected,
            domain: window.location.hostname
        };
    }
}

// Export the AutoFill class
export default AutoFill;