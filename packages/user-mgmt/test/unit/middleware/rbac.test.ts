import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    requireAuth,
} from "../../../src/middleware/rbac";
import { setupTestDatabase, cleanupTestDatabase } from "../../setup";
import {
    createMockEnv,
    createMockRequestWithSession,
    createSessionData,
    createAdminSessionData,
    createMemberSessionData,
} from "../../helpers/mocks";
import { RequestWithSession } from "../../../src/middleware/session";

// Type definitions for error responses
interface ErrorResponse {
    error: string;
    required?: string | string[];
    requiresAny?: boolean;
    requiresAll?: boolean;
    missing?: string[];
}

describe("RBAC Middleware", () => {
    beforeAll(async () => {
        await setupTestDatabase();
    });

    afterAll(async () => {
        await cleanupTestDatabase();
    });

    describe("requirePermission()", () => {
        it("should allow access when RBAC is disabled", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "false" });
            const request = createMockRequestWithSession(
                "http://localhost/test",
                null // No session
            );

            const middleware = requirePermission("users:write");
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeUndefined(); // No response means pass through
        });

        it("should return 401 when no session data exists", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const request = createMockRequestWithSession(
                "http://localhost/test",
                null
            );

            const middleware = requirePermission("users:read");
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeInstanceOf(Response);
            expect(result?.status).toBe(401);
            const body = (await result?.json()) as ErrorResponse;
            expect(body.error).toBe("Authentication required");
        });

        it("should return 403 when user lacks the required permission", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const sessionData = createMemberSessionData(); // Only has users:read
            const request = createMockRequestWithSession(
                "http://localhost/test",
                sessionData
            );

            const middleware = requirePermission("users:write");
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeInstanceOf(Response);
            expect(result?.status).toBe(403);
            const body = (await result?.json()) as ErrorResponse;
            expect(body.error).toBe("Insufficient permissions");
            // Permission names are no longer exposed in error responses for security
        });

        it("should allow access when user has the required permission", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const sessionData = createMemberSessionData();
            const request = createMockRequestWithSession(
                "http://localhost/test",
                sessionData
            );

            const middleware = requirePermission("users:read");
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeUndefined();
        });

        it("should allow access for admin:all user regardless of required permission", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const sessionData = createAdminSessionData();
            const request = createMockRequestWithSession(
                "http://localhost/test",
                sessionData
            );

            const middleware = requirePermission("any:arbitrary:permission");
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeUndefined();
        });
    });

    describe("requireAnyPermission()", () => {
        it("should return 401 when no session data exists", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const request = createMockRequestWithSession(
                "http://localhost/test",
                null
            );

            const middleware = requireAnyPermission([
                "users:read",
                "users:write",
            ]);
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeInstanceOf(Response);
            expect(result?.status).toBe(401);
        });

        it("should return 403 when user has none of the required permissions", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const sessionData = createMemberSessionData(); // Only has users:read
            const request = createMockRequestWithSession(
                "http://localhost/test",
                sessionData
            );

            const middleware = requireAnyPermission([
                "users:write",
                "users:delete",
            ]);
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeInstanceOf(Response);
            expect(result?.status).toBe(403);
            const body = (await result?.json()) as ErrorResponse;
            expect(body.error).toBe("Insufficient permissions");
            // Permission details are no longer exposed in error responses for security
        });

        it("should allow access when user has at least one required permission", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const sessionData = createMemberSessionData();
            const request = createMockRequestWithSession(
                "http://localhost/test",
                sessionData
            );

            const middleware = requireAnyPermission([
                "users:read",
                "users:write",
            ]);
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeUndefined();
        });

        it("should allow access for admin:all user", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const sessionData = createAdminSessionData();
            const request = createMockRequestWithSession(
                "http://localhost/test",
                sessionData
            );

            const middleware = requireAnyPermission([
                "any:permission1",
                "any:permission2",
            ]);
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeUndefined();
        });
    });

    describe("requireAllPermissions()", () => {
        it("should return 401 when no session data exists", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const request = createMockRequestWithSession(
                "http://localhost/test",
                null
            );

            const middleware = requireAllPermissions([
                "users:read",
                "users:write",
            ]);
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeInstanceOf(Response);
            expect(result?.status).toBe(401);
        });

        it("should return 403 with missing permissions when user lacks some", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const sessionData = createMemberSessionData(); // Only has users:read
            const request = createMockRequestWithSession(
                "http://localhost/test",
                sessionData
            );

            const middleware = requireAllPermissions([
                "users:read",
                "users:write",
            ]);
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeInstanceOf(Response);
            expect(result?.status).toBe(403);
            const body = (await result?.json()) as ErrorResponse;
            expect(body.error).toBe("Insufficient permissions");
            // Permission details are no longer exposed in error responses for security
        });

        it("should allow access when user has all required permissions", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const sessionData = createSessionData([
                "users:read",
                "users:write",
            ]);
            const request = createMockRequestWithSession(
                "http://localhost/test",
                sessionData
            );

            const middleware = requireAllPermissions([
                "users:read",
                "users:write",
            ]);
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeUndefined();
        });

        it("should allow access for admin:all user", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const sessionData = createAdminSessionData();
            const request = createMockRequestWithSession(
                "http://localhost/test",
                sessionData
            );

            const middleware = requireAllPermissions([
                "perm1",
                "perm2",
                "perm3",
            ]);
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeUndefined();
        });
    });

    describe("requireAuth()", () => {
        it("should return 401 when no session data exists", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const request = createMockRequestWithSession(
                "http://localhost/test",
                null
            );

            const middleware = requireAuth();
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeInstanceOf(Response);
            expect(result?.status).toBe(401);
            const body = (await result?.json()) as ErrorResponse;
            expect(body.error).toBe("Authentication required");
        });

        it("should allow access when session data exists", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "true" });
            const sessionData = createSessionData([]); // No permissions, but authenticated
            const request = createMockRequestWithSession(
                "http://localhost/test",
                sessionData
            );

            const middleware = requireAuth();
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            expect(result).toBeUndefined();
        });

        it("should work regardless of RBAC_ENABLED setting", async () => {
            const env = createMockEnv({ RBAC_ENABLED: "false" });
            const request = createMockRequestWithSession(
                "http://localhost/test",
                null
            );

            const middleware = requireAuth();
            const result = await middleware(
                request as RequestWithSession,
                env
            );

            // requireAuth() doesn't check RBAC_ENABLED, only session
            expect(result).toBeInstanceOf(Response);
            expect(result?.status).toBe(401);
        });
    });
});
