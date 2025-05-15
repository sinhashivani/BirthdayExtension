/**
 * Profiles management module for LoyaltyFill extension
 * Handles creating, updating, deleting, and retrieving user profiles
 */

class ProfileManager {
    /**
     * Initialize the profile manager
     */
    constructor() {
        this.currentProfileId = null;
        this.profilesCache = null;
    }

    /**
     * Generate a unique ID for a new profile
     * @returns {string} A unique ID string
     */
    generateProfileId() {
        return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get all stored profiles
     * @returns {Promise<Object>} Object containing all profiles with IDs as keys
     */
    async getAllProfiles() {
        if (this.profilesCache) {
            return this.profilesCache;
        }

        return new Promise((resolve) => {
            chrome.storage.sync.get('profiles', (result) => {
                const profiles = result.profiles || {};
                this.profilesCache = profiles;
                resolve(profiles);
            });
        });
    }

    /**
     * Get a specific profile by ID
     * @param {string} profileId - The ID of the profile to retrieve
     * @returns {Promise<Object|null>} The profile object or null if not found
     */
    async getProfile(profileId) {
        const profiles = await this.getAllProfiles();
        return profiles[profileId] || null;
    }

    /**
     * Get the currently active profile
     * @returns {Promise<Object|null>} The active profile or null if none is set
     */
    async getActiveProfile() {
        return new Promise((resolve) => {
            chrome.storage.sync.get('activeProfileId', async (result) => {
                if (result.activeProfileId) {
                    const profile = await this.getProfile(result.activeProfileId);
                    resolve(profile);
                } else {
                    // If no active profile is set, try to get the first available profile
                    const profiles = await this.getAllProfiles();
                    const profileIds = Object.keys(profiles);
                    if (profileIds.length > 0) {
                        resolve(profiles[profileIds[0]]);
                    } else {
                        resolve(null);
                    }
                }
            });
        });
    }

    /**
     * Set a profile as active
     * @param {string} profileId - The ID of the profile to set as active
     * @returns {Promise<boolean>} True if successful, false otherwise
     */
    async setActiveProfile(profileId) {
        const profile = await this.getProfile(profileId);
        if (!profile) return false;

        return new Promise((resolve) => {
            chrome.storage.sync.set({ activeProfileId: profileId }, () => {
                this.currentProfileId = profileId;
                resolve(true);
            });
        });
    }

    /**
     * Create a new profile
     * @param {Object} profileData - The profile data to save
     * @returns {Promise<string>} The ID of the newly created profile
     */
    async createProfile(profileData) {
        const profileId = this.generateProfileId();
        const profiles = await this.getAllProfiles();

        // Add metadata
        profileData.id = profileId;
        profileData.createdAt = new Date().toISOString();
        profileData.updatedAt = new Date().toISOString();

        // Add to profiles storage
        profiles[profileId] = profileData;

        return new Promise((resolve) => {
            chrome.storage.sync.set({ profiles }, () => {
                this.profilesCache = profiles;

                // If this is the first profile, set it as active
                if (Object.keys(profiles).length === 1) {
                    this.setActiveProfile(profileId);
                }

                resolve(profileId);
            });
        });
    }

    /**
     * Update an existing profile
     * @param {string} profileId - The ID of the profile to update
     * @param {Object} profileData - The updated profile data
     * @returns {Promise<boolean>} True if successful, false if profile not found
     */
    async updateProfile(profileId, profileData) {
        const profiles = await this.getAllProfiles();

        if (!profiles[profileId]) {
            return false;
        }

        // Update metadata
        profileData.id = profileId;
        profileData.createdAt = profiles[profileId].createdAt;
        profileData.updatedAt = new Date().toISOString();

        // Update in storage
        profiles[profileId] = profileData;

        return new Promise((resolve) => {
            chrome.storage.sync.set({ profiles }, () => {
                this.profilesCache = profiles;
                resolve(true);
            });
        });
    }

    /**
     * Delete a profile
     * @param {string} profileId - The ID of the profile to delete
     * @returns {Promise<boolean>} True if successful
     */
    async deleteProfile(profileId) {
        const profiles = await this.getAllProfiles();

        if (!profiles[profileId]) {
            return false;
        }

        delete profiles[profileId];

        return new Promise((resolve) => {
            chrome.storage.sync.set({ profiles }, async () => {
                this.profilesCache = profiles;

                // If the deleted profile was active, set another profile as active if available
                const activeProfile = await this.getActiveProfile();
                if (!activeProfile && Object.keys(profiles).length > 0) {
                    const firstProfileId = Object.keys(profiles)[0];
                    await this.setActiveProfile(firstProfileId);
                }

                resolve(true);
            });
        });
    }

    /**
     * Create a default profile with empty values
     * @returns {Object} A default profile object
     */
    createDefaultProfile() {
        return {
            name: '',
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            birthdate: '',
            address: '',
            city: '',
            state: '',
            zip: '',
            country: ''
        };
    }

    /**
     * Get profile field mapping for form autofill
     * @param {string} profileId - The ID of the profile to get mappings for
     * @returns {Promise<Object>} Object mapping field types to profile values
     */
    async getProfileFieldMapping(profileId) {
        const profile = await this.getProfile(profileId);
        if (!profile) return null;

        return {
            'first-name': profile.firstName,
            'last-name': profile.lastName,
            'full-name': `${profile.firstName} ${profile.lastName}`.trim(),
            'email': profile.email,
            'phone': profile.phone,
            'birthdate': profile.birthdate,
            'birth-day': profile.birthdate ? new Date(profile.birthdate).getDate() : '',
            'birth-month': profile.birthdate ? new Date(profile.birthdate).getMonth() + 1 : '',
            'birth-year': profile.birthdate ? new Date(profile.birthdate).getFullYear() : '',
            'address': profile.address,
            'city': profile.city,
            'state': profile.state,
            'zip': profile.zip,
            'country': profile.country
        };
    }

    /**
     * Clear the profiles cache to force a fresh load from storage
     */
    clearCache() {
        this.profilesCache = null;
    }

    /**
     * Delete all stored profiles
     * @returns {Promise<boolean>} True if successful
     */
    async deleteAllProfiles() {
        return new Promise((resolve) => {
            chrome.storage.sync.remove(['profiles', 'activeProfileId'], () => {
                this.profilesCache = {};
                this.currentProfileId = null;
                resolve(true);
            });
        });
    }
}

// Export the ProfileManager class
window.ProfileManager = ProfileManager;

/**
 * Encrypts sensitive profile data for storage
 * @param {Object} profileData - The profile data to encrypt
 * @param {string} key - The encryption key
 * @returns {Object} Encrypted profile data
 */
function encryptProfileData(profileData, key) {
    // In a real implementation, this would use a proper encryption algorithm
    // For this example, we're just demonstrating the concept
    const sensitiveFields = ['firstName', 'lastName', 'email', 'phone', 'birthdate', 'address'];
    const encryptedData = { ...profileData };

    sensitiveFields.forEach(field => {
        if (encryptedData[field]) {
            // Simple string obfuscation (NOT actual encryption - just for demonstration)
            encryptedData[field] = btoa(encryptedData[field]);
        }
    });

    return encryptedData;
}

/**
 * Decrypts sensitive profile data after retrieval
 * @param {Object} encryptedData - The encrypted profile data
 * @param {string} key - The encryption key
 * @returns {Object} Decrypted profile data
 */
function decryptProfileData(encryptedData, key) {
    // In a real implementation, this would use a proper decryption algorithm
    // For this example, we're just demonstrating the concept
    const sensitiveFields = ['firstName', 'lastName', 'email', 'phone', 'birthdate', 'address'];
    const decryptedData = { ...encryptedData };

    sensitiveFields.forEach(field => {
        if (decryptedData[field] && typeof decryptedData[field] === 'string') {
            try {
                // Simple string deobfuscation (NOT actual decryption - just for demonstration)
                decryptedData[field] = atob(decryptedData[field]);
            } catch (e) {
                // If decoding fails, keep the original value
                console.error(`Failed to decrypt field: ${field}`);
            }
        }
    });

    return decryptedData;
}

// Export encryption/decryption functions
window.encryptProfileData = encryptProfileData;
window.decryptProfileData = decryptProfileData;