-- Migration: 130_mymoments_contents.sql
-- Description: Create MyMoments contents table for vault items


CREATE TABLE IF NOT EXISTS my_moments_contents (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL REFERENCES my_moments_vaults(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  user_id TEXT, -- Clerk user ID
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  content_url TEXT NOT NULL,
  thumbnail_url TEXT,
  original_filename TEXT,
  file_size_bytes INTEGER,
  duration_seconds INTEGER, -- For videos
  width INTEGER,
  height INTEGER,
  caption TEXT,
  visibility TEXT DEFAULT 'event' CHECK (visibility IN ('private', 'event', 'public')),
  cool_points_earned INTEGER DEFAULT 0,
  repurposed_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for vault lookups
CREATE INDEX IF NOT EXISTS idx_contents_vault ON my_moments_contents(vault_id);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_contents_user ON my_moments_contents(user_identifier);

-- Index for visibility filtering
CREATE INDEX IF NOT EXISTS idx_contents_visibility ON my_moments_contents(visibility);

-- Index for recent content
CREATE INDEX IF NOT EXISTS idx_contents_recent ON my_moments_contents(created_at DESC);

-- Index for media type
CREATE INDEX IF NOT EXISTS idx_contents_type ON my_moments_contents(media_type);

