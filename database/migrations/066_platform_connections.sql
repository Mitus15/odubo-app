-- Platform Connections
-- OAuth tokens and credentials for external platform integrations
-- Enables connecting to Spotify, YouTube, Instagram, TikTok, etc.

CREATE TABLE IF NOT EXISTS platform_connections (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Platform identifier
  platform TEXT NOT NULL CHECK (platform IN (
    'spotify_artists',    -- Spotify for Artists
    'apple_artists',      -- Apple Music for Artists
    'youtube_analytics',  -- YouTube Analytics API
    'instagram',          -- Instagram Graph API
    'tiktok',             -- TikTok Creator API
    'facebook',           -- Facebook Pages
    'twitter'             -- X/Twitter API
  )),

  -- Account information
  account_id TEXT,                -- Platform's account/artist ID
  account_name TEXT,              -- Display name on platform
  account_url TEXT,               -- Profile URL
  account_image_url TEXT,         -- Profile picture

  -- OAuth tokens (should be encrypted in production)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TEXT,
  scopes TEXT,                    -- JSON array of granted scopes

  -- Connection status
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active',       -- Working connection
    'disconnected', -- User disconnected
    'error',        -- API error
    'expired',      -- Token expired, needs refresh
    'pending'       -- OAuth flow in progress
  )),

  -- Sync tracking
  last_sync_at TEXT,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed')),
  last_error TEXT,
  last_error_at TEXT,

  -- Metadata
  raw_profile TEXT,               -- JSON - raw API response
  settings TEXT,                  -- JSON - platform-specific settings

  -- Ownership
  created_by TEXT,                -- User ID who connected

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  -- One connection per platform (can be extended for multi-account later)
  UNIQUE(platform, account_id)
);

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_platform_conn_platform ON platform_connections(platform);
CREATE INDEX IF NOT EXISTS idx_platform_conn_status ON platform_connections(status);
CREATE INDEX IF NOT EXISTS idx_platform_conn_created_by ON platform_connections(created_by);

-- Add data_source column to streaming_analytics for source tracking
ALTER TABLE streaming_analytics ADD COLUMN data_source TEXT DEFAULT 'csv_import' CHECK (data_source IN (
  'csv_import',       -- Manual CSV upload
  'spotify_api',      -- Direct Spotify API
  'apple_api',        -- Direct Apple Music API
  'youtube_api',      -- Direct YouTube API
  'distributor_api',  -- Via distributor (DistroKid, etc.)
  'manual'            -- Manual entry
));

-- Track which import job created the record
ALTER TABLE streaming_analytics ADD COLUMN import_job_id TEXT;
