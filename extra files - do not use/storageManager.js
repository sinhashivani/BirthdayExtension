// /**
//  * StorageManager.js - Manages secure storage operations
//  * Handles encryption, decryption, and synchronization with chrome.storage
//  */

// class StorageManager {
//     /**
//      * Initialize the storage manager
//      * @param {Object} options - Configuration options
//      * @param {boolean} options.useEncryption - Whether to encrypt stored data
//      * @param {string} options.namespace - Namespace for storage keys to avoid collisions
//      */
//     constructor(options = {}) {
//         this.options = {
//             useEncryption: true,
//             namespace: 'loyalty_assistant_',
//             ...options
//         };
//     }

//     /**
//      * Save data to chrome.storage.sync
//      * @param {string} key - Storage key
//      * @param {any} data - Data to store
//      * @returns {Promise} Promise resolving to stored data
//      */
//     async save(key, data) {
//         const storageKey = this._getNamespacedKey(key);
//         const valueToStore = this.options.useEncryption ?
//             this._encrypt(JSON.stringify(data)) :
//             JSON.stringify(data);

//         return new Promise((resolve, reject) => {
//             const saveObj = {};
//             saveObj[storageKey] = valueToStore;

//             chrome.storage.sync.set(saveObj, () => {
//                 if (chrome.runtime.lastError) {
//                     reject(chrome.runtime.lastError);
//                 } else {
//                     resolve(data);
//                 }
//             });
//         });
//     }

//     /**
//      * Retrieve data from chrome.storage.sync
//      * @param {string} key - Storage key
//      * @param {any} defaultValue - Default value if not found
//      * @returns {Promise} Promise resolving to retrieved data
//      */
//     async get(key, defaultValue = null) {
//         const storageKey = this._getNamespacedKey(key);

//         return new Promise((resolve, reject) => {
//             chrome.storage.sync.get([storageKey], (result) => {
//                 if (chrome.runtime.lastError) {
//                     reject(chrome.runtime.lastError);
//                     return;
//                 }

//                 const storedValue = result[storageKey];
//                 if (storedValue === undefined) {
//                     resolve(defaultValue);
//                     return;
//                 }

//                 try {
//                     const parsedValue = this.options.useEncryption ?
//                         JSON.parse(this._decrypt(storedValue)) :
//                         JSON.parse(storedValue);
//                     resolve(parsedValue);
//                 } catch (error) {
//                     reject(error);
//                 }
//             });
//         });
//     }

//     /**
//      * Remove data from chrome.storage.sync
//      * @param {string} key - Storage key
//      * @returns {Promise} Promise resolving when completed
//      */
//     async remove(key) {
//         const storageKey = this._getNamespacedKey(key);

//         return new Promise((resolve, reject) => {
//             chrome.storage.sync.remove(storageKey, () => {
//                 if (chrome.runtime.lastError) {
//                     reject(chrome.runtime.lastError);
//                 } else {
//                     resolve();
//                 }
//             });
//         });
//     }

//     /**
//      * Clear all extension data from chrome.storage.sync
//      * Only clears keys in our namespace
//      * @returns {Promise} Promise resolving when completed
//      */
//     async clearAll() {
//         return new Promise((resolve, reject) => {
//             chrome.storage.sync.get(null, (items) => {
//                 if (chrome.runtime.lastError) {
//                     reject(chrome.runtime.lastError);
//                     return;
//                 }

//                 const keysToRemove = Object.keys(items).filter(key =>
//                     key.startsWith(this.options.namespace)
//                 );

//                 if (keysToRemove.length === 0) {
//                     resolve();
//                     return;
//                 }

//                 chrome.storage.sync.remove(keysToRemove, () => {
//                     if (chrome.runtime.lastError) {
//                         reject(chrome.runtime.lastError);
//                     } else {
//                         resolve();
//                     }
//                 });
//             });
//         });
//     }

//     /**
//      * Get the total size of saved data
//      * @returns {Promise<number>} Promise resolving to size in bytes
//      */
//     async getStorageSize() {
//         return new Promise((resolve, reject) => {
//             chrome.storage.sync.get(null, (items) => {
//                 if (chrome.runtime.lastError) {
//                     reject(chrome.runtime.lastError);
//                     return;
//                 }

//                 let totalSize = 0;
//                 const relevantItems = Object.entries(items).filter(([key]) =>
//                     key.startsWith(this.options.namespace)
//                 );

//                 for (const [key, value] of relevantItems) {
//                     // Calculate approximate size: key + value
//                     totalSize += key.length + JSON.stringify(value).length;
//                 }

//                 resolve(totalSize);
//             });
//         });
//     }

//     /**
//      * Add namespace to storage key
//      * @param {string} key - Original key
//      * @returns {string} Namespaced key
//      * @private
//      */
//     _getNamespacedKey(key) {
//         return `${this.options.namespace}${key}`;
//     }

//     /**
//      * Simple encryption for stored data
//      * Note: This is a basic implementation and not meant for highly sensitive data
//      * @param {string} text - Text to encrypt
//      * @returns {string} Encrypted text
//      * @private
//      */
//     _encrypt(text) {
//         // This is a basic implementation - for actual security,
//         // use a proper encryption library or Chrome's chrome.identity API

//         // Simple XOR cipher with a fixed key as a basic protection layer
//         const key = 'LOYALTY_ASSISTANT_KEY_2025';
//         let result = '';

//         for (let i = 0; i < text.length; i++) {
//             const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
//             result += String.fromCharCode(charCode);
//         }

//         // Convert to Base64 for storage
//         return btoa(result);
//     }

//     /**
//      * Simple decryption for stored data
//      * @param {string} encryptedText - Text to decrypt
//      * @returns {string} Decrypted text
//      * @private
//      */
//     _decrypt(encryptedText) {
//         // Decrypt Base64 encoded string
//         const text = atob(encryptedText);
//         const key = 'LOYALTY_ASSISTANT_KEY_2025';
//         let result = '';

//         for (let i = 0; i < text.length; i++) {
//             const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
//             result += String.fromCharCode(charCode);
//         }

//         return result;
//     }
// }

// // Export the StorageManager class
// export default StorageManager;