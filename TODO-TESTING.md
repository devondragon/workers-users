# RBAC Testing TODO Checklist

## Setup Tasks
- [ ] Create test KV namespace: `npx wrangler kv:namespace create "sessionstore_test"`
- [ ] Save the KV namespace ID: ___________________________
- [ ] Create test D1 database: `npx wrangler d1 create users-test`
- [ ] Save the D1 database ID: ___________________________

## Configuration Tasks
- [ ] Create `packages/session-state/wrangler.test.toml` with test KV ID
- [ ] Create `packages/user-mgmt/wrangler.test.toml` with test D1 ID
- [ ] Set `RBAC_ENABLED = "true"` in test config
- [ ] Set `SUPER_ADMIN_EMAIL` to your test admin email
- [ ] Create `packages/account-pages/wrangler.test.toml`

## Deployment Tasks
- [ ] Deploy session-state-test worker
- [ ] Initialize D1 schema: `npx wrangler d1 execute users-test --file=./schema.sql --remote --config wrangler.test.toml`
- [ ] Run RBAC migration: `npx wrangler d1 execute users-test --file=./migrations/002-rbac.sql --remote --config wrangler.test.toml`
- [ ] Deploy user-mgmt-test worker
- [ ] Update API_BASE_URL in account-pages to test worker URL
- [ ] Deploy account-pages-test

## Basic Functionality Tests
- [ ] Register new user - verify they get MEMBER role
- [ ] Login as regular user - verify session includes permissions
- [ ] Register super admin user - verify they get SUPER_ADMIN role
- [ ] Test `/load-user` endpoint returns roles and permissions

## RBAC API Tests
- [ ] GET `/rbac/roles` - List all roles (auth required)
- [ ] GET `/rbac/permissions` - List all permissions (auth required)
- [ ] POST `/rbac/roles` - Create new role (requires roles:write)
- [ ] GET `/rbac/users/:userId/roles` - Get user's roles
- [ ] POST `/rbac/users/:userId/roles` - Assign role (requires roles:assign)
- [ ] DELETE `/rbac/users/:userId/roles/:roleId` - Remove role (requires roles:assign)

## Permission Tests
- [ ] Test MEMBER can read user info
- [ ] Test MEMBER cannot create roles (403 expected)
- [ ] Test MEMBER cannot assign roles (403 expected)
- [ ] Test SUPER_ADMIN can perform all actions
- [ ] Test user with multiple roles gets combined permissions

## Edge Case Tests
- [ ] Test with RBAC_ENABLED = "false" - all endpoints should work
- [ ] Test RBAC endpoints return 403 when RBAC disabled
- [ ] Test migration script on users without roles
- [ ] Test role removal updates permissions on next login
- [ ] Test invalid role assignment attempts

## Performance Tests
- [ ] Measure load-user response time with permissions
- [ ] Verify permission caching works (multiple rapid requests)
- [ ] Check session size with permissions array

## Database Verification
- [ ] Query all users and their roles
- [ ] Verify role-permission mappings
- [ ] Check default roles and permissions exist
- [ ] Verify user_roles assignments

## Error Handling Tests
- [ ] Test with invalid session cookie
- [ ] Test with expired session
- [ ] Test with non-existent user ID
- [ ] Test with non-existent role ID
- [ ] Test duplicate role assignment

## Cleanup Tasks
- [ ] Delete test D1 database
- [ ] Delete test KV namespace
- [ ] Delete user-mgmt-test worker
- [ ] Delete session-state-test worker
- [ ] Delete account-pages-test project

## Notes Section
Use this space to record any issues, observations, or improvements needed:

### Issues Found:
- 

### Observations:
- 

### Suggested Improvements:
- 

### Test Environment URLs:
- User Management API: ___________________________
- Session State API: ___________________________
- Account Pages: ___________________________

### Test Credentials:
- Admin Email: ___________________________
- Test User 1: ___________________________
- Test User 2: ___________________________

## Quick Reference Commands

### Login and save cookie:
```bash
curl -X POST https://user-mgmt-test.YOUR-SUBDOMAIN.workers.dev/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@test.com","password":"your-password"}' \
  -c cookies.txt
```

### Check user info with roles:
```bash
curl https://user-mgmt-test.YOUR-SUBDOMAIN.workers.dev/load-user \
  -b cookies.txt | jq .
```

### List all roles:
```bash
curl https://user-mgmt-test.YOUR-SUBDOMAIN.workers.dev/rbac/roles \
  -b cookies.txt | jq .
```

### Check database:
```bash
npx wrangler d1 execute users-test --command "SELECT * FROM roles" --remote --config wrangler.test.toml
```

## Sign-off
- [ ] All tests completed successfully
- [ ] No breaking changes to existing functionality
- [ ] RBAC can be enabled/disabled without issues
- [ ] Performance is acceptable
- [ ] Ready for production deployment

Tested by: ___________________________ Date: _______________