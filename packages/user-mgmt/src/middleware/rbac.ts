/**
 * RBAC (Role-Based Access Control) middleware for permission-based authorization.
 * This middleware provides various functions to check user permissions before
 * allowing access to protected routes.
 */

import { Env, getRbacEnabled } from '../env';
import { hasPermission } from '../rbac';
import { RequestWithSession } from './session';

/**
 * Middleware that requires the user to have a specific permission.
 * 
 * If RBAC is disabled, this middleware allows all requests to pass through.
 * Otherwise, it checks if the user has the required permission.
 * 
 * @param permission - The permission name required to access the route
 * @returns Middleware function that checks for the specified permission
 */
export function requirePermission(permission: string) {
    return async (
        request: RequestWithSession,
        env: Env
    ): Promise<Response | void> => {
        // If RBAC is not enabled, allow all requests
        if (!getRbacEnabled(env)) {
            return;
        }
        
        // Check if session data exists
        if (!request.sessionData) {
            return new Response(
                JSON.stringify({
                    error: 'Authentication required'
                }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
        
        // Extract permissions from session data
        const userPermissions = request.sessionData.permissions || [];
        
        // Check if user has the required permission
        if (!hasPermission(userPermissions, permission)) {
            // Log the required permission server-side for debugging
            console.log(`Permission denied: user lacks '${permission}' permission`);
            return new Response(
                JSON.stringify({
                    error: 'Insufficient permissions'
                }),
                {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
        
        // User has the required permission, continue to next middleware/handler
        return;
    };
}

/**
 * Middleware that requires the user to have ANY of the specified permissions (OR logic).
 * 
 * If RBAC is disabled, this middleware allows all requests to pass through.
 * Otherwise, it checks if the user has at least one of the required permissions.
 * 
 * @param permissions - Array of permission names, user needs at least one
 * @returns Middleware function that checks for any of the specified permissions
 */
export function requireAnyPermission(permissions: string[]) {
    return async (
        request: RequestWithSession,
        env: Env
    ): Promise<Response | void> => {
        // If RBAC is not enabled, allow all requests
        if (!getRbacEnabled(env)) {
            return;
        }
        
        // Check if session data exists
        if (!request.sessionData) {
            return new Response(
                JSON.stringify({
                    error: 'Authentication required'
                }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
        
        // Extract permissions from session data
        const userPermissions = request.sessionData.permissions || [];
        
        // Check if user has any of the required permissions
        const hasAnyRequiredPermission = permissions.some(permission => 
            hasPermission(userPermissions, permission)
        );
        
        if (!hasAnyRequiredPermission) {
            // Log the required permissions server-side for debugging
            console.log(`Permission denied: user lacks any of [${permissions.join(', ')}] permissions`);
            return new Response(
                JSON.stringify({
                    error: 'Insufficient permissions'
                }),
                {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
        
        // User has at least one required permission, continue
        return;
    };
}

/**
 * Middleware that requires the user to have ALL of the specified permissions (AND logic).
 * 
 * If RBAC is disabled, this middleware allows all requests to pass through.
 * Otherwise, it checks if the user has all of the required permissions.
 * 
 * @param permissions - Array of permission names, user needs all of them
 * @returns Middleware function that checks for all of the specified permissions
 */
export function requireAllPermissions(permissions: string[]) {
    return async (
        request: RequestWithSession,
        env: Env
    ): Promise<Response | void> => {
        // If RBAC is not enabled, allow all requests
        if (!getRbacEnabled(env)) {
            return;
        }
        
        // Check if session data exists
        if (!request.sessionData) {
            return new Response(
                JSON.stringify({
                    error: 'Authentication required'
                }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
        
        // Extract permissions from session data
        const userPermissions = request.sessionData.permissions || [];
        
        // Check if user has all of the required permissions
        const missingPermissions = permissions.filter(permission => 
            !hasPermission(userPermissions, permission)
        );
        
        if (missingPermissions.length > 0) {
            // Log the missing permissions server-side for debugging
            console.log(`Permission denied: user missing [${missingPermissions.join(', ')}] permissions`);
            return new Response(
                JSON.stringify({
                    error: 'Insufficient permissions'
                }),
                {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
        
        // User has all required permissions, continue
        return;
    };
}

/**
 * Middleware that checks if the user is authenticated (has a valid session).
 * This is a simpler version that doesn't check specific permissions.
 * 
 * @returns Middleware function that checks for authentication
 */
export function requireAuth() {
    return async (
        request: RequestWithSession,
        env: Env
    ): Promise<Response | void> => {
        if (!request.sessionData) {
            return new Response(
                JSON.stringify({ 
                    error: 'Authentication required'
                }),
                { 
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
        
        // User is authenticated, continue
        return;
    };
}