-- Social Ops core tables and roles field

-- 1) Add users.roles for role-based access
-- Note: SQLite in D1 does not support "IF NOT EXISTS" on ALTER TABLE ADD COLUMN.
-- This migration assumes the column does not yet exist on this database.
ALTER TABLE users ADD COLUMN roles TEXT DEFAULT '["user"]';

-- 2) Social posts (logical posts linking internal content to social targets)
CREATE TABLE IF NOT EXISTS social_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT UNIQUE,
  content_type TEXT NOT NULL,
  content_id INTEGER,
  goal TEXT,
  created_by_user_id INTEGER,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- 3) Social post targets (per-platform instances)
CREATE TABLE IF NOT EXISTS social_post_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  social_post_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  platform_variant TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at DATETIME,
  published_at DATETIME,
  platform_post_id TEXT,
  caption TEXT,
  title TEXT,
  description TEXT,
  hashtags_json TEXT,
  cta TEXT,
  products_json TEXT,
  ai_metadata_json TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (social_post_id) REFERENCES social_posts(id)
);
