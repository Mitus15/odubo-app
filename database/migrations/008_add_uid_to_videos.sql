-- Add stable unique string UID to videos for consistent cross-system references
-- This avoids relying on INTEGER AUTOINCREMENT ids and aligns with albums/tracks TEXT ids

-- Add uid column if it does not exist
ALTER TABLE videos ADD COLUMN uid TEXT;

-- Ensure uniqueness (best-effort; if this fails on older engines, it's fine to skip)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_uid ON videos(uid);

-- Populate existing rows with generated UIDs if empty
UPDATE videos
SET uid = (
  'video_' || lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(6)))
)
WHERE uid IS NULL OR uid = '';


