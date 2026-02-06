-- Migration 100: Add UNIQUE constraint on videos.uid
-- Prevents duplicate video entries for the same Cloudflare Stream video

-- First, handle any existing duplicates by keeping only the most recent
-- (This is a safety measure in case duplicates already exist)
DELETE FROM videos 
WHERE id NOT IN (
  SELECT MAX(id) 
  FROM videos 
  WHERE uid IS NOT NULL 
  GROUP BY uid
);

-- Create unique index on uid (only for non-NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_uid_unique ON videos(uid) WHERE uid IS NOT NULL;
