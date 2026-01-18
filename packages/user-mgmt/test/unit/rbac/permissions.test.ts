import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { env } from "cloudflare:test";
import {
    getUserPermissions,
    hasPermission,
    getUserRoles,
} from "../../../src/rbac/permissions";
import { setupTestDatabase, cleanupTestDatabase, TEST_DATA } from "../../setup";
import { createMockEnv } from "../../helpers/mocks";
import { PERMISSION_NAMES, USER_IDS } from "../../helpers/fixtures";

describe("RBAC Permissions Module", () => {
    beforeAll(async () => {
        await setupTestDatabase();
    });

    afterAll(async () => {
        await cleanupTestDatabase();
    });

    describe("hasPermission()", () => {
        it("should return true when user has the exact permission", () => {
            const permissions = ["users:read", "users:write"];
            expect(hasPermission(permissions, "users:read")).toBe(true);
            expect(hasPermission(permissions, "users:write")).toBe(true);
        });

        it("should return false when user lacks the permission", () => {
            const permissions = ["users:read"];
            expect(hasPermission(permissions, "users:write")).toBe(false);
            expect(hasPermission(permissions, "roles:assign")).toBe(false);
        });

        it("should return true for any permission when user has admin:all", () => {
            const permissions = ["admin:all"];
            expect(hasPermission(permissions, "users:read")).toBe(true);
            expect(hasPermission(permissions, "users:write")).toBe(true);
            expect(hasPermission(permissions, "users:delete")).toBe(true);
            expect(hasPermission(permissions, "roles:assign")).toBe(true);
            expect(hasPermission(permissions, "any:arbitrary:permission")).toBe(
                true
            );
        });

        it("should return false for empty permission array", () => {
            expect(hasPermission([], "users:read")).toBe(false);
        });

        it("should handle case-sensitive permission matching", () => {
            const permissions = ["users:read"];
            expect(hasPermission(permissions, "users:read")).toBe(true);
            expect(hasPermission(permissions, "USERS:READ")).toBe(false);
            expect(hasPermission(permissions, "Users:Read")).toBe(false);
        });
    });

    describe("getUserPermissions()", () => {
        it("should return admin:all for super admin user", async () => {
            const mockEnv = createMockEnv();
            const permissions = await getUserPermissions(
                mockEnv,
                USER_IDS.admin
            );

            // Super admin has admin:all, so that should be the only returned permission
            expect(permissions).toContain(PERMISSION_NAMES.ADMIN_ALL);
            expect(permissions).toHaveLength(1);
        });

        it("should return only users:read for member user", async () => {
            const mockEnv = createMockEnv();
            const permissions = await getUserPermissions(
                mockEnv,
                USER_IDS.member
            );

            expect(permissions).toContain(PERMISSION_NAMES.USERS_READ);
            expect(permissions).toHaveLength(1);
        });

        it("should return empty array for user with no roles", async () => {
            const mockEnv = createMockEnv();
            const permissions = await getUserPermissions(
                mockEnv,
                USER_IDS.noRoles
            );

            expect(permissions).toEqual([]);
        });

        it("should return multiple permissions for moderator user", async () => {
            const mockEnv = createMockEnv();
            const permissions = await getUserPermissions(
                mockEnv,
                USER_IDS.moderator
            );

            expect(permissions).toContain(PERMISSION_NAMES.USERS_READ);
            expect(permissions).toContain(PERMISSION_NAMES.USERS_WRITE);
            expect(permissions).toHaveLength(2);
        });

        it("should return empty array for non-existent user", async () => {
            const mockEnv = createMockEnv();
            const permissions = await getUserPermissions(mockEnv, 99999);

            expect(permissions).toEqual([]);
        });
    });

    describe("getUserRoles()", () => {
        it("should return SUPER_ADMIN role for admin user", async () => {
            const mockEnv = createMockEnv();
            const roles = await getUserRoles(mockEnv, USER_IDS.admin);

            expect(roles).toHaveLength(1);
            expect(roles[0].name).toBe("SUPER_ADMIN");
            expect(roles[0].id).toBe(TEST_DATA.roles.superAdmin.id);
        });

        it("should return MEMBER role for member user", async () => {
            const mockEnv = createMockEnv();
            const roles = await getUserRoles(mockEnv, USER_IDS.member);

            expect(roles).toHaveLength(1);
            expect(roles[0].name).toBe("MEMBER");
        });

        it("should return empty array for user with no roles", async () => {
            const mockEnv = createMockEnv();
            const roles = await getUserRoles(mockEnv, USER_IDS.noRoles);

            expect(roles).toEqual([]);
        });

        it("should return Role objects with correct structure", async () => {
            const mockEnv = createMockEnv();
            const roles = await getUserRoles(mockEnv, USER_IDS.admin);

            expect(roles[0]).toHaveProperty("id");
            expect(roles[0]).toHaveProperty("name");
            expect(roles[0]).toHaveProperty("description");
            expect(roles[0]).toHaveProperty("createdAt");
            expect(roles[0].createdAt).toBeInstanceOf(Date);
        });

        it("should return empty array for non-existent user", async () => {
            const mockEnv = createMockEnv();
            const roles = await getUserRoles(mockEnv, 99999);

            expect(roles).toEqual([]);
        });
    });
});
