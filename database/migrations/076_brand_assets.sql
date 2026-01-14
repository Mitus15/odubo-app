-- Brand Assets Tables
-- Migration: 076_brand_assets.sql
-- Purpose: Digital Asset Manager for brand imagery and videos

-- Asset categories (top-level organization)
CREATE TABLE IF NOT EXISTS asset_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default categories
INSERT OR IGNORE INTO asset_categories (name, slug, sort_order) VALUES
  ('Products', 'products', 1),
  ('Brand', 'brand', 2),
  ('Creative', 'creative', 3);

-- Asset albums (within categories)
CREATE TABLE IF NOT EXISTS asset_albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES asset_categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  cover_asset_id INTEGER,
  status TEXT DEFAULT 'draft',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category_id, slug)
);

-- Individual assets (images and videos)
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id INTEGER NOT NULL REFERENCES asset_albums(id) ON DELETE CASCADE,

  -- Type and storage
  asset_type TEXT NOT NULL,
  r2_key TEXT,
  r2_key_thumb TEXT,
  r2_key_web TEXT,
  stream_uid TEXT,
  original_filename TEXT,
  mime_type TEXT,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  duration REAL,

  -- Core metadata
  title TEXT,
  description TEXT,
  alt_text TEXT,

  -- Attribution
  photographer TEXT,
  model_name TEXT,
  location TEXT,
  shoot_date DATE,

  -- Organization
  tags TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,

  -- Shopify integration
  product_handle TEXT,

  -- Moments integration
  moments_photo_id INTEGER,

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_assets_album ON assets(album_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_featured ON assets(is_featured);
CREATE INDEX IF NOT EXISTS idx_assets_product ON assets(product_handle);
CREATE INDEX IF NOT EXISTS idx_albums_category ON asset_albums(category_id);
CREATE INDEX IF NOT EXISTS idx_albums_status ON asset_albums(status);
