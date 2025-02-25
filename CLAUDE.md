# Cloudflare Workers Users Framework Development Guide

## Commands
- **Local development**: `lerna run dev` (in root) or `npm run dev` (in package directory)
- **Deploy workers**: `lerna run deploy` (all) or `npm run deploy` (single package)
- **Worker debugging**: Each worker has a dedicated inspector port (session-state: 51521, user-mgmt: 51522)
- **Front-end dev server**: Runs on http://localhost:48080

## Code Style Guidelines
- **Formatting**: 4-space indentation, opening braces on same line
- **Naming**: camelCase for variables/functions, PascalCase for interfaces/types/classes
- **Constants**: UPPER_SNAKE_CASE, defined at top of files
- **TypeScript**: Explicit parameter/return types, minimize use of `any`
- **Imports**: Group by source, locals first then externals
- **Error handling**: Try/catch with proper context, appropriate HTTP status codes
- **Async**: Always use async/await pattern for asynchronous operations
- **Documentation**: JSDoc-style comments for functions and interfaces

## Project Structure
Each package (user-mgmt, session-state, account-pages) is a standalone application deployed to Cloudflare's edge network. Use wrangler.toml for configuration.