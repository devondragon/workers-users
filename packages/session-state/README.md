# Session State Worker

## Overview

The Session State Worker is a Cloudflare Worker that provides robust session management capabilities for serverless applications. It leverages Cloudflare's KV (Key-Value) storage to maintain stateful sessions in a stateless serverless environment.

## Features

- **Session Creation**: Generate new sessions with custom data
- **Session Retrieval**: Fetch session data using session IDs
- **Session Updates**: Update entire session objects
- **Partial Updates**: Add specific data to existing sessions
- **Session Deletion**: Remove sessions when no longer needed

## API Endpoints

| Method | Endpoint               | Description                                |
|--------|------------------------|--------------------------------------------|
| POST   | /create                | Creates a new session                      |
| GET    | /get/:sessionId        | Retrieves data for a specific session      |
| PUT    | /update/:sessionId     | Updates a complete session                 |
| PATCH  | /add/:sessionId        | Adds data to an existing session           |
| DELETE | /delete/:sessionId     | Deletes a session                          |

## Installation

1. Ensure you have [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed:
   ```
   npm install -g wrangler
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a KV namespace for storing sessions:
   ```
   npx wrangler kv:namespace create "sessionstore"
   ```

4. Update the KV namespace ID in `wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "sessionstore"
   id = "<YOUR_KV_ID_HERE>"
   ```

## Configuration

The Worker is configured through the `wrangler.toml` file:

```toml
name = "session-state"
main = "src/index.ts"
compatibility_date = "2023-01-01"

[[kv_namespaces]]
binding = "sessionstore"
id = "<YOUR_KV_ID_HERE>"

[dev]
port = 51511
inspector_port = 51521
```

## Development

Run the Worker locally for development:

```bash
npm run dev
```

This will start the Worker on port 51511 with an inspector on port 51521.

## Deployment

Deploy the Worker to Cloudflare:

```bash
npm run deploy
```

## Usage

The Worker expects and returns JSON data. Here's a simple example of creating a session:

```javascript
// Create a session
const response = await fetch('https://your-worker-url/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userId: 123,
    role: 'admin',
    customData: { preferences: { theme: 'dark' } }
  })
});

const { sessionId } = await response.json();
```

## Dependencies

- [itty-router](https://github.com/kwhitley/itty-router) - Lightweight router for Cloudflare Workers
- TypeScript - For type safety and developer experience
- Cloudflare Workers runtime
- Cloudflare KV for data storage

## Integration

This Worker is designed to work in conjunction with the `user-mgmt` Worker to provide a complete user authentication and session management solution for serverless applications.