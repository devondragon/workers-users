# RBAC Testing Guide - Separate Environment Setup

## Overview
This guide walks you through setting up a separate Cloudflare environment to test the RBAC implementation without affecting your main deployment.

## Prerequisites
- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Node.js 16.17.0 or later

## Step 1: Create Test Infrastructure in Cloudflare

### 1.1 Create Test KV Namespace
```bash
# Create a test session store
npx wrangler kv:namespace create "sessionstore_test"
```
Save the returned ID - you'll need it for configuration.

### 1.2 Create Test D1 Database
```bash
# Create a test users database
npx wrangler d1 create users-test
```
Save the returned database_id - you'll need it for configuration.

### 1.3 Create Test Workers with Unique Names
We'll suffix all workers with `-test` to keep them separate.

## Step 2: Configure Test Environment

### 2.1 Create Test Configuration Files

Create `packages/session-state/wrangler.test.toml`:
```toml
name = "session-state-test"
main = "src/index.ts"
compatibility_date = "2024-01-17"

[[kv_namespaces]]
binding = "sessionstore"
id = "YOUR_TEST_KV_ID_HERE"  # Replace with ID from step 1.1

[dev]
port = 51521
```

Create `packages/user-mgmt/wrangler.test.toml`:
```toml
name = "user-mgmt-test"
main = "src/index.ts"
compatibility_date = "2024-01-17"

[[services]]
binding = "sessionService"
service = "session-state-test"  # Points to test session worker

[[d1_databases]]
binding = "usersDB"
database_name = "users-test"
database_id = "YOUR_TEST_DB_ID_HERE"  # Replace with ID from step 1.2

[vars]
EMAIL_FROM = "noreply@yourtest.com"
EMAIL_FROM_NAME = "RBAC Test Environment"
EMAIL_DKIM_SELECTOR = "mailchannels"
EMAIL_DKIM_DOMAIN = "yourtest.com"
FORGOT_PASSWORD_URL = "https://account-pages-test.pages.dev/forgot-password-reset.html"
TOKEN_VALID_MINUTES = 60

# RBAC Configuration - ENABLED for testing
RBAC_ENABLED = "true"
SUPER_ADMIN_EMAIL = "admin@test.com"  # Set to your test admin email

[dev]
port = 51522
```

Create `packages/account-pages/wrangler.test.toml`:
```toml
name = "account-pages-test"
```

## Step 3: Deploy Test Infrastructure

### 3.1 Deploy Session State Worker
```bash
cd packages/session-state
npx wrangler deploy --config wrangler.test.toml
```

### 3.2 Initialize D1 Database Schema
```bash
cd ../user-mgmt

# Create base user table
npx wrangler d1 execute users-test --file=./schema.sql --remote --config wrangler.test.toml

# Create RBAC tables
npx wrangler d1 execute users-test --file=./migrations/002-rbac.sql --remote --config wrangler.test.toml
```

### 3.3 Deploy User Management Worker
```bash
npx wrangler deploy --config wrangler.test.toml
```

### 3.4 Deploy Test Pages Application
```bash
cd ../account-pages

# Update the API URL in static/js/api.js to point to your test worker
# Find the line: const API_BASE_URL = 'https://user-mgmt.yourdomain.com';
# Change to: const API_BASE_URL = 'https://user-mgmt-test.YOUR-SUBDOMAIN.workers.dev';

npx wrangler pages deploy static --project-name account-pages-test
```

## Step 4: Test Scenarios

### 4.1 Basic RBAC Testing

1. **Register a New User**
   - Navigate to your test Pages URL
   - Register with email: `user1@test.com`
   - This user should automatically get the MEMBER role

2. **Verify MEMBER Role Assignment**
   ```bash
   # Check user roles in database
   npx wrangler d1 execute users-test --command "SELECT u.Username, r.name FROM User u JOIN user_roles ur ON u.UserID = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE u.Username = 'user1@test.com'" --remote --config wrangler.test.toml
   ```

3. **Test Super Admin Bootstrap**
   - Register a user with the email you set in `SUPER_ADMIN_EMAIL`
   - Login with this user
   - Check they have admin permissions

### 4.2 API Testing with cURL

Get your test worker URL from Cloudflare dashboard or wrangler output.

1. **Login and Get Session Cookie**
   ```bash
   # Login
   curl -X POST https://user-mgmt-test.YOUR-SUBDOMAIN.workers.dev/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin@test.com","password":"your-password"}' \
     -c cookies.txt -v
   ```

2. **Test Load User (Should Include Roles)**
   ```bash
   curl https://user-mgmt-test.YOUR-SUBDOMAIN.workers.dev/load-user \
     -b cookies.txt | jq .
   ```

   Expected response:
   ```json
   {
     "username": "admin@test.com",
     "firstName": "Admin",
     "lastName": "User",
     "permissions": ["admin:all"],
     "roles": [{
       "id": "00000000000000000000000000000001",
       "name": "SUPER_ADMIN",
       "description": "Full system administrator"
     }]
   }
   ```

3. **Test RBAC Endpoints**

   **List all roles (requires authentication):**
   ```bash
   curl https://user-mgmt-test.YOUR-SUBDOMAIN.workers.dev/rbac/roles \
     -b cookies.txt | jq .
   ```

   **List all permissions:**
   ```bash
   curl https://user-mgmt-test.YOUR-SUBDOMAIN.workers.dev/rbac/permissions \
     -b cookies.txt | jq .
   ```

   **Create a new role (requires roles:write permission):**
   ```bash
   curl -X POST https://user-mgmt-test.YOUR-SUBDOMAIN.workers.dev/rbac/roles \
     -H "Content-Type: application/json" \
     -d '{"name":"MODERATOR","description":"Content moderator"}' \
     -b cookies.txt | jq .
   ```

   **Assign role to user (requires roles:assign permission):**
   ```bash
   # First, get a user ID
   curl https://user-mgmt-test.YOUR-SUBDOMAIN.workers.dev/rbac/users/2/roles \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"roleId":"00000000000000000000000000000002"}' \
     -b cookies.txt | jq .
   ```

### 4.3 Permission Testing

1. **Test with Non-Admin User**
   - Login as `user1@test.com` (MEMBER role)
   - Try to create a role - should get 403 Forbidden
   - Try to list roles - should work (requires authentication only)

2. **Test Permission Inheritance**
   - Verify admin with `admin:all` can perform any action
   - Verify MEMBER can only read user info

### 4.4 Test RBAC Disabled Mode

1. **Update Configuration**
   ```toml
   # In wrangler.test.toml, change:
   RBAC_ENABLED = "false"
   ```

2. **Redeploy**
   ```bash
   npx wrangler deploy --config wrangler.test.toml
   ```

3. **Verify Backward Compatibility**
   - All endpoints should work without permission checks
   - No roles in load-user response
   - RBAC endpoints return 403

## Step 5: Advanced Testing

### 5.1 Database Verification Queries

```bash
# Check all users and their roles
npx wrangler d1 execute users-test --command "SELECT u.Username, GROUP_CONCAT(r.name) as roles FROM User u LEFT JOIN user_roles ur ON u.UserID = ur.user_id LEFT JOIN roles r ON ur.role_id = r.id GROUP BY u.UserID" --remote --config wrangler.test.toml

# Check role permissions
npx wrangler d1 execute users-test --command "SELECT r.name as role, GROUP_CONCAT(p.name) as permissions FROM roles r JOIN role_permissions rp ON r.id = rp.role_id JOIN permissions p ON rp.permission_id = p.id GROUP BY r.id" --remote --config wrangler.test.toml

# Check specific user permissions
npx wrangler d1 execute users-test --command "SELECT DISTINCT p.name FROM permissions p JOIN role_permissions rp ON p.id = rp.permission_id JOIN user_roles ur ON rp.role_id = ur.role_id JOIN User u ON ur.user_id = u.UserID WHERE u.Username = 'admin@test.com'" --remote --config wrangler.test.toml
```

### 5.2 Load Testing

```bash
# Test permission caching efficiency
for i in {1..10}; do
  time curl https://user-mgmt-test.YOUR-SUBDOMAIN.workers.dev/load-user \
    -b cookies.txt -s > /dev/null
done
```

### 5.3 Edge Cases

1. **Multiple Roles**
   - Assign both SUPER_ADMIN and MEMBER roles to a user
   - Verify permissions are combined correctly

2. **Role Removal**
   - Remove a role from a user
   - Verify permissions update on next login

3. **Migration Testing**
   ```bash
   # Add test users without roles
   npx wrangler d1 execute users-test --command "INSERT INTO User (Username, Password, FirstName, LastName) VALUES ('legacy@test.com', 'hash', 'Legacy', 'User')" --remote --config wrangler.test.toml
   
   # Run migration script
   npx wrangler d1 execute users-test --file=./migrations/003-assign-default-roles.sql --remote --config wrangler.test.toml
   
   # Verify they got MEMBER role
   ```

## Step 6: Cleanup

When testing is complete, clean up test resources:

```bash
# Delete test database
npx wrangler d1 delete users-test

# Delete test KV namespace
npx wrangler kv:namespace delete --namespace-id YOUR_TEST_KV_ID

# Delete test workers
npx wrangler delete --name user-mgmt-test
npx wrangler delete --name session-state-test

# Delete test Pages project
npx wrangler pages project delete account-pages-test
```

## Troubleshooting

### Common Issues

1. **"RBAC is not enabled" errors**
   - Verify RBAC_ENABLED = "true" in wrangler.test.toml
   - Ensure you redeployed after configuration change

2. **Permission denied errors**
   - Check user has correct role: verify in database
   - Ensure session includes permissions: check load-user response
   - Verify permission name matches exactly (case-sensitive)

3. **Session not found**
   - Check cookies are being sent with requests
   - Verify session-state-test worker is running
   - Check KV namespace binding is correct

### Debug Commands

```bash
# View worker logs
npx wrangler tail user-mgmt-test

# Check worker status
npx wrangler deployments list

# Inspect D1 database
npx wrangler d1 execute users-test --command "SELECT name FROM sqlite_master WHERE type='table'" --remote --config wrangler.test.toml
```

## Summary

This testing setup allows you to:
- Test RBAC in complete isolation from production
- Verify all permission scenarios
- Test migration procedures safely
- Validate backward compatibility
- Load test without affecting real users

Once testing is complete and you're confident in the implementation, you can apply the same migrations and configuration to your production environment.