/**
 * Middleware exports for user-mgmt package
 * 
 * This module exports all middleware functions for easy importing
 */

// Session middleware
export { 
    withSession, 
    withOptionalSession,
    type RequestWithSession 
} from './session';

// RBAC middleware
export { 
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    requireAuth
} from './rbac';