import { callApi } from './api.js';

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('fetchUserData').addEventListener('click', loadSessionData);
});

function loadSessionData() {
    callApi(`/load-user`)
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
