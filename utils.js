// utils.js - Utility functions for form detection and field matching

/**
 * Fuzzy matches text against a set of keywords
 * @param {string} text - The text to check
 * @param {string[]} keywords - Array of keywords to match against
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {boolean} Whether the text matches any keyword
 */
function fuzzyMatch(text, keywords, threshold = 0.8) {
    if (!text) return false;

    // Normalize text for comparison
    const normalizedText = text.toLowerCase().trim();

    // Direct match check
    for (const keyword of keywords) {
        const normalizedKeyword = keyword.toLowerCase().trim();
        if (normalizedText.includes(normalizedKeyword)) {
            return true;
        }
    }

    // Levenshtein distance-based fuzzy matching for more complex cases
    for (const keyword of keywords) {
        const normalizedKeyword = keyword.toLowerCase().trim();
        const similarity = levenshteinSimilarity(normalizedText, normalizedKeyword);
        if (similarity >= threshold) {
            return true;
        }
    }

    return false;
}

/**
 * Calculate normalized Levenshtein similarity between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function levenshteinSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    // Calculate Levenshtein distance matrix
    const m = str1.length;
    const n = str2.length;

    // Handle edge cases
    if (m === 0) return 0;
    if (n === 0) return 0;

    // Initialize matrix
    const matrix = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

    // Fill the first row and column
    for (let i = 0; i <= m; i++) matrix[i][0] = i;
    for (let j = 0; j <= n; j++) matrix[0][j] = j;

    // Fill the matrix
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1, // deletion
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    const distance = matrix[m][n];
    const maxLength = Math.max(m, n);

    // Return normalized similarity score (1 - normalized distance)
    return 1 - (distance / maxLength);
}

/**
 * Identifies the field type based on attributes and associated labels
 * @param {Element} element - Form element to analyze
 * @param {Object} customKeywords - Custom keywords for field detection
 * @returns {string|null} Identified field type or null if not recognized
 */

/**
 * Validates form data before submission
 * @param {Object} data - Form data to validate
 * @returns {Object} Validation result with success status and error messages
 */
function validateFormData(data) {
    const errors = {};

    // Email validation
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.email = 'Invalid email format';
    }

    // Phone validation (basic format check)
    if (data.phone && !/^[\d\s\-\(\)\+]+$/.test(data.phone)) {
        errors.phone = 'Invalid phone format';
    }

    // ZIP/Postal code validation (US format as default)
    if (data.zip && !/^\d{5}(-\d{4})?$/.test(data.zip)) {
        errors.zip = 'Invalid ZIP code format';
    }

    // Birthday validation
    if (data.birthday) {
        const date = new Date(data.birthday);
        if (isNaN(date.getTime())) {
            errors.birthday = 'Invalid date format';
        } else {
            // Check if date is in the past and not too far in the past (>120 years)
            const now = new Date();
            if (date > now) {
                errors.birthday = 'Birthday cannot be in the future';
            } else if (date < new Date(now.getFullYear() - 120, now.getMonth(), now.getDate())) {
                errors.birthday = 'Birthday seems too far in the past';
            }
        }
    }
    if (data.password) {
        const password = data.password;

        // Example Rules:
        // Rule 1: Minimum length (e.g., 8 characters)
        if (password.length < 8) {
            errors.password = 'Password must be at least 8 characters long';
        }
        // Rule 2: Contains at least one uppercase letter
        else if (!/[A-Z]/.test(password)) {
            errors.password = 'Password must contain at least one uppercase letter';
        }
        // Rule 3: Contains at least one lowercase letter
        else if (!/[a-z]/.test(password)) {
            errors.password = 'Password must contain at least one lowercase letter';
        }
        // Rule 4: Contains at least one number
        else if (!/[0-9]/.test(password)) {
            errors.password = 'Password must contain at least one number';
        }
        // Rule 5: Optional - Contains at least one special character (uncomment to enable)
        // else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~` ]/.test(password)) {
        //      errors.password = 'Password must contain at least one special character';
        // }

    }
    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Creates a CSV string from submission tracker data
 * @param {Array} submissions - Array of submission objects
 * @returns {string} CSV formatted string
 */
function exportToCSV(submissions) {
    if (!submissions || submissions.length === 0) {
        return 'No data to export';
    }

    // Define columns
    const columns = [
        'Website',
        'Submission Date',
        'Birthday Field Detected',
        'Reward Likelihood'
    ];

    // Create CSV header
    let csv = columns.join(',') + '\n';

    // Add rows
    submissions.forEach(submission => {
        const row = [
            `"${submission.domain}"`,
            `"${new Date(submission.timestamp).toLocaleDateString()}"`,
            `"${submission.birthdayFieldDetected ? 'Yes' : 'No'}"`,
            `"${submission.birthdayFieldDetected ? 'High' : 'Unlikely'}"`,
        ];
        csv += row.join(',') + '\n';
    });

    return csv;
}

/**
 * Creates a JSON string from submission tracker data
 * @param {Array} submissions - Array of submission objects
 * @returns {string} Formatted JSON string
 */
function exportToJSON(submissions) {
    if (!submissions || submissions.length === 0) {
        return '[]';
    }

    return JSON.stringify(submissions, null, 2);
}

/**
 * Detects if a page has a CAPTCHA
 * @returns {boolean} Whether CAPTCHA is detected
 */
function detectCaptcha() {
    const captchaKeywords = [
        'captcha',
        'recaptcha',
        'hcaptcha',
        'cf-turnstile',
        'g-recaptcha',
        'h-captcha'
    ];

    // Check for CAPTCHA in class names, IDs, and iframe sources
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
        if (element.id && captchaKeywords.some(keyword => element.id.toLowerCase().includes(keyword))) {
            return true;
        }
        if (element.className && typeof element.className === 'string' &&
            captchaKeywords.some(keyword => element.className.toLowerCase().includes(keyword))) {
            return true;
        }
    }

    // Check for CAPTCHA iframes
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
        if (iframe.src && captchaKeywords.some(keyword => iframe.src.toLowerCase().includes(keyword))) {
            return true;
        }
    }

    // Check for CAPTCHA scripts
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
        if (script.src && captchaKeywords.some(keyword => script.src.toLowerCase().includes(keyword))) {
            return true;
        }
    }

    return false;
}

/**
 * Detects if a form spans multiple pages
 * @param {HTMLFormElement} form - The form element to check
 * @returns {boolean} Whether the form appears to be multi-page
 */
function detectMultiPageForm(form) {
    // Check for pagination indicators
    const paginationKeywords = ['next', 'continue', 'proceed', 'step', 'page'];

    // Check for buttons that suggest multi-page flow
    const buttons = form.querySelectorAll('button, input[type="button"], input[type="submit"]');
    for (const button of buttons) {
        const buttonText = button.textContent || button.value || '';
        if (paginationKeywords.some(keyword => buttonText.toLowerCase().includes(keyword))) {
            // Avoid false positives with common buttons like "Next day" or "Continue shopping"
            if (!buttonText.toLowerCase().includes('day') &&
                !buttonText.toLowerCase().includes('shopping')) {
                return true;
            }
        }
    }

    // Check for progress indicators
    const progressIndicators = document.querySelectorAll(
        '.progress, .progress-bar, .stepper, .wizard, [role="progressbar"]'
    );
    if (progressIndicators.length > 0) {
        return true;
    }

    // Check for step indicators in the URL
    if (window.location.href.includes('step=') ||
        window.location.href.includes('page=') ||
        window.location.href.includes('wizard')) {
        return true;
    }

    return false;
}