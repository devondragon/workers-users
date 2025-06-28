/**
 * Example routes demonstrating middleware usage
 * 
 * This file shows how to integrate the session and RBAC middleware
 * with itty-router in the user-mgmt worker.
 */

import { AutoRouter, IRequest } from 'itty-router';
import { Env } from '../env';
import { 
    withSession, 
    withOptionalSession,
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    requireAuth,
    RequestWithSession
} from './index';

// Example of creating a router with middleware
export function createProtectedRoutes() {
    const router = AutoRouter<RequestWithSession, [Env, ExecutionContext]>();
    
    // Public route - no authentication required
    router.get('*/public/info', async (request, env) => {
        return new Response(JSON.stringify({ 
            message: 'This is public information' 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    });
    
    // Public route with optional session - shows different content based on auth status
    router.get('*/public/greeting', 
        withOptionalSession,
        async (request: RequestWithSession, env) => {
            if (request.sessionData) {
                return new Response(JSON.stringify({ 
                    message: `Welcome back, ${request.sessionData.firstName}!`,
                    authenticated: true
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            return new Response(JSON.stringify({ 
                message: 'Welcome, guest!',
                authenticated: false
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    );
    
    // Protected route - requires authentication only
    router.get('*/user/profile',
        withSession,
        requireAuth(),
        async (request: RequestWithSession, env) => {
            return new Response(JSON.stringify({
                username: request.sessionData!.username,
                firstName: request.sessionData!.firstName,
                lastName: request.sessionData!.lastName,
                permissions: request.sessionData!.permissions || []
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    );
    
    // Admin route - requires specific permission
    router.get('*/admin/users',
        withSession,
        requirePermission('user:list'),
        async (request: RequestWithSession, env) => {
            // Handler would fetch and return user list
            return new Response(JSON.stringify({
                message: 'User list would be returned here',
                requestedBy: request.sessionData!.username
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    );
    
    // Create user - requires user:create permission
    router.post('*/admin/users',
        withSession,
        requirePermission('user:create'),
        async (request: RequestWithSession, env) => {
            const userData = await request.json();
            return new Response(JSON.stringify({
                message: 'User would be created here',
                userData,
                createdBy: request.sessionData!.username
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    );
    
    // Update user - requires either admin:all or user:update permission
    router.put('*/admin/users/:id',
        withSession,
        requireAnyPermission(['admin:all', 'user:update']),
        async (request: RequestWithSession, env) => {
            const userId = request.params.id;
            const updateData = await request.json();
            return new Response(JSON.stringify({
                message: `User ${userId} would be updated here`,
                updateData,
                updatedBy: request.sessionData!.username
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    );
    
    // Delete user - requires both user:delete AND admin:write permissions
    router.delete('*/admin/users/:id',
        withSession,
        requireAllPermissions(['user:delete', 'admin:write']),
        async (request: RequestWithSession, env) => {
            const userId = request.params.id;
            return new Response(JSON.stringify({
                message: `User ${userId} would be deleted here`,
                deletedBy: request.sessionData!.username
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    );
    
    // System configuration - requires multiple permissions
    router.put('*/admin/system/config',
        withSession,
        requireAllPermissions(['system:configure', 'admin:write']),
        async (request: RequestWithSession, env) => {
            const config = await request.json();
            return new Response(JSON.stringify({
                message: 'System configuration would be updated here',
                config,
                updatedBy: request.sessionData!.username
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    );
    
    // Reports - requires any reporting permission
    router.get('*/reports/:type',
        withSession,
        requireAnyPermission(['report:view', 'report:admin', 'admin:all']),
        async (request: RequestWithSession, env) => {
            const reportType = request.params.type;
            return new Response(JSON.stringify({
                message: `Report of type '${reportType}' would be generated here`,
                requestedBy: request.sessionData!.username,
                permissions: request.sessionData!.permissions
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    );
    
    return router;
}