/**
 * Loyalty Form Filler Extension - Utils
 * Common utility functions for the extension
 */

/**
 * Simple encryption function for data protection
 * Note: This is not cryptographically secure, but provides basic obfuscation
 * For a production extension, consider using the Web Crypto API
 * 
 * @param {string} text - Text to encrypt
 * @param {string} key - Encryption key
 * @returns {string} Encrypted text
 */
function encryptData(text, key = 'loyalty-program-filler') {
    const textToChars = text => text.split('').map(c => c.charCodeAt(0));
    const byteHex = n => ("0" + Number(n).toString(16)).substr(-2);
    const applySaltToChar = code => textToChars(key).reduce((a, b) => a ^ b, code);

    return text
        .split('')
        .map(textToChars)
        .map(applySaltToChar)
        .map(byteHex)
        .join('');
}

/**
 * Simple decryption function matching the encryption
 * 
 * @param {string} encoded - Encrypted text
 * @param {string} key - Encryption key
 * @returns {string} Decrypted text
 */
function decryptData(encoded, key = 'loyalty-program-filler') {
    const textToChars = text => text.split('').map(c => c.charCodeAt(0));
    const applySaltToChar = code => textToChars(key).reduce((a, b) => a ^ b, code);

    return encoded
        .match(/.{1,2}/g)
        .map(hex => parseInt(hex, 16))
        .map(applySaltToChar)
        .map(charCode => String.fromCharCode(charCode))
        .join('');
}

/**
 * Field detection patterns for different types of form fields
 */
const fieldPatterns = {
    firstName: {
        attributes: ['first_name', 'firstname', 'fname', 'first-name', 'given-name', 'givenname'],
        labels: ['first name', 'given name', 'first', 'forename']
    },
    lastName: {
        attributes: ['last_name', 'lastname', 'lname', 'last-name', 'family-name', 'familyname', 'surname'],
        labels: ['last name', 'family name', 'last', 'surname']
    },
    email: {
        attributes: ['email', 'e-mail', 'email_address', 'emailaddress', 'email-address'],
        labels: ['email', 'e-mail', 'email address']
    },
    birthdate: {
        attributes: ['birth_date', 'birthdate', 'bday', 'dob', 'date_of_birth', 'dateofbirth', 'birthday'],
        labels: ['birth date', 'birthdate', 'date of birth', 'birthday', 'birth day', 'dob', 'mm/dd/yyyy', 'dd/mm/yyyy']
    },
    phone: {
        attributes: ['phone', 'telephone', 'phone_number', 'phonenumber', 'phone-number', 'mobile', 'cell'],
        labels: ['phone', 'telephone', 'phone number', 'mobile', 'cell', 'cellular']
    }
};

/**
 * Check if a field matches a specific type based on its attributes or labels
 * 
 * @param {HTMLElement} field - Form field element
 * @param {HTMLElement} label - Associated label element (if any)
 * @param {string} type - Field type to check
 * @returns {boolean} Whether the field matches the type
 */
function matchesFieldType(field, label, type) {
    const patterns = fieldPatterns[type];
    if (!patterns) return false;

    const id = field.id?.toLowerCase() || '';
    const name = field.name?.toLowerCase() || '';
    const placeholder = field.placeholder?.toLowerCase() || '';

    // Check attributes
    if (patterns.attributes.some(attr => id.includes(attr) || name.includes(attr) || placeholder.includes(attr))) {
        return true;
    }

    // Check label if provided
    if (label) {
        const labelText = label.textContent.toLowerCase();
        if (patterns.labels.some(text => labelText.includes(text))) {
            return true;
        }
    }

    return false;
}

/**
 * Calculate the string similarity score using Levenshtein distance
 * Used for fuzzy matching field names
 * 
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function stringSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;

    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    const costs = [];

    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(
                        Math.min(newValue, lastValue),
                        costs[j]
                    ) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }

    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;

    return (maxLen - costs[s2.length]) / maxLen;
}

/**
 * Format a date string to the specified format
 * 
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {string} format - Target format (MM/DD/YYYY, DD/MM/YYYY, etc.)
 * @returns {string} Formatted date string
 */
function formatDate(dateStr, format = 'MM/DD/YYYY') {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    switch (format) {
        case 'MM/DD/YYYY':
            return `${month}/${day}/${year}`;
        case 'DD/MM/YYYY':
            return `${day}/${month}/${year}`;
        case 'YYYY-MM-DD':
            return `${year}-${month}-${day}`;
        case 'MM-DD-YYYY':
            return `${month}-${day}-${year}`;
        default:
            return `${month}/${day}/${year}`;
    }
}

/**
 * Determine if an input is a date input and what format it requires
 * 
 * @param {HTMLElement} input - Input element
 * @returns {string|null} Date format or null if not a date input
 */
function detectDateFormat(input) {
    // Check input type
    if (input.type === 'date') {
        return 'YYYY-MM-DD'; // HTML date input format
    }

    // Check placeholder or pattern attribute
    const placeholder = (input.placeholder || '').toLowerCase();
    const pattern = (input.pattern || '').toLowerCase();

    if (placeholder.includes('mm/dd/yyyy') || pattern.includes('mm/dd/yyyy')) {
        return 'MM/DD/YYYY';
    }

    if (placeholder.includes('dd/mm/yyyy') || pattern.includes('dd/mm/yyyy')) {
        return 'DD/MM/YYYY';
    }

    if (placeholder.includes('yyyy-mm-dd') || pattern.includes('yyyy-mm-dd')) {
        return 'YYYY-MM-DD';
    }

    // Check if this is a birthday field
    const id = (input.id || '').toLowerCase();
    const name = (input.name || '').toLowerCase();

    if (id.includes('birth') || name.includes('birth') ||
        id.includes('dob') || name.includes('dob') ||
        id.includes('bday') || name.includes('bday')) {
        // Default to MM/DD/YYYY for US-centric sites
        return 'MM/DD/YYYY';
    }

    return null;
}