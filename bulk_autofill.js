const RETAILER_DB_KEY = 'retailerDatabase';

async function getRetailers() {
    const result = await chrome.storage.local.get([RETAILER_DB_KEY]);
    return result[RETAILER_DB_KEY] || [];
}

async function saveRetailers(retailers) {
    await chrome.storage.local.set({ [RETAILER_DB_KEY]: retailers });
}

async function addRetailer(name, url) {
    const retailers = await getRetailers();
    const newRetailer = {
        id: self.crypto.randomUUID(),
        name: name,
        membershipPageUrl: url,
        dateAdded: new Date().toISOString()
    };
    retailers.push(newRetailer);
    await saveRetailers(retailers);
    renderRetailerList(); // Function to update the UI
}

// In bulk_autofill.js

async function renderRetailerList() {
    const retailers = await getRetailers();
    const container = document.getElementById('retailerListContainer');
    container.innerHTML = ''; // Clear existing list

    const noRetailersMessage = document.getElementById('noRetailersMessage');

    if (retailers.length === 0) {
        noRetailersMessage.style.display = 'block'; // Show the "no retailers" message
        return;
    } else {
        noRetailersMessage.style.display = 'none'; // Hide it if there are retailers
    }

    // Create a dedicated wrapper for retailer items to better manage layout and prevent
    // direct child manipulation issues if other elements are added to retailerListContainer
    const listWrapper = document.createElement('div');
    listWrapper.id = 'retailers-wrapper';
    container.appendChild(listWrapper);

    retailers.forEach(retailer => {
        const retailerDiv = document.createElement('div');
        retailerDiv.className = 'retailer-item';
        // Crucial for linking UI elements to backend data and status updates
        retailerDiv.setAttribute('data-retailer-id', retailer.id);

        retailerDiv.innerHTML = `
            <div class="retailer-info">
                <input type="checkbox" class="retailer-checkbox" value="${retailer.id}">
                <span>${retailer.name} (<a href="${retailer.membershipPageUrl}" target="_blank" rel="noopener noreferrer">${retailer.membershipPageUrl}</a>)</span>
            </div>
            <div class="retailer-actions">
                <button class="edit-retailer" data-id="${retailer.id}">Edit</button>
                <button class="delete-retailer" data-id="${retailer.id}">Delete</button>
            </div>
            <span class="status-display status-pending">Status: In Queue</span> `;
        listWrapper.appendChild(retailerDiv);
    });

    // Add event listeners for Delete buttons
    listWrapper.querySelectorAll('.delete-retailer').forEach(button => {
        button.addEventListener('click', async (event) => {
            const idToDelete = event.target.dataset.id;
            if (confirm(`Are you sure you want to delete "${retailers.find(r => r.id === idToDelete)?.name || 'this retailer'}"?`)) {
                await deleteRetailer(idToDelete); // Call the delete function
                renderRetailerList(); // Re-render the list to update UI
            }
        });
    });

    // Add event listeners for Edit buttons (implementation for editRetailer is needed)
    listWrapper.querySelectorAll('.edit-retailer').forEach(button => {
        button.addEventListener('click', async (event) => {
            const idToEdit = event.target.dataset.id;
            // You would typically open a modal or inline form here
            console.log("Edit functionality to be implemented for retailer ID:", idToEdit);
            // Example:
            // const retailerToEdit = retailers.find(r => r.id === idToEdit);
            // openEditModal(retailerToEdit);
        });
    });
}

// You will also need the implementation for deleteRetailer and potentially editRetailer
// Example deleteRetailer function (add this to bulk_autofill.js)
async function deleteRetailer(id) {
    let retailers = await getRetailers();
    retailers = retailers.filter(r => r.id !== id);
    await saveRetailers(retailers);
}


// ... functions for rendering, deleting, editing retailers ...
// ... function to get selected retailer IDs for bulk processing ...

// Example: Event listener for adding a new retailer
async function addRetailer(name, url) {
    const retailers = await getRetailers();
    const newRetailer = {
        id: self.crypto.randomUUID(),
        name: name,
        membershipPageUrl: url,
        dateAdded: new Date().toISOString()
    };
    retailers.push(newRetailer);
    await saveRetailers(retailers);
    renderRetailerList(); // <-- This is the crucial call!
}

document.getElementById('addRetailerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = event.target.retailerName.value;
    const url = event.target.retailerUrl.value;
    if (name && url) {
        await addRetailer(name, url); // This calls addRetailer, which then calls renderRetailerList()
        event.target.reset();
    } else {
        alert('Please provide both name and URL.');
    }
});

// bulk_autofill.js (continued)
document.addEventListener('DOMContentLoaded', () => {
    // (Retailer management setup code from earlier)
    renderRetailerList(); // initial render

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

    document.getElementById('clearAllRetailers').addEventListener('click', async () => {
        if (confirm("Are you sure you want to clear all retailers? This cannot be undone.")) {
            await saveRetailers([]); // Save an empty array
            renderRetailerList(); // Re-render the list
        }
    });


    // Function to render/update the status list in the HTML
    function updateRetailerStatusesInUI(statuses) {
        const retailerListElement = document.getElementById('retailerListContainer'); // Assuming you have this
        Object.keys(statuses).forEach(retailerId => {
            const retailerDiv = retailerListElement.querySelector(`[data-retailer-id="${retailerId}"]`);
            if (retailerDiv) {
                let statusText = `Status: ${statuses[retailerId].status}`;
                if (statuses[retailerId].message) {
                    statusText += ` - ${statuses[retailerId].message}`;
                }
                const statusEl = retailerDiv.querySelector('.status-display') || document.createElement('span');
                statusEl.className = 'status-display';
                statusEl.textContent = statusText;
                // Add appropriate CSS classes for styling based on status (e.g., .status-complete, .status-error)
                statusEl.classList.remove('status-pending', 'status-in_progress', 'status-complete', 'status-error');
                statusEl.classList.add(`status-${statuses[retailerId].status}`);

                if (!retailerDiv.querySelector('.status-display')) {
                    retailerDiv.appendChild(statusEl);
                }

                // Add retry button if status is 'error'
                let retryButton = retailerDiv.querySelector('.retry-button');
                if (statuses[retailerId].status === 'error' && !retryButton) {
                    retryButton = document.createElement('button');
                    retryButton.textContent = 'Retry';
                    retryButton.className = 'retry-button';
                    retryButton.onclick = () => {
                        port.postMessage({ action: 'retryRetailer', retailerId: retailerId });
                        // Visually update status to pending/retrying immediately
                        statusEl.textContent = 'Status: pending - Retrying...';
                        statusEl.className = 'status-display status-pending';
                        retryButton.remove(); // Remove button after clicking
                    };
                    retailerDiv.appendChild(retryButton);
                } else if (statuses[retailerId].status !== 'error' && retryButton) {
                    retryButton.remove();
                }
            }
        });
    }

    renderRetailerList();
});

