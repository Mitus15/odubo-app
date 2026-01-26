-- =============================================================================
-- Migration 088: Custom Galleries - Flexible Gallery Types with Multi-Content Linking
-- =============================================================================
-- Transforms event-focused galleries into a flexible system supporting:
-- - Multiple gallery types (event, collection, lookbook, showcase, bts, campaign, archive)
-- - Admin-only vs public upload modes
-- - Multi-content linking (products, videos, clips, tracks, albums, events)
-- =============================================================================

-- 1. Add gallery_type column to support different gallery purposes
-- Default 'event' for backward compatibility with existing galleries
ALTER TABLE galleries ADD COLUMN gallery_type TEXT NOT NULL DEFAULT 'event';

-- 2. Add upload permission control
-- 'public' = anyone can upload (event mode), 'admin' = only admin can upload
ALTER TABLE galleries ADD COLUMN upload_mode TEXT NOT NULL DEFAULT 'public';

-- 3. Add cover photo support for admin-curated galleries
ALTER TABLE galleries ADD COLUMN cover_photo_key TEXT;

-- 4. Add display ordering for curated galleries
ALTER TABLE galleries ADD COLUMN sort_order INTEGER DEFAULT 0;

-- 5. Create gallery_links table for multi-content linking
CREATE TABLE IF NOT EXISTS gallery_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gallery_id INTEGER NOT NULL,

  -- Polymorphic link target
  -- product = Shopify product, video = videos table, clip = videos with type=clip
  -- track = tracks table, album = albums table, event = events table, gallery = self-reference
  link_type TEXT NOT NULL CHECK (link_type IN ('product', 'video', 'clip', 'track', 'album', 'event', 'gallery')),
  link_id TEXT NOT NULL,           -- ID of the linked content
  link_handle TEXT,                -- Human-readable identifier (product handle, video uid, etc.)

  -- Link metadata
  is_primary INTEGER DEFAULT 0,    -- Primary link (for featured display, only one per gallery)
  display_label TEXT,              -- Optional custom label ("Shop the Look", "Listen Now")
  sort_order INTEGER DEFAULT 0,    -- Ordering within gallery

  -- Audit
  created_at TEXT DEFAULT (datetime('now')),
  created_by TEXT,

  FOREIGN KEY (gallery_id) REFERENCES galleries(id) ON DELETE CASCADE,
  UNIQUE (gallery_id, link_type, link_id)
);

-- Indexes for gallery_links
CREATE INDEX IF NOT EXISTS idx_gallery_links_gallery ON gallery_links(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_links_type_id ON gallery_links(link_type, link_id);
CREATE INDEX IF NOT EXISTS idx_gallery_links_primary ON gallery_links(gallery_id, is_primary) WHERE is_primary = 1;

-- 6. Add source indicator to gallery_photos for distinguishing admin vs public uploads
-- 'public' = uploaded via public camera/upload, 'admin' = uploaded by admin, 'import' = bulk import
ALTER TABLE gallery_photos ADD COLUMN source TEXT DEFAULT 'public';

-- 7. Add sort_order to gallery_photos for admin-controlled photo ordering
ALTER TABLE gallery_photos ADD COLUMN sort_order INTEGER DEFAULT 0;

-- 8. Add caption support for gallery photos
ALTER TABLE gallery_photos ADD COLUMN caption TEXT;

-- 9. Create indexes for efficient gallery queries
CREATE INDEX IF NOT EXISTS idx_galleries_type ON galleries(gallery_type);
CREATE INDEX IF NOT EXISTS idx_galleries_upload_mode ON galleries(upload_mode);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_sort ON gallery_photos(gallery_id, sort_order);

-- 10. Migrate existing product links from galleries table to gallery_links table
-- This preserves existing Shopify product associations while enabling multiple links
INSERT INTO gallery_links (gallery_id, link_type, link_id, link_handle, is_primary, created_at)
SELECT
  id,
  'product',
  COALESCE(shopify_product_id, shopify_product_handle),
  shopify_product_handle,
  1,
  datetime('now')
FROM galleries
WHERE shopify_product_id IS NOT NULL OR shopify_product_handle IS NOT NULL;
