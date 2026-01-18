import { env } from "cloudflare:test";

/**
 * SQL statements to create the test database schema
 */
const schemaSQL = `
    CREATE TABLE IF NOT EXISTS User (
        UserID INTEGER PRIMARY KEY,
        Username TEXT UNIQUE,
        Password TEXT,
        FirstName TEXT,
        LastName TEXT,
        ResetToken TEXT,
        ResetTokenTime DATETIME,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_roles (
        user_id INTEGER NOT NULL,
        role_id TEXT NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, role_id),
        FOREIGN KEY (user_id) REFERENCES User(UserID) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
        role_id TEXT NOT NULL,
        permission_id TEXT NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_username ON User(Username);
    CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        action TEXT NOT NULL,
        actor_id INTEGER,
        actor_username TEXT,
        target_type TEXT NOT NULL,
        target_id TEXT,
        target_name TEXT,
        details TEXT,
        ip_address TEXT,
        success INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
`;

/**
 * SQL statements to seed the test database with initial data
 */
const seedDataSQL = `
    -- Insert default permissions
    INSERT INTO permissions (id, name, description) VALUES
        ('perm-admin-all', 'admin:all', 'Full administrative access'),
        ('perm-users-read', 'users:read', 'View user information'),
        ('perm-users-write', 'users:write', 'Create and update users'),
        ('perm-users-delete', 'users:delete', 'Delete users'),
        ('perm-roles-assign', 'roles:assign', 'Assign roles to users'),
        ('perm-roles-read', 'roles:read', 'View roles and permissions'),
        ('perm-roles-write', 'roles:write', 'Create and manage roles');

    -- Insert default roles
    INSERT INTO roles (id, name, description) VALUES
        ('role-super-admin', 'SUPER_ADMIN', 'Full system administrator'),
        ('role-member', 'MEMBER', 'Basic member access'),
        ('role-moderator', 'MODERATOR', 'Moderator with limited permissions');

    -- Assign permissions to SUPER_ADMIN role (all permissions)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT 'role-super-admin', id FROM permissions;

    -- Assign permissions to MEMBER role (only users:read)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT 'role-member', id FROM permissions WHERE name = 'users:read';

    -- Assign permissions to MODERATOR role (users:read, users:write)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT 'role-moderator', id FROM permissions WHERE name IN ('users:read', 'users:write');

    -- Insert test users
    INSERT INTO User (UserID, Username, Password, FirstName, LastName) VALUES
        (1, 'admin@test.com', 'hashed_password', 'Admin', 'User'),
        (2, 'member@test.com', 'hashed_password', 'Member', 'User'),
        (3, 'noroles@test.com', 'hashed_password', 'No', 'Roles'),
        (4, 'moderator@test.com', 'hashed_password', 'Mod', 'User');

    -- Assign roles to test users
    INSERT INTO user_roles (user_id, role_id) VALUES
        (1, 'role-super-admin'),
        (2, 'role-member'),
        (4, 'role-moderator');
`;

/**
 * Initialize the test database with schema and seed data.
 * Should be called in beforeAll() of test suites.
 */
export async function setupTestDatabase(): Promise<void> {
    const db = env.usersDB as D1Database;

    // Execute schema statements one by one
    const schemaStatements = schemaSQL
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    for (const statement of schemaStatements) {
        await db.prepare(statement).run();
    }

    // Execute seed data statements one by one
    const seedStatements = seedDataSQL
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    for (const statement of seedStatements) {
        await db.prepare(statement).run();
    }
}

/**
 * Clean up the test database.
 * Should be called in afterAll() of test suites.
 */
export async function cleanupTestDatabase(): Promise<void> {
    const db = env.usersDB as D1Database;

    await db.prepare("DELETE FROM audit_logs").run();
    await db.prepare("DELETE FROM user_roles").run();
    await db.prepare("DELETE FROM role_permissions").run();
    await db.prepare("DELETE FROM roles").run();
    await db.prepare("DELETE FROM permissions").run();
    await db.prepare("DELETE FROM User").run();
}

/**
 * Test data constants for use in tests
 */
export const TEST_DATA = {
    users: {
        admin: { id: 1, username: "admin@test.com" },
        member: { id: 2, username: "member@test.com" },
        noRoles: { id: 3, username: "noroles@test.com" },
        moderator: { id: 4, username: "moderator@test.com" },
    },
    roles: {
        superAdmin: { id: "role-super-admin", name: "SUPER_ADMIN" },
        member: { id: "role-member", name: "MEMBER" },
        moderator: { id: "role-moderator", name: "MODERATOR" },
    },
    permissions: {
        adminAll: { id: "perm-admin-all", name: "admin:all" },
        usersRead: { id: "perm-users-read", name: "users:read" },
        usersWrite: { id: "perm-users-write", name: "users:write" },
        usersDelete: { id: "perm-users-delete", name: "users:delete" },
        rolesAssign: { id: "perm-roles-assign", name: "roles:assign" },
        rolesRead: { id: "perm-roles-read", name: "roles:read" },
        rolesWrite: { id: "perm-roles-write", name: "roles:write" },
    },
} as const;
