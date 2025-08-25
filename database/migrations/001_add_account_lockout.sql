-- Migration: Add account lockout fields to users table
-- Date: 2025-01-15
-- Purpose: Security hardening - implement account lockout after failed login attempts

-- Add account lockout fields to users table
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN account_locked_until DATETIME;
ALTER TABLE users ADD COLUMN last_failed_login DATETIME;

-- Create index for efficient lockout checking
CREATE INDEX IF NOT EXISTS idx_users_account_lockout ON users(failed_login_attempts, account_locked_until);

-- Add comment for documentation
-- failed_login_attempts: Count of consecutive failed login attempts
-- account_locked_until: Timestamp when account lockout expires (NULL if not locked)
-- last_failed_login: Timestamp of last failed login attempt
