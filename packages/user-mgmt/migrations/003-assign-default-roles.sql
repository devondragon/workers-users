-- Migration to assign default MEMBER role to existing users
-- This migration should be run after RBAC tables are created

-- Assign MEMBER role to all existing users who don't have any roles yet
INSERT OR IGNORE INTO user_roles (user_id, role_id)
SELECT 
    u.UserID,
    '00000000000000000000000000000002' -- MEMBER role ID
FROM User u
WHERE NOT EXISTS (
    SELECT 1 
    FROM user_roles ur 
    WHERE ur.user_id = u.UserID
);