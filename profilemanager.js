// profileManager.js - Handles user profile management

class ProfileManager {
    /**
     * Initialize the profile manager
     */
    constructor() {
        this.profiles = [];
        this.currentProfileId = null;
        this.loadProfiles();
    }

    /**
     * Load profiles from storage
     * @returns {Promise<void>}
     */
    async loadProfiles() {
        try {
            const result = await chrome.storage.sync.get(['profiles', 'currentProfileId']);
            this.profiles = result.profiles || [];
            this.currentProfileId = result.currentProfileId || (this.profiles[0]?.id || null);
        } catch (error) {
            console.error('Error loading profiles:', error);
            this.profiles = [];
            this.currentProfileId = null;
        }
    }

    /**
     * Save profiles to storage
     * @returns {Promise<void>}
     */
    async saveProfiles() {
        try {
            await chrome.storage.sync.set({ profiles: this.profiles });
        } catch (error) {
            console.error('Error saving profiles:', error);
        }
    }

    /**
     * Set the current active profile
     * @param {string} profileId - ID of the profile to set as active
     * @returns {Promise<boolean>} - Whether the operation was successful
     */
    async setCurrentProfile(profileId) {
        if (!this.profiles.some(profile => profile.id === profileId)) {
            return false;
        }

        this.currentProfileId = profileId;
        try {
            await chrome.storage.sync.set({ currentProfileId: profileId });
            return true;
        } catch (error) {
            console.error('Error setting current profile:', error);
            return false;
        }
    }

    /**
     * Get the current active profile
     * @returns {Object|null} - The current profile or null if none exists
     */
    getCurrentProfile() {
        if (!this.currentProfileId) return null;
        return this.profiles.find(profile => profile.id === this.currentProfileId) || null;
    }

    /**
     * Get all profiles
     * @returns {Array} - Array of profile objects
     */
    getAllProfiles() {
        return this.profiles;
    }

    /**
     * Create a new profile
     * @param {Object} profileData - Profile data
     * @param {string} profileData.name - Profile name
     * @param {Object} profileData.data - Profile form data
     * @returns {Promise<Object>} - The newly created profile
     */
    async createProfile(profileData) {
        const newProfile = {
            id: 'profile_' + Date.now(),
            name: profileData.name,
            data: this.sanitizeProfileData(profileData.data),
            created: Date.now(),
            lastUsed: Date.now()
        };

        this.profiles.push(newProfile);
        await this.saveProfiles();

        // Set as current profile if this is the first one
        if (this.profiles.length === 1) {
            await this.setCurrentProfile(newProfile.id);
        }

        return newProfile;
    }

    /**
     * Update an existing profile
     * @param {string} profileId - ID of the profile to update
     * @param {Object} profileData - New profile data
     * @returns {Promise<boolean>} - Whether the update was successful
     */
    async updateProfile(profileId, profileData) {
        const profileIndex = this.profiles.findIndex(profile => profile.id === profileId);

        if (profileIndex === -1) {
            return false;
        }

        // Update profile with new data while preserving ID and created date
        this.profiles[profileIndex] = {
            ...this.profiles[profileIndex],
            name: profileData.name || this.profiles[profileIndex].name,
            data: profileData.data ? this.sanitizeProfileData(profileData.data) : this.profiles[profileIndex].data,
            lastUsed: Date.now()
        };

        await this.saveProfiles();
        return true;
    }

    /**
     * Delete a profile
     * @param {string} profileId - ID of the profile to delete
     * @returns {Promise<boolean>} - Whether the deletion was successful
     */
    async deleteProfile(profileId) {
        const initialLength = this.profiles.length;
        this.profiles = this.profiles.filter(profile => profile.id !== profileId);

        if (this.profiles.length < initialLength) {
            // If we deleted the current profile, set the first available profile as current
            if (this.currentProfileId === profileId) {
                this.currentProfileId = this.profiles[0]?.id || null;
                await chrome.storage.sync.set({ currentProfileId: this.currentProfileId });
            }

            await this.saveProfiles();
            return true;
        }

        return false;
    }

    /**
     * Get profile by ID
     * @param {string} profileId - ID of the profile to retrieve
     * @returns {Object|null} - The profile object or null if not found
     */
    getProfileById(profileId) {
        return this.profiles.find(profile => profile.id === profileId) || null;
    }

    /**
     * Update last used timestamp for a profile
     * @param {string} profileId - ID of the profile
     * @returns {Promise<boolean>} - Whether the update was successful
     */
    async updateLastUsed(profileId) {
        const profileIndex = this.profiles.findIndex(profile => profile.id === profileId);

        if (profileIndex === -1) {
            return false;
        }

        this.profiles[profileIndex].lastUsed = Date.now();
        await this.saveProfiles();
        return true;
    }

    /**
     * Sanitize profile data to ensure consistent format
     * @param {Object} data - Raw profile data
     * @returns {Object} - Sanitized profile data
     */
    sanitizeProfileData(data) {
        const sanitizedData = {};

        // Process standard fields and ensure consistent naming
        const fieldMappings = {
            firstName: ['firstName', 'first_name', 'fname', 'first'],
            lastName: ['lastName', 'last_name', 'lname', 'last'],
            email: ['email', 'emailAddress', 'email_address'],
            phone: ['phone', 'phoneNumber', 'phone_number', 'mobile', 'cellphone'],
            birthday: ['birthday', 'birthdate', 'birth_date', 'dateOfBirth', 'date_of_birth', 'dob'],
            address: ['address', 'streetAddress', 'street_address'],
            city: ['city'],
            state: ['state', 'province', 'region'],
            zipCode: ['zipCode', 'zip', 'postal_code', 'postalCode'],
            country: ['country']
        };

        // Map input fields to standardized field names
        for (const [standardField, aliases] of Object.entries(fieldMappings)) {
            for (const alias of aliases) {
                if (data[alias] !== undefined) {
                    sanitizedData[standardField] = data[alias];
                    break;
                }
            }
        }

        // Add any other fields not covered by standard mappings
        for (const [key, value] of Object.entries(data)) {
            let isMapped = false;

            for (const aliases of Object.values(fieldMappings)) {
                if (aliases.includes(key)) {
                    isMapped = true;
                    break;
                }
            }

            if (!isMapped) {
                sanitizedData[key] = value;
            }
        }

        return sanitizedData;
    }

    /**
     * Export a profile as JSON
     * @param {string} profileId - ID of the profile to export
     * @returns {string|null} - JSON string of the profile or null if not found
     */
    exportProfileAsJSON(profileId) {
        const profile = this.getProfileById(profileId);
        if (!profile) return null;

        return JSON.stringify(profile, null, 2);
    }

    /**
     * Import a profile from JSON
     * @param {string} jsonString - JSON string of the profile
     * @returns {Promise<Object|null>} - The imported profile or null if import failed
     */
    async importProfileFromJSON(jsonString) {
        try {
            const profileData = JSON.parse(jsonString);

            // Validate profile structure
            if (!profileData.name || !profileData.data || typeof profileData.data !== 'object') {
                throw new Error('Invalid profile format');
            }

            // Create a new profile with the imported data
            return await this.createProfile({
                name: profileData.name,
                data: profileData.data
            });
        } catch (error) {
            console.error('Error importing profile:', error);
            return null;
        }
    }
}

// Export the profile manager class
export default ProfileManager;