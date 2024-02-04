const API_BASE_URL = 'https://<YOUR-USER-MGMT-WORKER-URL>';

function toggleForms() {
    var loginForm = document.getElementById("login-form");
    var registerForm = document.getElementById("register-form");
    if (loginForm.style.display === "none") {
        loginForm.style.display = "block";
        registerForm.style.display = "none";
    } else {
        loginForm.style.display = "none";
        registerForm.style.display = "block";
    }
}

document.getElementById('loginForm').addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent the default form submission
    handleLogin();
});

document.getElementById('registerForm').addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent the default form submission
    handleRegister();
});

function handleLogin() {
    const username = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    callApi(`${API_BASE_URL}/login`, { username, password })
        .then(data => {
            displayMessage('login', 'success', 'Login successful!');
            document.getElementById('loginForm').style.display = 'none';
        })
        .catch(error => {
            displayMessage('login', 'error', 'Login failed: ' + error.message);
        });
}

function handleRegister() {
    const username = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;

    callApi(`${API_BASE_URL}/register`, { username, password, firstName, lastName })
        .then(data => {
            displayMessage('register', 'success', 'Registration successful!');
            document.getElementById('registerForm').style.display = 'none';
        })
        .catch(error => {
            displayMessage('register', 'error', 'Registration failed: ' + error.message);
        });
}


function callApi(endpoint, data) {
    return fetch(endpoint, {
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

function displayMessage(formType, messageType, message) {
    const messageElementId = formType + '-message';
    const messageElement = document.getElementById(messageElementId);
    messageElement.textContent = message;
    messageElement.className = 'message ' + messageType;
}

// Initialize with the login form visible
document.getElementById("login-form").style.display = "block";
