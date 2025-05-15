/**
 * ConsentManager.js - Handles user consent for form submissions
 * Manages the display and tracking of consent dialogs
 */

class ConsentManager {
    /**
     * Initialize the consent manager
     * @param {Object} options - Configuration options
     * @param {boolean} options.requireConsent - Whether to require consent before submission
     * @param {number} options.consentValidDays - Number of days consent is valid for a domain
     */
    constructor(options = {}) {
        this.options = {
            requireConsent: true,
            consentValidDays: 30,
            ...options
        };

        this.consentStorageKey = 'loyalty_assistant_consents';
    }

    /**
     * Create and display a consent dialog
     * @param {Object} formData - The data to be submitted
     * @param {string} domain - The domain for which consent is being requested
     * @returns {Promise<boolean>} Promise resolving to whether consent was given
     */
    async showConsentDialog(formData, domain) {
        if (!this.options.requireConsent) {
            return true;
        }

        // Check if we already have valid consent for this domain
        if (await this.hasValidConsent(domain)) {
            return true;
        }

        return new Promise(resolve => {
            // Create dialog elements
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center;';

            const dialog = document.createElement('div');
            dialog.style.cssText = 'background: white; padding: 20px; border-radius: 8px; width: 400px; max-width: 90%; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';

            const title = document.createElement('h2');
            title.textContent = 'Form Submission Consent';
            title.style.cssText = 'margin-top: 0; color: #2c3e50;';

            const message = document.createElement('p');
            message.textContent = `The Loyalty Program Assistant extension would like to submit the following data to ${domain}:`;

            // Create form data preview
            const dataPreview = document.createElement('div');
            dataPreview.style.cssText = 'max-height: 150px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 4px; background: #f9f9f9;';

            const dataList = document.createElement('ul');
            dataList.style.cssText = 'margin: 0; padding-left: 20px;';

            // Add list items for form data
            Object.entries(formData).forEach(([field, value]) => {
                // Mask sensitive data if needed
                let displayValue = value;
                if (field.toLowerCase().includes('password')) {
                    displayValue = '••••••••';
                }

                const item = document.createElement('li');
                item.textContent = `${field}: ${displayValue}`;
                dataList.appendChild(item);
            });

            dataPreview.appendChild(dataList);

            // Create buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'display: flex; justify-content: space-between; margin-top: 20px;';

            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; background: #e0e0e0; cursor: pointer;';

            const approveButton = document.createElement('button');
            approveButton.textContent = 'Approve Submission';
            approveButton.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; background: #4CAF50; color: white; cursor: pointer;';

            // Add checkbox for remembering consent
            const rememberContainer = document.createElement('div');
            rememberContainer.style.cssText = 'margin-top: 15px;';

            const rememberCheckbox = document.createElement('input');
            rememberCheckbox.type = 'checkbox';
            rememberCheckbox.id = 'remember-consent';

            const rememberLabel = document.createElement('label');
            rememberLabel.htmlFor = 'remember-consent';
            rememberLabel.textContent = `Remember my choice for this website for ${this.options.consentValidDays} days`;
            rememberLabel.style.cssText = 'margin-left: 8px; font-size: 14px;';

            rememberContainer.appendChild(rememberCheckbox);
            rememberContainer.appendChild(rememberLabel);

            // Handle button clicks
            cancelButton.addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(false);
            });

            approveButton.addEventListener('click', async () => {
                if (rememberCheckbox.checked) {
                    await this.saveConsent(domain);
                }
                document.body.removeChild(overlay);
                resolve(true);
            });

            // Assemble the dialog
            buttonContainer.appendChild(cancelButton);
            buttonContainer.appendChild(approveButton);

            dialog.appendChild(title);
            dialog.appendChild(message);
            dialog.appendChild(dataPreview);
            dialog.appendChild(rememberContainer);
            dialog.appendChild(buttonContainer);

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
        });
    }

    /**
     * Save consent for a domain
     * @param {string} domain - The domain for which to save consent
     */
    async saveConsent(domain) {
        try {
            // Get existing consents
            const existingConsents = await this.getStoredConsents();

            // Add or update this domain's consent
            existingConsents[domain] = {
                timestamp: Date.now(),
                expiresAt: Date.now() + (this.options.consentValidDays * 24 * 60 * 60 * 1000)
            };

            // Save back to storage
            await this.storeConsents(existingConsents);
        } catch (error) {
            console.error('Error saving consent:', error);
        }
    }

    /**
     * Check if there is valid consent for a domain
     * @param {string} domain - The domain to check
     * @returns {Promise<boolean>} Whether there is valid consent
     */
    async hasValidConsent(domain) {
        try {
            const consents = await this.getStoredConsents();

            if (!consents[domain]) {
                return false;
            }

            // Check if consent has expired
            return consents[domain].expiresAt > Date.now();
        } catch (error) {
            console.error('Error checking consent:', error);
            return false;
        }
    }

    /**
     * Revoke consent for a domain
     * @param {string} domain - The domain for which to revoke consent
     */
    async revokeConsent(domain) {
        try {
            const consents = await this.getStoredConsents();

            if (consents[domain]) {
                delete consents[domain];
                await this.storeConsents(consents);
            }
        } catch (error) {
            console.error('Error revoking consent:', error);
        }
    }

    /**
     * Revoke all stored consents
     */
    async revokeAllConsents() {
        await this.storeConsents({});
    }

    /**
     * Get all stored consents
     * @returns {Promise<Object>} Stored consents
     * @private
     */
    async getStoredConsents() {
        return new Promise(resolve => {
            chrome.storage.local.get([this.consentStorageKey], result => {
                resolve(result[this.consentStorageKey] || {});
            });
        });
    }

    /**
     * Store consents in chrome.storage.local
     * @param {Object} consents - Consent data to store
     * @private
     */
    async storeConsents(consents) {
        return new Promise((resolve, reject) => {
            const data = {};
            data[this.consentStorageKey] = consents;

            chrome.storage.local.set(data, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Get list of domains with active consent
     * @returns {Promise<Array>} Array of domain objects with consent status
     */
    async getActiveConsents() {
        const consents = await this.getStoredConsents();
        const now = Date.now();

        return Object.entries(consents)
            .filter(([_, data]) => data.expiresAt > now)
            .map(([domain, data]) => ({
                domain,
                grantedAt: new Date(data.timestamp),
                expiresAt: new Date(data.expiresAt),
                daysRemaining: Math.ceil((data.expiresAt - now) / (24 * 60 * 60 * 1000))
            }));
    }
}

// Export the ConsentManager class
export default ConsentManager;