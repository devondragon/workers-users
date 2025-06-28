/**
 * RBAC (Role-Based Access Control) module
 * 
 * This module provides functions for managing user permissions and roles
 * in the user management system.
 */

// Export all permission-related functions
export {
    getUserPermissions,
    hasPermission,
    getUserRoles
} from './permissions';

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

// Re-export RBAC types for convenience
export type {
    Role,
    Permission,
    UserRole,
    SessionData
} from '../types/rbac';