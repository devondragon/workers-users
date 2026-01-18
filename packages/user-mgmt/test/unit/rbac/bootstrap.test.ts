import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { env } from "cloudflare:test";
import { bootstrapSuperAdmin } from "../../../src/rbac/bootstrap";
import { setupTestDatabase, cleanupTestDatabase } from "../../setup";
import { createMockEnv } from "../../helpers/mocks";
import { getUserRoles } from "../../../src/rbac/permissions";
import { getAuditLogs } from "../../../src/rbac/audit";
import { ROLE_IDS, USER_IDS, USERNAMES } from "../../helpers/fixtures";

describe("RBAC Bootstrap Module", () => {
    beforeAll(async () => {
        await setupTestDatabase();
    });

    afterAll(async () => {
        await cleanupTestDatabase();
    });

    describe("bootstrapSuperAdmin()", () => {
        it("should skip when SUPER_ADMIN_EMAIL is not configured", async () => {
            const mockEnv = createMockEnv({ SUPER_ADMIN_EMAIL: undefined });

            // Should complete without error
            await expect(bootstrapSuperAdmin(mockEnv)).resolves.not.toThrow();

            // Verify no changes were made - user 3 still has no SUPER_ADMIN role
            const roles = await getUserRoles(mockEnv, USER_IDS.noRoles);
            expect(roles.map((r) => r.name)).not.toContain("SUPER_ADMIN");
        });

        it("should skip when user with email is not found", async () => {
            const mockEnv = createMockEnv({
                SUPER_ADMIN_EMAIL: "nonexistent@test.com",
            });

            // Should complete without error
            await expect(bootstrapSuperAdmin(mockEnv)).resolves.not.toThrow();

            // Verify no audit log was created for this non-existent user
            const auditLogs = await getAuditLogs(mockEnv, {
                action: "BOOTSTRAP_SUPER_ADMIN",
            });
            const nonExistentUserLogs = auditLogs.filter(
                (log) => log.targetName === "nonexistent@test.com"
            );
            expect(nonExistentUserLogs).toHaveLength(0);
        });

        it("should skip when user already has SUPER_ADMIN role", async () => {
            // admin@test.com (User ID 1) already has SUPER_ADMIN role from seed data
            const mockEnv = createMockEnv({
                SUPER_ADMIN_EMAIL: USERNAMES.admin,
            });

            // Verify user already has SUPER_ADMIN role
            const rolesBefore = await getUserRoles(mockEnv, USER_IDS.admin);
            expect(rolesBefore.map((r) => r.name)).toContain("SUPER_ADMIN");

            // Clear audit logs before test
            const db = env.usersDB as D1Database;
            await db.prepare("DELETE FROM audit_logs").run();

            await bootstrapSuperAdmin(mockEnv);

            // Verify no new audit log was created (since role was already assigned)
            const auditLogs = await getAuditLogs(mockEnv, {
                action: "BOOTSTRAP_SUPER_ADMIN",
                targetId: USER_IDS.admin.toString(),
            });
            expect(auditLogs).toHaveLength(0);

            // Verify user still has exactly one SUPER_ADMIN role (no duplicate)
            const rolesAfter = await getUserRoles(mockEnv, USER_IDS.admin);
            const superAdminRoles = rolesAfter.filter((r) => r.name === "SUPER_ADMIN");
            expect(superAdminRoles).toHaveLength(1);
        });

        it("should assign SUPER_ADMIN role when user exists and does not have role", async () => {
            // noroles@test.com (User ID 3) has no roles initially
            const mockEnv = createMockEnv({
                SUPER_ADMIN_EMAIL: USERNAMES.noRoles,
            });

            // Verify user has no roles initially
            const rolesBefore = await getUserRoles(mockEnv, USER_IDS.noRoles);
            expect(rolesBefore.map((r) => r.name)).not.toContain("SUPER_ADMIN");

            await bootstrapSuperAdmin(mockEnv);

            // Verify SUPER_ADMIN role was assigned
            const rolesAfter = await getUserRoles(mockEnv, USER_IDS.noRoles);
            expect(rolesAfter.map((r) => r.name)).toContain("SUPER_ADMIN");

            // Cleanup: remove the role assignment for other tests
            const db = env.usersDB as D1Database;
            await db
                .prepare("DELETE FROM user_roles WHERE user_id = ? AND role_id = ?")
                .bind(USER_IDS.noRoles, ROLE_IDS.SUPER_ADMIN)
                .run();
        });

        it("should handle errors gracefully and not throw", async () => {
            // Create an env with a mock database that throws errors
            const errorDb = {
                prepare: () => ({
                    bind: () => ({
                        first: () => Promise.reject(new Error("Database error")),
                    }),
                }),
            } as unknown as D1Database;

            const mockEnv = createMockEnv({
                SUPER_ADMIN_EMAIL: "test@test.com",
            });
            mockEnv.usersDB = errorDb;

            // Should not throw - the function handles errors gracefully
            await expect(bootstrapSuperAdmin(mockEnv)).resolves.not.toThrow();
        });

        it("should log audit event after assigning role", async () => {
            // Use member@test.com (User ID 2) who has MEMBER role but not SUPER_ADMIN
            const mockEnv = createMockEnv({
                SUPER_ADMIN_EMAIL: USERNAMES.member,
            });

            // Verify user does not have SUPER_ADMIN role
            const rolesBefore = await getUserRoles(mockEnv, USER_IDS.member);
            expect(rolesBefore.map((r) => r.name)).not.toContain("SUPER_ADMIN");

            // Clear audit logs before test
            const db = env.usersDB as D1Database;
            await db.prepare("DELETE FROM audit_logs").run();

            await bootstrapSuperAdmin(mockEnv);

            // Verify audit log was created
            const auditLogs = await getAuditLogs(mockEnv, {
                action: "BOOTSTRAP_SUPER_ADMIN",
                targetId: USER_IDS.member.toString(),
            });

            expect(auditLogs.length).toBeGreaterThan(0);
            expect(auditLogs[0].action).toBe("BOOTSTRAP_SUPER_ADMIN");
            expect(auditLogs[0].actorUsername).toBe("SYSTEM");
            expect(auditLogs[0].targetType).toBe("USER");
            expect(auditLogs[0].targetId).toBe(USER_IDS.member.toString());
            expect(auditLogs[0].targetName).toBe(USERNAMES.member);
            expect(auditLogs[0].success).toBe(true);

            // Cleanup: remove the role assignment for other tests
            await db
                .prepare("DELETE FROM user_roles WHERE user_id = ? AND role_id = ?")
                .bind(USER_IDS.member, ROLE_IDS.SUPER_ADMIN)
                .run();
        });

        it("should skip when SUPER_ADMIN role does not exist in database", async () => {
            // Create a fresh environment and temporarily remove the SUPER_ADMIN role
            const db = env.usersDB as D1Database;

            // First, remove existing SUPER_ADMIN role assignment to allow role deletion
            await db
                .prepare("DELETE FROM user_roles WHERE role_id = ?")
                .bind(ROLE_IDS.SUPER_ADMIN)
                .run();

            // Remove role permissions for SUPER_ADMIN
            await db
                .prepare("DELETE FROM role_permissions WHERE role_id = ?")
                .bind(ROLE_IDS.SUPER_ADMIN)
                .run();

            // Remove the SUPER_ADMIN role
            await db
                .prepare("DELETE FROM roles WHERE id = ?")
                .bind(ROLE_IDS.SUPER_ADMIN)
                .run();

            const mockEnv = createMockEnv({
                SUPER_ADMIN_EMAIL: USERNAMES.noRoles,
            });

            // Clear audit logs before test
            await db.prepare("DELETE FROM audit_logs").run();

            // Should complete without throwing
            await expect(bootstrapSuperAdmin(mockEnv)).resolves.not.toThrow();

            // Verify no audit log was created (since role doesn't exist)
            const auditLogs = await getAuditLogs(mockEnv, {
                action: "BOOTSTRAP_SUPER_ADMIN",
            });
            expect(auditLogs).toHaveLength(0);

            // Restore the SUPER_ADMIN role for other tests
            await db
                .prepare("INSERT INTO roles (id, name, description) VALUES (?, ?, ?)")
                .bind(ROLE_IDS.SUPER_ADMIN, "SUPER_ADMIN", "Full system administrator")
                .run();

            // Restore role permissions
            const permissions = await db.prepare("SELECT id FROM permissions").all();
            for (const perm of permissions.results) {
                await db
                    .prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)")
                    .bind(ROLE_IDS.SUPER_ADMIN, (perm as { id: string }).id)
                    .run();
            }

            // Restore admin user's SUPER_ADMIN role
            await db
                .prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)")
                .bind(USER_IDS.admin, ROLE_IDS.SUPER_ADMIN)
                .run();
        });
    });
});
