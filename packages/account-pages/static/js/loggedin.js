const API_BASE_URL = '<YOUR-USER-MGMT-WORKER-URL>';

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('fetchUserData').addEventListener('click', loadSessionData);
});

function loadSessionData() {
    callApi(`${API_BASE_URL}/load-user`)
        .then(data => {
            // Display the user's data
            document.getElementById('user-data').innerText = JSON.stringify(data, null, 2);
        })
        .catch(error => {
            console.error('Failed to load user data', error);
            // Optionally, display the error on the webpage
            document.getElementById('user-data').innerText = `Error: ${error.message}`;
        });
}

function callApi(endpoint, data = null) {
    const options = {
        credentials: 'include',
        crossDomain: true,
        method: 'GET', // Assuming GET since we're loading data; adjust if necessary
        headers: {
            'Content-Type': 'application/json'
        },
    };
    // If data is provided, add it to the request
    if (data) {
        options.body = JSON.stringify(data);
        options.method = 'POST'; // Switch to POST if data is included
    }

    return fetch(endpoint, options)
        .then(async response => {
            if (!response.ok) {
                const errorData = await response.json(); // Attempt to parse the error response
                throw new Error(errorData.error || 'Network response was not ok'); // Use the server's error message if available
            }
            return response.json();
        });
}
