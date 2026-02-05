-- =============================================================================
-- DISTRIBUTION TRACKING ENHANCEMENTS
-- Add columns for PostForMe status tracking and platform-specific metadata
-- Migration: 098_distribution_tracking.sql
-- =============================================================================

-- Add PostForMe status tracking columns to social_content
ALTER TABLE social_content ADD COLUMN postforme_status TEXT DEFAULT 'draft';
ALTER TABLE social_content ADD COLUMN postforme_error TEXT;
ALTER TABLE social_content ADD COLUMN last_status_sync DATETIME;

-- Add per-platform post IDs and URLs (JSON objects)
-- Format: {"instagram": "post_id", "tiktok": "post_id", "youtube": "video_id"}
ALTER TABLE social_content ADD COLUMN platform_post_ids TEXT;
ALTER TABLE social_content ADD COLUMN platform_urls TEXT;

-- Add YouTube-specific fields
ALTER TABLE social_content ADD COLUMN title_youtube TEXT;
ALTER TABLE social_content ADD COLUMN description_youtube TEXT;
ALTER TABLE social_content ADD COLUMN is_youtube_short INTEGER DEFAULT 0;

-- Rename postforme_id to postforme_post_id for clarity (if exists)
-- Note: postforme_id already exists from migration 075, we'll keep it

-- Add indexes for status queries
CREATE INDEX IF NOT EXISTS idx_social_content_postforme_status 
  ON social_content(postforme_status);

CREATE INDEX IF NOT EXISTS idx_social_content_postforme_id 
  ON social_content(postforme_id) WHERE postforme_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_content_last_sync 
  ON social_content(last_status_sync);
