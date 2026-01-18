# Role-Based Access Control (RBAC) Documentation

## Overview

The Cloudflare Workers Users Framework includes an optional Role-Based Access Control (RBAC) system that provides fine-grained permission management for your applications. This system allows you to define roles, assign permissions, and control access to resources based on user roles.

### Key Features

- **Flexible Permission System**: Define custom permissions using a hierarchical format
- **Role Management**: Create and manage roles with specific permission sets
- **User-Role Assignment**: Assign multiple roles to users
- **Permission Inheritance**: Wildcard support for permission hierarchies
- **API Integration**: Built-in endpoints for role and permission management
- **Optional Implementation**: RBAC can be enabled or disabled based on your needs

### Architecture

The RBAC system is built into the `user-mgmt` worker and uses the D1 database for persistence. It consists of:

- **Roles**: Named collections of permissions
- **Permissions**: String-based access controls in `resource:action` format
- **User-Role Mappings**: Many-to-many relationships between users and roles
- **Role-Permission Mappings**: Many-to-many relationships between roles and permissions

## Configuration Guide

### Environment Variables

Add these environment variables to your `user-mgmt` worker configuration:

```toml
# In packages/user-mgmt/wrangler.toml
[vars]
RBAC_ENABLED = "true"  # Enable RBAC system (default: false)
RBAC_DEFAULT_ROLE = "user"  # Default role for new users (optional)
RBAC_ADMIN_EMAIL = "admin@example.com"  # Email for initial admin user (optional)
```

### Database Schema

The RBAC system requires additional tables in your D1 database. Run this migration after the initial schema:

```sql
-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    permission TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User-Role mapping
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id)
);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_permissions_permission ON permissions(permission);
```

### Default Roles and Permissions

When RBAC is enabled, the system can automatically create default roles:

```sql
-- Insert default roles
INSERT INTO roles (name, description) VALUES
    ('admin', 'Full system access'),
    ('user', 'Standard user access'),
    ('guest', 'Limited guest access');

-- Insert default permissions
INSERT INTO permissions (permission, description) VALUES
    ('users:read', 'View user profiles'),
    ('users:write', 'Edit user profiles'),
    ('users:delete', 'Delete users'),
    ('users:*', 'All user operations'),
    ('roles:read', 'View roles'),
    ('roles:write', 'Create and edit roles'),
    ('roles:delete', 'Delete roles'),
    ('roles:assign', 'Assign roles to users'),
    ('roles:*', 'All role operations'),
    ('system:*', 'Full system access');

-- Assign permissions to roles
-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.permission = 'system:*';

-- User gets basic permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'user' AND p.permission IN ('users:read', 'users:write');

-- Guest gets read-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'guest' AND p.permission = 'users:read';
```

## Migration Guide

### For Existing Deployments

1. **Backup your data**: Before enabling RBAC, ensure you have backups of your D1 database.

2. **Run the RBAC migration**:
   ```bash
   cd packages/user-mgmt
   npx wrangler d1 execute users --file=./migrations/rbac.sql --remote
   ```

3. **Update your wrangler.toml**:
   ```toml
   [vars]
   RBAC_ENABLED = "true"
   RBAC_DEFAULT_ROLE = "user"
   ```

4. **Assign roles to existing users**:
   ```sql
   -- Assign default role to all existing users
   INSERT INTO user_roles (user_id, role_id)
   SELECT u.id, r.id FROM users u, roles r
   WHERE r.name = 'user'
   AND u.id NOT IN (SELECT user_id FROM user_roles);
   ```

5. **Assign admin role** to your administrative users:
   ```sql
   -- Assign admin role to specific user
   INSERT INTO user_roles (user_id, role_id)
   SELECT u.id, r.id FROM users u, roles r
   WHERE u.email = 'admin@example.com' AND r.name = 'admin';
   ```

6. **Deploy the updated worker**:
   ```bash
   npm run deploy
   ```

### For New Deployments

1. **Configure environment variables** in `wrangler.toml` before first deployment
2. **Deploy the workers** with `lerna run deploy`
3. **Run both schema files**:
   ```bash
   cd packages/user-mgmt
   npx wrangler d1 execute users --file=./schema.sql --remote
   npx wrangler d1 execute users --file=./migrations/rbac.sql --remote
   ```

## Permission Format Explanation

### Basic Format

Permissions follow a `resource:action` format:
- `users:read` - Read access to user resources
- `posts:write` - Write access to post resources
- `admin:delete` - Delete access to admin resources

### Wildcards

Use wildcards for broader permissions:
- `users:*` - All actions on user resources
- `*:read` - Read access to all resources
- `*:*` - Full access to everything

### Hierarchical Permissions

You can create hierarchical permissions:
- `api:users:read` - Read users via API
- `api:users:write` - Write users via API
- `api:users:*` - All user operations via API
- `api:*` - All API operations

### Permission Checking

The system checks permissions in order of specificity:
1. Exact match (e.g., `users:read`)
2. Action wildcard (e.g., `users:*`)
3. Resource wildcard (e.g., `*:read`)
4. Full wildcard (e.g., `*:*`)

## API Endpoint Documentation

### Authentication Required

All RBAC endpoints require authentication. Include the session cookie or token with requests.

### Role Management Endpoints

#### List All Roles
```http
GET /api/roles
Authorization: Bearer <token>

Response:
{
  "roles": [
    {
      "id": 1,
      "name": "admin",
      "description": "Full system access",
      "permissions": ["system:*"],
      "userCount": 2
    }
  ]
}
```

#### Get Role Details
```http
GET /api/roles/:roleId
Authorization: Bearer <token>

Response:
{
  "id": 1,
  "name": "admin",
  "description": "Full system access",
  "permissions": ["system:*"],
  "users": [
    {"id": 1, "email": "admin@example.com"}
  ]
}
```

#### Create Role
```http
POST /api/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "editor",
  "description": "Content editing access",
  "permissions": ["posts:read", "posts:write"]
}

Response:
{
  "id": 4,
  "name": "editor",
  "description": "Content editing access"
}
```

#### Update Role
```http
PUT /api/roles/:roleId
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Updated description",
  "permissions": ["posts:*", "comments:*"]
}
```

#### Delete Role
```http
DELETE /api/roles/:roleId
Authorization: Bearer <token>
```

### User Role Assignment

#### Get User Roles
```http
GET /api/users/:userId/roles
Authorization: Bearer <token>

Response:
{
  "roles": [
    {"id": 1, "name": "admin"},
    {"id": 2, "name": "user"}
  ]
}
```

#### Assign Role to User
```http
POST /api/users/:userId/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "roleId": 3
}
```

#### Remove Role from User
```http
DELETE /api/users/:userId/roles/:roleId
Authorization: Bearer <token>
```

### Permission Checking

#### Check User Permissions
```http
POST /api/permissions/check
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": 123,
  "permissions": ["users:read", "posts:write"]
}

Response:
{
  "results": {
    "users:read": true,
    "posts:write": false
  }
}
```

#### Get User's Effective Permissions
```http
GET /api/users/:userId/permissions
Authorization: Bearer <token>

Response:
{
  "permissions": [
    "users:read",
    "users:write",
    "posts:read"
  ]
}
```

## Example Usage Scenarios

### Scenario 1: Blog Platform

```javascript
// Define permissions for a blog platform
const blogPermissions = [
  'posts:read',      // View posts
  'posts:write',     // Create/edit own posts
  'posts:delete',    // Delete own posts
  'posts:publish',   // Publish posts
  'posts:moderate',  // Moderate all posts
  'comments:read',   // View comments
  'comments:write',  // Write comments
  'comments:delete', // Delete comments
  'users:manage'     // Manage users
];

// Create roles
const roles = [
  {
    name: 'reader',
    permissions: ['posts:read', 'comments:read']
  },
  {
    name: 'author',
    permissions: ['posts:*', 'comments:*']
  },
  {
    name: 'editor',
    permissions: ['posts:*', 'comments:*', 'users:manage']
  }
];
```

### Scenario 2: E-commerce Platform

```javascript
// E-commerce permissions
const ecommercePermissions = [
  'products:view',
  'products:manage',
  'orders:view',
  'orders:create',
  'orders:update',
  'orders:cancel',
  'inventory:view',
  'inventory:manage',
  'customers:view',
  'customers:manage',
  'reports:view',
  'reports:generate'
];

// Role definitions
const roles = [
  {
    name: 'customer',
    permissions: ['products:view', 'orders:create', 'orders:view']
  },
  {
    name: 'support',
    permissions: ['products:view', 'orders:view', 'customers:view']
  },
  {
    name: 'manager',
    permissions: ['*:view', '*:manage']
  }
];
```

### Scenario 3: Multi-tenant SaaS

```javascript
// Tenant-specific permissions
const tenantPermissions = [
  'tenant:settings:read',
  'tenant:settings:write',
  'tenant:users:invite',
  'tenant:users:remove',
  'tenant:billing:view',
  'tenant:billing:manage',
  'tenant:data:export'
];

// Check permission with tenant context
async function checkTenantPermission(userId, tenantId, permission) {
  // First check if user belongs to tenant
  const userTenant = await getUserTenant(userId, tenantId);
  if (!userTenant) return false;
  
  // Then check permission within tenant context
  return checkUserPermission(userId, `tenant:${tenantId}:${permission}`);
}
```

## Troubleshooting Guide

### Common Issues

#### 1. RBAC_ENABLED not working
**Problem**: RBAC endpoints return 404 even with RBAC_ENABLED=true

**Solution**: 
- Ensure the environment variable is properly set in wrangler.toml
- Redeploy the worker after configuration changes
- Check worker logs for RBAC initialization messages

#### 2. Permission denied errors
**Problem**: Users getting "Permission denied" for actions they should have access to

**Solution**:
- Verify the user has the correct roles assigned
- Check that the role has the required permissions
- Use the permission check endpoint to debug
- Remember wildcard permissions (e.g., `users:*` includes `users:read`)

#### 3. Database migration failures
**Problem**: RBAC migration script fails

**Solution**:
- Ensure the base schema is applied first
- Check for existing tables/conflicts
- Verify D1 database bindings are correct
- Use `--local` flag for testing migrations locally first

#### 4. Default role not assigned
**Problem**: New users don't get the default role

**Solution**:
- Verify RBAC_DEFAULT_ROLE is set correctly
- Check that the role exists in the database
- Review user registration endpoint logs
- Manually assign roles if needed

### Performance Considerations

1. **Permission Caching**: Consider implementing permission caching in KV store for frequently checked permissions

2. **Batch Operations**: Use batch endpoints when checking multiple permissions or assigning multiple roles

3. **Index Optimization**: Ensure database indexes are properly created for user_roles and role_permissions tables

4. **Query Optimization**: For large deployments, consider denormalizing permission data for faster lookups

### Security Best Practices

1. **Principle of Least Privilege**: Grant only necessary permissions to each role

2. **Regular Audits**: Periodically review role assignments and permissions

3. **Separation of Duties**: Use multiple roles rather than one role with many permissions

4. **Permission Naming**: Use clear, consistent naming conventions for permissions

5. **Admin Protection**: Limit who can assign/modify admin roles

6. **Logging**: Enable audit logging for all RBAC operations

## Advanced Topics

### Custom Permission Validators

You can implement custom permission validation logic:

```javascript
// Custom validator for resource ownership
async function canUserAccessResource(userId, resourceId, permission) {
  // Check ownership first
  const resource = await getResource(resourceId);
  if (resource.ownerId === userId) {
    return true; // Owners have full access
  }
  
  // Otherwise check RBAC permissions
  return checkUserPermission(userId, permission);
}
```

### Dynamic Permissions

Create permissions based on runtime conditions:

```javascript
// Generate tenant-specific permissions
function getTenantPermissions(tenantId) {
  return [
    `tenant:${tenantId}:read`,
    `tenant:${tenantId}:write`,
    `tenant:${tenantId}:admin`
  ];
}
```

### Permission Inheritance

Implement hierarchical permission checking:

```javascript
// Check if user has permission or any parent permission
function hasPermissionHierarchy(userPerms, requiredPerm) {
  const permParts = requiredPerm.split(':');
  
  // Check exact match
  if (userPerms.includes(requiredPerm)) return true;
  
  // Check wildcards at each level
  for (let i = permParts.length; i > 0; i--) {
    const wildcardPerm = permParts.slice(0, i - 1).concat('*').join(':');
    if (userPerms.includes(wildcardPerm)) return true;
  }
  
  return false;
}
```

## Integration Examples

### Frontend Integration

```javascript
// Check permissions before showing UI elements
async function checkUIPermissions() {
  const response = await fetch('/api/users/me/permissions', {
    credentials: 'include'
  });
  
  const { permissions } = await response.json();
  
  // Show/hide UI elements based on permissions
  if (permissions.includes('posts:write')) {
    document.getElementById('create-post-btn').style.display = 'block';
  }
  
  if (permissions.includes('users:manage')) {
    document.getElementById('admin-menu').style.display = 'block';
  }
}
```

### Middleware Integration

```javascript
// Express-style middleware for permission checking
function requirePermission(permission) {
  return async (req, res, next) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const hasPermission = await checkUserPermission(userId, permission);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    next();
  };
}

// Usage
router.post('/api/posts', requirePermission('posts:write'), createPost);
router.delete('/api/users/:id', requirePermission('users:delete'), deleteUser);
```

### Worker Integration

```javascript
// Cloudflare Worker route protection
import { Router } from 'itty-router';

const router = Router();

// Permission middleware
async function withPermission(permission) {
  return async (request, env, ctx) => {
    const userId = await getUserIdFromSession(request, env);
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const hasPermission = await checkUserPermission(userId, permission, env);
    if (!hasPermission) {
      return new Response('Forbidden', { status: 403 });
    }
  };
}

// Protected routes
router.post('/api/admin/*', withPermission('admin:*'), handleAdminRoute);
router.put('/api/users/:id', withPermission('users:write'), updateUser);
```

## Conclusion

The RBAC system in the Cloudflare Workers Users Framework provides a flexible and powerful way to manage permissions in your applications. By following this guide, you can implement fine-grained access control that scales with your application's needs.

Remember that RBAC is optional - you can start without it and enable it later as your application grows. The system is designed to be backward compatible and can be gradually adopted in existing deployments.