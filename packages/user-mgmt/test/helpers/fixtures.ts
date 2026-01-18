import { Role, Permission } from "../../src/types/rbac";

/**
 * Test fixture data for roles
 */
export const ROLE_FIXTURES: Record<string, Role> = {
    superAdmin: {
        id: "role-super-admin",
        name: "SUPER_ADMIN",
        description: "Full system administrator",
        createdAt: new Date("2024-01-01"),
    },
    member: {
        id: "role-member",
        name: "MEMBER",
        description: "Basic member access",
        createdAt: new Date("2024-01-01"),
    },
    moderator: {
        id: "role-moderator",
        name: "MODERATOR",
        description: "Moderator with limited permissions",
        createdAt: new Date("2024-01-01"),
    },
};

/**
 * Test fixture data for permissions
 */
export const PERMISSION_FIXTURES: Record<string, Permission> = {
    adminAll: {
        id: "perm-admin-all",
        name: "admin:all",
        description: "Full administrative access",
        createdAt: new Date("2024-01-01"),
    },
    usersRead: {
        id: "perm-users-read",
        name: "users:read",
        description: "View user information",
        createdAt: new Date("2024-01-01"),
    },
    usersWrite: {
        id: "perm-users-write",
        name: "users:write",
        description: "Create and update users",
        createdAt: new Date("2024-01-01"),
    },
    usersDelete: {
        id: "perm-users-delete",
        name: "users:delete",
        description: "Delete users",
        createdAt: new Date("2024-01-01"),
    },
    rolesAssign: {
        id: "perm-roles-assign",
        name: "roles:assign",
        description: "Assign roles to users",
        createdAt: new Date("2024-01-01"),
    },
    rolesRead: {
        id: "perm-roles-read",
        name: "roles:read",
        description: "View roles and permissions",
        createdAt: new Date("2024-01-01"),
    },
    rolesWrite: {
        id: "perm-roles-write",
        name: "roles:write",
        description: "Create and manage roles",
        createdAt: new Date("2024-01-01"),
    },
};

/**
 * Test user IDs
 */
export const USER_IDS = {
    admin: 1,
    member: 2,
    noRoles: 3,
    moderator: 4,
} as const;

/**
 * Test usernames (emails)
 */
export const USERNAMES = {
    admin: "admin@test.com",
    member: "member@test.com",
    noRoles: "noroles@test.com",
    moderator: "moderator@test.com",
} as const;

/**
 * All permission names for easy reference
 */
export const PERMISSION_NAMES = {
    ADMIN_ALL: "admin:all",
    USERS_READ: "users:read",
    USERS_WRITE: "users:write",
    USERS_DELETE: "users:delete",
    ROLES_ASSIGN: "roles:assign",
    ROLES_READ: "roles:read",
    ROLES_WRITE: "roles:write",
} as const;

/**
 * Role IDs for easy reference
 */
export const ROLE_IDS = {
    SUPER_ADMIN: "role-super-admin",
    MEMBER: "role-member",
    MODERATOR: "role-moderator",
} as const;
