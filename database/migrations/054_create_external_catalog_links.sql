-- External Catalog Links
-- Maps internal tracks/albums to external platform IDs

CREATE TABLE IF NOT EXISTS external_catalog_links (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Internal reference (one of these should be set)
  track_id TEXT,
  album_id TEXT,
  artist_id TEXT,

  -- External platform
  platform TEXT NOT NULL,            -- spotify, apple_music, amazon, youtube_music, tidal, deezer, soundcloud, bandcamp

  -- External identifiers
  external_id TEXT NOT NULL,         -- Platform's ID
  external_url TEXT,                 -- Direct link

  -- Additional platform-specific data
  external_data TEXT,                -- JSON with platform-specific fields

  -- Matching metadata (for verification)
  matched_title TEXT,
  matched_artist TEXT,
  match_confidence REAL,             -- 0-1, how confident we are in the match

  -- Status
  verified INTEGER DEFAULT 0,        -- Manually verified
  auto_matched INTEGER DEFAULT 1,    -- Was this auto-matched or manual

  -- Sync
  last_synced_at TEXT,
  sync_error TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,

  -- One link per entity per platform
  UNIQUE(track_id, platform),
  UNIQUE(album_id, platform)
);

-- Platform API credentials and connection status
CREATE TABLE IF NOT EXISTS platform_connections (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  platform TEXT NOT NULL UNIQUE,     -- spotify, apple_music, etc.

  -- Connection status
  connected INTEGER DEFAULT 0,
  connection_type TEXT,              -- oauth, api_key, manual

  -- Credentials (encrypted or reference to secure storage)
  credentials_encrypted TEXT,

  -- OAuth tokens
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TEXT,

  -- API limits
  rate_limit_remaining INTEGER,
  rate_limit_reset_at TEXT,

  -- Sync status
  last_sync_at TEXT,
  last_sync_status TEXT,
  last_sync_error TEXT,

  -- Account info
  account_id TEXT,
  account_name TEXT,
  account_email TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_catalog_links_track ON external_catalog_links(track_id);
CREATE INDEX IF NOT EXISTS idx_catalog_links_album ON external_catalog_links(album_id);
CREATE INDEX IF NOT EXISTS idx_catalog_links_platform ON external_catalog_links(platform);
CREATE INDEX IF NOT EXISTS idx_catalog_links_external ON external_catalog_links(platform, external_id);
