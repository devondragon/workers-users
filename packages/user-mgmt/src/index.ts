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
import { AutoRouter, cors, IRequest } from 'itty-router';
// Defines the environment variables required by the worker.
import { Env, getRbacEnabled } from './env';
import { bootstrapSuperAdmin } from './rbac/bootstrap';

import {
	handleRegister,
	handleLogin,
	handleLogout,
	handleForgotPassword,
	handleForgotPasswordValidate,
	handleForgotPasswordNewPassword,
	handleLoadUser,
	handleListRoles,
	handleCreateRole,
	handleListPermissions,
	handleGetUserRoles,
	handleAssignRole,
	handleRemoveRole,
} from './handlers';

// Middleware for CORS preflight and response handling
const { preflight, corsify } = cors({
	origin: true,
	credentials: true,
	allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
	maxAge: 84600,
});

// Flag to ensure bootstrap only runs once per worker instance
let bootstrapCompleted = false;

// Middleware to run bootstrap on first request
async function bootstrapMiddleware(request: IRequest, env: Env, ctx: ExecutionContext) {
	if (!bootstrapCompleted && getRbacEnabled(env)) {
		bootstrapCompleted = true;
		try {
			await bootstrapSuperAdmin(env);
		} catch (error) {
			console.error('Error during RBAC bootstrap:', error);
			// Continue processing the request even if bootstrap fails
		}
	}
}

const router = AutoRouter<IRequest, [Env, ExecutionContext]>({
	before: [preflight, bootstrapMiddleware],  // add preflight and bootstrap upstream
	finally: [corsify],   // and corsify downstream
});

// Define routes
router
	.post('*/register', (request, env, ctx) => handleRegister(request, env))
	.post('*/login', (request, env, ctx) => handleLogin(request, env))
	.post('*/logout', (request, env, ctx) => handleLogout(request, env))
	.post('*/forgot-password', (request, env, ctx) => handleForgotPassword(request, env))
	.post('*/forgot-password-validate', (request, env, ctx) => handleForgotPasswordValidate(request, env))
	.post('*/forgot-password-new-password', (request, env, ctx) => handleForgotPasswordNewPassword(request, env))
	.get('*/load-user', (request, env, ctx) => handleLoadUser(request, env));

// Add RBAC routes if RBAC is enabled
router
	.get('*/rbac/roles', (request, env, ctx) => {
		if (!env.RBAC_ENABLED || env.RBAC_ENABLED !== 'true') {
			return new Response(JSON.stringify({ error: 'RBAC is not enabled' }), { status: 403 });
		}
		return handleListRoles(request, env);
	})
	.post('*/rbac/roles', (request, env, ctx) => {
		if (!env.RBAC_ENABLED || env.RBAC_ENABLED !== 'true') {
			return new Response(JSON.stringify({ error: 'RBAC is not enabled' }), { status: 403 });
		}
		return handleCreateRole(request, env);
	})
	.get('*/rbac/permissions', (request, env, ctx) => {
		if (!env.RBAC_ENABLED || env.RBAC_ENABLED !== 'true') {
			return new Response(JSON.stringify({ error: 'RBAC is not enabled' }), { status: 403 });
		}
		return handleListPermissions(request, env);
	})
	.get('*/rbac/users/:userId/roles', (request, env, ctx) => {
		if (!env.RBAC_ENABLED || env.RBAC_ENABLED !== 'true') {
			return new Response(JSON.stringify({ error: 'RBAC is not enabled' }), { status: 403 });
		}
		return handleGetUserRoles(request, env);
	})
	.post('*/rbac/users/:userId/roles', (request, env, ctx) => {
		if (!env.RBAC_ENABLED || env.RBAC_ENABLED !== 'true') {
			return new Response(JSON.stringify({ error: 'RBAC is not enabled' }), { status: 403 });
		}
		return handleAssignRole(request, env);
	})
	.delete('*/rbac/users/:userId/roles/:roleId', (request, env, ctx) => {
		if (!env.RBAC_ENABLED || env.RBAC_ENABLED !== 'true') {
			return new Response(JSON.stringify({ error: 'RBAC is not enabled' }), { status: 403 });
		}
		return handleRemoveRole(request, env);
	})
	.all('*', () => new Response('Not Found', { status: 404 }));

export default { ...router }; // Export the router
