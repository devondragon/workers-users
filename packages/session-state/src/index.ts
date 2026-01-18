/**
 * Provides session management functionality within a Cloudflare Workers environment.
 * This module defines methods for creating, retrieving, updating, adding to, and deleting sessions,
 * with each session identified by a unique session ID. Sessions are stored in a Cloudflare KV namespace.
 *
 * The `Env` interface represents the expected environment configuration,
 * containing the `sessionstore` KVNamespace for session data storage.
 *
 * Functions (in the session.ts file) include:
 * - `generateSessionId`: Generates a unique session identifier using `crypto.randomUUID`.
 * - `createSession`: Creates a new session with the provided data in the Cloudflare KV store and returns the session ID.
 * - `updateSession`: Updates the data for a given session ID in the Cloudflare KV store.
 * - `addToSession`: Adds data to an existing session in the Cloudflare KV store.
 * - `getSessionData`: Retrieves session data for a given session ID from the Cloudflare KV store.
 * - `deleteSession`: Deletes a session from the Cloudflare KV store using the session ID.
 *
 * The default export is an async `fetch` function that handles HTTP requests to create, get, update, add to, and delete sessions based on the request path.
 * It uses `itty-router` to define the routes and handle the requests.
 * The supported routes are:
 * - POST `/create`: Creates a new session.
 * - GET `/get/:sessionId`: Retrieves session data for the given session ID.
 * - DELETE `/delete/:sessionId`: Deletes the session with the given session ID.
 * - PUT `/update/:sessionId`: Updates the session data for the given session ID.
 * - PATCH `/add/:sessionId`: Adds data to the existing session with the given session ID.
 * - ALL `*`: Catches all other requests and returns a 404 response.
 *
 * It is designed to be deployed as part of a Cloudflare Worker.
 */
import { AutoRouter, IRequest } from 'itty-router';
import { Env } from './env';
import {
	handleCreateSession,
	handleGetSessionData,
	handleAddToSession,
	handleUpdateSession,
	handleDeleteSession,
	handleGetCache,
	handleSetCache,
	handleDeleteCache
} from './handlers';

const router = AutoRouter<IRequest, [Env, ExecutionContext]>();

router
	// Session routes
	.post('/create', (request, env) => handleCreateSession(request, env))
	.get('/get/:sessionId', (request, env) => handleGetSessionData(request, env))
	.delete('/delete/:sessionId', (request, env) => handleDeleteSession(request, env))
	.put('/update/:sessionId', (request, env) => handleUpdateSession(request, env))
	.patch('/add/:sessionId', (request, env) => handleAddToSession(request, env))
	// Cache routes
	.get('/cache/:cacheKey', (request, env) => handleGetCache(request, env))
	.put('/cache/:cacheKey', (request, env) => handleSetCache(request, env))
	.delete('/cache/:cacheKey', (request, env) => handleDeleteCache(request, env))
	.all('*', () => new Response('Invalid request', { status: 404 }));

export default { ...router }; // Export the router
