import { Env, getRbacEnabled, getIpLoggingEnabled } from '../env';
import { PERMISSIONS, VALIDATION } from '../constants/rbac';
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
 * Helper function to create JSON error responses.
 * Consolidates the repeated error response pattern.
 *
 * @param message - The error message to include in the response
 * @param status - The HTTP status code
 * @returns A Response object with the error message
 */
function createErrorResponse(message: string, status: number): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Type guard to validate session data has the expected shape.
 * Provides runtime safety for data loaded from session storage.
 */
function isValidSessionData(data: unknown): data is SessionData {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const obj = data as Record<string, unknown>;
    return (
        typeof obj.username === 'string' &&
        typeof obj.firstName === 'string' &&
        typeof obj.lastName === 'string' &&
        (obj.permissions === undefined || Array.isArray(obj.permissions))
    );
}

/**
 * Safely parse an integer from a query parameter with NaN handling.
 * Returns the default value if parsing fails or result is NaN.
 */
function safeParseInt(value: string | null, defaultValue: number, maxValue?: number): number {
    if (!value) {
        return defaultValue;
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) {
        return defaultValue;
    }
    if (maxValue !== undefined) {
        return Math.min(parsed, maxValue);
    }
    return parsed;
}

/**
 * Get IP address for audit logging if enabled (GDPR-compliant).
 * Returns undefined if IP logging is disabled.
 */
function getAuditIpAddress(request: Request, env: Env): string | undefined {
    if (!getIpLoggingEnabled(env)) {
        return undefined;
    }
    return getIpAddressFromRequest(request) ?? undefined;
}

/**
 * Validate role name according to security constraints.
 * Returns error message if invalid, null if valid.
 */
function validateRoleName(name: string): string | null {
    const trimmed = name.trim();
    if (trimmed.length < VALIDATION.ROLE_NAME_MIN_LENGTH) {
        return `Role name must be at least ${VALIDATION.ROLE_NAME_MIN_LENGTH} characters`;
    }
    if (trimmed.length > VALIDATION.ROLE_NAME_MAX_LENGTH) {
        return `Role name must be at most ${VALIDATION.ROLE_NAME_MAX_LENGTH} characters`;
    }
    if (!VALIDATION.ROLE_NAME_PATTERN.test(trimmed)) {
        return 'Role name can only contain letters, numbers, underscores, colons, and hyphens';
    }
    return null;
}

/**
 * Validate description length.
 * Returns error message if invalid, null if valid.
 */
function validateDescription(description: string | undefined): string | null {
    if (description && description.length > VALIDATION.DESCRIPTION_MAX_LENGTH) {
        return `Description must be at most ${VALIDATION.DESCRIPTION_MAX_LENGTH} characters`;
    }
    return null;
}

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
            error: createErrorResponse('RBAC is not enabled', 403)
        };
    }

    // Get session
    const sessionId = getSessionIdFromCookies(request);
    if (!sessionId) {
        return {
            authorized: false,
            error: createErrorResponse('Authentication required', 401)
        };
    }

    // Load session data with type validation
    const rawSessionData = await loadSession(env, sessionId);
    if (!rawSessionData || !isValidSessionData(rawSessionData)) {
        return {
            authorized: false,
            error: createErrorResponse('Invalid session', 401)
        };
    }
    const sessionData = rawSessionData;

    // Check permission
    if (!sessionData.permissions || !hasPermission(sessionData.permissions, permission)) {
        return {
            authorized: false,
            error: createErrorResponse('Insufficient permissions', 403)
        };
    }

    return { authorized: true, sessionData };
}

/**
 * GET /rbac/roles - List all roles
 * Requires roles:read permission
 * Supports pagination via limit and offset query params
 */
export async function handleListRoles(request: Request, env: Env): Promise<Response> {
    try {
        // Check permission - requires roles:read
        const authResult = await requirePermission(request, env, PERMISSIONS.ROLES_READ);
        if (!authResult.authorized) {
            return authResult.error!;
        }

        // Parse pagination parameters with safe integer parsing
        const url = new URL(request.url);
        const limit = safeParseInt(url.searchParams.get('limit'), 100, 500);
        const offset = safeParseInt(url.searchParams.get('offset'), 0);

        // Query roles with pagination
        const query = `
            SELECT id, name, description, created_at as createdAt
            FROM roles
            ORDER BY name
            LIMIT ? OFFSET ?
        `;

        const result = await env.usersDB
            .prepare(query)
            .bind(limit, offset)
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

        return new Response(JSON.stringify({ roles, limit, offset }), {
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
        const authResult = await requirePermission(request, env, PERMISSIONS.ROLES_WRITE);
        if (!authResult.authorized) {
            return authResult.error!;
        }

        // Parse request body
        const body = await request.json() as { name: string; description?: string };
        const { name, description } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return new Response(JSON.stringify({ error: 'Role name is required' }), { status: 400 });
        }

        // Validate role name
        const nameError = validateRoleName(name);
        if (nameError) {
            return new Response(JSON.stringify({ error: nameError }), { status: 400 });
        }

        // Validate description length
        const descError = validateDescription(description);
        if (descError) {
            return new Response(JSON.stringify({ error: descError }), { status: 400 });
        }

        // Create the role
        const role = await createRole(env, name.trim(), description);

        // Get actor information for audit log
        const actorResult = await env.usersDB
            .prepare('SELECT UserID FROM User WHERE Username = ?')
            .bind(authResult.sessionData!.username)
            .first<{ UserID: number }>();

        // Log the audit event (IP logging is GDPR-configurable)
        if (actorResult) {
            await logRoleCreated(
                env,
                actorResult.UserID,
                authResult.sessionData!.username,
                role.id,
                role.name,
                role.description,
                getAuditIpAddress(request, env)
            );
        }

        return new Response(JSON.stringify({ role }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: unknown) {
        console.error('Error creating role:', error);

        // Handle duplicate role name - check for error code from roles.ts
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'DUPLICATE_ROLE_NAME') {
            // Return user-friendly error without exposing internal details
            return new Response(JSON.stringify({ error: 'Role with that name already exists' }), { status: 409 });
        }

        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}

/**
 * GET /rbac/permissions - List all permissions
 * Requires roles:read permission
 * Supports pagination via limit and offset query params
 */
export async function handleListPermissions(request: Request, env: Env): Promise<Response> {
    try {
        // Check permission - requires roles:read
        const authResult = await requirePermission(request, env, PERMISSIONS.ROLES_READ);
        if (!authResult.authorized) {
            return authResult.error!;
        }

        // Parse pagination parameters with safe integer parsing
        const url = new URL(request.url);
        const limit = safeParseInt(url.searchParams.get('limit'), 100, 500);
        const offset = safeParseInt(url.searchParams.get('offset'), 0);

        // Query permissions with pagination
        const query = `
            SELECT id, name, description, created_at as createdAt
            FROM permissions
            ORDER BY name
            LIMIT ? OFFSET ?
        `;

        const result = await env.usersDB
            .prepare(query)
            .bind(limit, offset)
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

        return new Response(JSON.stringify({ permissions, limit, offset }), {
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

        const rawSessionData = await loadSession(env, sessionId);
        if (!rawSessionData || !isValidSessionData(rawSessionData)) {
            return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
        }
        const sessionData = rawSessionData;

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
        const authResult = await requirePermission(request, env, PERMISSIONS.ROLES_ASSIGN);
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

        // Batch queries: fetch target user, actor user, and role in parallel using separate indexed queries
        const [targetUserResult, actorUserResult, roleResult] = await Promise.all([
            // Target user by ID (indexed lookup)
            env.usersDB
                .prepare('SELECT UserID, Username FROM User WHERE UserID = ?')
                .bind(userId)
                .first<{ UserID: number; Username: string }>(),
            // Actor user by username (indexed lookup)
            env.usersDB
                .prepare('SELECT UserID, Username FROM User WHERE Username = ?')
                .bind(authResult.sessionData!.username)
                .first<{ UserID: number; Username: string }>(),
            // Role details
            env.usersDB
                .prepare('SELECT id, name FROM roles WHERE id = ?')
                .bind(roleId)
                .first<{ id: string; name: string }>()
        ]);

        if (!targetUserResult) {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
        }

        if (!roleResult) {
            return new Response(JSON.stringify({ error: 'Role not found' }), { status: 404 });
        }

        // Assign the role
        await assignRole(env, userId, roleId);

        // Log the audit event (IP logging is GDPR-configurable)
        if (actorUserResult) {
            await logRoleAssigned(
                env,
                actorUserResult.UserID,
                authResult.sessionData!.username,
                targetUserResult.UserID,
                targetUserResult.Username,
                roleResult.id,
                roleResult.name,
                getAuditIpAddress(request, env)
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
        const authResult = await requirePermission(request, env, PERMISSIONS.ROLES_ASSIGN);
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

        // Batch queries: fetch target user, actor user, and role in parallel using separate indexed queries
        const [targetUserResult, actorUserResult, roleResult] = await Promise.all([
            // Target user by ID (indexed lookup)
            env.usersDB
                .prepare('SELECT UserID, Username FROM User WHERE UserID = ?')
                .bind(userId)
                .first<{ UserID: number; Username: string }>(),
            // Actor user by username (indexed lookup)
            env.usersDB
                .prepare('SELECT UserID, Username FROM User WHERE Username = ?')
                .bind(authResult.sessionData!.username)
                .first<{ UserID: number; Username: string }>(),
            // Role details
            env.usersDB
                .prepare('SELECT id, name FROM roles WHERE id = ?')
                .bind(roleId)
                .first<{ id: string; name: string }>()
        ]);

        // Remove the role
        await removeRole(env, userId, roleId);

        // Log the audit event (IP logging is GDPR-configurable)
        if (actorUserResult && targetUserResult && roleResult) {
            await logRoleRemoved(
                env,
                actorUserResult.UserID,
                authResult.sessionData!.username,
                targetUserResult.UserID,
                targetUserResult.Username,
                roleResult.id,
                roleResult.name,
                getAuditIpAddress(request, env)
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
        const authResult = await requirePermission(request, env, PERMISSIONS.ADMIN_ALL);
        if (!authResult.authorized) {
            return authResult.error!;
        }

        // Parse query parameters with input validation
        const url = new URL(request.url);
        const queryParams: AuditLogQueryParams = {};

        const action = url.searchParams.get('action');
        if (action && action.length <= VALIDATION.AUDIT_STRING_MAX_LENGTH) {
            queryParams.action = action as AuditLogQueryParams['action'];
        }

        const actorId = url.searchParams.get('actorId');
        if (actorId && /^\d+$/.test(actorId)) {
            queryParams.actorId = parseInt(actorId, 10);
        }

        const actorUsername = url.searchParams.get('actorUsername');
        if (actorUsername && actorUsername.length <= VALIDATION.AUDIT_STRING_MAX_LENGTH) {
            queryParams.actorUsername = actorUsername;
        }

        const targetType = url.searchParams.get('targetType');
        if (targetType && targetType.length <= VALIDATION.AUDIT_STRING_MAX_LENGTH) {
            queryParams.targetType = targetType as AuditLogQueryParams['targetType'];
        }

        const targetId = url.searchParams.get('targetId');
        if (targetId && targetId.length <= VALIDATION.AUDIT_STRING_MAX_LENGTH) {
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

        // Validate date range: startDate must be before endDate
        if (queryParams.startDate && queryParams.endDate &&
            queryParams.startDate > queryParams.endDate) {
            return new Response(JSON.stringify({ error: 'startDate must be before endDate' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const limit = url.searchParams.get('limit');
        if (limit && /^\d+$/.test(limit)) {
            queryParams.limit = Math.min(parseInt(limit, 10), 1000); // Cap at 1000
        }

        const offset = url.searchParams.get('offset');
        if (offset && /^\d+$/.test(offset)) {
            queryParams.offset = parseInt(offset, 10);
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