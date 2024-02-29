import { callApi } from './api.js';

document.addEventListener('DOMContentLoaded', () => handlePasswordReset());


async function handlePasswordReset() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const messageDiv = document.getElementById('message');
    const form = document.getElementById('passwordResetForm');

    if (!token) {
        messageDiv.textContent = 'Error: No token provided.';
        return;
    }

    callApi(`/forgot-password-validate`, { token })
        .then(data => {
            messageDiv.textContent = 'Success! Please enter a new password.';
            form.style.display = 'block';
        })
        .catch(error => {
            messageDiv.textContent = 'Error: Invalid or expired token.';
        });


    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        handleSetNewPassword();
    });
}

function handleSetNewPassword() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        messageDiv.textContent = 'Passwords do not match.';
        return;
    }

    callApi(`/forgot-password-new-password`, { token, password })
        .then(data => {
            messageDiv.textContent = 'Password reset successful! You can now log in.';
            document.getElementById('passwordResetForm').style.display = 'none';
        })
        .catch(error => {
            messageDiv.textContent = 'Failed to reset password: ' + error.message;
        });
}

