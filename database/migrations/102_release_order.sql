-- =============================================================================
-- RELEASE ORDER FOR DEPLOYMENT PIPELINE
-- Order parent videos for content release planning
-- =============================================================================

-- Add release_order for parent video ordering (lower number = deploy first)
-- This is separate from feed_position (which is for public feed randomization edge cases)
ALTER TABLE videos ADD COLUMN release_order INTEGER;

-- Index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_videos_release_order ON videos(release_order);
