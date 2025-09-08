-- Add role column to users for RBAC (admin|editor|viewer)
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'viewer';

-- Backfill: if is_admin truthy, set role to 'admin'
UPDATE users SET role = 'admin' WHERE is_admin = 1 OR is_admin = '1' OR is_admin = 'true';

-- Optional helpful index
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

