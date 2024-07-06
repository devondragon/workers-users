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
import { AutoRouter, IRequest } from 'itty-router';
import { Env } from './env';
import {
	createSession,
	getSessionData,
	deleteSession,
} from './session';

const router = AutoRouter<IRequest, [Env, ExecutionContext]>();

router
	.post('/create', async (request, env, ctx) => {
		try {
			const requestData = await request.json();
			const sessionId = await createSession(requestData, env);
			return new Response(sessionId, { status: 201 });
		} catch (error) {
			return new Response('Failed to create session', { status: 500 });
		}
	})
	.get('/get/:sessionId', async ({ params }, env) => {
		try {
			const { sessionId } = params;
			const data = await getSessionData(sessionId, env);
			if (!data) {
				return new Response('Session not found', { status: 404 });
			}
			return new Response(JSON.stringify(data), { status: 200 });
		} catch (error) {
			return new Response('Failed to retrieve session', { status: 500 });
		}
	})
	.delete('/delete/:sessionId', async ({ params }, env) => {
		try {
			const { sessionId } = params;
			await deleteSession(sessionId, env);
			return new Response('Session deleted', { status: 200 });
		} catch (error) {
			return new Response('Failed to delete session', { status: 500 });
		}
	})
	.all('*', () => new Response('Invalid request', { status: 404 }));

export default {
	fetch: router.handle,
};
