// For local development, use the following line:
// const apiBaseUrl = 'http://localhost:51512';

// For production, use the following line:
const apiBaseUrl = 'https://user-mgmt.tools.justblackmagic.com';


export function callApi(endpoint, data) {
    const url = apiBaseUrl + endpoint;
    return fetch(url, {
        credentials: 'include',
        crossDomain: true,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(async response => {
            if (!response.ok) {
                const errorData = await response.json(); // Attempt to parse the error response
                throw new Error(errorData.error || 'Network response was not ok'); // Use the server's error message if available
            }
            return response.json();
        });
}
