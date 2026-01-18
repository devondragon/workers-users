# RBAC (Role-Based Access Control) Implementation Plan

## Executive Summary

This document outlines the plan to add an optional, lightweight Role-Based Access Control system to the Cloudflare Workers Users Framework. The RBAC system will be completely optional, ensuring zero impact on existing deployments while providing powerful authorization capabilities for applications that need them.

## High-Level Design

### Core Principles
1. **Optional by Default**: RBAC is disabled unless explicitly enabled via environment variable
2. **Zero Breaking Changes**: Existing deployments continue working without modification
3. **Performance-First**: Permissions cached in session to avoid repeated database queries
4. **Simple Yet Flexible**: Resource:action permission model (e.g., "users:read", "posts:write")
5. **Developer-Friendly**: Easy to understand, configure, and use

### Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  account-pages  │────▶│    user-mgmt    │────▶│ session-state   │
│   (Frontend)    │     │    (Worker)     │     │   (Worker)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                          │
                               ▼                          ▼
                        ┌─────────────┐           ┌─────────────┐
                        │  D1 Database │           │  KV Store   │
                        │  + RBAC Tables│          │ + Permissions│
                        └─────────────┘           └─────────────┘
```

### Key Components

1. **Environment Variable**: `RBAC_ENABLED=true` to enable the feature
2. **Database Schema**: Four new tables (roles, permissions, user_roles, role_permissions)
3. **Session Enhancement**: Permissions cached in session data for performance
4. **Middleware**: `requirePermission()` middleware for route protection
5. **Default Setup**: Two default roles (SUPER_ADMIN, MEMBER) with predefined permissions

## Implementation Approach

### Phase 1: Database and Core Infrastructure
- Create RBAC database schema with migrations
- Implement core permission checking functions
- Add environment variable support

### Phase 2: Session Integration
- Enhance session creation to include user permissions
- Modify session data structure to cache permissions
- Update session-state worker to handle enhanced sessions

### Phase 3: Authorization Middleware
- Create permission checking middleware
- Add middleware to protect existing endpoints (optional)
- Implement permission utilities

### Phase 4: Management APIs
- Create RBAC management endpoints (/rbac/*)
- Add role assignment functionality
- Implement permission management

### Phase 5: Migration and Documentation
- Create migration scripts for existing users
- Write comprehensive documentation
- Add example implementations

## Detailed Task List

### 1. Database Schema Tasks
- [ ] Create migration file `002-rbac.sql` with RBAC tables
  - [ ] Create `roles` table (id, name, description)
  - [ ] Create `permissions` table (id, name, description)
  - [ ] Create `user_roles` junction table
  - [ ] Create `role_permissions` junction table
- [ ] Add default data migration
  - [ ] Insert default permissions (admin:all, users:read, users:write, etc.)
  - [ ] Insert default roles (SUPER_ADMIN, MEMBER)
  - [ ] Assign permissions to default roles
- [ ] Create indexes for performance optimization

### 2. Environment Configuration Tasks
- [ ] Add `RBAC_ENABLED` to user-mgmt `wrangler.toml`
- [ ] Add `SUPER_ADMIN_EMAIL` for bootstrapping first admin
- [ ] Update `Env` interface in TypeScript with new variables
- [ ] Add RBAC configuration to CLAUDE.md

### 3. Type Definition Tasks
- [ ] Create `types/rbac.ts` with RBAC-specific types
  - [ ] Define `Role` interface
  - [ ] Define `Permission` interface
  - [ ] Define `UserRole` interface
- [ ] Update `SessionData` type to include permissions array
- [ ] Add RBAC response types for API endpoints

### 4. Core RBAC Functions
- [ ] Create `src/rbac/permissions.ts`
  - [ ] Implement `getUserPermissions(userId)` function
  - [ ] Implement `hasPermission(permissions, required)` function
  - [ ] Implement `getUserRoles(userId)` function
- [ ] Create `src/rbac/roles.ts`
  - [ ] Implement `assignRole(userId, roleId)` function
  - [ ] Implement `removeRole(userId, roleId)` function
  - [ ] Implement `createRole(name, description)` function

### 5. Session Enhancement Tasks
- [ ] Update session creation in `user-mgmt/src/session.ts`
  - [ ] Add permission fetching when RBAC is enabled
  - [ ] Include permissions in session data
- [ ] Update session-state worker handlers
  - [ ] Ensure permissions are stored in KV
  - [ ] Handle larger session payloads

### 6. Middleware Implementation
- [ ] Create `src/middleware/rbac.ts`
  - [ ] Implement `requirePermission(permission)` middleware
  - [ ] Add support for checking multiple permissions
  - [ ] Handle "admin:all" special permission
- [ ] Create `requireAnyPermission(permissions)` for OR logic
- [ ] Create `requireAllPermissions(permissions)` for AND logic

### 7. User Registration Updates
- [ ] Modify registration handler to assign default role
  - [ ] Query MEMBER role ID
  - [ ] Insert user_roles record on registration
- [ ] Add role assignment to user creation flow

### 8. Management API Endpoints
- [ ] Create `/rbac/roles` endpoints
  - [ ] GET /rbac/roles - List all roles
  - [ ] POST /rbac/roles - Create new role
  - [ ] PUT /rbac/roles/:id - Update role
  - [ ] DELETE /rbac/roles/:id - Delete role
- [ ] Create `/rbac/permissions` endpoints
  - [ ] GET /rbac/permissions - List all permissions
  - [ ] POST /rbac/permissions - Create new permission
- [ ] Create `/rbac/users/:userId/roles` endpoints
  - [ ] GET /rbac/users/:userId/roles - Get user's roles
  - [ ] POST /rbac/users/:userId/roles - Assign role to user
  - [ ] DELETE /rbac/users/:userId/roles/:roleId - Remove role from user

### 9. Existing Endpoint Protection
- [ ] Add optional permission checks to sensitive endpoints
  - [ ] DELETE /users/:id - requires "users:delete"
  - [ ] PUT /users/:id - requires "users:update" or own user
- [ ] Update load-user endpoint to include roles/permissions when RBAC enabled

### 10. Admin Bootstrapping
- [ ] Create initialization script for first admin
  - [ ] Check for SUPER_ADMIN_EMAIL environment variable
  - [ ] Assign SUPER_ADMIN role to specified user
- [ ] Add bootstrapping to worker startup (optional)

### 11. Testing Tasks
- [ ] Create test suite for RBAC functions
- [ ] Test permission checking logic
- [ ] Test middleware with various permission scenarios
- [ ] Test session enhancement
- [ ] Test backwards compatibility with RBAC disabled

### 12. Migration Scripts
- [ ] Create script to assign default role to existing users
- [ ] Create script to promote specific users to admin
- [ ] Document migration process for existing deployments

### 13. Documentation Tasks
- [ ] Update README.md with RBAC section
- [ ] Create RBAC.md with detailed documentation
  - [ ] Configuration guide
  - [ ] Permission format explanation
  - [ ] API endpoint documentation
  - [ ] Migration guide
- [ ] Add RBAC examples to account-pages
- [ ] Update CLAUDE.md with RBAC information

### 14. Frontend Examples
- [ ] Add permission-based UI elements to account-pages
  - [ ] Show/hide admin features based on permissions
  - [ ] Display user's roles on profile page
- [ ] Create admin panel example (future enhancement)

### 15. Performance Optimization
- [ ] Add database indexes for permission queries
- [ ] Implement permission caching strategy
- [ ] Monitor and optimize permission query performance

## Migration Strategy

1. **Deploy Code** - Deploy new code with RBAC_ENABLED=false
2. **Run Migrations** - Execute database migrations to create RBAC tables
3. **Assign Roles** - Run script to assign default roles to existing users
4. **Bootstrap Admin** - Assign SUPER_ADMIN role to designated user
5. **Enable RBAC** - Set RBAC_ENABLED=true and redeploy

## Success Criteria

- [ ] Existing deployments work unchanged when RBAC is disabled
- [ ] New deployments can enable RBAC with minimal configuration
- [ ] Permission checks add <5ms latency to protected requests
- [ ] Clear documentation enables developers to implement RBAC quickly
- [ ] Migration path is safe and reversible

## Future Enhancements

1. **Admin UI** - Dedicated Pages application for RBAC management
2. **Dynamic Permissions** - Runtime permission registration
3. **Permission Wildcards** - Support for pattern matching (e.g., "posts:*")
4. **Audit Logging** - Track permission changes and access attempts
5. **Session Revocation** - Immediate permission revocation capability