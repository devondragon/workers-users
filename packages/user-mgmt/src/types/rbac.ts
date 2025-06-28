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