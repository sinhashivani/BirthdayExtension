/**
 * FormValidator.js - Validates form fields before submission
 * Handles validation rules for different types of form fields
 */

class FormValidator {
    /**
     * Initialize the validator with custom rules
     * @param {Object} customRules - User-defined validation rules
     */
    constructor(customRules = {}) {
        this.rules = {
            // Default validation rules
            email: {
                regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Please enter a valid email address'
            },
            phone: {
                regex: /^\+?[\d\s()-]{10,15}$/,
                message: 'Please enter a valid phone number'
            },
            zipcode: {
                regex: /^\d{5}(-\d{4})?$/,
                message: 'Please enter a valid ZIP code'
            },
            date: {
                // Matches formats like MM/DD/YYYY, MM-DD-YYYY, etc.
                regex: /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
                message: 'Please enter a valid date format (MM/DD/YYYY)'
            },
            // Merge with custom rules
            ...customRules
        };
    }

    /**
     * Add a new validation rule
     * @param {string} fieldType - Type of field to validate
     * @param {RegExp} regex - Regular expression for validation
     * @param {string} message - Error message for failed validation
     */
    addRule(fieldType, regex, message) {
        this.rules[fieldType] = { regex, message };
    }

    /**
     * Validate a form field based on its type
     * @param {string} fieldType - Type of field to validate
     * @param {string} value - Value to validate
     * @returns {Object} Validation result {valid: boolean, message: string}
     */
    validate(fieldType, value) {
        // Handle empty values based on required flag
        if (!value || value.trim() === '') {
            return { valid: false, message: 'This field is required' };
        }

        const rule = this.rules[fieldType];

        // If no rule exists for this type, assume valid
        if (!rule) {
            return { valid: true, message: '' };
        }

        // Apply the regex validation
        const isValid = rule.regex.test(value);
        return {
            valid: isValid,
            message: isValid ? '' : rule.message
        };
    }

    /**
     * Validate an entire form data object
     * @param {Object} formData - Object with field types as keys and values to validate
     * @returns {Object} Validation results {valid: boolean, errors: Object}
     */
    validateForm(formData) {
        const errors = {};
        let isValid = true;

        for (const [fieldType, value] of Object.entries(formData)) {
            const result = this.validate(fieldType, value);
            if (!result.valid) {
                errors[fieldType] = result.message;
                isValid = false;
            }
        }

        return {
            valid: isValid,
            errors
        };
    }

    /**
     * Get the rules for a specific field type
     * @param {string} fieldType - Type of field
     * @returns {Object|null} The rule object or null if not found
     */
    getRule(fieldType) {
        return this.rules[fieldType] || null;
    }

    /**
     * Get all validation rules
     * @returns {Object} All validation rules
     */
    getAllRules() {
        return { ...this.rules };
    }
}

// Export the FormValidator class
export default FormValidator;