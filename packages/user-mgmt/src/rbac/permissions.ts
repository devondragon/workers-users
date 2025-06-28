import { Env } from '../env';
import { Role, Permission } from '../types/rbac';

/**
 * Retrieves all permissions for a user based on their assigned roles.
 * If the user has the 'admin:all' permission, returns only that permission for efficiency.
 * 
 * @param env - The environment configuration containing the database connection
 * @param userId - The ID of the user whose permissions to retrieve
 * @returns A promise that resolves to an array of permission names
 * @throws Error if the database query fails
 */
export async function getUserPermissions(env: Env, userId: number): Promise<string[]> {
    try {
        // Query to get all permissions for a user through their roles
        const query = `
            SELECT DISTINCT p.name
            FROM user_roles ur
            INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
            INNER JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = ?
        `;
        
        const result = await env.usersDB
            .prepare(query)
            .bind(userId)
            .all<{ name: string }>();
        
        if (!result.success) {
            throw new Error('Failed to retrieve user permissions');
        }
        
        const permissions = result.results.map(row => row.name);
        
        // If user has admin:all permission, return only that for efficiency
        if (permissions.includes('admin:all')) {
            return ['admin:all'];
        }
        
        return permissions;
    } catch (error) {
        console.error('Error getting user permissions:', error);
        throw new Error('Failed to retrieve user permissions');
    }
}

/**
 * Checks if a user has a specific permission.
 * If the user has 'admin:all' permission, they automatically have all permissions.
 * 
 * @param permissions - Array of permission names the user has
 * @param required - The permission name to check for
 * @returns True if the user has the required permission, false otherwise
 */
export function hasPermission(permissions: string[], required: string): boolean {
    // Admin has all permissions
    if (permissions.includes('admin:all')) {
        return true;
    }
    
    // Check for specific permission
    return permissions.includes(required);
}

/**
 * Retrieves all roles assigned to a user with full role details.
 * 
 * @param env - The environment configuration containing the database connection
 * @param userId - The ID of the user whose roles to retrieve
 * @returns A promise that resolves to an array of Role objects
 * @throws Error if the database query fails
 */
export async function getUserRoles(env: Env, userId: number): Promise<Role[]> {
    try {
        const query = `
            SELECT r.id, r.name, r.description, r.created_at as createdAt
            FROM user_roles ur
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = ?
            ORDER BY r.name
        `;
        
        const result = await env.usersDB
            .prepare(query)
            .bind(userId)
            .all<{
                id: string;
                name: string;
                description: string;
                createdAt: string;
            }>();
        
        if (!result.success) {
            throw new Error('Failed to retrieve user roles');
        }
        
        // Convert to Role objects with proper Date objects
        return result.results.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            createdAt: new Date(row.createdAt)
        }));
    } catch (error) {
        console.error('Error getting user roles:', error);
        throw new Error('Failed to retrieve user roles');
    }
}