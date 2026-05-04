-- Migration: 124_community_posts.sql
-- Description: Create community posts table for unified community wall across Cool Wrld


CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  user_identifier TEXT,
  user_id TEXT, -- Clerk user ID
  post_type TEXT NOT NULL CHECK (post_type IN ('hype_video', 'outfit_preview', 'reaction', 'question', 'fan_photo', 'fan_clip')),
  episode_id TEXT REFERENCES cool_wrld_episodes(id) ON DELETE SET NULL,
  gallery_id TEXT REFERENCES galleries(id) ON DELETE SET NULL,
  content_url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'featured', 'rejected')),
  featured_at DATETIME,
  rejection_reason TEXT,
  moderation_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  moderated_at DATETIME,
  moderated_by TEXT
);

-- Index for episode filtering
CREATE INDEX IF NOT EXISTS idx_community_episode ON community_posts(episode_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_community_status ON community_posts(status);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_community_user ON community_posts(user_identifier);

-- Index for featured posts
CREATE INDEX IF NOT EXISTS idx_community_featured ON community_posts(featured_at);

-- Index for recent posts
CREATE INDEX IF NOT EXISTS idx_community_recent ON community_posts(created_at DESC);

