import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { env } from "cloudflare:test";
import {
    assignRole,
    removeRole,
    createRole,
    getDefaultRoleId,
    assignDefaultRole,
} from "../../../src/rbac/roles";
import { getUserRoles } from "../../../src/rbac/permissions";
import { setupTestDatabase, cleanupTestDatabase } from "../../setup";
import { createMockEnv } from "../../helpers/mocks";
import { ROLE_IDS, USER_IDS } from "../../helpers/fixtures";

describe("RBAC Roles Module", () => {
    beforeAll(async () => {
        await setupTestDatabase();
    });

    afterAll(async () => {
        await cleanupTestDatabase();
    });

    describe("assignRole()", () => {
        it("should assign a role to a user", async () => {
            const mockEnv = createMockEnv();

            // User 3 (noRoles) has no roles initially
            let roles = await getUserRoles(mockEnv, USER_IDS.noRoles);
            expect(roles).toHaveLength(0);

            // Assign member role
            await assignRole(mockEnv, USER_IDS.noRoles, ROLE_IDS.MEMBER);

            // Verify role was assigned
            roles = await getUserRoles(mockEnv, USER_IDS.noRoles);
            expect(roles).toHaveLength(1);
            expect(roles[0].name).toBe("MEMBER");
        });

        it("should be idempotent - assigning same role twice should not error", async () => {
            const mockEnv = createMockEnv();

            // Assign member role twice
            await assignRole(mockEnv, USER_IDS.noRoles, ROLE_IDS.MEMBER);
            await expect(
                assignRole(mockEnv, USER_IDS.noRoles, ROLE_IDS.MEMBER)
            ).resolves.not.toThrow();

            // Should still have only one role
            const roles = await getUserRoles(mockEnv, USER_IDS.noRoles);
            const memberRoles = roles.filter((r) => r.name === "MEMBER");
            expect(memberRoles).toHaveLength(1);
        });

        it("should allow assigning multiple roles to a user", async () => {
            const mockEnv = createMockEnv();

            // Assign both member and moderator roles
            await assignRole(mockEnv, USER_IDS.noRoles, ROLE_IDS.MEMBER);
            await assignRole(mockEnv, USER_IDS.noRoles, ROLE_IDS.MODERATOR);

            // Verify both roles are assigned
            const roles = await getUserRoles(mockEnv, USER_IDS.noRoles);
            expect(roles.length).toBeGreaterThanOrEqual(2);
            expect(roles.map((r) => r.name)).toContain("MEMBER");
            expect(roles.map((r) => r.name)).toContain("MODERATOR");
        });
    });

    describe("removeRole()", () => {
        it("should remove a role from a user", async () => {
            const mockEnv = createMockEnv();

            // Ensure user has the role first
            await assignRole(mockEnv, USER_IDS.noRoles, ROLE_IDS.MODERATOR);
            let roles = await getUserRoles(mockEnv, USER_IDS.noRoles);
            expect(roles.map((r) => r.name)).toContain("MODERATOR");

            // Remove the role
            await removeRole(mockEnv, USER_IDS.noRoles, ROLE_IDS.MODERATOR);

            // Verify role was removed
            roles = await getUserRoles(mockEnv, USER_IDS.noRoles);
            expect(roles.map((r) => r.name)).not.toContain("MODERATOR");
        });

        it("should be idempotent - removing non-existent assignment should not error", async () => {
            const mockEnv = createMockEnv();

            // User doesn't have super admin role
            const roles = await getUserRoles(mockEnv, USER_IDS.noRoles);
            expect(roles.map((r) => r.name)).not.toContain("SUPER_ADMIN");

            // Removing should not throw
            await expect(
                removeRole(mockEnv, USER_IDS.noRoles, ROLE_IDS.SUPER_ADMIN)
            ).resolves.not.toThrow();
        });
    });

    describe("createRole()", () => {
        it("should create a new role with name only", async () => {
            const mockEnv = createMockEnv();

            const role = await createRole(mockEnv, "TEST_ROLE");

            expect(role).toHaveProperty("id");
            expect(role.name).toBe("TEST_ROLE");
            expect(role.description).toBe("");
            expect(role.createdAt).toBeInstanceOf(Date);
        });

        it("should create a new role with name and description", async () => {
            const mockEnv = createMockEnv();

            const role = await createRole(
                mockEnv,
                "TEST_ROLE_2",
                "Test role description"
            );

            expect(role.name).toBe("TEST_ROLE_2");
            expect(role.description).toBe("Test role description");
        });

        it("should generate a unique ID for each role", async () => {
            const mockEnv = createMockEnv();

            const role1 = await createRole(mockEnv, "UNIQUE_1");
            const role2 = await createRole(mockEnv, "UNIQUE_2");

            expect(role1.id).not.toBe(role2.id);
        });

        it("should throw error when creating role with duplicate name", async () => {
            const mockEnv = createMockEnv();

            await createRole(mockEnv, "DUPLICATE_ROLE");

            await expect(
                createRole(mockEnv, "DUPLICATE_ROLE")
            ).rejects.toThrow();
        });
    });

    describe("getDefaultRoleId()", () => {
        it("should return the MEMBER role ID", async () => {
            const mockEnv = createMockEnv();

            const defaultRoleId = await getDefaultRoleId(mockEnv);

            expect(defaultRoleId).toBe(ROLE_IDS.MEMBER);
        });
    });

    describe("assignDefaultRole()", () => {
        it("should assign MEMBER role to a user", async () => {
            const mockEnv = createMockEnv();

            // Create a test user without roles
            const db = env.usersDB as D1Database;
            await db
                .prepare(
                    "INSERT INTO User (UserID, Username, Password, FirstName, LastName) VALUES (?, ?, ?, ?, ?)"
                )
                .bind(100, "newuser@test.com", "hash", "New", "User")
                .run();

            // Assign default role
            await assignDefaultRole(mockEnv, 100);

            // Verify MEMBER role was assigned
            const roles = await getUserRoles(mockEnv, 100);
            expect(roles).toHaveLength(1);
            expect(roles[0].name).toBe("MEMBER");

            // Cleanup
            await db.prepare("DELETE FROM user_roles WHERE user_id = ?").bind(100).run();
            await db.prepare("DELETE FROM User WHERE UserID = ?").bind(100).run();
        });
    });
});
