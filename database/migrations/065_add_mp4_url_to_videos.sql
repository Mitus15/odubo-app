-- Add mp4_url column to videos table for Cloudflare Stream MP4 downloads
-- This enables faster playback and better Safari/iOS compatibility

ALTER TABLE videos ADD COLUMN mp4_url TEXT;

-- Index for faster lookups when fetching clips with MP4
CREATE INDEX IF NOT EXISTS idx_videos_mp4_url ON videos(mp4_url) WHERE mp4_url IS NOT NULL;
