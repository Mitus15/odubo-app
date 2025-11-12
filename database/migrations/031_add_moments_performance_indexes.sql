-- Add performance indexes for Moments app queries
-- These dramatically improve query performance when multiple users access galleries simultaneously

-- Index for gallery_photos lookups by gallery_id with created_at ordering
-- Used by: /api/moments/list and gallery photo preview queries
CREATE INDEX IF NOT EXISTS idx_gallery_photos_gallery_created 
ON gallery_photos(gallery_id, created_at DESC);

-- Index for gallery_photos moderation filtering
-- Used by: Public queries that filter out moderated=2 (hidden) photos
CREATE INDEX IF NOT EXISTS idx_gallery_photos_moderation 
ON gallery_photos(moderated);

-- Composite index for efficient filtering and sorting
-- Used by: Queries that filter by gallery + moderation status + sort by date
CREATE INDEX IF NOT EXISTS idx_gallery_photos_gallery_mod_created 
ON gallery_photos(gallery_id, moderated, created_at DESC);

-- Index for galleries ordering by created_at
-- Used by: /api/moments/galleries/public ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_galleries_created 
ON galleries(created_at DESC);

-- Index for gallery_photos thumbnail lookups (used in cover image queries)
-- Used by: Cover photo selection in gallery list
CREATE INDEX IF NOT EXISTS idx_gallery_photos_thumbnail 
ON gallery_photos(thumbnail_key) WHERE thumbnail_key IS NOT NULL;
