-- =============================================================================
-- CLIP FEED ORDERING
-- Manual control over clip order in the feed
-- =============================================================================

-- Add feed_position for manual ordering (lower number = appears first)
ALTER TABLE videos ADD COLUMN feed_position INTEGER;

-- Index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_videos_feed_position ON videos(feed_position);
