/**
 * Bootstrap functionality for RBAC system
 *
 * This module provides functions to bootstrap the RBAC system,
 * particularly for setting up the initial super admin user.
 *
 * SECURITY NOTE: The current User table does not have an email verification
 * column. This means the bootstrap process cannot verify that the user has
 * confirmed ownership of their email address. For production deployments,
 * consider:
 * 1. Adding email verification to the registration flow
 * 2. Manually verifying the super admin before enabling RBAC
 * 3. Using a separate secure channel to confirm admin identity
 */

import { Env, getSuperAdminEmail, getUsersDB } from '../env';
import { assignRole } from './roles';
import { logBootstrapSuperAdmin } from './audit';
import { ROLES } from '../constants/rbac';

/**
 * Gets the super admin role ID
 * @param env - The environment configuration
 * @returns The super admin role ID
 */
async function getSuperAdminRoleId(env: Env): Promise<string | null> {
    const db = getUsersDB(env);
    const result = await db.prepare(
        'SELECT id FROM roles WHERE name = ?'
    ).bind(ROLES.SUPER_ADMIN).first();

    return result ? result.id as string : null;
}

/**
 * Checks if a user already has the super admin role
 * @param env - The environment configuration
 * @param userId - The user ID to check
 * @returns True if the user has the super admin role
 */
async function userHasSuperAdminRole(env: Env, userId: string): Promise<boolean> {
    const db = getUsersDB(env);
    const result = await db.prepare(
        `SELECT ur.user_id
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = ? AND r.name = ?`
    ).bind(userId, ROLES.SUPER_ADMIN).first();

    return result !== null;
}

/**
 * Bootstraps the super admin user if configured
 * 
 * This function:
 * - Checks if SUPER_ADMIN_EMAIL is configured
 * - Finds the user with that email
 * - Assigns the SUPER_ADMIN role if not already assigned
 * - Logs the bootstrap action
 * 
 * @param env - The environment configuration
 */
export async function bootstrapSuperAdmin(env: Env): Promise<void> {
    const superAdminEmail = getSuperAdminEmail(env);
    
    if (!superAdminEmail) {
        console.log('RBAC Bootstrap: SUPER_ADMIN_EMAIL not configured, skipping bootstrap');
        return;
    }
    
    try {
        const db = getUsersDB(env);

        // Find user by email
        const user = await db.prepare(
            'SELECT UserID FROM User WHERE Username = ?'
        ).bind(superAdminEmail).first();

        if (!user) {
            console.log(`RBAC Bootstrap: User with email ${superAdminEmail} not found`);
            return;
        }

        const userId = user.UserID as number;

        // Check if user already has super admin role
        const hasSuperAdmin = await userHasSuperAdminRole(env, userId.toString());
        if (hasSuperAdmin) {
            console.log(`RBAC Bootstrap: User ${superAdminEmail} already has SUPER_ADMIN role`);
            return;
        }

        // Get super admin role ID
        const superAdminRoleId = await getSuperAdminRoleId(env);
        if (!superAdminRoleId) {
            console.error('RBAC Bootstrap: SUPER_ADMIN role not found in database');
            return;
        }

        // Assign super admin role
        await assignRole(env, userId, superAdminRoleId);
        console.log(`RBAC Bootstrap: Successfully assigned SUPER_ADMIN role to ${superAdminEmail}`);

        // Log the bootstrap event
        await logBootstrapSuperAdmin(env, userId, superAdminEmail);

    } catch (error) {
        console.error('RBAC Bootstrap: Error during bootstrap:', error);
        // Don't throw - we don't want to prevent the worker from starting
    }
}