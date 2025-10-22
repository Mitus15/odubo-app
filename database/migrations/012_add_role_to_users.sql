-- Backfill: if is_admin truthy, set role to 'admin' (role column might already exist)
UPDATE users SET role = 'admin' WHERE (is_admin = 1 OR is_admin = '1' OR is_admin = 'true') AND (role IS NULL OR role = '' OR role = 'viewer');

-- Optional helpful index
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

