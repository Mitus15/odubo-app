-- Migration 104: Add thumbnail status tracking columns
-- Purpose: Track thumbnail generation state to prevent race conditions
-- and know whether thumbnail is from R2 (reliable) or Cloudflare fallback (unreliable)

-- Add thumbnail generation status column
ALTER TABLE videos ADD COLUMN thumbnail_status TEXT DEFAULT 'pending';

-- Add thumbnail error tracking (for debugging failed generations)
ALTER TABLE videos ADD COLUMN thumbnail_error TEXT;

-- Add thumbnail source tracking (where the thumbnail came from)
ALTER TABLE videos ADD COLUMN thumbnail_source TEXT;

-- Create index for querying videos by thumbnail status (e.g., find all with failed thumbnails)
CREATE INDEX IF NOT EXISTS idx_videos_thumbnail_status ON videos(thumbnail_status);

-- Backfill existing videos:
-- If they have a poster_url with r2.odubo.studio, mark as completed from r2
-- Otherwise if they have any poster_url, mark as fallback from cloudflare
UPDATE videos
SET thumbnail_status = 'completed',
    thumbnail_source = 'r2'
WHERE poster_url IS NOT NULL
  AND poster_url LIKE '%r2.odubo.studio%';

UPDATE videos
SET thumbnail_status = 'fallback',
    thumbnail_source = 'cloudflare'
WHERE poster_url IS NOT NULL
  AND poster_url NOT LIKE '%r2.odubo.studio%'
  AND (thumbnail_status IS NULL OR thumbnail_status = 'pending');
