import { Env } from '../env';
import { Role } from '../types/rbac';
import { invalidateCachedPermissions } from './cache';

/**
 * Assigns a role to a user. Uses INSERT OR IGNORE to prevent duplicate assignments.
 * 
 * @param env - The environment configuration containing the database connection
 * @param userId - The ID of the user to assign the role to
 * @param roleId - The ID of the role to assign
 * @returns A promise that resolves when the role is assigned
 * @throws Error if the database operation fails
 */
export async function assignRole(env: Env, userId: number, roleId: string): Promise<void> {
    try {
        const query = `
            INSERT OR IGNORE INTO user_roles (user_id, role_id, assigned_at)
            VALUES (?, ?, datetime('now'))
        `;

        const result = await env.usersDB
            .prepare(query)
            .bind(userId, roleId)
            .run();

        if (!result.success) {
            throw new Error('Failed to assign role to user');
        }

        // Invalidate the user's permission cache
        await invalidateCachedPermissions(env, userId);
    } catch (error) {
        console.error('Error assigning role:', error);
        throw new Error('Failed to assign role to user');
    }
}

/**
 * Removes a role from a user. Returns successfully even if the role wasn't assigned (idempotent).
 * 
 * @param env - The environment configuration containing the database connection
 * @param userId - The ID of the user to remove the role from
 * @param roleId - The ID of the role to remove
 * @returns A promise that resolves when the role is removed
 * @throws Error if the database operation fails
 */
export async function removeRole(env: Env, userId: number, roleId: string): Promise<void> {
    try {
        const query = `
            DELETE FROM user_roles
            WHERE user_id = ? AND role_id = ?
        `;

        const result = await env.usersDB
            .prepare(query)
            .bind(userId, roleId)
            .run();

        if (!result.success) {
            throw new Error('Failed to remove role from user');
        }

        // Invalidate the user's permission cache
        await invalidateCachedPermissions(env, userId);
    } catch (error) {
        console.error('Error removing role:', error);
        throw new Error('Failed to remove role from user');
    }
}

/**
 * Creates a new role in the roles table.
 * 
 * @param env - The environment configuration containing the database connection
 * @param name - The name of the role to create
 * @param description - Optional description for the role
 * @returns A promise that resolves to the created Role object
 * @throws Error if the role name already exists or if the database operation fails
 */
export async function createRole(env: Env, name: string, description?: string): Promise<Role> {
    try {
        // Generate a unique ID for the role
        const roleId = crypto.randomUUID();
        const roleDescription = description || '';
        
        const query = `
            INSERT INTO roles (id, name, description, created_at)
            VALUES (?, ?, ?, datetime('now'))
        `;
        
        const result = await env.usersDB
            .prepare(query)
            .bind(roleId, name, roleDescription)
            .run();
        
        if (!result.success) {
            throw new Error('Failed to create role');
        }
        
        // Return the created role object
        return {
            id: roleId,
            name: name,
            description: roleDescription,
            createdAt: new Date()
        };
    } catch (error: unknown) {
        // Handle duplicate name errors gracefully
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('UNIQUE constraint')) {
            console.error('Role name already exists:', name);
            throw new Error(`Role with name '${name}' already exists`);
        }
        console.error('Error creating role:', error);
        throw new Error('Failed to create role');
    }
}

/**
 * Gets the ID of the MEMBER role for new user registration.
 * 
 * @param env - The environment configuration containing the database connection
 * @returns A promise that resolves to the MEMBER role ID, or null if not found
 * @throws Error if the database query fails
 */
export async function getDefaultRoleId(env: Env): Promise<string | null> {
    try {
        const query = `
            SELECT id FROM roles
            WHERE name = 'MEMBER'
            LIMIT 1
        `;
        
        const result = await env.usersDB
            .prepare(query)
            .first<{ id: string }>();
        
        return result?.id || null;
    } catch (error) {
        console.error('Error getting default role ID:', error);
        throw new Error('Failed to retrieve default role ID');
    }
}

/**
 * Convenience function that assigns the MEMBER role to a user.
 * Used during user registration when RBAC is enabled.
 * 
 * @param env - The environment configuration containing the database connection
 * @param userId - The ID of the user to assign the default role to
 * @returns A promise that resolves when the default role is assigned
 * @throws Error if the default role is not found or if assignment fails
 */
export async function assignDefaultRole(env: Env, userId: number): Promise<void> {
    const defaultRoleId = await getDefaultRoleId(env);
    
    if (!defaultRoleId) {
        throw new Error('Default MEMBER role not found in database');
    }
    
    await assignRole(env, userId, defaultRoleId);
}