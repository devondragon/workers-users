# Middleware Usage Guide

This directory contains middleware for session management and RBAC (Role-Based Access Control) authorization.

## Session Middleware

### `withSession`
Requires a valid session. Returns 401 if no session is found.

```typescript
import { withSession } from './middleware';

router.get('*/protected', 
    withSession,
    (request, env) => {
        // request.sessionData is available here
        return new Response(`Hello ${request.sessionData.username}`);
    }
);
```

### `withOptionalSession`
Loads session if available but doesn't require it.

```typescript
import { withOptionalSession } from './middleware';

router.get('*/public', 
    withOptionalSession,
    (request, env) => {
        if (request.sessionData) {
            return new Response(`Hello ${request.sessionData.username}`);
        }
        return new Response('Hello Guest');
    }
);
```

## RBAC Middleware

All RBAC middleware functions check if RBAC is enabled via the `RBAC_ENABLED` environment variable. If disabled, all requests are allowed through.

### `requirePermission`
Requires a specific permission.

```typescript
import { withSession, requirePermission } from './middleware';

router.post('*/admin/users', 
    withSession,
    requirePermission('user:create'),
    (request, env) => {
        // Only users with 'user:create' permission can access this
    }
);
```

### `requireAnyPermission`
Requires at least one of the specified permissions (OR logic).

```typescript
import { withSession, requireAnyPermission } from './middleware';

router.get('*/admin/dashboard', 
    withSession,
    requireAnyPermission(['admin:view', 'dashboard:view']),
    (request, env) => {
        // Users with either 'admin:view' OR 'dashboard:view' can access
    }
);
```

### `requireAllPermissions`
Requires all of the specified permissions (AND logic).

```typescript
import { withSession, requireAllPermissions } from './middleware';

router.delete('*/admin/users/:id', 
    withSession,
    requireAllPermissions(['user:delete', 'admin:write']),
    (request, env) => {
        // Users must have BOTH 'user:delete' AND 'admin:write' permissions
    }
);
```

### `requireAuth`
Simply requires authentication without checking specific permissions.

```typescript
import { withSession, requireAuth } from './middleware';

router.get('*/profile', 
    withSession,
    requireAuth(),
    (request, env) => {
        // Any authenticated user can access
    }
);
```

## Combining Middleware

You can chain multiple middleware functions:

```typescript
router.put('*/admin/settings',
    withSession,                           // First, ensure user has a session
    requirePermission('settings:write'),    // Then, check for specific permission
    async (request, env) => {
        // Handle the request
    }
);
```

## Error Responses

The middleware returns standardized error responses:

- **401 Unauthorized**: No session or invalid session
- **403 Forbidden**: Valid session but insufficient permissions

Example error response:
```json
{
    "error": "Insufficient permissions",
    "required": "user:delete",
    "message": "You need the 'user:delete' permission to access this resource"
}
```