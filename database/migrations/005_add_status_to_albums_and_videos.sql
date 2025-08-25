-- Add status field to albums table
ALTER TABLE albums ADD COLUMN status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'));

-- Add status field to videos table  
ALTER TABLE videos ADD COLUMN status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'));

-- Add status field to tracks table
ALTER TABLE tracks ADD COLUMN status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'));

-- Update existing records to have 'published' status if they don't have one
UPDATE albums SET status = 'published' WHERE status IS NULL;
UPDATE videos SET status = 'published' WHERE status IS NULL;
UPDATE tracks SET status = 'published' WHERE status IS NULL;
