-- Social CMS Tables
-- Migration: 075_social_cms.sql
-- Purpose: Create tables for Social CMS - content management for social media distribution

-- Content folders for organization
CREATE TABLE IF NOT EXISTS social_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_default BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default folders
INSERT OR IGNORE INTO social_folders (name, slug, is_default, sort_order) VALUES
  ('Behind the Scenes', 'bts', TRUE, 1),
  ('Reels', 'reels', TRUE, 2),
  ('Promos', 'promos', TRUE, 3),
  ('Clips', 'clips', TRUE, 4);

-- Social content items
CREATE TABLE IF NOT EXISTS social_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id INTEGER REFERENCES social_folders(id),

  -- Content source
  source_type TEXT NOT NULL DEFAULT 'upload', -- 'upload' or 'clip'
  video_id INTEGER REFERENCES videos(id), -- if source_type='clip'
  upload_uid TEXT, -- Cloudflare Stream UID if uploaded
  thumbnail_url TEXT,
  duration REAL, -- Duration in seconds

  -- Metadata
  title TEXT NOT NULL,

  -- Per-platform captions
  caption_instagram TEXT,
  caption_tiktok TEXT,
  caption_youtube TEXT,
  hashtags_instagram TEXT,
  hashtags_tiktok TEXT,
  hashtags_youtube TEXT,

  -- Workflow status: draft, review, approved, scheduled, posted, archived
  status TEXT DEFAULT 'draft',

  -- Scheduling
  scheduled_for DATETIME,
  scheduled_platforms TEXT, -- JSON array: ["instagram", "tiktok", "youtube"]

  -- Posting tracking
  posted_at DATETIME,
  posted_platforms TEXT, -- JSON array of actually posted platforms
  postforme_id TEXT, -- if using PostForMe integration

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_social_content_folder ON social_content(folder_id);
CREATE INDEX IF NOT EXISTS idx_social_content_status ON social_content(status);
CREATE INDEX IF NOT EXISTS idx_social_content_scheduled ON social_content(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_social_content_source ON social_content(source_type, video_id);

-- Analytics per post per platform
CREATE TABLE IF NOT EXISTS social_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL REFERENCES social_content(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- instagram, tiktok, youtube

  -- Metrics (manual entry initially)
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,

  -- Platform-specific
  platform_post_id TEXT, -- native post ID on platform
  platform_url TEXT, -- direct link to post

  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Unique constraint: one analytics record per content per platform
  UNIQUE(content_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_social_analytics_content ON social_analytics(content_id);
CREATE INDEX IF NOT EXISTS idx_social_analytics_platform ON social_analytics(platform);
