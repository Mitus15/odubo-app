-- =============================================================================
-- MULTI-ENTITY SUPPORT
-- Support multiple brands/entities (e.g., "Odubo", "BAAD") each with their own
-- social accounts, posts, and content libraries
-- =============================================================================

-- Entities table (brands/business units)
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL,                    -- "Odubo", "BAAD"
  slug TEXT NOT NULL UNIQUE,             -- "odubo", "baad" (for URLs)
  description TEXT,
  logo_url TEXT,
  color TEXT DEFAULT '#843c2d',          -- Brand color for UI
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert initial entities
INSERT OR IGNORE INTO entities (id, name, slug, description, color) VALUES
  ('odubo', 'Odubo', 'odubo', 'Personal artist brand', '#843c2d'),
  ('baad', 'BAAD', 'baad', 'Clothing line', '#1a1a1a');

-- Add entity_id to social_accounts
ALTER TABLE social_accounts ADD COLUMN entity_id TEXT REFERENCES entities(id);

-- Add entity_id and account_ids to social_posts
ALTER TABLE social_posts ADD COLUMN entity_id TEXT REFERENCES entities(id);
ALTER TABLE social_posts ADD COLUMN account_ids TEXT;  -- JSON array of account IDs

-- Add entity_id to social_media_library (if exists)
-- Using a safe approach that won't fail if table doesn't exist
CREATE TABLE IF NOT EXISTS social_media_library (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  entity_id TEXT REFERENCES entities(id),
  media_type TEXT NOT NULL,              -- video, image
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  filename TEXT,
  file_size INTEGER,
  duration_ms INTEGER,
  width INTEGER,
  height INTEGER,
  uploaded_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entities_slug ON entities(slug);
CREATE INDEX IF NOT EXISTS idx_entities_active ON entities(is_active);
CREATE INDEX IF NOT EXISTS idx_social_accounts_entity ON social_accounts(entity_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_entity ON social_posts(entity_id);
CREATE INDEX IF NOT EXISTS idx_social_media_library_entity ON social_media_library(entity_id);

-- Update existing accounts to belong to default entity (odubo)
UPDATE social_accounts SET entity_id = 'odubo' WHERE entity_id IS NULL;

-- Update existing posts to belong to default entity (odubo)
UPDATE social_posts SET entity_id = 'odubo' WHERE entity_id IS NULL;
