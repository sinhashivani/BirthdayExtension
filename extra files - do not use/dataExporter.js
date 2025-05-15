// /**
//  * DataExporter.js - Exports tracker data in different formats
//  * Handles CSV and JSON exports of submission data
//  */

// class DataExporter {
//     /**
//      * Generate CSV data from tracker entries
//      * @param {Array} trackerEntries - Array of tracker entry objects
//      * @returns {string} CSV formatted data
//      */
//     generateCSV(trackerEntries) {
//         if (!trackerEntries || !trackerEntries.length) {
//             return '';
//         }

//         // Extract column headers from the first entry
//         const headers = Object.keys(trackerEntries[0]);

//         // Create CSV header row
//         let csvContent = headers.join(',') + '\n';

//         // Add data rows
//         trackerEntries.forEach(entry => {
//             const row = headers.map(header => {
//                 // Handle values that might contain commas by wrapping in quotes
//                 const value = entry[header] !== null && entry[header] !== undefined ?
//                     String(entry[header]) : '';

//                 // Escape quotes and wrap in quotes if contains comma, newline or quotes
//                 if (value.includes(',') || value.includes('\n') || value.includes('"')) {
//                     return `"${value.replace(/"/g, '""')}"`;
//                 }
//                 return value;
//             });

//             csvContent += row.join(',') + '\n';
//         });

//         return csvContent;
//     }

//     /**
//      * Generate JSON data from tracker entries
//      * @param {Array} trackerEntries - Array of tracker entry objects
//      * @returns {string} JSON formatted data
//      */
//     generateJSON(trackerEntries) {
//         return JSON.stringify(trackerEntries, null, 2);
//     }

//     /**
//      * Trigger a download of the exported data
//      * @param {string} data - The data to download
//      * @param {string} filename - The filename for the download
//      * @param {string} type - The MIME type of the data
//      */
//     downloadData(data, filename, type) {
//         const blob = new Blob([data], { type });
//         const url = URL.createObjectURL(blob);

//         const downloadLink = document.createElement('a');
//         downloadLink.href = url;
//         downloadLink.download = filename;

//         // Trigger the download
//         document.body.appendChild(downloadLink);
//         downloadLink.click();

//         // Clean up
//         document.body.removeChild(downloadLink);
//         setTimeout(() => URL.revokeObjectURL(url), 100);
//     }

//     /**
//      * Export tracker data to CSV and trigger download
//      * @param {Array} trackerEntries - Array of tracker entry objects
//      * @param {string} [filename='loyalty_tracker_export.csv'] - The filename for the download
//      */
//     exportToCSV(trackerEntries, filename = 'loyalty_tracker_export.csv') {
//         const csvData = this.generateCSV(trackerEntries);
//         this.downloadData(csvData, filename, 'text/csv');
//     }

//     /**
//      * Export tracker data to JSON and trigger download
//      * @param {Array} trackerEntries - Array of tracker entry objects
//      * @param {string} [filename='loyalty_tracker_export.json'] - The filename for the download
//      */
//     exportToJSON(trackerEntries, filename = 'loyalty_tracker_export.json') {
//         const jsonData = this.generateJSON(trackerEntries);
//         this.downloadData(jsonData, filename, 'application/json');
//     }

//     /**
//      * Convert a Date object to a string in YYYY-MM-DD format
//      * @param {Date} date - Date object to format
//      * @returns {string} Formatted date string
//      */
//     static formatDate(date) {
//         const d = new Date(date);
//         const year = d.getFullYear();
//         const month = String(d.getMonth() + 1).padStart(2, '0');
//         const day = String(d.getDate()).padStart(2, '0');
//         return `${year}-${month}-${day}`;
//     }

//     /**
//      * Add today's date to filename
//      * @param {string} baseFilename - Base filename without extension
//      * @param {string} extension - File extension with dot (e.g., '.csv')
//      * @returns {string} Filename with date
//      */
//     static getFilenameWithDate(baseFilename, extension) {
//         const dateStr = DataExporter.formatDate(new Date());
//         return `${baseFilename}_${dateStr}${extension}`;
//     }
// }

// // Export the DataExporter class
// export default DataExporter;