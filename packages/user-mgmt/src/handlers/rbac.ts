import { Env, getRbacEnabled } from '../env';
import { getSessionIdFromCookies } from '../utils';
import { loadSession } from '../session';
import {
    hasPermission,
    getUserRoles,
    assignRole,
    removeRole,
    createRole,
    logRoleAssigned,
    logRoleRemoved,
    logRoleCreated,
    getAuditLogs,
    getIpAddressFromRequest
} from '../rbac';
import { Role, Permission, SessionData } from '../types/rbac';
import { AuditLogQueryParams } from '../rbac/audit';

/**
 * Middleware to check if user is authenticated and has required permission
 */
async function requirePermission(
    request: Request, 
    env: Env, 
    permission: string
): Promise<{ authorized: boolean; sessionData?: SessionData; error?: Response }> {
    // Check if RBAC is enabled
    if (!getRbacEnabled(env)) {
        return { 
            authorized: false, 
            error: new Response(JSON.stringify({ error: 'RBAC is not enabled' }), { status: 403 })
        };
    }

    // Get session
    const sessionId = getSessionIdFromCookies(request);
    if (!sessionId) {
        return { 
            authorized: false, 
            error: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })
        };
    }

    // Load session data
    const sessionData = await loadSession(env, sessionId) as SessionData;
    if (!sessionData) {
        return { 
            authorized: false, 
            error: new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 })
        };
    }

    // Check permission
    if (!sessionData.permissions || !hasPermission(sessionData.permissions, permission)) {
        return { 
            authorized: false, 
            error: new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403 })
        };
    }

    return { authorized: true, sessionData };
}

/**
 * GET /rbac/roles - List all roles
 * Requires authentication
 */
export async function handleListRoles(request: Request, env: Env): Promise<Response> {
    try {
        // Check if user is authenticated
        const sessionId = getSessionIdFromCookies(request);
        if (!sessionId) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
        }

        const sessionData = await loadSession(env, sessionId);
        if (!sessionData) {
            return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
        }

        // Query all roles
        const query = `
            SELECT id, name, description, created_at as createdAt
            FROM roles
            ORDER BY name
        `;
        
        const result = await env.usersDB
            .prepare(query)
            .all<{
                id: string;
                name: string;
                description: string;
                createdAt: string;
            }>();
        
        if (!result.success) {
            throw new Error('Failed to retrieve roles');
        }
        
        // Convert to Role objects
        const roles: Role[] = result.results.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            createdAt: new Date(row.createdAt)
        }));

        return new Response(JSON.stringify({ roles }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error listing roles:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}

/**
 * POST /rbac/roles - Create new role
 * Requires roles:write permission
 */
export async function handleCreateRole(request: Request, env: Env): Promise<Response> {
    try {
        // Check permission
        const authResult = await requirePermission(request, env, 'roles:write');
        if (!authResult.authorized) {
            return authResult.error!;
        }

        // Parse request body
        const body = await request.json() as { name: string; description?: string };
        const { name, description } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return new Response(JSON.stringify({ error: 'Role name is required' }), { status: 400 });
        }

        // Create the role
        const role = await createRole(env, name.trim(), description);

        // Get actor information for audit log
        const actorResult = await env.usersDB
            .prepare('SELECT UserID FROM User WHERE Username = ?')
            .bind(authResult.sessionData!.username)
            .first<{ UserID: number }>();

        // Log the audit event
        if (actorResult) {
            await logRoleCreated(
                env,
                actorResult.UserID,
                authResult.sessionData!.username,
                role.id,
                role.name,
                role.description,
                getIpAddressFromRequest(request) ?? undefined
            );
        }

        return new Response(JSON.stringify({ role }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: unknown) {
        console.error('Error creating role:', error);

        // Handle duplicate role name - sanitize error message to prevent stack trace exposure
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('already exists')) {
            // Return generic error without exposing stack trace or internal details
            return new Response(JSON.stringify({ error: 'Role with that name already exists' }), { status: 409 });
        }

        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}

/**
 * GET /rbac/permissions - List all permissions
 * Requires authentication
 */
export async function handleListPermissions(request: Request, env: Env): Promise<Response> {
    try {
        // Check if user is authenticated
        const sessionId = getSessionIdFromCookies(request);
        if (!sessionId) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
        }

        const sessionData = await loadSession(env, sessionId);
        if (!sessionData) {
            return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
        }

        // Query all permissions
        const query = `
            SELECT id, name, description, created_at as createdAt
            FROM permissions
            ORDER BY name
        `;
        
        const result = await env.usersDB
            .prepare(query)
            .all<{
                id: string;
                name: string;
                description: string;
                createdAt: string;
            }>();
        
        if (!result.success) {
            throw new Error('Failed to retrieve permissions');
        }
        
        // Convert to Permission objects
        const permissions: Permission[] = result.results.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            createdAt: new Date(row.createdAt)
        }));

        return new Response(JSON.stringify({ permissions }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error listing permissions:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}

/**
 * GET /rbac/users/:userId/roles - Get user's roles
 * Requires authentication and either requesting own roles or roles:read permission
 */
export async function handleGetUserRoles(request: Request, env: Env): Promise<Response> {
    try {
        // Extract userId from URL
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/');
        const userIdIndex = pathParts.indexOf('users') + 1;
        const userIdStr = pathParts[userIdIndex];
        
        if (!userIdStr || isNaN(parseInt(userIdStr))) {
            return new Response(JSON.stringify({ error: 'Invalid user ID' }), { status: 400 });
        }
        
        const userId = parseInt(userIdStr);

        // Check if user is authenticated
        const sessionId = getSessionIdFromCookies(request);
        if (!sessionId) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
        }

        const sessionData = await loadSession(env, sessionId) as SessionData;
        if (!sessionData) {
            return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
        }

        // Get current user's ID for comparison
        const currentUserResult = await env.usersDB
            .prepare('SELECT UserID FROM User WHERE Username = ?')
            .bind(sessionData.username)
            .first<{ UserID: number }>();
        
        if (!currentUserResult) {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
        }

        // Check if requesting own roles or has permission
        const isOwnRoles = currentUserResult.UserID === userId;
        if (!isOwnRoles && sessionData.permissions && !hasPermission(sessionData.permissions, 'roles:read')) {
            return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403 });
        }

        // Get user's roles
        const roles = await getUserRoles(env, userId);

        return new Response(JSON.stringify({ roles }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error getting user roles:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}

/**
 * POST /rbac/users/:userId/roles - Assign role to user
 * Requires roles:assign permission
 */
export async function handleAssignRole(request: Request, env: Env): Promise<Response> {
    try {
        // Check permission
        const authResult = await requirePermission(request, env, 'roles:assign');
        if (!authResult.authorized) {
            return authResult.error!;
        }

        // Extract userId from URL
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/');
        const userIdIndex = pathParts.indexOf('users') + 1;
        const userIdStr = pathParts[userIdIndex];
        
        if (!userIdStr || isNaN(parseInt(userIdStr))) {
            return new Response(JSON.stringify({ error: 'Invalid user ID' }), { status: 400 });
        }
        
        const userId = parseInt(userIdStr);

        // Parse request body
        const body = await request.json() as { roleId: string };
        const { roleId } = body;

        if (!roleId || typeof roleId !== 'string') {
            return new Response(JSON.stringify({ error: 'Role ID is required' }), { status: 400 });
        }

        // Verify user exists
        const userResult = await env.usersDB
            .prepare('SELECT UserID FROM User WHERE UserID = ?')
            .bind(userId)
            .first();
        
        if (!userResult) {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
        }

        // Verify role exists and get role details
        const roleResult = await env.usersDB
            .prepare('SELECT id, name FROM roles WHERE id = ?')
            .bind(roleId)
            .first<{ id: string; name: string }>();

        if (!roleResult) {
            return new Response(JSON.stringify({ error: 'Role not found' }), { status: 404 });
        }

        // Get target user details
        const targetUserResult = await env.usersDB
            .prepare('SELECT UserID, Username FROM User WHERE UserID = ?')
            .bind(userId)
            .first<{ UserID: number; Username: string }>();

        // Get actor information for audit log
        const actorResult = await env.usersDB
            .prepare('SELECT UserID FROM User WHERE Username = ?')
            .bind(authResult.sessionData!.username)
            .first<{ UserID: number }>();

        // Assign the role
        await assignRole(env, userId, roleId);

        // Log the audit event
        if (actorResult && targetUserResult) {
            await logRoleAssigned(
                env,
                actorResult.UserID,
                authResult.sessionData!.username,
                targetUserResult.UserID,
                targetUserResult.Username,
                roleResult.id,
                roleResult.name,
                getIpAddressFromRequest(request) ?? undefined
            );
        }

        return new Response(JSON.stringify({ message: 'Role assigned successfully' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error assigning role:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}

/**
 * DELETE /rbac/users/:userId/roles/:roleId - Remove role from user
 * Requires roles:assign permission
 */
export async function handleRemoveRole(request: Request, env: Env): Promise<Response> {
    try {
        // Check permission
        const authResult = await requirePermission(request, env, 'roles:assign');
        if (!authResult.authorized) {
            return authResult.error!;
        }

        // Extract userId and roleId from URL
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/');
        const userIdIndex = pathParts.indexOf('users') + 1;
        const rolesIndex = pathParts.indexOf('roles', userIdIndex) + 1;
        
        const userIdStr = pathParts[userIdIndex];
        const roleId = pathParts[rolesIndex];
        
        if (!userIdStr || isNaN(parseInt(userIdStr))) {
            return new Response(JSON.stringify({ error: 'Invalid user ID' }), { status: 400 });
        }
        
        if (!roleId) {
            return new Response(JSON.stringify({ error: 'Invalid role ID' }), { status: 400 });
        }

        const userId = parseInt(userIdStr);

        // Get role details for audit log
        const roleResult = await env.usersDB
            .prepare('SELECT id, name FROM roles WHERE id = ?')
            .bind(roleId)
            .first<{ id: string; name: string }>();

        // Get target user details for audit log
        const targetUserResult = await env.usersDB
            .prepare('SELECT UserID, Username FROM User WHERE UserID = ?')
            .bind(userId)
            .first<{ UserID: number; Username: string }>();

        // Get actor information for audit log
        const actorResult = await env.usersDB
            .prepare('SELECT UserID FROM User WHERE Username = ?')
            .bind(authResult.sessionData!.username)
            .first<{ UserID: number }>();

        // Remove the role
        await removeRole(env, userId, roleId);

        // Log the audit event
        if (actorResult && targetUserResult && roleResult) {
            await logRoleRemoved(
                env,
                actorResult.UserID,
                authResult.sessionData!.username,
                targetUserResult.UserID,
                targetUserResult.Username,
                roleResult.id,
                roleResult.name,
                getIpAddressFromRequest(request) ?? undefined
            );
        }

        return new Response(JSON.stringify({ message: 'Role removed successfully' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error removing role:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}

/**
 * GET /rbac/audit-logs - Query audit logs
 * Requires admin:all permission
 *
 * Query parameters:
 * - action: Filter by action type
 * - actorId: Filter by actor user ID
 * - actorUsername: Filter by actor username
 * - targetType: Filter by target type (USER, ROLE, PERMISSION, SYSTEM)
 * - targetId: Filter by target ID
 * - startDate: Filter by start date (ISO 8601 format)
 * - endDate: Filter by end date (ISO 8601 format)
 * - limit: Maximum number of results (default: 100)
 * - offset: Pagination offset (default: 0)
 */
export async function handleGetAuditLogs(request: Request, env: Env): Promise<Response> {
    try {
        // Check permission - requires admin:all
        const authResult = await requirePermission(request, env, 'admin:all');
        if (!authResult.authorized) {
            return authResult.error!;
        }

        // Parse query parameters
        const url = new URL(request.url);
        const queryParams: AuditLogQueryParams = {};

        const action = url.searchParams.get('action');
        if (action) {
            queryParams.action = action as AuditLogQueryParams['action'];
        }

        const actorId = url.searchParams.get('actorId');
        if (actorId && !isNaN(parseInt(actorId))) {
            queryParams.actorId = parseInt(actorId);
        }

        const actorUsername = url.searchParams.get('actorUsername');
        if (actorUsername) {
            queryParams.actorUsername = actorUsername;
        }

        const targetType = url.searchParams.get('targetType');
        if (targetType) {
            queryParams.targetType = targetType as AuditLogQueryParams['targetType'];
        }

        const targetId = url.searchParams.get('targetId');
        if (targetId) {
            queryParams.targetId = targetId;
        }

        const startDate = url.searchParams.get('startDate');
        if (startDate) {
            const date = new Date(startDate);
            if (!isNaN(date.getTime())) {
                queryParams.startDate = date;
            }
        }

        const endDate = url.searchParams.get('endDate');
        if (endDate) {
            const date = new Date(endDate);
            if (!isNaN(date.getTime())) {
                queryParams.endDate = date;
            }
        }

        const limit = url.searchParams.get('limit');
        if (limit && !isNaN(parseInt(limit))) {
            queryParams.limit = Math.min(parseInt(limit), 1000); // Cap at 1000
        }

        const offset = url.searchParams.get('offset');
        if (offset && !isNaN(parseInt(offset))) {
            queryParams.offset = parseInt(offset);
        }

        // Fetch audit logs
        const logs = await getAuditLogs(env, queryParams);

        return new Response(JSON.stringify({ logs }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}