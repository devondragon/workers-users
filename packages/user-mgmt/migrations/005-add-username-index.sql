-- Index on Username for RBAC performance optimization
-- This column is queried in every RBAC operation to look up user roles and permissions
CREATE INDEX IF NOT EXISTS idx_user_username ON User(Username);
