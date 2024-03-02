// Function to send an email
export async function sendEmail(toEmail: string, toName: string, subject: string, contentValue: string, env: Env): Promise<void> {

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

    console.log('Sending email:', JSON.stringify(payload));

    // Create a new request to the MailChannels API
    const sendRequest = new Request('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    // Send the request
    try {
        const response = await fetch(sendRequest);
        if (!response.ok) {
            const responseBodyText = await response.text(); // Read the response body as text
            throw new Error(`Failed to send email: ${response.statusText} - ${responseBodyText}`);
        }
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

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
