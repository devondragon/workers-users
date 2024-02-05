/**
 * Provides session management functionality within a Cloudflare Workers environment.
 * This module defines methods for creating, retrieving, and deleting sessions,
 * with each session identified by a unique session ID. Sessions are stored in a Cloudflare KV namespace.
 *
 * The `Env` interface represents the expected environment configuration,
 * containing the `sessionstore` KVNamespace for session data storage.
 *
 * Functions:
 * - `generateSessionId`: Generates a unique session identifier using `crypto.randomUUID`.
 * - `createSession`: Creates a new session with the provided data in the Cloudflare KV store and returns the session ID.
 * - `updateSession`: Updates the data for a given session ID in the Cloudflare KV store.
 * - `addToSession`: Adds data to an existing session in the Cloudflare KV store.
 * - `getSessionData`: Retrieves session data for a given session ID from the Cloudflare KV store.
 * - `deleteSession`: Deletes a session from the Cloudflare KV store using the session ID.
 *
 * The default export is an async `fetch` function that handles HTTP requests to create, get, and delete sessions based on the request path.
 * It is designed to be deployed as part of a Cloudflare Worker.
 *
 */


export interface Env {
	sessionstore: KVNamespace;
}

function generateSessionId(): string {
	// Generate a random and unique session identifier.
	// This should be VERY unique, but with a very high traffic system or one with extremely high security requirements,
	// you may want to ensure the key is not in use.
	return crypto.randomUUID();
}

// Create a new session in the KV store
async function createSession(data: any, env: Env): Promise<string> {
	const sessionId = generateSessionId();
	try {
		await env.sessionstore.put(sessionId, JSON.stringify(data));
	} catch (error) {
		console.error("Error creating session: " + error);
	}
	return sessionId;
}

// Update session data in the KV store
async function updateSession(sessionId: string, data: any, env: Env): Promise<void> {
	await env.sessionstore.put(sessionId, JSON.stringify(data));
}

// Add data to an existing session
async function addToSession(sessionId: string, data: any, env: Env): Promise<void> {
	const sessionData = await getSessionData(sessionId, env);
	await updateSession(sessionId, { ...sessionData, ...data }, env);
}

// Retrieve session data from the KV store
async function getSessionData(sessionId: string, env: Env): Promise<any> {
	const data = await env.sessionstore.get(sessionId);
	return data ? JSON.parse(data) : null;
}

// Delete a session from the KV store
async function deleteSession(sessionId: string, env: Env): Promise<void> {
	await env.sessionstore.delete(sessionId);
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		try {
			if (path === '/create' && request.method === 'POST') {
				const requestData = await request.json();
				const sessionId = await createSession(requestData, env);
				return new Response(sessionId);

			} else if (path.startsWith('/get/') && request.method === 'GET') {
				const sessionId = path.split('/')[2];
				const data = await getSessionData(sessionId, env);
				return new Response(JSON.stringify(data));

			} else if (path.startsWith('/delete/') && request.method === 'DELETE') {
				const sessionId = path.split('/')[2];
				await deleteSession(sessionId, env);
				return new Response('Session deleted');

			} else {
				return new Response('Invalid request', { status: 404 });
			}
		} catch (error) {
			console.error("Error processing request: " + error);
			return new Response('Error processing request', { status: 500 });
		}
	},
};
