-- Add audio_normalized column to videos table to track loudness normalization status
-- This helps avoid re-processing clips that have already been normalized to -16 LUFS

ALTER TABLE videos ADD COLUMN audio_normalized INTEGER DEFAULT 0;

-- Create index for faster querying of unnormalized clips
CREATE INDEX IF NOT EXISTS idx_videos_audio_normalized ON videos(audio_normalized) WHERE type = 'clip';
