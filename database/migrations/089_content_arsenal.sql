-- =============================================================================
-- Migration 089: Content Arsenal - Clip Identity & Platform URL Backfeed
-- =============================================================================
-- Purpose: Support "Magazine & Bullets" content orchestration
-- - Preserve original filenames after upload
-- - Track clip ordering within parent videos
-- - Store backfeed URLs from YouTube/TikTok/Instagram after publishing
-- =============================================================================

-- =============================================================================
-- CLIP IDENTITY: Preserve original filename and ordering
-- =============================================================================
ALTER TABLE videos ADD COLUMN original_filename TEXT;  -- e.g., "BAAD_Teaser_v3_final.mp4"
ALTER TABLE videos ADD COLUMN clip_index INTEGER;      -- Position within parent (1-based)
ALTER TABLE videos ADD COLUMN total_siblings INTEGER;  -- Total clips in the magazine

-- =============================================================================
-- EXTERNAL PLATFORM URLs (for backfeed)
-- =============================================================================
ALTER TABLE videos ADD COLUMN youtube_url TEXT;
ALTER TABLE videos ADD COLUMN youtube_shorts_url TEXT;
ALTER TABLE videos ADD COLUMN tiktok_url TEXT;
ALTER TABLE videos ADD COLUMN instagram_reels_url TEXT;

-- =============================================================================
-- POST FOR ME TRACKING (for auto-backfeed)
-- =============================================================================
ALTER TABLE videos ADD COLUMN postforme_post_id TEXT;  -- Links to Post for Me
ALTER TABLE videos ADD COLUMN postforme_status TEXT;   -- scheduled/published/failed

-- Platform post IDs (from backfeed)
ALTER TABLE videos ADD COLUMN youtube_post_id TEXT;
ALTER TABLE videos ADD COLUMN tiktok_post_id TEXT;
ALTER TABLE videos ADD COLUMN instagram_post_id TEXT;

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_videos_youtube ON videos(youtube_url) WHERE youtube_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_tiktok ON videos(tiktok_url) WHERE tiktok_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_parent_order ON videos(parent_video_id, clip_index);
CREATE INDEX IF NOT EXISTS idx_videos_postforme ON videos(postforme_post_id) WHERE postforme_post_id IS NOT NULL;
