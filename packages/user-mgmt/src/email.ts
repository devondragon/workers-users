import { Env } from './env';

// Interfaces
interface EmailRecipient {
    email: string;
    name: string;
}

interface EmailContent {
    type: string;
    value: string;
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
