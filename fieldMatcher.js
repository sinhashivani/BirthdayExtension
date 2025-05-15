/**
 * FieldMatcher.js - Handles fuzzy matching for form field detection
 * Uses various strategies to match form fields to user profile data
 */

class FieldMatcher {
    /**
     * Initialize the field matcher with custom field mappings
     * @param {Object} customMappings - User-defined field mappings
     */
    constructor(customMappings = {}) {
        // Default field mappings for common form fields
        this.fieldMappings = {
            firstName: ['first_name', 'firstname', 'fname', 'givenname', 'given_name', 'first'],
            lastName: ['last_name', 'lastname', 'lname', 'surname', 'familyname', 'family_name', 'last'],
            email: ['email', 'email_address', 'emailaddress', 'e-mail', 'mail'],
            phone: ['phone', 'telephone', 'phone_number', 'phonenumber', 'mobile', 'cell', 'cellphone'],
            birthDate: ['birth_date', 'birthdate', 'dob', 'date_of_birth', 'birthday', 'bday', 'birth_day'],
            birthMonth: ['birth_month', 'birthmonth', 'dobmonth', 'bmonth'],
            birthDay: ['birth_day', 'birthday', 'dobday', 'bday'],
            birthYear: ['birth_year', 'birthyear', 'dobyear', 'byear'],
            address: ['address', 'street_address', 'addr', 'street', 'address1', 'address_line1'],
            city: ['city', 'town', 'locality'],
            state: ['state', 'province', 'region', 'administrative_area'],
            zipCode: ['zip', 'zipcode', 'zip_code', 'postal', 'postal_code', 'postcode'],
            country: ['country', 'nation', 'country_code'],
            // Merge with custom mappings
            ...customMappings
        };

        // Common labels that might appear next to form fields
        this.labelMappings = {
            firstName: ['First Name', 'Given Name', 'First'],
            lastName: ['Last Name', 'Family Name', 'Surname', 'Last'],
            email: ['Email', 'Email Address', 'E-mail'],
            phone: ['Phone', 'Phone Number', 'Telephone', 'Mobile', 'Cell'],
            birthDate: ['Birth Date', 'Date of Birth', 'Birthday', 'DOB'],
            birthMonth: ['Birth Month', 'Month of Birth'],
            birthDay: ['Birth Day', 'Day of Birth'],
            birthYear: ['Birth Year', 'Year of Birth'],
            address: ['Address', 'Street Address', 'Mailing Address'],
            city: ['City', 'Town'],
            state: ['State', 'Province', 'Region'],
            zipCode: ['ZIP Code', 'Postal Code', 'ZIP'],
            country: ['Country', 'Nation']
        };

        // Initialize keywords from the mappings for faster lookups
        this._initializeKeywords();
    }

    /**
     * Add a custom field mapping
     * @param {string} profileField - The profile field name
     * @param {Array} formFieldNames - Array of possible form field names
     * @param {Array} labelNames - Array of possible label texts
     */
    addFieldMapping(profileField, formFieldNames = [], labelNames = []) {
        if (!this.fieldMappings[profileField]) {
            this.fieldMappings[profileField] = [];
        }

        if (!this.labelMappings[profileField]) {
            this.labelMappings[profileField] = [];
        }

        this.fieldMappings[profileField] = [
            ...this.fieldMappings[profileField],
            ...formFieldNames
        ];

        this.labelMappings[profileField] = [
            ...this.labelMappings[profileField],
            ...labelNames
        ];

        // Update keywords after adding new mappings
        this._initializeKeywords();
    }

    /**
     * Initialize keywords from mappings for faster lookups
     * @private
     */
    _initializeKeywords() {
        this.fieldKeywords = {};
        this.labelKeywords = {};

        // Process field mappings
        for (const [profileField, formFields] of Object.entries(this.fieldMappings)) {
            formFields.forEach(formField => {
                this.fieldKeywords[formField.toLowerCase()] = profileField;
            });
        }

        // Process label mappings
        for (const [profileField, labels] of Object.entries(this.labelMappings)) {
            labels.forEach(label => {
                this.labelKeywords[label.toLowerCase()] = profileField;
            });
        }
    }

    /**
     * Match a form field to a user profile field
     * @param {HTMLElement} field - The form field element
     * @returns {string|null} The matched profile field or null if no match
     */
    matchField(field) {
        // Try to match by ID or name attributes
        const idMatch = this.matchByAttribute(field.id);
        if (idMatch) return idMatch;

        const nameMatch = this.matchByAttribute(field.name);
        if (nameMatch) return nameMatch;

        // Try to match by class attribute
        const classMatch = this.matchByAttribute(field.className);
        if (classMatch) return classMatch;

        // Try to match by placeholder text
        if (field.placeholder) {
            const placeholderMatch = this.matchByText(field.placeholder);
            if (placeholderMatch) return placeholderMatch;
        }

        // Try to match by associated label
        const labelMatch = this.matchByLabel(field);
        if (labelMatch) return labelMatch;

        // Try to match by nearby text content
        const nearbyTextMatch = this.matchByNearbyText(field);
        if (nearbyTextMatch) return nearbyTextMatch;

        // No match found
        return null;
    }

    /**
     * Match a field by its attribute value
     * @param {string} attributeValue - The attribute value to match
     * @returns {string|null} The matched profile field or null if no match
     */
    matchByAttribute(attributeValue) {
        if (!attributeValue) return null;

        // Convert to lowercase and remove non-alphanumeric characters
        const normalizedValue = attributeValue.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Try exact match first
        if (this.fieldKeywords[normalizedValue]) {
            return this.fieldKeywords[normalizedValue];
        }

        // Try fuzzy match by checking if any keyword is contained in the attribute
        for (const [keyword, profileField] of Object.entries(this.fieldKeywords)) {
            if (normalizedValue.includes(keyword)) {
                return profileField;
            }
        }

        return null;
    }

    /**
     * Match a field by text content
     * @param {string} text - The text to match
     * @returns {string|null} The matched profile field or null if no match
     */
    matchByText(text) {
        if (!text) return null;

        const normalizedText = text.toLowerCase();

        // Try exact match first
        if (this.labelKeywords[normalizedText]) {
            return this.labelKeywords[normalizedText];
        }

        // Try fuzzy match by checking if any keyword is contained in the text
        for (const [keyword, profileField] of Object.entries(this.labelKeywords)) {
            if (normalizedText.includes(keyword.toLowerCase())) {
                return profileField;
            }
        }

        return null;
    }

    /**
     * Match a field by its associated label
     * @param {HTMLElement} field - The form field element
     * @returns {string|null} The matched profile field or null if no match
     */
    matchByLabel(field) {
        // Try to find label by for attribute
        if (field.id) {
            const label = document.querySelector(`label[for="${field.id}"]`);
            if (label && label.textContent) {
                return this.matchByText(label.textContent.trim());
            }
        }

        // Try to find parent label
        let parent = field.parentElement;
        while (parent) {
            if (parent.tagName === 'LABEL' && parent.textContent) {
                return this.matchByText(parent.textContent.trim());
            }
            parent = parent.parentElement;
        }

        return null;
    }

    /**
     * Match a field by text nearby in the DOM
     * @param {HTMLElement} field - The form field element
     * @returns {string|null} The matched profile field or null if no match
     */
    matchByNearbyText(field) {
        // Get all text nodes within a certain distance of the field
        const nearbyTextNodes = this._getNearbyTextNodes(field);

        // Try to match by text content
        for (const node of nearbyTextNodes) {
            const match = this.matchByText(node.textContent.trim());
            if (match) return match;
        }

        return null;
    }

    /**
     * Get text nodes nearby a field element
     * @param {HTMLElement} field - The form field element
     * @param {number} maxDistance - Maximum distance to search (in siblings)
     * @returns {Array} Array of text nodes
     * @private
     */
    _getNearbyTextNodes(field, maxDistance = 3) {
        const textNodes = [];

        // Check previous siblings
        let current = field.previousSibling;
        let distance = 0;

        while (current && distance < maxDistance) {
            if (current.nodeType === Node.TEXT_NODE && current.textContent.trim()) {
                textNodes.push(current);
            } else if (current.nodeType === Node.ELEMENT_NODE) {
                // Add all text nodes from this element
                const nodeTextContents = Array.from(current.childNodes)
                    .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());

                textNodes.push(...nodeTextContents);
            }

            current = current.previousSibling;
            distance++;
        }

        // Check parent's previous siblings
        if (field.parentElement) {
            current = field.parentElement.previousSibling;
            distance = 0;

            while (current && distance < maxDistance) {
                if (current.nodeType === Node.TEXT_NODE && current.textContent.trim()) {
                    textNodes.push(current);
                }

                current = current.previousSibling;
                distance++;
            }
        }

        return textNodes;
    }

    /**
     * Check if a field is a birth date related field
     * @param {string} profileField - The matched profile field
     * @returns {boolean} Whether the field is related to birth date
     */
    isBirthDateField(profileField) {
        return ['birthDate', 'birthMonth', 'birthDay', 'birthYear'].includes(profileField);
    }

    /**
     * Get all profile fields
     * @returns {Array} Array of profile field names
     */
    getAllProfileFields() {
        return Object.keys(this.fieldMappings);
    }
}

// Export the FieldMatcher class
export default FieldMatcher;