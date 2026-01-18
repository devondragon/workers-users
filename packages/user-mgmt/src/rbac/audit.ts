import { Env } from '../env';
import { AuditLogEntry, AuditLogParams, AuditAction, AuditTargetType } from '../types/rbac';

/**
 * Logs an audit event to the database.
 * This function is designed to fail gracefully - it will log errors but not throw,
 * to avoid disrupting the main operation.
 *
 * @param env - The environment configuration containing the database connection
 * @param params - The parameters for the audit log entry
 */
export async function logAuditEvent(env: Env, params: AuditLogParams): Promise<void> {
    try {
        const query = `
            INSERT INTO audit_logs (
                action,
                actor_id,
                actor_username,
                target_type,
                target_id,
                target_name,
                details,
                ip_address,
                success
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await env.usersDB
            .prepare(query)
            .bind(
                params.action,
                params.actorId ?? null,
                params.actorUsername ?? null,
                params.targetType,
                params.targetId ?? null,
                params.targetName ?? null,
                params.details ?? null,
                params.ipAddress ?? null,
                params.success !== false ? 1 : 0
            )
            .run();
    } catch (error) {
        // Log error but don't throw - audit logging should not break the main operation
        console.error('Error logging audit event:', error);
    }
}

/**
 * Logs a role assignment event.
 *
 * @param env - The environment configuration
 * @param actorId - The ID of the user performing the action
 * @param actorUsername - The username of the user performing the action
 * @param targetUserId - The ID of the user receiving the role
 * @param targetUsername - The username of the user receiving the role
 * @param roleId - The ID of the role being assigned
 * @param roleName - The name of the role being assigned
 * @param ipAddress - Optional IP address of the actor
 */
export async function logRoleAssigned(
    env: Env,
    actorId: number,
    actorUsername: string,
    targetUserId: number,
    targetUsername: string,
    roleId: string,
    roleName: string,
    ipAddress?: string
): Promise<void> {
    await logAuditEvent(env, {
        action: 'ROLE_ASSIGNED',
        actorId,
        actorUsername,
        targetType: 'USER',
        targetId: targetUserId.toString(),
        targetName: targetUsername,
        details: JSON.stringify({ roleId, roleName }),
        ipAddress: ipAddress ?? null,
        success: true,
    });
}

/**
 * Logs a role removal event.
 *
 * @param env - The environment configuration
 * @param actorId - The ID of the user performing the action
 * @param actorUsername - The username of the user performing the action
 * @param targetUserId - The ID of the user losing the role
 * @param targetUsername - The username of the user losing the role
 * @param roleId - The ID of the role being removed
 * @param roleName - The name of the role being removed
 * @param ipAddress - Optional IP address of the actor
 */
export async function logRoleRemoved(
    env: Env,
    actorId: number,
    actorUsername: string,
    targetUserId: number,
    targetUsername: string,
    roleId: string,
    roleName: string,
    ipAddress?: string
): Promise<void> {
    await logAuditEvent(env, {
        action: 'ROLE_REMOVED',
        actorId,
        actorUsername,
        targetType: 'USER',
        targetId: targetUserId.toString(),
        targetName: targetUsername,
        details: JSON.stringify({ roleId, roleName }),
        ipAddress: ipAddress ?? null,
        success: true,
    });
}

/**
 * Logs a role creation event.
 *
 * @param env - The environment configuration
 * @param actorId - The ID of the user performing the action
 * @param actorUsername - The username of the user performing the action
 * @param roleId - The ID of the newly created role
 * @param roleName - The name of the newly created role
 * @param roleDescription - Optional description of the role
 * @param ipAddress - Optional IP address of the actor
 */
export async function logRoleCreated(
    env: Env,
    actorId: number,
    actorUsername: string,
    roleId: string,
    roleName: string,
    roleDescription?: string,
    ipAddress?: string
): Promise<void> {
    await logAuditEvent(env, {
        action: 'ROLE_CREATED',
        actorId,
        actorUsername,
        targetType: 'ROLE',
        targetId: roleId,
        targetName: roleName,
        details: roleDescription ? JSON.stringify({ description: roleDescription }) : null,
        ipAddress: ipAddress ?? null,
        success: true,
    });
}

/**
 * Logs a bootstrap super admin event (system-level action).
 *
 * @param env - The environment configuration
 * @param userId - The ID of the user who was made super admin
 * @param username - The username of the user who was made super admin
 */
export async function logBootstrapSuperAdmin(
    env: Env,
    userId: number,
    username: string
): Promise<void> {
    await logAuditEvent(env, {
        action: 'BOOTSTRAP_SUPER_ADMIN',
        actorId: null,
        actorUsername: 'SYSTEM',
        targetType: 'USER',
        targetId: userId.toString(),
        targetName: username,
        details: JSON.stringify({ reason: 'System bootstrap via RBAC_ADMIN_EMAIL' }),
        ipAddress: null,
        success: true,
    });
}

/**
 * Query parameters for fetching audit logs
 */
export interface AuditLogQueryParams {
    action?: AuditAction;
    actorId?: number;
    actorUsername?: string;
    targetType?: AuditTargetType;
    targetId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}

/**
 * Retrieves audit log entries from the database with optional filtering.
 *
 * @param env - The environment configuration
 * @param params - Optional query parameters for filtering
 * @returns An array of audit log entries
 */
export async function getAuditLogs(
    env: Env,
    params: AuditLogQueryParams = {}
): Promise<AuditLogEntry[]> {
    const conditions: string[] = [];
    const bindings: (string | number | null)[] = [];

    if (params.action) {
        conditions.push('action = ?');
        bindings.push(params.action);
    }

    if (params.actorId !== undefined) {
        conditions.push('actor_id = ?');
        bindings.push(params.actorId);
    }

    if (params.actorUsername) {
        conditions.push('actor_username = ?');
        bindings.push(params.actorUsername);
    }

    if (params.targetType) {
        conditions.push('target_type = ?');
        bindings.push(params.targetType);
    }

    if (params.targetId) {
        conditions.push('target_id = ?');
        bindings.push(params.targetId);
    }

    if (params.startDate) {
        conditions.push('timestamp >= ?');
        bindings.push(params.startDate.toISOString());
    }

    if (params.endDate) {
        conditions.push('timestamp <= ?');
        bindings.push(params.endDate.toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;

    const query = `
        SELECT
            id,
            timestamp,
            action,
            actor_id as actorId,
            actor_username as actorUsername,
            target_type as targetType,
            target_id as targetId,
            target_name as targetName,
            details,
            ip_address as ipAddress,
            success
        FROM audit_logs
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
    `;

    bindings.push(limit, offset);

    try {
        const result = await env.usersDB
            .prepare(query)
            .bind(...bindings)
            .all<{
                id: string;
                timestamp: string;
                action: AuditAction;
                actorId: number | null;
                actorUsername: string | null;
                targetType: AuditTargetType;
                targetId: string | null;
                targetName: string | null;
                details: string | null;
                ipAddress: string | null;
                success: number;
            }>();

        if (!result.success) {
            throw new Error('Failed to retrieve audit logs');
        }

        return result.results.map(row => ({
            id: row.id,
            timestamp: new Date(row.timestamp),
            action: row.action,
            actorId: row.actorId,
            actorUsername: row.actorUsername,
            targetType: row.targetType,
            targetId: row.targetId,
            targetName: row.targetName,
            details: row.details,
            ipAddress: row.ipAddress,
            success: row.success === 1,
        }));
    } catch (error) {
        console.error('Error retrieving audit logs:', error);
        throw new Error('Failed to retrieve audit logs');
    }
}

/**
 * Logs a failed authorization attempt.
 * Used to track when users attempt to access resources without proper permissions.
 *
 * @param env - The environment configuration
 * @param userId - The ID of the user who was denied (if known)
 * @param username - The username of the user who was denied (if known)
 * @param requiredPermission - The permission that was required
 * @param ipAddress - Optional IP address of the user
 */
export async function logAuthorizationDenied(
    env: Env,
    userId: number | null,
    username: string | null,
    requiredPermission: string,
    ipAddress?: string
): Promise<void> {
    await logAuditEvent(env, {
        action: 'AUTHORIZATION_DENIED',
        actorId: userId,
        actorUsername: username,
        targetType: 'SYSTEM',
        targetId: null,
        targetName: null,
        details: JSON.stringify({ requiredPermission }),
        ipAddress: ipAddress ?? null,
        success: false,
    });
}

/**
 * Extracts the IP address from a request.
 *
 * @param request - The incoming HTTP request
 * @returns The IP address or null if not available
 */
export function getIpAddressFromRequest(request: Request): string | null {
    // Cloudflare provides the client IP in the CF-Connecting-IP header
    return request.headers.get('CF-Connecting-IP')
        ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
        ?? null;
}
