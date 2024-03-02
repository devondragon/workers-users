/**
 * This module defines a Cloudflare Worker for managing user authentication and session management in a serverless
 * architecture. It utilizes Cloudflare's D1 Database to persist user information and integrates with a custom
 * session management service for maintaining user sessions. The worker offers endpoints for user registration,
 * authentication (login), session termination (logout), password reset functionalities, and retrieving user
 * session information, catering to the foundational needs of secure and stateful web applications.
 *
 * Utilizing SHA-256 for password hashing, this worker prioritizes security while acknowledging the operational
 * constraints of Cloudflare Workers, such as the impracticality of employing bcrypt for hashing due to its
 * computational intensity. Additionally, the worker implements essential Cross-Origin Resource Sharing (CORS)
 * handling capabilities to ensure seamless interaction with web clients across different origins.
 *
 * By defining a structured `Env` interface, the worker enforces type checking on environment variables,
 * guaranteeing the availability of external resources like the user database (usersDB) and session management
 * services. This approach enhances the reliability and maintainability of the worker in handling user
 * authentication and session management tasks.
 *
 * Features:
 * - Registration: Validates user data and stores it securely in the database.
 * - Login: Authenticates users by validating credentials and initiating a session.
 * - Logout: Terminates an active user session and clears related data.
 * - Password Reset: Facilitates password recovery processes for users.
 * - Session Data Retrieval: Demonstrates real-time session management by fetching session data.
 * - CORS Handling: Manages CORS preflight requests to support diverse web clients.
 *
 * This worker is architected to serve as a secure, scalable foundation for building web applications on the
 * Cloudflare platform, showcasing the feasibility of leveraging serverless architectures for complex
 * application functionalities such as user management and session control.
 */


import { sendEmail } from './emailHandler';


// Hashing algorithm used for securing passwords. Using bcrypt is not practical in a Worker environment.
const hashingAlgo = 'SHA-256';

// Defines the environment variables required by the worker.
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

// CORS headers configuration to support cross-origin requests.
const corsHeaders: { [key: string]: string } = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
	"Access-Control-Max-Age": "86400",
	"Access-Control-Allow-Credentials": "true",
}

// Main worker class handling incoming requests and routing them to appropriate handlers.
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		let response: Response | null = null;
		// Handle CORS preflight requests.
		if (request.method === "OPTIONS") {
			response = handleOptions(request)
		} else {
			switch (path) {
				case '/register':
					response = await handleRegister(request, env);
					break
				case '/login':
					response = await handleLogin(request, env);
					break;
				case '/logout':
					response = await handleLogout(request, env);
					break;
				case '/forgot-password':
					response = await handleForgotPassword(request, env);
					break;
				case '/forgot-password-validate':
					response = await handleForgotPasswordValidate(request, env);
					break;
				case '/forgot-password-new-password':
					response = await handleForgotPasswordNewPassword(request, env);
					break;
				case '/load-user':
					response = await handleLoadUser(request, env);
					break;
				default:
					response = new Response('Not Found', { status: 404 });
			}
		}
		// Append CORS headers to the response before returning.
		response.headers.set("Access-Control-Allow-Origin", getValidatedOrigin(request) || "*")
		response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		response.headers.set("Access-Control-Allow-Credentials", "true")
		return response;
	},
};

// Handles loading user data based on the session ID extracted from cookies.
// This is a demonstration of session management in action.
async function handleLoadUser(request: Request, env: Env): Promise<Response> {
	// Extract the cookie header
	const cookieHeader = request.headers.get('Cookie');

	// Parse the cookies to find the session ID
	let sessionId = null;
	if (cookieHeader) {
		const cookies = cookieHeader.split(';').map(cookie => cookie.trim());
		const sessionCookie = cookies.find(cookie => cookie.startsWith('cfw_session='));
		if (sessionCookie) {
			sessionId = sessionCookie.split('=')[1];
		}
	}

	if (sessionId) {
		// Call the session retrieval endpoint of the other worker
		const loadSessionUrl = `https://session-state.d1.compact.workers.dev/get/${sessionId}`;
		const loadRequest = new Request(loadSessionUrl);
		const loadResponse = await env.sessionService.fetch(loadRequest);
		const sessionData = await loadResponse.json();

		return new Response(JSON.stringify(sessionData), {
			headers: {
				'Access-Control-Allow-Origin': getValidatedOrigin(request) || '*',
				'Content-Type': 'application/json'
			}
		});
	}
	return new Response(JSON.stringify({ error: 'User not logged in' }), { status: 401 });
}

// Processes user registration requests, including validation, password hashing, and database insertion.
async function handleRegister(request: Request, env: Env): Promise<Response> {
	try {
		// Parse user data from the request body
		const regData = await request.json() as RegistrationData;
		const { username, password, firstName, lastName } = regData;

		// Basic validation
		if (!username || !password) {
			return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
		}

		// Check if the user already exists
		const checkUserQuery = 'SELECT Username FROM User WHERE Username = ?';
		const checkUserStmt = await env.usersDB.prepare(checkUserQuery);
		const existingUser = await checkUserStmt.bind(username).all();
		if (existingUser.success && existingUser.results.length > 0) {
			return new Response(JSON.stringify({ error: 'User already exists' }), { status: 409 });
		}

		const hashedPassword = await hashPassword(password);

		// Store user data in usersDB
		const insertUserQuery = 'INSERT INTO User (Username, Password, FirstName, LastName) VALUES (?, ?, ?, ?)';
		const insertUserStmt = await env.usersDB.prepare(insertUserQuery);
		await insertUserStmt.bind(username, hashedPassword, firstName, lastName).run();

		return new Response(JSON.stringify({ message: 'User registered successfully' }), { status: 201 });
	} catch (error) {
		// Handle any unexpected errors
		return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
	}
}

// Authenticates users by validating credentials and creating a session on successful login.
async function handleLogin(request: Request, env: Env): Promise<Response> {
	const credentials = await request.json() as Credentials;

	// Now credentials is typed as Credentials
	const { username, password } = credentials;
	try {
		if (username && password) {
			const query = 'SELECT * FROM User WHERE Username = ?1';
			const result = (await env.usersDB.prepare(query).bind(username).all()).results;
			if (result.length > 0) {

				const user = result[0];
				// Compare the provided password with the stored hash
				const passwordMatch = await comparePassword(password, user.Password as string);
				if (!passwordMatch) {
					return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
				}

				const sessionData = {
					username: user.Username,
					firstName: user.FirstName,
					lastName: user.LastName,
				};

				// Load any additional user data from the database or other sources to be stored in the session

				// Create a session
				const sessionCreationRequest = new Request("https://session-state.d1.compact.workers.dev/create", {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(sessionData),
				});
				const sessionResponse = await env.sessionService.fetch(sessionCreationRequest);
				const sessionId = await sessionResponse.text();
				// Set a cookie with the session ID
				const headers = new Headers({
					'Access-Control-Allow-Origin': getValidatedOrigin(request) || '*',
					'Content-Type': 'application/json',
					'Set-Cookie': `cfw_session=${sessionId}; Secure; Path=/; SameSite=None; Max-Age=${60 * 30}`

				});

				return new Response(JSON.stringify({ message: 'Login successful' }), { headers });
			}
		}
	} catch (error) {
		console.error("Unexpected error: " + error);
	}
	return new Response(JSON.stringify({ error: 'Login failed' }), { status: 401 });
}

// Ends a user's session and clears session-related data.
async function handleLogout(request: Request, env: Env): Promise<Response> {
	// Extract the cookie header
	const cookieHeader = request.headers.get('Cookie');

	// Parse the cookies to find the session ID
	let sessionId = null;
	if (cookieHeader) {
		const cookies = cookieHeader.split(';').map(cookie => cookie.trim());
		const sessionCookie = cookies.find(cookie => cookie.startsWith('cfw_session='));
		if (sessionCookie) {
			sessionId = sessionCookie.split('=')[1];
		}
	}

	if (sessionId) {
		// Call the session deletion endpoint of the other worker
		const deleteSessionUrl = `https://session-state.d1.compact.workers.dev/delete/${sessionId}`;
		const deleteRequest = new Request(deleteSessionUrl, { method: 'DELETE' });
		await env.sessionService.fetch(deleteRequest);
	}

	// Clear the session cookie in the response
	const headers = new Headers({
		'Set-Cookie': 'cfw_session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
	});

	return new Response(JSON.stringify({ message: 'Logout successful' }), { headers });
}

// Placeholder for initiating the password reset process.
async function handleForgotPassword(request: Request, env: Env): Promise<Response> {
	const { username } = await request.json() as { username: string };
	console.log('Initiating password reset for username:', username);
	// Initiate password reset process
	// load user by email
	const query = 'SELECT * FROM User WHERE Username = ?';
	const result = (await env.usersDB.prepare(query).bind(username).all()).results;
	if (result.length === 0) {
		return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
	}
	const user = result[0];

	// create a reset token
	const resetToken = crypto.getRandomValues(new Uint8Array(16)).join('');

	// store reset token in database
	const updateQuery = 'UPDATE User SET ResetToken = ?, ResetTokenTime = ? WHERE Username = ?';
	await env.usersDB.prepare(updateQuery).bind(resetToken, Date.now(), username).run();

	// send email with reset link
	const resetLink = `${env.FORGOT_PASSWORD_URL}?token=${resetToken}`;

	const toEmail = username;
	const toName = `${user.FirstName} ${user.LastName}`;
	const subject = 'Password Reset Link';

	const contentValue = `Click the following link to reset your password: ${resetLink}`;
	await sendEmail(toEmail, toName, subject, contentValue, env);
	return new Response(JSON.stringify({ message: 'Password reset initiated' }));
}

async function handleForgotPasswordValidate(request: Request, env: Env): Promise<Response> {
	const { token } = await request.json() as { token: string };
	// validate token
	const query = 'SELECT * FROM User WHERE ResetToken = ?';
	const result = (await env.usersDB.prepare(query).bind(token).all()).results;
	if (result.length === 0) {
		return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400 });
	}
	const user = result[0];

	const millisecondsInMinute = 1000 * 60;
	const tokenExpirationTime = env.TOKEN_VALID_MINUTES * millisecondsInMinute;

	// check if token expired
	if (Date.now() - (user.ResetTokenTime as number) > tokenExpirationTime) {
		return new Response(JSON.stringify({ error: 'Token expired' }), { status: 400 });
	}

	return new Response(JSON.stringify({ message: 'Valid Token' }));
}

async function handleForgotPasswordNewPassword(request: Request, env: Env): Promise<Response> {
	const { token, password } = await request.json() as { token: string, password: string };
	// validate token
	const query = 'SELECT * FROM User WHERE ResetToken = ?';
	const result = (await env.usersDB.prepare(query).bind(token).all()).results;
	if (result.length === 0) {
		return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400 });
	}
	const user = result[0];
	const hashedPassword = await hashPassword(password);
	const updateQuery = 'UPDATE User SET Password = ?, ResetToken = NULL, ResetTokenTime = NULL WHERE Username = ?';
	await env.usersDB.prepare(updateQuery).bind(hashedPassword, user.Username).run();
	return new Response(JSON.stringify({ message: 'Password reset successful' }));
}

// Implement a function to hash passwords
// While best practice is to use a slow hashing algorithm like bcrypt, doing so in a Worker is not practical.
async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16)).join('');
	const data = new TextEncoder().encode(salt + password);
	const hashBuffer = await crypto.subtle.digest({ name: hashingAlgo }, data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	return `${salt}:${hashHex}`;
}

// Compares a provided password against a stored hash to authenticate a user.
async function comparePassword(providedPassword: string, storedHash: string): Promise<boolean> {
	// Split the stored hash to extract the salt and the actual hash
	const [salt, originalHash] = storedHash.split(':');

	// Hash the provided password with the extracted salt
	const data = new TextEncoder().encode(salt + providedPassword);
	const hashBuffer = await crypto.subtle.digest({ name: hashingAlgo }, data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

	// Compare the newly generated hash with the original hash
	return hashHex === originalHash;
}

// Handles CORS preflight requests by setting appropriate headers.
function handleOptions(request: Request): Response {
	// Make sure the necessary headers are present
	// for this to be a valid pre-flight request
	let headers = request.headers;
	if (
		headers.get("Origin") !== null &&
		headers.get("Access-Control-Request-Method") !== null &&
		headers.get("Access-Control-Request-Headers") !== null
	) {
		// Handle CORS pre-flight request.
		let respHeaders: { [key: string]: string } = {
			...corsHeaders,
			"Access-Control-Allow-Headers": headers.get("Access-Control-Request-Headers") || "",
		};
		respHeaders["Content-Type"] = "text/plain";
		respHeaders["X-Content-Type-Options"] = "nosniff";
		respHeaders["Access-Control-Allow-Origin"] = getValidatedOrigin(request) || "*";
		return new Response(null, {
			headers: respHeaders,
		});
	} else {
		// Handle standard OPTIONS request.
		return new Response(null, {
			headers: {
				"Allow": "GET, HEAD, POST, OPTIONS",
				"Content-Type": "text/plain"
			},
		});
	}
}

// Validates the origin of a request to enforce CORS policy.
// This is a basic example and should be extended to include a list of allowed origins.
function getValidatedOrigin(request: Request): string | null {
	const origin = request.headers.get("Origin");
	if (origin === null) {
		return null;
	}
	const url = new URL(origin);
	if (url.protocol === "http:" || url.protocol === "https:") {
		// You could also validate the hostname against a list of allowed known good origins.
		return origin;
	} else {
		return null;
	}
}

// Defines the structure for user credentials.
interface Credentials {
	username: string;
	password: string;
}

// Extends Credentials with additional registration data.
interface RegistrationData extends Credentials {
	firstName: string;
	lastName: string;
}
