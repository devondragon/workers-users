import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    getPermissionsCacheKey,
    getCachedPermissions,
    setCachedPermissions,
    invalidateCachedPermissions,
} from "../../../src/rbac/cache";
import { Env } from "../../../src/env";

/**
 * Creates a mock session service with configurable fetch behavior.
 */
function createMockSessionServiceWithFetch(
    fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): Fetcher {
    return {
        fetch: fetchImpl,
    } as Fetcher;
}

/**
 * Creates a minimal mock Env with a configurable session service.
 */
function createTestEnv(sessionService: Fetcher): Env {
    return {
        usersDB: {} as D1Database,
        sessionService,
        EMAIL_FROM: "test@test.com",
        EMAIL_FROM_NAME: "Test",
        FORGOT_PASSWORD_URL: "https://test.com/reset",
        TOKEN_VALID_MINUTES: 60,
        EMAIL_DKIM_DOMAIN: "test.com",
        EMAIL_DKIM_SELECTOR: "test",
        EMAIL_DKIM_PRIVATE_KEY: "test-key",
        RBAC_ENABLED: "true",
        SUPER_ADMIN_EMAIL: "admin@test.com",
    };
}

describe("RBAC Cache Module", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getPermissionsCacheKey()", () => {
        it("should generate correct key format for user ID", () => {
            const key = getPermissionsCacheKey(123);
            expect(key).toBe("permissions:user:123");
        });

        it("should generate correct key format for different user IDs", () => {
            expect(getPermissionsCacheKey(1)).toBe("permissions:user:1");
            expect(getPermissionsCacheKey(999)).toBe("permissions:user:999");
            expect(getPermissionsCacheKey(0)).toBe("permissions:user:0");
        });
    });

    describe("getCachedPermissions()", () => {
        it("should return cached data on cache hit", async () => {
            const cachedPermissions = ["users:read", "users:write"];
            const mockFetch = vi.fn().mockResolvedValue(
                new Response(JSON.stringify(cachedPermissions), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                })
            );
            const sessionService = createMockSessionServiceWithFetch(mockFetch);
            const env = createTestEnv(sessionService);

            const result = await getCachedPermissions(env, 123);

            expect(result).toEqual(cachedPermissions);
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Verify the request was made with correct URL and method
            const request = mockFetch.mock.calls[0][0] as Request;
            expect(request.url).toContain("/cache/permissions%3Auser%3A123");
            expect(request.method).toBe("GET");
        });

        it("should return null on cache miss (404)", async () => {
            const mockFetch = vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ error: "Not found" }), {
                    status: 404,
                    headers: { "Content-Type": "application/json" },
                })
            );
            const sessionService = createMockSessionServiceWithFetch(mockFetch);
            const env = createTestEnv(sessionService);

            const result = await getCachedPermissions(env, 456);

            expect(result).toBeNull();
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("should return null on error (graceful degradation)", async () => {
            const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
            const sessionService = createMockSessionServiceWithFetch(mockFetch);
            const env = createTestEnv(sessionService);

            const result = await getCachedPermissions(env, 789);

            expect(result).toBeNull();
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("should return null on non-404 error status", async () => {
            const mockFetch = vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ error: "Server error" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                })
            );
            const sessionService = createMockSessionServiceWithFetch(mockFetch);
            const env = createTestEnv(sessionService);

            const result = await getCachedPermissions(env, 123);

            expect(result).toBeNull();
        });
    });

    describe("setCachedPermissions()", () => {
        it("should successfully cache permissions", async () => {
            const mockFetch = vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                })
            );
            const sessionService = createMockSessionServiceWithFetch(mockFetch);
            const env = createTestEnv(sessionService);
            const permissions = ["users:read", "roles:assign"];

            await setCachedPermissions(env, 123, permissions);

            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Verify the request was made with correct URL, method, and body
            const request = mockFetch.mock.calls[0][0] as Request;
            expect(request.url).toContain("/cache/permissions%3Auser%3A123");
            expect(request.method).toBe("PUT");
            expect(request.headers.get("Content-Type")).toBe("application/json");

            const body = await request.json();
            expect(body).toEqual({ data: permissions, ttl: 60 }); // Default TTL is now 60 seconds for tighter security
        });

        it("should use custom TTL when provided", async () => {
            const mockFetch = vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                })
            );
            const sessionService = createMockSessionServiceWithFetch(mockFetch);
            const env = createTestEnv(sessionService);
            const permissions = ["admin:all"];
            const customTtl = 600;

            await setCachedPermissions(env, 456, permissions, customTtl);

            const request = mockFetch.mock.calls[0][0] as Request;
            const body = await request.json();
            expect(body).toEqual({ data: permissions, ttl: customTtl });
        });

        it("should handle errors gracefully (does not throw)", async () => {
            const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
            const sessionService = createMockSessionServiceWithFetch(mockFetch);
            const env = createTestEnv(sessionService);

            // Should not throw
            await expect(
                setCachedPermissions(env, 123, ["users:read"])
            ).resolves.not.toThrow();

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("should handle non-ok response gracefully (does not throw)", async () => {
            const mockFetch = vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ error: "Server error" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                })
            );
            const sessionService = createMockSessionServiceWithFetch(mockFetch);
            const env = createTestEnv(sessionService);

            // Should not throw
            await expect(
                setCachedPermissions(env, 123, ["users:read"])
            ).resolves.not.toThrow();
        });
    });

    describe("invalidateCachedPermissions()", () => {
        it("should successfully invalidate cache", async () => {
            const mockFetch = vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                })
            );
            const sessionService = createMockSessionServiceWithFetch(mockFetch);
            const env = createTestEnv(sessionService);

            await invalidateCachedPermissions(env, 123);

            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Verify the request was made with correct URL and method
            const request = mockFetch.mock.calls[0][0] as Request;
            expect(request.url).toContain("/cache/permissions%3Auser%3A123");
            expect(request.method).toBe("DELETE");
        });

        it("should handle 404 gracefully (cache key does not exist)", async () => {
            const mockFetch = vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ error: "Not found" }), {
                    status: 404,
                    headers: { "Content-Type": "application/json" },
                })
            );
            const sessionService = createMockSessionServiceWithFetch(mockFetch);
            const env = createTestEnv(sessionService);

            // Should not throw
            await expect(
                invalidateCachedPermissions(env, 456)
            ).resolves.not.toThrow();

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("should handle errors gracefully (does not throw)", async () => {
            const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
            const sessionService = createMockSessionServiceWithFetch(mockFetch);
            const env = createTestEnv(sessionService);

            // Should not throw
            await expect(
                invalidateCachedPermissions(env, 789)
            ).resolves.not.toThrow();

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("should handle non-404 error status gracefully (does not throw)", async () => {
            const mockFetch = vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ error: "Server error" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                })
            );
            const sessionService = createMockSessionServiceWithFetch(mockFetch);
            const env = createTestEnv(sessionService);

            // Should not throw
            await expect(
                invalidateCachedPermissions(env, 123)
            ).resolves.not.toThrow();
        });
    });
});
