-- Social Posting System Tables
-- Comprehensive system for scheduling and publishing to social platforms

-- Drop old unused tables (empty, from previous attempt)
DROP TABLE IF EXISTS social_post_targets;
DROP TABLE IF EXISTS social_posts;

-- Main scheduled posts table
CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, pending_approval, scheduled, publishing, published, failed
  created_by TEXT NOT NULL,              -- user ID
  approved_by TEXT,                       -- user ID who approved

  -- Content
  media_type TEXT NOT NULL,              -- video, image, carousel
  media_url TEXT NOT NULL,               -- R2/Stream URL
  media_key TEXT,                        -- R2 key for deletion
  thumbnail_url TEXT,

  -- Source reference (if from library)
  source_type TEXT,                      -- 'library', 'upload', 'clip'
  source_id TEXT,                        -- ID of source content (video, clip, etc.)

  -- Editing
  crop_settings TEXT,                    -- JSON: per-platform crop data
  trim_start_ms INTEGER,
  trim_end_ms INTEGER,
  text_overlays TEXT,                    -- JSON: text overlay config

  -- Caption
  caption TEXT,
  caption_by_platform TEXT,              -- JSON: platform-specific captions
  hashtags TEXT,                         -- JSON array
  mentions TEXT,                         -- JSON array
  first_comment TEXT,                    -- For Instagram

  -- Scheduling
  scheduled_at TEXT,
  published_at TEXT,
  timezone TEXT DEFAULT 'America/Los_Angeles',

  -- Platforms
  platforms TEXT NOT NULL,               -- JSON array of platform names
  platform_status TEXT,                  -- JSON: status per platform
  platform_post_ids TEXT,                -- JSON: external IDs after publish
  platform_errors TEXT,                  -- JSON: errors per platform

  -- Metadata
  title TEXT,                            -- Internal title for organization
  requires_approval INTEGER DEFAULT 0,
  is_important INTEGER DEFAULT 0,
  notes TEXT,                            -- Internal team notes
  edit_history TEXT,                     -- JSON array of changes
  tags TEXT,                             -- JSON array for categorization

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Auto-saved drafts (wizard state)
CREATE TABLE IF NOT EXISTS social_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  draft_data TEXT NOT NULL,              -- JSON blob of wizard state
  last_step INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Team activity log
CREATE TABLE IF NOT EXISTS social_activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT,                        -- Denormalized for display
  action TEXT NOT NULL,                  -- created, edited, approved, published, deleted, commented
  target_type TEXT NOT NULL,             -- post, draft
  target_id TEXT NOT NULL,
  details TEXT,                          -- JSON with change details
  created_at TEXT DEFAULT (datetime('now'))
);

-- Post comments (team collaboration)
CREATE TABLE IF NOT EXISTS social_post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,                        -- Denormalized for display
  comment TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE
);

-- Content library (uploaded media for posting)
CREATE TABLE IF NOT EXISTS social_media_library (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Media info
  media_type TEXT NOT NULL,              -- video, image
  media_url TEXT NOT NULL,               -- R2/Stream URL
  media_key TEXT,                        -- R2 key
  thumbnail_url TEXT,

  -- Metadata
  filename TEXT,
  file_size INTEGER,
  duration_ms INTEGER,                   -- For videos
  width INTEGER,
  height INTEGER,
  aspect_ratio TEXT,                     -- '9:16', '1:1', '16:9', etc.

  -- Organization
  title TEXT,
  description TEXT,
  tags TEXT,                             -- JSON array

  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TEXT,

  -- Processing
  processing_status TEXT DEFAULT 'ready', -- uploading, processing, ready, failed

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Optimal posting times (learned from analytics)
CREATE TABLE IF NOT EXISTS social_posting_times (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,          -- 0=Sunday, 6=Saturday
  hour INTEGER NOT NULL,                 -- 0-23
  score REAL DEFAULT 0,                  -- Engagement score for this slot
  sample_count INTEGER DEFAULT 0,        -- Number of posts analyzed
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(platform, day_of_week, hour)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_by ON social_posts(created_by);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON social_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_social_drafts_user ON social_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_activity_target ON social_activity_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_social_media_library_user ON social_media_library(user_id);
CREATE INDEX IF NOT EXISTS idx_social_media_library_type ON social_media_library(media_type);
