/**
 * RBAC (Role-Based Access Control) module
 * 
 * This module provides functions for managing user permissions and roles
 * in the user management system.
 */

// Export all permission-related functions
export {
    getUserPermissions,
    getUserPermissionsFromDB,
    hasPermission,
    getUserRoles
} from './permissions';

// Export cache functions
export {
    getCachedPermissions,
    setCachedPermissions,
    invalidateCachedPermissions,
    getPermissionsCacheKey
} from './cache';

// Export all role management functions
export {
    assignRole,
    removeRole,
    createRole,
    getDefaultRoleId,
    assignDefaultRole
} from './roles';

// Export bootstrap functions
export {
    bootstrapSuperAdmin
} from './bootstrap';

// Export audit logging functions
export {
    logAuditEvent,
    logRoleAssigned,
    logRoleRemoved,
    logRoleCreated,
    logBootstrapSuperAdmin,
    logAuthorizationDenied,
    getAuditLogs,
    getIpAddressFromRequest
} from './audit';

// Re-export RBAC types for convenience
export type {
    Role,
    Permission,
    UserRole,
    SessionData,
    AuditAction,
    AuditTargetType,
    AuditLogEntry,
    AuditLogParams
} from '../types/rbac';