/**
 * Permission caching module for RBAC system.
 *
 * This module provides functions to cache user permissions in KV storage
 * via the session-state worker. Caching improves performance by reducing
 * database queries for frequently accessed permission data.
 *
 * Cache Strategy:
 * - TTL: 1 minute (60 seconds) for tighter security
 * - Invalidation: Immediate delete on role assignment/removal
 * - Graceful degradation: Falls back to D1 query on cache failure
 */

import { Env } from '../env';

/** Cache TTL in seconds (1 minute for tighter security) */
const CACHE_TTL_SECONDS = 60;

/**
 * Generates the cache key for a user's permissions.
 *
 * @param userId - The user's ID
 * @returns The cache key string
 */
export function getPermissionsCacheKey(userId: number): string {
    return `permissions:user:${userId}`;
}

/**
 * Retrieves cached permissions for a user.
 *
 * @param env - The environment configuration
 * @param userId - The user's ID
 * @returns The cached permissions array, or null if not cached
 */
export async function getCachedPermissions(
    env: Env,
    userId: number
): Promise<string[] | null> {
    try {
        const cacheKey = getPermissionsCacheKey(userId);
        // Use relative URL with service binding - the binding handles routing
        const cacheUrl = `https://session-service/cache/${encodeURIComponent(cacheKey)}`;

        const response = await env.sessionService.fetch(
            new Request(cacheUrl, { method: 'GET' })
        );

        if (response.ok) {
            const data = await response.json() as string[];
            console.log(`Cache hit for user ${userId} permissions`);
            return data;
        }

        // Cache miss (404) is expected, not an error
        if (response.status === 404) {
            console.log(`Cache miss for user ${userId} permissions`);
            return null;
        }

        console.error(`Cache get failed with status ${response.status}`);
        return null;
    } catch (error) {
        console.error('Error retrieving cached permissions:', error);
        return null;
    }
}

/**
 * Stores permissions in cache for a user.
 *
 * @param env - The environment configuration
 * @param userId - The user's ID
 * @param permissions - The permissions array to cache
 * @param ttl - Optional TTL in seconds (defaults to 5 minutes)
 */
export async function setCachedPermissions(
    env: Env,
    userId: number,
    permissions: string[],
    ttl: number = CACHE_TTL_SECONDS
): Promise<void> {
    try {
        const cacheKey = getPermissionsCacheKey(userId);
        // Use relative URL with service binding - the binding handles routing
        const cacheUrl = `https://session-service/cache/${encodeURIComponent(cacheKey)}`;

        const response = await env.sessionService.fetch(
            new Request(cacheUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: permissions, ttl }),
            })
        );

        if (!response.ok) {
            console.error(`Cache set failed with status ${response.status}`);
        } else {
            console.log(`Cached permissions for user ${userId}`);
        }
    } catch (error) {
        console.error('Error caching permissions:', error);
        // Don't throw - caching failures should not break the main operation
    }
}

/**
 * Invalidates (deletes) the cached permissions for a user.
 * Should be called when a user's roles change.
 *
 * @param env - The environment configuration
 * @param userId - The user's ID
 */
export async function invalidateCachedPermissions(
    env: Env,
    userId: number
): Promise<void> {
    try {
        const cacheKey = getPermissionsCacheKey(userId);
        // Use relative URL with service binding - the binding handles routing
        const cacheUrl = `https://session-service/cache/${encodeURIComponent(cacheKey)}`;

        const response = await env.sessionService.fetch(
            new Request(cacheUrl, { method: 'DELETE' })
        );

        if (!response.ok && response.status !== 404) {
            console.error(`Cache invalidation failed with status ${response.status}`);
        } else {
            console.log(`Invalidated permissions cache for user ${userId}`);
        }
    } catch (error) {
        console.error('Error invalidating cached permissions:', error);
        // Don't throw - cache invalidation failures should not break the main operation
    }
}
