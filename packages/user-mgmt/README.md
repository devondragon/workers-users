# User Management Worker

## Overview

The User Management Worker is a Cloudflare Worker that provides comprehensive user authentication and account management functionality. This serverless solution uses Cloudflare D1 (SQLite) for data storage and integrates with the Session State Worker to maintain user sessions.

## Features

- **User Registration**: Create new user accounts
- **Authentication**: Secure login with password hashing
- **Session Management**: Integration with the Session State Worker
- **Password Reset**: Complete forgot password flow with email verification
- **User Data Access**: Retrieve user information securely
- **CORS Support**: Configurable cross-origin resource sharing
- **RBAC (Role-Based Access Control)**: Optional role and permission management
- **Audit Logging**: Track security-related actions with queryable logs
- **Permission Caching**: Optimized permission checks with KV-based caching

## API Endpoints

| Method | Endpoint                    | Description                               |
|--------|----------------------------|-------------------------------------------|
| POST   | /register                  | Create a new user account                  |
| POST   | /login                     | Authenticate and create a session          |
| GET    | /logout                    | End a user session                         |
| POST   | /forgot-password           | Initiate password reset process            |
| POST   | /forgot-password-validate  | Validate a password reset token            |
| POST   | /forgot-password-new-password | Set a new password after reset          |
| GET    | /load-user                  | Get current user data from session        |

### RBAC Endpoints (when RBAC_ENABLED=true)

| Method | Endpoint                    | Description                               | Permission Required |
|--------|----------------------------|-------------------------------------------|---------------------|
| GET    | /rbac/roles                | List all roles                            | Authenticated       |
| POST   | /rbac/roles                | Create a new role                         | roles:write         |
| GET    | /rbac/permissions          | List all permissions                      | Authenticated       |
| GET    | /rbac/users/:userId/roles  | Get user's roles                          | roles:read (or own) |
| POST   | /rbac/users/:userId/roles  | Assign role to user                       | roles:assign        |
| DELETE | /rbac/users/:userId/roles/:roleId | Remove role from user              | roles:assign        |
| GET    | /rbac/audit-logs           | Query audit logs                          | admin:all           |

## Installation

1. Ensure you have [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed:
   ```
   npm install -g wrangler
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a D1 database for storing user data:
   ```
   npx wrangler d1 create users
   ```

4. Update the D1 database ID in `wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "usersDB"
   database_name = "users"
   database_id = "<YOUR_DB_ID_HERE>"
   ```

5. Initialize the database schema:
   ```
   npx wrangler d1 execute users --file=./schema.sql --remote
   ```

## Configuration

The Worker is configured through the `wrangler.toml` file:

```toml
name = "user-mgmt"
main = "src/index.ts"
compatibility_date = "2023-01-01"

[[d1_databases]]
binding = "usersDB"
database_name = "users" 
database_id = "<YOUR_DB_ID_HERE>"

[[services]]
binding = "SESSION_STATE"
service = "session-state"

[vars]
FORGOT_PASSWORD_URL = "https://your-site.com/forgot-password-reset.html"
FORGOT_PASSWORD_TOKEN_EXPIRATION_TIME = "3600"
EMAIL_FROM = "noreply@yourdomain.com"
EMAIL_DKIM_DOMAIN = "yourdomain.com"
EMAIL_DKIM_SELECTOR = "mailchannels"
EMAIL_DKIM_PRIVATE_KEY = ""

[dev]
port = 51512
inspector_port = 51522
```

## RBAC Configuration

To enable Role-Based Access Control, add the following to your `wrangler.toml`:

```toml
[vars]
RBAC_ENABLED = "true"
SUPER_ADMIN_EMAIL = "admin@yourdomain.com"  # Optional: Bootstrap this user as super admin
```

### Setting Up RBAC

1. Run the RBAC migration to create the necessary tables:
   ```bash
   npx wrangler d1 execute users --file=./migrations/001-rbac-schema.sql --remote
   npx wrangler d1 execute users --file=./migrations/004-audit-logs.sql --remote
   ```

2. Seed initial roles and permissions:
   ```bash
   npx wrangler d1 execute users --file=./migrations/002-rbac-seed.sql --remote
   ```

3. If `SUPER_ADMIN_EMAIL` is configured, the specified user will automatically receive the SUPER_ADMIN role on worker startup.

### Default Roles and Permissions

The system comes with these default roles:
- **SUPER_ADMIN**: Full system access (`admin:all` permission)
- **MEMBER**: Basic read access (`users:read` permission)
- **MODERATOR**: User management (`users:read`, `users:write`, `roles:read`)

### Audit Logging

All RBAC operations are automatically logged to the `audit_logs` table:
- Role assignments and removals
- Role creation
- Super admin bootstrap events

Query audit logs via the `/rbac/audit-logs` endpoint (requires `admin:all` permission).

### Permission Caching

User permissions are cached in KV storage via the Session State Worker:
- **TTL**: 5 minutes (300 seconds)
- **Invalidation**: Immediate on role assignment/removal
- **Fallback**: Graceful degradation to D1 on cache failure

## Email Configuration

The Worker uses [MailChannels](https://mailchannels.com/) for sending password reset emails from Cloudflare Workers. To configure email:

1. Set up your domain with the appropriate DNS records for MailChannels
2. Configure the email variables in wrangler.toml:
   - `EMAIL_FROM`: Your sending email address
   - `EMAIL_DKIM_DOMAIN`: Your domain name
   - `EMAIL_DKIM_SELECTOR`: DKIM selector (typically "mailchannels")
   - `EMAIL_DKIM_PRIVATE_KEY`: Your DKIM private key

## Development

Run the Worker locally for development:

```bash
npm run dev
```

This will start the Worker on port 51512 with an inspector on port 51522.

## Testing

The project includes a comprehensive test suite using [Vitest](https://vitest.dev/) with the Cloudflare Workers pool.

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

### Test Coverage

The test suite includes:
- **Unit tests**: Core RBAC functions (permissions, roles, cache)
- **Middleware tests**: Authorization middleware (requirePermission, requireAnyPermission, requireAllPermissions)
- **Integration tests**: All RBAC API endpoints

Tests use Miniflare to simulate the Cloudflare Workers environment with D1 database support.

## Deployment

Deploy the Worker to Cloudflare:

```bash
npm run deploy
```

## Authentication Implementation

The Worker implements secure authentication with:

- Password hashing using SHA-256
- Cookie-based session management
- Integration with the Session State Worker
- CORS configuration for cross-origin communication
- HTTPS-only cookies

## Dependencies

- [itty-router](https://github.com/kwhitley/itty-router) - Lightweight router for Cloudflare Workers
- TypeScript - For type safety and developer experience
- Cloudflare Workers runtime
- Cloudflare D1 for database
- MailChannels for email delivery

## Integration

This Worker integrates with:

1. **Session State Worker**: For managing user sessions
2. **Account Pages**: Example front-end implementation