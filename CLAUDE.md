# Cloudflare Workers Users Framework Development Guide

## Project Overview
This is a Cloudflare Workers-based user management framework that provides serverless authentication and session management. It consists of three main components:
- **user-mgmt**: Handles user registration, login, password reset, and authentication using D1 database
- **session-state**: Manages session data using KV storage with distributed edge persistence
- **account-pages**: Example frontend Pages application demonstrating authentication flows

## Architecture
- **Authentication**: SHA-256 password hashing (optimized for Workers constraints)
- **Session Management**: Service-to-service communication between workers
- **Database**: D1 for user data persistence, KV for session storage
- **API Design**: RESTful endpoints with CORS support for cross-origin requests

## Commands
### Development
- **Local development**: `lerna run dev` (in root) or `npm run dev` (in package directory)
- **Worker ports**: session-state: 51511, user-mgmt: 51512
- **Pages dev server**: http://localhost:48080
- **Inspector ports**: session-state: 51521, user-mgmt: 51522, account-pages: 9230

### Deployment
- **Deploy all**: `lerna run deploy` (deploys all workers and pages)
- **Deploy single**: `npm run deploy` (from specific package directory)
- **Database migrations**: `npx wrangler d1 execute users --file=./schema.sql --remote`

### Testing & Debugging
- **Linting**: Run configured linters before committing
- **Type checking**: TypeScript strict mode enabled
- **Local API**: User management API runs on http://localhost:51512 in dev mode

## Code Style Guidelines
- **Formatting**: 4-space indentation, opening braces on same line
- **Naming**: camelCase for variables/functions, PascalCase for interfaces/types/classes
- **Constants**: UPPER_SNAKE_CASE, defined at top of files
- **TypeScript**: Explicit parameter/return types, minimize use of `any`
- **Imports**: Group by source, locals first then externals
- **Error handling**: Try/catch with proper context, appropriate HTTP status codes
- **Async**: Always use async/await pattern for asynchronous operations
- **Documentation**: JSDoc-style comments for functions and interfaces
- **Security**: Never log or expose secrets, use environment variables for sensitive data

## Project Structure
```
workers-users/
├── packages/
│   ├── user-mgmt/           # User authentication worker
│   │   ├── src/             # TypeScript source files
│   │   ├── migrations/      # D1 database migrations
│   │   └── wrangler.toml    # Worker configuration
│   ├── session-state/       # Session management worker
│   │   ├── src/             # TypeScript source files
│   │   └── wrangler.toml    # Worker configuration
│   └── account-pages/       # Example frontend application
│       ├── static/          # HTML, CSS, JS files
│       └── wrangler.toml    # Pages configuration
├── lerna.json               # Lerna monorepo configuration
└── package.json             # Root package with workspaces

```

## Key Dependencies
- **itty-router**: Lightweight router for Workers (v5.0.17)
- **@cloudflare/workers-types**: TypeScript types for Workers APIs
- **wrangler**: Cloudflare CLI for development and deployment

## Environment Variables
### user-mgmt Worker
- `EMAIL_FROM`: Sender email for password reset
- `EMAIL_FROM_NAME`: Display name for emails
- `EMAIL_DKIM_SELECTOR`: DKIM selector for email authentication
- `EMAIL_DKIM_DOMAIN`: Domain for DKIM signing
- `FORGOT_PASSWORD_URL`: Reset password page URL
- `TOKEN_VALID_MINUTES`: Password reset token validity (default: 60)

### Bindings
- **D1 Database**: `usersDB` - User data storage
- **KV Namespace**: `sessionstore` - Session data storage
- **Service Binding**: `sessionService` - Connection to session-state worker

## API Endpoints
### user-mgmt Worker
- `POST /register` - User registration
- `POST /login` - User authentication
- `POST /logout` - Session termination
- `POST /forgot-password` - Initiate password reset
- `POST /forgot-password-validate` - Validate reset token
- `POST /forgot-password-new-password` - Update password
- `GET /load-user` - Get current user data

### session-state Worker
- `POST /create` - Create new session
- `GET /get/:sessionId` - Retrieve session data
- `PUT /update/:sessionId` - Update session data
- `PATCH /add/:sessionId` - Add data to session
- `DELETE /delete/:sessionId` - Delete session

## Development Notes
- Email functionality uses MailChannels (free tier for Workers)
- CORS is configured for cross-origin requests with credentials
- Session cookies should be on same domain as API for Safari compatibility
- Use route-based deployment for same-domain API hosting (e.g., /user-api/*)