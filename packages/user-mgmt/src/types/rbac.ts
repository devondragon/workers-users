/**
 * Represents a role in the RBAC system
 */
export interface Role {
    id: string;
    name: string;
    description: string;
    createdAt: Date;
}

/**
 * Represents a permission in the RBAC system
 */
export interface Permission {
    id: string;
    name: string;
    description: string;
    createdAt: Date;
}

/**
 * Represents the association between a user and a role
 */
export interface UserRole {
    userId: string;
    roleId: string;
    assignedAt: Date;
}

/**
 * Enhanced session data that includes RBAC permissions and roles
 */
export interface SessionData {
    username: string;
    firstName: string;
    lastName: string;
    permissions?: string[];
    roles?: Role[];
}

/**
 * Audit action types for RBAC operations
 */
export type AuditAction =
    | 'ROLE_ASSIGNED'
    | 'ROLE_REMOVED'
    | 'ROLE_CREATED'
    | 'ROLE_UPDATED'
    | 'ROLE_DELETED'
    | 'PERMISSION_CREATED'
    | 'PERMISSION_DELETED'
    | 'BOOTSTRAP_SUPER_ADMIN'
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILURE'
    | 'LOGOUT';

/**
 * Target types for audit log entries
 */
export type AuditTargetType = 'USER' | 'ROLE' | 'PERMISSION' | 'SYSTEM';

/**
 * Represents an entry in the audit log
 */
export interface AuditLogEntry {
    id: string;
    timestamp: Date;
    action: AuditAction;
    actorId: number | null;
    actorUsername: string | null;
    targetType: AuditTargetType;
    targetId: string | null;
    targetName: string | null;
    details: string | null;
    ipAddress: string | null;
    success: boolean;
}

/**
 * Parameters for creating an audit log entry
 */
export interface AuditLogParams {
    action: AuditAction;
    actorId?: number | null;
    actorUsername?: string | null;
    targetType: AuditTargetType;
    targetId?: string | null;
    targetName?: string | null;
    details?: string | null;
    ipAddress?: string | null;
    success?: boolean;
}