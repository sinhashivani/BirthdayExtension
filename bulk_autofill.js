const RETAILER_DB_KEY = 'retailerDatabase';
let allRetailers = {}; // To store all retailers loaded from storage
let activeProfile = null

let retailerListDiv = null;
let noRetailersMessage = null;

async function getRetailers() {
    console.log("Fetching retailers from storage...");
    const result = await chrome.storage.local.get([RETAILER_DB_KEY]);
    return result[RETAILER_DB_KEY] || [];
}

async function saveRetailers(retailers) {
    console.log("Saving retailers to storage:", retailers);
    await chrome.storage.local.set({ [RETAILER_DB_KEY]: retailers });
}

async function addRetailer(name, url) {
    console.log("Adding retailer:", name, url);
    const currentRetailers = await getRetailers(); // Get current list from storage
    const newRetailer = {
        id: self.crypto.randomUUID(),
        name: name,
        signupUrl: url, // Assuming you now use signupUrl
        dateAdded: new Date().toISOString()
    };
    currentRetailers.push(newRetailer);
    console.log("Current retailers before saving:", currentRetailers);
    await saveRetailers(currentRetailers);
    console.log("Retailers saved successfully:", currentRetailers);

    // After saving, update the `allRetailers` global variable
    allRetailers[newRetailer.id] = newRetailer;
    console.log("Retailer added successfully:", newRetailer);

    renderRetailerList(Object.values(allRetailers)); // Re-render the UI with the updated list
}

// --- Delete Retailer Function (from your previous code) ---
async function deleteRetailer(id) {
    let currentRetailers = await getRetailers();
    currentRetailers = currentRetailers.filter(r => r.id !== id);
    await saveRetailers(currentRetailers);

    // Also update the in-memory `allRetailers` object
    delete allRetailers[id];

    renderRetailerList(Object.values(allRetailers)); // Re-render the UI
}

// In bulk_autofill.js

function renderRetailerList(retailersToDisplay) {
    // Ensure retailerListDiv is correctly assigned before using it
    if (!retailerListDiv) {
        console.error("Bulk Autofill UI: Target element 'retailerList' not found. Cannot render retailers.");
        return; // Exit if the element isn't found
    }

    retailerListDiv.innerHTML = ''; // Clear previous content

    // Check if the retailersToDisplay array is empty
    if (!retailersToDisplay || retailersToDisplay.length === 0) {
        retailerListDiv.innerHTML = '<p id="noRetailersMessage">No retailers configured for bulk autofill.</p>'; // Use <p> instead of <li> if it's a general div
        return;
    }

    retailersToDisplay.forEach(retailer => {
        const listItem = document.createElement('div'); // Using div as you used 'retailer-item' before, but <li> is also fine if retailerListDiv is a <ul>/<ol>
        listItem.className = 'retailer-item'; // Use 'retailer-item' for consistency with CSS
        listItem.setAttribute('data-retailer-id', retailer.id); // Important for status updates

        console.log("Rendering retailer:", retailer); // Debug log to see what is being rendered
        listItem.innerHTML = `
            <div class="retailer-info">
                <input type="checkbox" class="retailer-checkbox" name="retailerCheckbox" value="${retailer.id}">
                <span>${retailer.name} (<a href="${retailer.signupUrl}" target="_blank" rel="noopener noreferrer">${retailer.signupUrl}</a>)</span>
            </div>
            <div class="retailer-actions">
                <button class="edit-retailer" data-id="${retailer.id}">Edit</button>
                <button class="delete-retailer" data-id="${retailer.id}">Delete</button>
            </div>
            <span class="status-display status-pending">Status: In Queue</span>
        `;
        retailerListDiv.appendChild(listItem);
    });

    // Add event listeners for Delete buttons (MUST BE ADDED AFTER ELEMENTS ARE CREATED)
    retailerListDiv.querySelectorAll('.delete-retailer').forEach(button => {
        button.addEventListener('click', async (event) => {
            const idToDelete = event.target.dataset.id;
            if (confirm(`Are you sure you want to delete "${retailersToDisplay.find(r => r.id === idToDelete)?.name || 'this retailer'}"?`)) {
                await deleteRetailer(idToDelete);
            }
        });
    });

    // Add event listeners for Edit buttons (implementation needed)
    retailerListDiv.querySelectorAll('.edit-retailer').forEach(button => {
        button.addEventListener('click', async (event) => {
            const idToEdit = event.target.dataset.id;
            console.log("Edit functionality to be implemented for retailer ID:", idToEdit);
        });
    });
}

// --- showStatusMessage (helper for UI feedback) ---
function showStatusMessage(message, type = "info") {
    const statusDisplay = document.getElementById('autofillStatusDisplay'); // Assuming you have this ID in HTML
    if (statusDisplay) {
        statusDisplay.innerHTML = `<p class="status-${type}">${message}</p>`;
    } else {
        console.warn("Status display element not found:", message);
    }
}

async function loadAndDisplayRetailers() {
    console.log("Bulk Autofill UI: Loading and displaying retailers...");
    try {
        // Assume you're sending a message to background.js to get the database
        const response = await chrome.runtime.sendMessage({ action: 'getRetailerDatabase' });
        console.log("Bulk Autofill UI: Retailers loaded (full response object):", response);

        // Check if response and retailers array are valid
        if (response && Array.isArray(response.retailers) && response.retailers.length > 0) {
            // Convert the array back to an object keyed by ID
            allRetailers = response.retailers.reduce((obj, retailer) => {
                obj[retailer.id] = retailer;
                return obj;
            }, {});
            console.log("Bulk Autofill UI: Successfully loaded allRetailers:", allRetailers);
            renderRetailerList(Object.values(allRetailers)); // Pass the array of retailer objects
        } else {
            allRetailers = {}; // Ensure allRetailers is empty if no data
            renderRetailerList([]); // Pass an empty array to render function
            showStatusMessage("No retailers found for bulk autofill.", "info");
        }
    } catch (error) {
        console.error("Bulk Autofill UI: Error loading retailers:", error);
        showStatusMessage("Error loading retailers for bulk autofill. See console for details.", "error");
    }
}

// bulk_autofill.js (continued)
document.addEventListener('DOMContentLoaded', () => {
    // (Retailer management setup code from earlier)
    retailerListDiv = document.getElementById('retailerList'); // Ensure your HTML has <div id="retailerList">

    document.getElementById('addRetailerForm').addEventListener('submit', async (event) => {
        console.log("Add Retailer Form submitted");
        event.preventDefault();
        const name = event.target.retailerName.value;
        const url = event.target.retailerUrl.value; // Assuming your input ID is 'retailerUrl'

        if (name && url) {
            await addRetailer(name, url);
            event.target.reset(); // Clear the form
        } else {
            alert('Please provide both name and URL.');
        }
    });

    document.getElementById('clearAllRetailers').addEventListener('click', async () => {
        if (confirm("Are you sure you want to clear all retailers? This cannot be undone.")) {
            await saveRetailers([]); // Save an empty array
            allRetailers = {}; // Clear in-memory object
            renderRetailerList([]); // Re-render the list to update UI
            showStatusMessage("All retailers cleared.", "info");
        }
    });

    const port = chrome.runtime.connect({ name: "bulkAutofillUI" });

    port.onMessage.addListener((msg) => {
        console.log("Message from background:", msg);
        if (msg.action === 'bulkProcessUpdate' || msg.action === 'bulkProcessComplete') {
            updateRetailerStatusesInUI(msg.statuses);
        }
        if (msg.action === 'bulkProcessComplete') {
            alert('Bulk autofill process finished!');
            // Enable start button again, etc.
        }
    });

    document.getElementById('startBulkAutofillButton').addEventListener('click', async () => {
        const selectedRetailers = Array.from(document.querySelectorAll('.retailer-checkbox:checked'))
            .map(cb => cb.value);
        if (selectedRetailers.length === 0) {
            alert("Please select at least one retailer.");
            return;
        }
        // Disable button, show loading indicator, etc.
        port.postMessage({ action: "startBulkAutofill", selectedRetailerIds: selectedRetailers });
    });

    // Function to render/update the status list in the HTML (existing, just placing it in context)
    function updateRetailerStatusesInUI(statuses) {
        // Ensure retailerListDiv is available for finding elements
        if (!retailerListDiv) return;

        Object.keys(statuses).forEach(retailerId => {
            const retailerDiv = retailerListDiv.querySelector(`[data-retailer-id="${retailerId}"]`);
            if (retailerDiv) {
                let statusText = `Status: ${statuses[retailerId].status}`;
                if (statuses[retailerId].message) {
                    statusText += ` - ${statuses[retailerId].message}`;
                }
                const statusEl = retailerDiv.querySelector('.status-display') || document.createElement('span');
                statusEl.className = 'status-display';
                statusEl.textContent = statusText;
                statusEl.classList.remove('status-pending', 'status-in_progress', 'status-complete', 'status-error');
                statusEl.classList.add(`status-${statuses[retailerId].status}`);

                if (!retailerDiv.querySelector('.status-display')) {
                    retailerDiv.appendChild(statusEl);
                }

                let retryButton = retailerDiv.querySelector('.retry-button');
                if (statuses[retailerId].status === 'error' && !retryButton) {
                    retryButton = document.createElement('button');
                    retryButton.textContent = 'Retry';
                    retryButton.className = 'retry-button';
                    retryButton.onclick = () => {
                        port.postMessage({ action: 'retryRetailer', retailerId: retailerId });
                        statusEl.textContent = 'Status: pending - Retrying...';
                        statusEl.className = 'status-display status-pending';
                        retryButton.remove();
                    };
                    retailerDiv.appendChild(retryButton);
                } else if (statuses[retailerId].status !== 'error' && retryButton) {
                    retryButton.remove();
                }
            }
        });
    }

    // --- Initial load and display of retailers ---
    loadAndDisplayRetailers();
    renderRetailerList(); // initial render
});

