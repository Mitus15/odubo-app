-- Add MP4 processing status tracking to videos table
-- This helps monitor async Stream MP4 download generation

-- Add processing status column
ALTER TABLE videos ADD COLUMN mp4_processing_status TEXT DEFAULT 'pending'
  CHECK (mp4_processing_status IN ('pending', 'processing', 'ready', 'failed'));

-- Add timestamp for when we started processing
ALTER TABLE videos ADD COLUMN mp4_processing_started_at TEXT;

-- Add timestamp for last check
ALTER TABLE videos ADD COLUMN mp4_processing_last_checked_at TEXT;

-- Add retry count
ALTER TABLE videos ADD COLUMN mp4_processing_retry_count INTEGER DEFAULT 0;

-- Add error message if it fails
ALTER TABLE videos ADD COLUMN mp4_processing_error TEXT;

-- Index for background job query
CREATE INDEX IF NOT EXISTS idx_videos_mp4_processing_status
  ON videos(mp4_processing_status, mp4_processing_started_at);

-- Update existing videos based on their mp4_url
UPDATE videos SET mp4_processing_status =
  CASE
    WHEN mp4_url IS NULL THEN 'pending'
    WHEN mp4_url LIKE '%media.odubo.studio/videos/source/%' THEN 'pending'
    WHEN mp4_url LIKE '%cloudflarestream.com%downloads%' THEN 'ready'
    ELSE 'pending'
  END
WHERE uid IS NOT NULL;
