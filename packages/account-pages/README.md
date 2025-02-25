# Account Pages

## Overview

Account Pages is a Cloudflare Pages project that provides a simple, front-end implementation for user authentication and account management. It serves as a demonstration and reference for integrating with the User Management and Session State Workers.

## Features

- **User Authentication**: Login and registration forms
- **Password Management**: Forgot password and reset flows
- **Session Handling**: Displays user data from active sessions
- **Responsive Design**: Clean, minimalist interface
- **API Integration**: Demonstrates communication with Workers

## Pages

| Page | Description |
|------|-------------|
| index.html | Login and registration forms |
| loggedin.html | Post-login page displaying user data |
| forgot-password.html | Form to request password reset |
| forgot-password-reset.html | Form to create a new password |

## Installation

1. Ensure you have [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed:
   ```
   npm install -g wrangler
   ```

2. Create a Cloudflare Pages project:
   ```
   npx wrangler pages project create account-pages
   ```

3. Configure the API endpoint in `static/js/api.js`:
   ```javascript
   // For production
   const API_BASE_URL = 'https://your-user-mgmt-worker.com';
   
   // For development
   // const API_BASE_URL = 'http://localhost:51512';
   ```

## Configuration

The Pages project is configured through the `wrangler.toml` file:

```toml
name = "account-pages"
compatibility_date = "2023-01-01"

[site]
bucket = "./static"

[dev]
port = 48080
```

## Development

Run the Pages application locally for development:

```bash
npm run dev
```

This will start the development server on port 48080.

## Deployment

Deploy the Pages application to Cloudflare:

```bash
npm run deploy
```

## Browser Compatibility

The Account Pages application is designed to work in all modern browsers, including:
- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## Structure

- **static/css**: Contains the application styling
- **static/js**: JavaScript files for API communication and UI logic
- **static/img**: Images and assets 
- **static/*.html**: HTML templates for each page

## API Integration

The application communicates with the User Management Worker API via the `callApi()` helper function in `api.js`. This function handles:

- Authentication headers
- Error handling
- Request formatting
- Session cookie management

## Usage

The Account Pages project is primarily intended as a reference implementation. In production, you may want to:

1. Integrate the authentication flows into your existing application
2. Customize the look and feel to match your branding
3. Enhance the UI with a modern framework like React, Vue, or Svelte
4. Add additional features such as user profile management

## Integration with Workers

This front-end application works with:

1. **User Management Worker**: For authentication and user operations
2. **Session State Worker**: For maintaining session data (accessed indirectly)

For a complete solution, ensure all three components are properly deployed and configured.