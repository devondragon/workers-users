/**
 * This module provides functionality for sending emails within a Cloudflare Workers environment. It is designed to
 * integrate with external email services, specifically using the MailChannels API for email transmission. The module
 * supports DKIM (DomainKeys Identified Mail) signatures to enhance email security and deliverability. It allows sending
 * emails with personalized content and subject lines to specified recipients.
 *
 * The `sendEmail` function encapsulates the process of constructing the email payload, including DKIM configuration,
 * and sending the email through a POST request to the MailChannels API. Error handling mechanisms are in place to
 * ensure robustness and provide feedback on the email sending process.
 *
 * Interfaces are defined for the structure of email recipients, content, DKIM data, and the overall email payload
 * to ensure type safety and clarity throughout the email construction and sending process.
 *
 * The `Env` interface outlines the expected environment variables, including configurations for the email sender,
 * DKIM setup, and other service-specific settings.
 */

// Interfaces

interface EmailRecipient {
    email: string;
    name: string;
}

interface EmailContent {
    type: string;
    value: string;
}

interface DkimData {
    dkim_domain: string;
    dkim_selector: string;
    dkim_private_key: string;
}

interface EmailPayload {
    personalizations: Array<{
        to: EmailRecipient[];
        dkim_domain: string;
        dkim_selector: string;
        dkim_private_key: string;
    }>;
    from: EmailRecipient;
    subject: string;
    content: EmailContent[];
}

export interface Env {
    usersDB: D1Database; // Reference to Cloudflare's D1 Database for user data.
    sessionService: Fetcher; // Direct reference to session-state Worker for session management.
    EMAIL_FROM: string; // Email address to use as the sender for password reset emails.
    EMAIL_FROM_NAME: string; // Name to use as the sender for password reset emails.
    FORGOT_PASSWORD_URL: string; // URL to use as the password reset link in the email.
    TOKEN_VALID_MINUTES: number; // Time in minutes for the password reset token to expire.
    EMAIL_DKIM_DOMAIN: string; // Domain for DKIM signature
    EMAIL_DKIM_SELECTOR: string; // Selector for DKIM signature
    EMAIL_DKIM_PRIVATE_KEY: string; // Private key for DKIM signature
}


/**
 * Sends an email using MailChannels API with specified recipient, subject, and content.
 * DKIM settings are included in the payload for email security.
 *
 * @param {string} toEmail - The recipient's email address.
 * @param {string} toName - The recipient's name.
 * @param {string} subject - The subject line of the email.
 * @param {string} contentValue - The plain text content of the email.
 * @param {Env} env - Environment variables providing configuration and credentials.
 * @returns {Promise<void>} - A promise that resolves when the email is sent or throws an error.
 */
export async function sendEmail(toEmail: string, toName: string, subject: string, contentValue: string, env: Env): Promise<void> {
    // Construct the email payload including DKIM signature settings
    const payload: EmailPayload = {
        personalizations: [
            {
                to: [{ email: toEmail, name: toName }],
                dkim_domain: env.EMAIL_DKIM_DOMAIN,
                dkim_selector: env.EMAIL_DKIM_SELECTOR,
                dkim_private_key: env.EMAIL_DKIM_PRIVATE_KEY
            },
        ],
        from: {
            email: env.EMAIL_FROM,
            name: env.EMAIL_FROM_NAME
        },
        subject: subject,
        content: [
            {
                type: 'text/plain',
                value: contentValue,
            },
        ],
    };

    // Log the action for debugging purposes (consider security/privacy implications in production)
    console.log('Sending email:', JSON.stringify(payload));

    // Prepare the request to the MailChannels API
    const sendRequest = new Request('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    // Execute the request and handle the response or errors
    try {
        const response = await fetch(sendRequest);
        if (!response.ok) {
            const responseBodyText = await response.text(); // Read the response body as text
            throw new Error(`Failed to send email: ${response.statusText} - ${responseBodyText}`);
        }
        console.log('Email sent successfully');
    } catch (error) {
        // Log any errors encountered during the request
        console.error('Error sending email:', error);
    }
}
