-- Migration: 122_content_connections.sql
-- Description: Create content connections table for cross-linking any content types


CREATE TABLE IF NOT EXISTS content_connections (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('video', 'clip', 'track', 'album', 'gallery', 'game', 'episode', 'post')),
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('video', 'clip', 'track', 'album', 'gallery', 'game', 'episode', 'post')),
  target_id TEXT NOT NULL,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('features', 'sequel', 'remix', 'bts', 'related', 'soundtrack', 'merchandise', 'chapter')),
  metadata TEXT, -- JSON: timestamps, descriptions, etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

-- Index for source lookups
CREATE INDEX IF NOT EXISTS idx_connections_source ON content_connections(source_type, source_id);

-- Index for target lookups
CREATE INDEX IF NOT EXISTS idx_connections_target ON content_connections(target_type, target_id);

-- Index for connection type filtering
CREATE INDEX IF NOT EXISTS idx_connections_type ON content_connections(connection_type);

