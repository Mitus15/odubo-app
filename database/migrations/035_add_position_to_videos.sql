-- Add position column to videos table for ordering clips
ALTER TABLE videos ADD COLUMN position INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_videos_position ON videos(position);
