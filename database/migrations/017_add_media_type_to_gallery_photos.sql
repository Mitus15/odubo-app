-- Migration 017: Add media_type column to gallery_photos (photo | video)

-- SQLite will error if the column already exists; this migration assumes sequential application.
ALTER TABLE gallery_photos ADD COLUMN media_type TEXT DEFAULT 'photo';


