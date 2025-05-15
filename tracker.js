// tracker.js - Handles submission tracking functionality

class SubmissionTracker {
    /**
     * Initialize the tracker
     */
    constructor() {
        this.trackerData = [];
        this.loadTrackerData();
    }

    /**
     * Load tracker data from storage
     * @returns {Promise<void>}
     */
    async loadTrackerData() {
        try {
            const result = await chrome.storage.sync.get('submissionTracker');
            this.trackerData = result.submissionTracker || [];
        } catch (error) {
            console.error('Error loading tracker data:', error);
            this.trackerData = [];
        }
    }

    /**
     * Save tracker data to storage
     * @returns {Promise<void>}
     */
    async saveTrackerData() {
        try {
            await chrome.storage.sync.set({ submissionTracker: this.trackerData });
        } catch (error) {
            console.error('Error saving tracker data:', error);
        }
    }

    /**
     * Add a new submission to the tracker
     * @param {Object} submission - Submission details
     * @param {string} submission.domain - Website domain
     * @param {boolean} submission.birthdayFieldDetected - Whether a birthday field was detected
     * @param {Object} submission.formData - The data that was submitted
     * @param {Object} submission.metadata - Additional metadata about the submission
     * @returns {Promise<void>}
     */
    async addSubmission(submission) {
        const newEntry = {
            id: `submission_${Date.now()}`,
            domain: submission.domain,
            submissionDate: Date.now(),
            birthdayFieldDetected: submission.birthdayFieldDetected,
            formData: submission.formData || {},
            metadata: submission.metadata || {}
        };

        this.trackerData.push(newEntry);
        await this.saveTrackerData();
        return newEntry;
    }

    /**
     * Get all tracker data
     * @returns {Array} - Array of submission entries
     */
    getTrackerData() {
        return this.trackerData;
    }

    /**
     * Delete a submission entry
     * @param {string} submissionId - ID of the submission to delete
     * @returns {Promise<boolean>} - Whether the deletion was successful
     */
    async deleteSubmission(submissionId) {
        const initialLength = this.trackerData.length;
        this.trackerData = this.trackerData.filter(entry => entry.id !== submissionId);

        if (this.trackerData.length < initialLength) {
            await this.saveTrackerData();
            return true;
        }
        return false;
    }

    /**
     * Clear all submission data
     * @returns {Promise<void>}
     */
    async clearAllData() {
        this.trackerData = [];
        await this.saveTrackerData();
    }

    /**
     * Export tracker data in specified format
     * @param {string} format - Export format ('csv' or 'json')
     * @returns {string} - Formatted data string
     */
    exportData(format) {
        if (format === 'csv') {
            return this.exportAsCSV();
        } else {
            return this.exportAsJSON();
        }
    }

    /**
     * Export tracker data as CSV
     * @returns {string} - CSV formatted string
     */
    exportAsCSV() {
        const headers = ['Domain', 'Submission Date', 'Birthday Field', 'Reward Likelihood', 'Has Captcha'];

        const rows = this.trackerData.map(entry => [
            entry.domain,
            new Date(entry.submissionDate).toLocaleDateString(),
            entry.birthdayFieldDetected ? 'Detected' : 'Not Detected',
            entry.birthdayFieldDetected ? 'High' : 'Low',
            entry.metadata?.captchaDetected ? 'Yes' : 'No'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        return csvContent;
    }

    /**
     * Export tracker data as JSON
     * @returns {string} - JSON formatted string
     */
    exportAsJSON() {
        return JSON.stringify(this.trackerData, null, 2);
    }

    /**
     * Check if a domain already exists in the tracker
     * @param {string} domain - Website domain to check
     * @returns {boolean} - Whether the domain exists
     */
    domainExists(domain) {
        return this.trackerData.some(entry => entry.domain === domain);
    }

    /**
     * Get stats about the tracker data
     * @returns {Object} - Statistics object
     */
    getStats() {
        const totalSubmissions = this.trackerData.length;
        const birthdayFieldCount = this.trackerData.filter(entry => entry.birthdayFieldDetected).length;
        const captchaCount = this.trackerData.filter(entry => entry.metadata?.captchaDetected).length;

        return {
            totalSubmissions,
            birthdayFieldCount,
            birthdayFieldPercentage: totalSubmissions ? (birthdayFieldCount / totalSubmissions * 100).toFixed(1) : 0,
            captchaCount,
            recentSubmissions: this.trackerData
                .sort((a, b) => b.submissionDate - a.submissionDate)
                .slice(0, 5)
        };
    }
}

// Export the tracker class
export default SubmissionTracker;