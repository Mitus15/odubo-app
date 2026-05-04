-- Migration: 133_moments_retention.sql
-- Description: Add retention and content rights fields to galleries

-- Retention settings
ALTER TABLE galleries ADD COLUMN expires_at TEXT;
ALTER TABLE galleries ADD COLUMN is_permanent BOOLEAN DEFAULT FALSE;
ALTER TABLE galleries ADD COLUMN deleted_at TEXT;

-- Content rights (non-exclusive license by default)
ALTER TABLE galleries ADD COLUMN content_rights TEXT DEFAULT 'non-exclusive';

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_galleries_expires_at ON galleries(expires_at);
CREATE INDEX IF NOT EXISTS idx_galleries_is_permanent ON galleries(is_permanent);