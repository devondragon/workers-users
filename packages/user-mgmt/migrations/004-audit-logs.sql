-- Audit Logs Migration
-- Creates the audit_logs table for tracking RBAC-related actions

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    action TEXT NOT NULL,
    actor_id INTEGER,
    actor_username TEXT,
    target_type TEXT NOT NULL,
    target_id TEXT,
    target_name TEXT,
    details TEXT,
    ip_address TEXT,
    success INTEGER DEFAULT 1
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type ON audit_logs(target_type);
