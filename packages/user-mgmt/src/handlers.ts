import { Env, getForgotPasswordUrl } from './env';
import { getSessionIdFromCookies, checkUserExists, getUser, storeResetToken, storeUser, isTokenExpired, getUserByResetToken, updatePassword, RegistrationData, Credentials } from './utils';
import { hashPassword, comparePassword } from './auth';
import { createSession, deleteSession, loadSession } from './session';
import { sendEmail } from './email';

// Handles loading user data based on the session ID extracted from cookies.
/**
 * Handles the request to load a user.
 *
 * @param request - The incoming request object.
 * @param env - The environment object.
 * @returns A Promise that resolves to a Response object.
 */
export async function handleLoadUser(request: Request, env: Env): Promise<Response> {
    const sessionId = getSessionIdFromCookies(request);
    if (sessionId) {
        const sessionData = await loadSession(env, sessionId);
        if (sessionData) {
            return new Response(JSON.stringify(sessionData), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    return new Response(JSON.stringify({ error: 'User not logged in' }), { status: 401 });
}

// Processes user registration requests, including validation, password hashing, and database insertion.
/* `handleRegister` is a function that processes user registration requests. It performs the
following tasks:
1. Parses the registration data from the incoming request.
2. Checks if the required fields (username and password) are present in the registration data.
3. Checks if the user already exists in the database.
4. Hashes the user's password for secure storage.
5. Stores the user's information (username, hashed password, first name, last name) in the
database.
6. Returns a response indicating whether the user registration was successful or if any errors
occurred during the process. */
export async function handleRegister(request: Request, env: Env): Promise<Response> {
    try {
        const regData = await request.json() as RegistrationData;
        const { username, password, firstName, lastName } = regData;

        if (!username || !password) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
        }

        const userExists = await checkUserExists(env, username);
        if (userExists) {
            return new Response(JSON.stringify({ error: 'User already exists' }), { status: 409 });
        }

        const hashedPassword = await hashPassword(password);
        await storeUser(env, { username, hashedPassword, firstName, lastName });

        return new Response(JSON.stringify({ message: 'User registered successfully' }), { status: 201 });
    } catch (error) {
        console.error('Error during registration:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}

// Authenticates users by validating credentials and creating a session on successful login.
/**
 * Handles the login request.
 *
 * @param request - The incoming request object.
 * @param env - The environment object.
 * @returns A Promise that resolves to a Response object.
 */
export async function handleLogin(request: Request, env: Env): Promise<Response> {
    const credentials = await request.json() as Credentials;
    const { username, password } = credentials;

    try {
        if (!username || !password) {
            return new Response(JSON.stringify({ error: 'Missing username or password' }), { status: 400 });
        }

        const user = await getUser(env, username);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
        }

        const passwordMatch = await comparePassword(password, user.Password as string);
        if (!passwordMatch) {
            return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
        }

        const sessionId = await createSession(env, user);
        return new Response(JSON.stringify({ message: 'Login successful' }), {
            headers: { 'Set-Cookie': `cfw_session=${sessionId}; Secure; Path=/; SameSite=None; Max-Age=${60 * 30}` }
        });
    } catch (error) {
        console.error('Error during login:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}

// Ends a user's session and clears session-related data.
/**
 * This function handles the logout process for a user.
 * @param {Request} request - The `request` parameter represents the incoming request to the server, containing information
 * such as headers, body, method, and other details sent by the client.
 * @param {Env} env - The `env` parameter typically refers to the environment variables that are available to your
 * serverless function. These variables can be used to store sensitive information or configuration settings that your
 * function may need.
 */
export async function handleLogout(request: Request, env: Env): Promise<Response> {
    const sessionId = getSessionIdFromCookies(request);
    if (sessionId) {
        await deleteSession(env, sessionId);
    }

    const headers = new Headers({
        'Set-Cookie': 'cfw_session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
    });

    return new Response(JSON.stringify({ message: 'Logout successful' }), { headers });
}

// Placeholder for initiating the password reset process.
/**
 * The function `handleForgotPassword` handles the process of initiating a password reset for a user by generating a reset
 * token, storing it, sending a reset link via email, and returning a success message or error response.
 * @param {Request} request - The `request` parameter in the `handleForgotPassword` function is of type `Request`, which
 * likely represents an incoming HTTP request containing data such as the username for which the password reset is
 * requested. This parameter is used to extract the necessary information from the request body to initiate the password
 * reset process.
 * @param {Env} env - The `env` parameter typically represents the environment configuration or settings needed for the
 * function to operate correctly. This can include things like database connections, API keys, email service
 * configurations, and other environment-specific variables required for the function to run in different environments
 * (e.g., development, staging, production).
 * @returns The `handleForgotPassword` function returns a `Response` object. If the user is not found, it returns a
 * response with a 404 status and an error message. If the password reset is initiated successfully, it returns a response
 * with a success message. If there is an error during the process, it returns a response with a 500 status and an error
 * message.
 */
export async function handleForgotPassword(request: Request, env: Env): Promise<Response> {
    try {
        const { username } = await request.json() as { username: string };
        const user = await getUser(env, username);
        if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
        }

        const resetToken = crypto.getRandomValues(new Uint8Array(16)).join('');
        await storeResetToken(env, username, resetToken);

        const resetLink = `${getForgotPasswordUrl(env)}?token=${resetToken}`;
        const toEmail = username;
        const toName = `${user.FirstName} ${user.LastName}`;
        const subject = 'Password Reset Link';
        const contentValue = `Click the following link to reset your password: ${resetLink}`;
        await sendEmail(toEmail, toName, subject, contentValue, env);

        return new Response(JSON.stringify({ message: 'Password reset initiated' }));
    } catch (error) {
        console.error('Error during password reset:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}

// Validates a password reset token.
/**
 * The function `handleForgotPasswordValidate` validates a reset token for a user and returns an appropriate response based
 * on the token's validity.
 * @param {Request} request - The `request` parameter in the `handleForgotPasswordValidate` function is of type `Request`,
 * which represents an incoming HTTP request. It contains information such as headers, body, and other request details sent
 * by the client to the server. In this function, the request body is expected to contain a
 * @param {Env} env - The `env` parameter typically refers to the environment object that contains configuration settings,
 * environment variables, and other resources needed for the application to run. It is commonly used to access database
 * connections, API keys, and other external services.
 * @returns The function `handleForgotPasswordValidate` returns a `Response` object with a JSON stringified message
 * indicating whether the token is valid or not. If the token is invalid, it returns an error message with status code 400.
 * If the token is valid, it returns a message indicating that the token is valid.
 */
export async function handleForgotPasswordValidate(request: Request, env: Env): Promise<Response> {
    const { token } = await request.json() as { token: string };
    const user = await getUserByResetToken(env, token);
    if (!user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400 });
    }

    const tokenExpired = isTokenExpired(env, user.ResetTokenTime as number);
    if (tokenExpired) {
        return new Response(JSON.stringify({ error: 'Token expired' }), { status: 400 });
    }

    return new Response(JSON.stringify({ message: 'Valid Token' }));
}

// Sets a new password for the user after validating the reset token.
/**
 * The function `handleForgotPasswordNewPassword` handles the process of resetting a user's password using a reset token
 * and updating the password in the system.
 * @param {Request} request - The `request` parameter in the `handleForgotPasswordNewPassword` function is of type
 * `Request`, which likely represents an HTTP request object containing data sent by the client to the server. This object
 * may include information such as headers, body content, and request method.
 * @param {Env} env - The `env` parameter in the `handleForgotPasswordNewPassword` function likely represents the
 * environment configuration or context needed for the function to interact with external services or resources. This could
 * include database connections, API keys, or other settings required for the function to execute successfully. It is
 * typically passed in to
 * @returns The function `handleForgotPasswordNewPassword` returns a `Promise` that resolves to a `Response` object. The
 * response can contain either a success message indicating that the password reset was successful, or an error message in
 * case of an invalid token or internal server error.
 */
export async function handleForgotPasswordNewPassword(request: Request, env: Env): Promise<Response> {
    try {
        const { token, password } = await request.json() as { token: string, password: string };
        const user = await getUserByResetToken(env, token);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400 });
        }

        const hashedPassword = await hashPassword(password);
        await updatePassword(env, user.Username, hashedPassword);

        return new Response(JSON.stringify({ message: 'Password reset successful' }));
    } catch (error) {
        console.error('Error resetting password:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}
