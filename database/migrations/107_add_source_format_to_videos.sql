-- Migration 107: Add source_format to videos table for format tracking
-- Enables skipping transcoding for already-MP4 files

-- Add source_format column to videos table
ALTER TABLE videos ADD COLUMN source_format TEXT;

-- Index for filtering by format
CREATE INDEX idx_videos_source_format ON videos(source_format) WHERE source_format IS NOT NULL;

-- Backfill existing videos based on mp4_url extension
UPDATE videos
SET source_format = CASE
  WHEN mp4_url LIKE '%.mp4' THEN 'mp4'
  WHEN mp4_url LIKE '%.mov' THEN 'mov'
  WHEN mp4_url LIKE '%.avi' THEN 'avi'
  WHEN mp4_url LIKE '%.mkv' THEN 'mkv'
  WHEN mp4_url LIKE '%.webm' THEN 'webm'
  ELSE 'unknown'
END
WHERE mp4_url IS NOT NULL;
