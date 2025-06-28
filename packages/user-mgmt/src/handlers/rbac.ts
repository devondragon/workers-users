import { Env, getRbacEnabled } from '../env';
import { getSessionIdFromCookies } from '../utils';
import { loadSession } from '../session';
import { 
    hasPermission, 
    getUserRoles, 
    assignRole, 
    removeRole, 
    createRole 
} from '../rbac';
import { Role, Permission, SessionData } from '../types/rbac';

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

        return new Response(JSON.stringify({ role }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error('Error creating role:', error);
        
        // Handle duplicate role name
        if (error.message && error.message.includes('already exists')) {
            return new Response(JSON.stringify({ error: error.message }), { status: 409 });
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
            .prepare('SELECT UserID FROM Users WHERE Username = ?')
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
            .prepare('SELECT UserID FROM Users WHERE UserID = ?')
            .bind(userId)
            .first();
        
        if (!userResult) {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
        }

        // Verify role exists
        const roleResult = await env.usersDB
            .prepare('SELECT id FROM roles WHERE id = ?')
            .bind(roleId)
            .first();
        
        if (!roleResult) {
            return new Response(JSON.stringify({ error: 'Role not found' }), { status: 404 });
        }

        // Assign the role
        await assignRole(env, userId, roleId);

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

        // Remove the role
        await removeRole(env, userId, roleId);

        return new Response(JSON.stringify({ message: 'Role removed successfully' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error removing role:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}