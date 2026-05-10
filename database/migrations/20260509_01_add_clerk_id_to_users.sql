-- Add clerk_id column to users table for Clerk authentication integration
ALTER TABLE users ADD COLUMN clerk_id TEXT UNIQUE;

-- Add index for faster lookups by clerk_id
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
