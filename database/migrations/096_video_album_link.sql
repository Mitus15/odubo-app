-- Migration 096: Video-Album Relationship + Clip Columns Documentation
-- Purpose: Add album_id to videos for direct album linking
--          Document existing clip relationship columns

-- ============================================================================
-- ADD ALBUM RELATIONSHIP TO VIDEOS
-- ============================================================================

ALTER TABLE videos ADD COLUMN album_id TEXT REFERENCES albums(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_videos_album_id ON videos(album_id);

-- ============================================================================
-- CLIP RELATIONSHIP COLUMNS (Already exist via prior migrations, documenting here)
-- ============================================================================
-- These columns enable clips to reference their parent video:
--
-- parent_video_id INTEGER       -- References videos.id for parent video
-- clip_index INTEGER            -- Order/position within parent's clips (1, 2, 3...)
-- total_siblings INTEGER        -- Total number of clips for this parent
--
-- Usage:
-- - Parent videos have parent_video_id = NULL
-- - Clips have parent_video_id = {parent's id}
-- - To get all clips for a video: SELECT * FROM videos WHERE parent_video_id = ? ORDER BY clip_index
-- ============================================================================
