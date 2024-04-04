import { callApi } from './api.js';


document.addEventListener('DOMContentLoaded', function () {
    // Existing event listeners
    document.getElementById('loginForm').addEventListener('submit', function (event) {
        event.preventDefault(); // Prevent the default form submission
        handleLogin();
    });

    document.getElementById('registerForm').addEventListener('submit', function (event) {
        event.preventDefault(); // Prevent the default form submission
        handleRegister();
    });

    // Toggle forms event listener
    document.getElementById('toggleRegForm').addEventListener('click', toggleForms);
    document.getElementById('toggleLoginForm').addEventListener('click', toggleForms);
});


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

function handleLogin() {
    const username = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    callApi(`/login`, { username, password })
        .then(data => {
            displayMessage('login', 'success', 'Login successful!');
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('loggedin-link').classList.remove('hidden'); // Show login message
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

    callApi(`/register`, { username, password, firstName, lastName })
        .then(data => {
            displayMessage('register', 'success', 'Registration successful!');
            document.getElementById('registerForm').style.display = 'none';
        })
        .catch(error => {
            displayMessage('register', 'error', 'Registration failed: ' + error.message);
        });
}

function displayMessage(formType, messageType, message) {
    const messageElementId = formType + '-message';
    const messageElement = document.getElementById(messageElementId);
    messageElement.textContent = message;
    messageElement.className = 'message ' + messageType;
}



async function isLoggedInStatus() {
    try {
        const data = await callApi('/is-logged-in');
        return data.loggedIn;
    } catch (error) {
        console.error('Error checking login status:', error);
        return false;
    }
}

async function checkLoginAndUpdateUI() {
    const isLoggedIn = await isLoggedInStatus();
    console.log(isLoggedIn); // Logs the actual value

    updateVisibility(isLoggedIn);
}

function updateVisibility(isLoggedIn) {
    document.querySelectorAll('.loggedInOnly').forEach(element => {
        element.classList.toggle('hidden', !isLoggedIn);
    });

    document.querySelectorAll('.notLoggedInOnly').forEach(element => {
        element.classList.toggle('hidden', isLoggedIn);
    });
}

// Initiate the login check and UI update process
checkLoginAndUpdateUI();


// Initialize with the login form visible
document.getElementById("login-form").style.display = "block";
