-- ============================================================================
-- Migration 063: Media Registry for Professional-Grade Asset Management
-- ============================================================================
-- Creates a central registry for all media assets across R2 and Stream
-- Enables:
--   - Full audit trail of all uploads
--   - Orphan detection (assets without DB references)
--   - Storage analytics and reporting
--   - Consistent metadata across all content types
-- ============================================================================

-- Central registry for ALL media assets
CREATE TABLE IF NOT EXISTS media_registry (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Storage location
  storage_type TEXT NOT NULL CHECK (storage_type IN ('r2', 'stream')),
  storage_key TEXT NOT NULL,           -- R2 key or Stream UID
  storage_bucket TEXT,                 -- R2 bucket name (null for Stream)

  -- Public access
  public_url TEXT,                     -- Full public URL

  -- Asset metadata
  media_type TEXT NOT NULL CHECK (media_type IN ('video', 'image', 'audio', 'document')),
  content_type TEXT,                   -- MIME type (video/mp4, image/jpeg, etc.)
  file_size_bytes INTEGER,
  original_filename TEXT,

  -- Dimensions (for images/videos)
  width INTEGER,
  height INTEGER,
  duration_seconds REAL,

  -- Ownership and categorization
  entity_id TEXT REFERENCES entities(id),
  category TEXT NOT NULL,              -- 'social', 'clips', 'gallery', 'album', 'featured', 'thumbnail'
  subcategory TEXT,                    -- Additional categorization

  -- Reference to owning record (polymorphic)
  owner_type TEXT,                     -- 'social_post', 'video', 'gallery_photo', 'album', etc.
  owner_id TEXT,                       -- ID of the owning record

  -- Audit trail
  uploaded_by TEXT,                    -- User ID or 'system'
  upload_source TEXT,                  -- 'web', 'api', 'sync', 'migration'
  upload_ip TEXT,
  user_agent TEXT,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted', 'orphaned')),

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT,

  -- Prevent duplicate storage keys per storage type
  UNIQUE (storage_type, storage_key)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_media_registry_entity ON media_registry(entity_id);
CREATE INDEX IF NOT EXISTS idx_media_registry_category ON media_registry(category);
CREATE INDEX IF NOT EXISTS idx_media_registry_owner ON media_registry(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_media_registry_status ON media_registry(status);
CREATE INDEX IF NOT EXISTS idx_media_registry_created ON media_registry(created_at);
CREATE INDEX IF NOT EXISTS idx_media_registry_storage ON media_registry(storage_type, storage_key);

-- Audit log for media operations
CREATE TABLE IF NOT EXISTS media_audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- What happened
  action TEXT NOT NULL,                -- 'upload', 'delete', 'archive', 'restore', 'update'

  -- What was affected
  media_id TEXT REFERENCES media_registry(id),
  storage_type TEXT,
  storage_key TEXT,

  -- Who did it
  actor_id TEXT,                       -- User ID or 'system'
  actor_ip TEXT,

  -- Details
  details TEXT,                        -- JSON with additional context

  -- When
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_audit_log_media ON media_audit_log(media_id);
CREATE INDEX IF NOT EXISTS idx_media_audit_log_actor ON media_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_media_audit_log_created ON media_audit_log(created_at);

-- ============================================================================
-- Storage Path Conventions (documented in schema)
-- ============================================================================
--
-- R2 Path Structure:
-- ==================
--
-- social/{entity_slug}/{YYYY}/{MM}/{DD}/{uuid}.{ext}
--   - Social media uploads organized by entity and date
--   - Example: social/odubo/2025/01/15/a1b2c3d4.mp4
--
-- clips/{YYYY}/{MM}/{uuid}.{ext}
--   - Video clips (if stored in R2, usually Stream)
--
-- galleries/{gallery_slug}/photos/{uuid}.{ext}
-- galleries/{gallery_slug}/videos/{uuid}.{ext}
--   - Event/gallery uploads organized by gallery
--
-- albums/{album_id}/cover.{ext}
-- albums/{album_id}/tracks/{track_id}.{ext}
--   - Album artwork and audio files
--
-- thumbnails/{category}/{owner_id}/{uuid}.{ext}
--   - Auto-generated thumbnails for videos, etc.
--   - Example: thumbnails/videos/abc123/thumb-001.jpg
--
-- featured/cover-{timestamp}.{ext}
-- featured/background-{timestamp}.{ext}
--   - Featured page assets (singleton)
--
-- Cloudflare Stream:
-- ==================
-- All videos go to Stream with metadata in Stream's meta object
-- UID stored in media_registry.storage_key
--
-- ============================================================================
