import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { env } from "cloudflare:test";
import {
    handleListRoles,
    handleCreateRole,
    handleListPermissions,
    handleGetUserRoles,
    handleAssignRole,
    handleRemoveRole,
} from "../../../src/handlers/rbac";
import { setupTestDatabase, cleanupTestDatabase, TEST_DATA } from "../../setup";
import { createMockEnv, createMockRequest } from "../../helpers/mocks";
import { ROLE_IDS, USER_IDS, PERMISSION_NAMES } from "../../helpers/fixtures";

// Type definitions for API responses
interface RoleResponse {
    id: string;
    name: string;
    description?: string;
}

interface PermissionResponse {
    id: string;
    name: string;
    description?: string;
}

interface RolesListResponse {
    roles: RoleResponse[];
}

interface PermissionsListResponse {
    permissions: PermissionResponse[];
}

interface CreateRoleResponse {
    role: RoleResponse;
}

interface MessageResponse {
    message: string;
}

describe("RBAC Handlers Integration Tests", () => {
    beforeAll(async () => {
        await setupTestDatabase();
    });

    afterAll(async () => {
        await cleanupTestDatabase();
    });

    describe("handleListRoles()", () => {
        it("should return 401 when no session cookie", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest("http://localhost/rbac/roles");

            const response = await handleListRoles(request, mockEnv);

            expect(response.status).toBe(401);
        });

        it("should return list of roles for authenticated user", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest("http://localhost/rbac/roles", {
                cookies: { cfw_session: "admin-session" },
            });

            const response = await handleListRoles(request, mockEnv);

            expect(response.status).toBe(200);
            const body = (await response.json()) as RolesListResponse;
            expect(body.roles).toBeInstanceOf(Array);
            expect(body.roles.length).toBeGreaterThanOrEqual(2);
            expect(body.roles.map((r) => r.name)).toContain("SUPER_ADMIN");
            expect(body.roles.map((r) => r.name)).toContain("MEMBER");
        });
    });

    describe("handleCreateRole()", () => {
        it("should return 403 when RBAC is disabled", async () => {
            const mockEnv = createMockEnv({ RBAC_ENABLED: "false" });
            const request = createMockRequest("http://localhost/rbac/roles", {
                method: "POST",
                body: { name: "NEW_ROLE" },
                cookies: { cfw_session: "admin-session" },
            });

            const response = await handleCreateRole(request, mockEnv);

            expect(response.status).toBe(403);
        });

        it("should return 401 when no session cookie", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest("http://localhost/rbac/roles", {
                method: "POST",
                body: { name: "NEW_ROLE" },
            });

            const response = await handleCreateRole(request, mockEnv);

            expect(response.status).toBe(401);
        });

        it("should return 403 when user lacks roles:write permission", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest("http://localhost/rbac/roles", {
                method: "POST",
                body: { name: "NEW_ROLE" },
                cookies: { cfw_session: "member-session" },
            });

            const response = await handleCreateRole(request, mockEnv);

            expect(response.status).toBe(403);
        });

        it("should create a role when user has roles:write permission", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest("http://localhost/rbac/roles", {
                method: "POST",
                body: { name: "INTEGRATION_TEST_ROLE", description: "Test role" },
                cookies: { cfw_session: "admin-session" },
            });

            const response = await handleCreateRole(request, mockEnv);

            expect(response.status).toBe(201);
            const body = (await response.json()) as CreateRoleResponse;
            expect(body.role.name).toBe("INTEGRATION_TEST_ROLE");
            expect(body.role.description).toBe("Test role");
        });

        it("should return 400 when role name is missing", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest("http://localhost/rbac/roles", {
                method: "POST",
                body: { description: "No name" },
                cookies: { cfw_session: "admin-session" },
            });

            const response = await handleCreateRole(request, mockEnv);

            expect(response.status).toBe(400);
        });

        it("should return 409 when role name already exists", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest("http://localhost/rbac/roles", {
                method: "POST",
                body: { name: "SUPER_ADMIN" }, // Already exists
                cookies: { cfw_session: "admin-session" },
            });

            const response = await handleCreateRole(request, mockEnv);

            expect(response.status).toBe(409);
        });
    });

    describe("handleListPermissions()", () => {
        it("should return 401 when no session cookie", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                "http://localhost/rbac/permissions"
            );

            const response = await handleListPermissions(request, mockEnv);

            expect(response.status).toBe(401);
        });

        it("should return list of permissions for authenticated user", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                "http://localhost/rbac/permissions",
                {
                    cookies: { cfw_session: "admin-session" },
                }
            );

            const response = await handleListPermissions(request, mockEnv);

            expect(response.status).toBe(200);
            const body = (await response.json()) as PermissionsListResponse;
            expect(body.permissions).toBeInstanceOf(Array);
            expect(body.permissions.length).toBeGreaterThanOrEqual(7);
            expect(body.permissions.map((p) => p.name)).toContain(
                "admin:all"
            );
        });
    });

    describe("handleGetUserRoles()", () => {
        it("should return 401 when no session cookie", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                "http://localhost/rbac/users/1/roles"
            );

            const response = await handleGetUserRoles(request, mockEnv);

            expect(response.status).toBe(401);
        });

        it("should return user roles for own user", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                `http://localhost/rbac/users/${USER_IDS.admin}/roles`,
                {
                    cookies: { cfw_session: "admin-session" },
                }
            );

            const response = await handleGetUserRoles(request, mockEnv);

            expect(response.status).toBe(200);
            const body = (await response.json()) as RolesListResponse;
            expect(body.roles).toBeInstanceOf(Array);
            expect(body.roles.map((r) => r.name)).toContain("SUPER_ADMIN");
        });

        it("should return 400 for invalid user ID", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                "http://localhost/rbac/users/invalid/roles",
                {
                    cookies: { cfw_session: "admin-session" },
                }
            );

            const response = await handleGetUserRoles(request, mockEnv);

            expect(response.status).toBe(400);
        });
    });

    describe("handleAssignRole()", () => {
        it("should return 403 when RBAC is disabled", async () => {
            const mockEnv = createMockEnv({ RBAC_ENABLED: "false" });
            const request = createMockRequest(
                `http://localhost/rbac/users/${USER_IDS.noRoles}/roles`,
                {
                    method: "POST",
                    body: { roleId: ROLE_IDS.MEMBER },
                    cookies: { cfw_session: "admin-session" },
                }
            );

            const response = await handleAssignRole(request, mockEnv);

            expect(response.status).toBe(403);
        });

        it("should return 401 when no session cookie", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                `http://localhost/rbac/users/${USER_IDS.noRoles}/roles`,
                {
                    method: "POST",
                    body: { roleId: ROLE_IDS.MEMBER },
                }
            );

            const response = await handleAssignRole(request, mockEnv);

            expect(response.status).toBe(401);
        });

        it("should return 403 when user lacks roles:assign permission", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                `http://localhost/rbac/users/${USER_IDS.noRoles}/roles`,
                {
                    method: "POST",
                    body: { roleId: ROLE_IDS.MEMBER },
                    cookies: { cfw_session: "member-session" },
                }
            );

            const response = await handleAssignRole(request, mockEnv);

            expect(response.status).toBe(403);
        });

        it("should assign role when user has roles:assign permission", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                `http://localhost/rbac/users/${USER_IDS.noRoles}/roles`,
                {
                    method: "POST",
                    body: { roleId: ROLE_IDS.MODERATOR },
                    cookies: { cfw_session: "admin-session" },
                }
            );

            const response = await handleAssignRole(request, mockEnv);

            expect(response.status).toBe(200);
            const body = (await response.json()) as MessageResponse;
            expect(body.message).toBe("Role assigned successfully");
        });

        it("should return 400 when roleId is missing", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                `http://localhost/rbac/users/${USER_IDS.noRoles}/roles`,
                {
                    method: "POST",
                    body: {},
                    cookies: { cfw_session: "admin-session" },
                }
            );

            const response = await handleAssignRole(request, mockEnv);

            expect(response.status).toBe(400);
        });

        it("should return 404 when user does not exist", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                "http://localhost/rbac/users/99999/roles",
                {
                    method: "POST",
                    body: { roleId: ROLE_IDS.MEMBER },
                    cookies: { cfw_session: "admin-session" },
                }
            );

            const response = await handleAssignRole(request, mockEnv);

            expect(response.status).toBe(404);
        });

        it("should return 404 when role does not exist", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                `http://localhost/rbac/users/${USER_IDS.noRoles}/roles`,
                {
                    method: "POST",
                    body: { roleId: "non-existent-role" },
                    cookies: { cfw_session: "admin-session" },
                }
            );

            const response = await handleAssignRole(request, mockEnv);

            expect(response.status).toBe(404);
        });
    });

    describe("handleRemoveRole()", () => {
        it("should return 403 when RBAC is disabled", async () => {
            const mockEnv = createMockEnv({ RBAC_ENABLED: "false" });
            const request = createMockRequest(
                `http://localhost/rbac/users/${USER_IDS.moderator}/roles/${ROLE_IDS.MODERATOR}`,
                {
                    method: "DELETE",
                    cookies: { cfw_session: "admin-session" },
                }
            );

            const response = await handleRemoveRole(request, mockEnv);

            expect(response.status).toBe(403);
        });

        it("should return 401 when no session cookie", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                `http://localhost/rbac/users/${USER_IDS.moderator}/roles/${ROLE_IDS.MODERATOR}`,
                {
                    method: "DELETE",
                }
            );

            const response = await handleRemoveRole(request, mockEnv);

            expect(response.status).toBe(401);
        });

        it("should return 403 when user lacks roles:assign permission", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                `http://localhost/rbac/users/${USER_IDS.moderator}/roles/${ROLE_IDS.MODERATOR}`,
                {
                    method: "DELETE",
                    cookies: { cfw_session: "member-session" },
                }
            );

            const response = await handleRemoveRole(request, mockEnv);

            expect(response.status).toBe(403);
        });

        it("should remove role when user has roles:assign permission", async () => {
            const mockEnv = createMockEnv();

            // First ensure the user has a role to remove
            const db = env.usersDB as D1Database;
            await db
                .prepare(
                    "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)"
                )
                .bind(USER_IDS.noRoles, ROLE_IDS.MODERATOR)
                .run();

            const request = createMockRequest(
                `http://localhost/rbac/users/${USER_IDS.noRoles}/roles/${ROLE_IDS.MODERATOR}`,
                {
                    method: "DELETE",
                    cookies: { cfw_session: "admin-session" },
                }
            );

            const response = await handleRemoveRole(request, mockEnv);

            expect(response.status).toBe(200);
            const body = (await response.json()) as MessageResponse;
            expect(body.message).toBe("Role removed successfully");
        });

        it("should return 400 for invalid user ID", async () => {
            const mockEnv = createMockEnv();
            const request = createMockRequest(
                `http://localhost/rbac/users/invalid/roles/${ROLE_IDS.MEMBER}`,
                {
                    method: "DELETE",
                    cookies: { cfw_session: "admin-session" },
                }
            );

            const response = await handleRemoveRole(request, mockEnv);

            expect(response.status).toBe(400);
        });
    });
});
