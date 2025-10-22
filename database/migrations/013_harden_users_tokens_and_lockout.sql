-- Helpful indexes (columns might already exist from other migrations)
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(account_locked_until);

