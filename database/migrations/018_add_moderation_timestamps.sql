-- Migration 018: Add moderation timestamps and moderated_by to gallery_photos

-- Add columns to store who moderated and when
-- ALTER TABLE gallery_photos ADD COLUMN moderated_at TEXT;
-- ALTER TABLE gallery_photos ADD COLUMN moderated_by TEXT;

-- Ensure there's an index on moderated to speed moderation queries
CREATE INDEX IF NOT EXISTS idx_gallery_photos_moderated ON gallery_photos(moderated);


