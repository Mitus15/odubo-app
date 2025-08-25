-- Add artist_name column to videos table for LibraryManager compatibility
ALTER TABLE videos ADD COLUMN artist_name TEXT DEFAULT '';

-- Update the table to have proper status field
ALTER TABLE videos ADD COLUMN status TEXT DEFAULT 'published';

-- Add missing fields for better compatibility
ALTER TABLE videos ADD COLUMN updated_at TEXT DEFAULT '';

-- Update existing records to have proper timestamps
UPDATE videos SET updated_at = created_at WHERE updated_at = '' OR updated_at IS NULL;
