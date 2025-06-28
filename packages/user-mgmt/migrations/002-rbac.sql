-- RBAC (Role-Based Access Control) Migration
-- Creates roles, permissions, and junction tables for user authorization

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL,
    role_id TEXT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES User(UserID) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Insert default permissions
INSERT OR IGNORE INTO permissions (id, name, description) VALUES
    (lower(hex(randomblob(16))), 'admin:all', 'Full administrative access'),
    (lower(hex(randomblob(16))), 'users:read', 'View user information'),
    (lower(hex(randomblob(16))), 'users:write', 'Create and update users'),
    (lower(hex(randomblob(16))), 'users:delete', 'Delete users'),
    (lower(hex(randomblob(16))), 'roles:assign', 'Assign roles to users'),
    (lower(hex(randomblob(16))), 'roles:read', 'View roles and permissions'),
    (lower(hex(randomblob(16))), 'roles:write', 'Create and manage roles');

-- Insert default roles
INSERT OR IGNORE INTO roles (id, name, description) VALUES
    ('00000000000000000000000000000001', 'SUPER_ADMIN', 'Full system administrator'),
    ('00000000000000000000000000000002', 'MEMBER', 'Basic member access');

-- Assign permissions to SUPER_ADMIN role (all permissions)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT '00000000000000000000000000000001', id FROM permissions;

-- Assign permissions to MEMBER role (only users:read)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT '00000000000000000000000000000002', id FROM permissions WHERE name = 'users:read';