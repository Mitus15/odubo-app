-- Add security/token columns for verification, invites and lockout
ALTER TABLE users ADD COLUMN invite_token_hash TEXT;
ALTER TABLE users ADD COLUMN invite_token_expiry INTEGER;

ALTER TABLE users ADD COLUMN email_verification_token_hash TEXT;
ALTER TABLE users ADD COLUMN email_verification_expiry INTEGER;

-- Reset token columns already referenced; ensure presence
ALTER TABLE users ADD COLUMN reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN reset_token_expiry INTEGER;

-- Lockout tracking
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN account_locked_until INTEGER;
ALTER TABLE users ADD COLUMN last_failed_login INTEGER;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(account_locked_until);

