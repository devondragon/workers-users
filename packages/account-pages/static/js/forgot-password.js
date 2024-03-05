import { callApi } from './api.js';

document.addEventListener('DOMContentLoaded', function () {

    document.getElementById('forgotPasswordForm').addEventListener('submit', function (event) {
        event.preventDefault(); // Prevent the default form submission
        handleForgotPassword();
    });
});

function handleForgotPassword() {
    const username = document.getElementById('loginEmail').value;
    callApi(`/forgot-password`, { username })
        .then(data => {
            displayMessage('forgot-password', 'success', 'Password reset email sent!');
            document.getElementById('forgotPasswordForm').style.display = 'none';
        })
        .catch(error => {
            displayMessage('forgot-password', 'error', 'Failed to send password reset email: ' + error.message);
        });
}

function displayMessage(formName, type, message) {
    const messageElement = document.getElementById(`${formName}-message`);
    messageElement.innerText = message;
    messageElement.className = type;
    messageElement.style.display = 'block';
}
