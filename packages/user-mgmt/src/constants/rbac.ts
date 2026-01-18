/**
 * RBAC Constants
 *
 * Centralized constants for role-based access control permissions,
 * role names, and validation rules.
 */

/**
 * Permission strings for RBAC authorization checks.
 * Use these constants instead of magic strings throughout the codebase.
 */
export const PERMISSIONS = {
    /** Full administrative access - bypasses all permission checks */
    ADMIN_ALL: 'admin:all',
    /** Permission to view roles and their configurations */
    ROLES_READ: 'roles:read',
    /** Permission to create, update, and delete roles */
    ROLES_WRITE: 'roles:write',
    /** Permission to assign or remove roles from users */
    ROLES_ASSIGN: 'roles:assign',
    /** Permission to view user information */
    USERS_READ: 'users:read',
    /** Permission to modify user information */
    USERS_WRITE: 'users:write',
} as const;

/**
 * Built-in role names.
 * These roles have special handling in the RBAC system.
 */
export const ROLES = {
    /** Super administrator with full system access */
    SUPER_ADMIN: 'SUPER_ADMIN',
    /** Default member role with basic permissions */
    MEMBER: 'MEMBER',
} as const;

/**
 * Validation constants for RBAC entities.
 * Used for input validation in role and permission operations.
 */
export const VALIDATION = {
    /** Minimum length for role names */
    ROLE_NAME_MIN_LENGTH: 2,
    /** Maximum length for role names */
    ROLE_NAME_MAX_LENGTH: 50,
    /** Pattern for valid role names: alphanumeric, underscore, colon, hyphen */
    ROLE_NAME_PATTERN: /^[a-zA-Z0-9_:\-]+$/,
    /** Maximum length for role descriptions */
    DESCRIPTION_MAX_LENGTH: 500,
    /** Maximum length for audit log strings (actor, action, details) */
    AUDIT_STRING_MAX_LENGTH: 255,
} as const;

/** Type representing valid permission values */
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/** Type representing valid role name values */
export type RoleName = typeof ROLES[keyof typeof ROLES];
