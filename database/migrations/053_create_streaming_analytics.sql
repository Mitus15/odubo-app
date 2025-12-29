-- Streaming Analytics System
-- Stores metrics from DSPs (Spotify, Apple Music, etc.)

-- Daily streaming analytics per track per platform
CREATE TABLE IF NOT EXISTS streaming_analytics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- What we're tracking
  track_id TEXT,                     -- Internal track ID (if linked)
  release_id TEXT,                   -- Distribution release ID (if linked)
  external_track_id TEXT,            -- DSP's track ID
  isrc TEXT,                         -- For matching

  -- Where
  platform TEXT NOT NULL,            -- spotify, apple_music, amazon, youtube_music, tidal, deezer
  territory TEXT DEFAULT 'global',   -- ISO country code or 'global'

  -- When
  date TEXT NOT NULL,                -- YYYY-MM-DD

  -- Core metrics
  streams INTEGER DEFAULT 0,
  listeners INTEGER DEFAULT 0,       -- Unique listeners (if available)
  saves INTEGER DEFAULT 0,           -- Saves/adds to library
  shares INTEGER DEFAULT 0,

  -- Revenue (in cents to avoid float issues)
  revenue_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',

  -- Engagement
  skip_rate REAL,                    -- 0-1, percentage of skips
  avg_listen_duration_seconds INTEGER,
  completion_rate REAL,              -- 0-1, percentage who finished

  -- Source breakdown (percentages, 0-100)
  source_playlist INTEGER DEFAULT 0,
  source_album INTEGER DEFAULT 0,
  source_search INTEGER DEFAULT 0,
  source_direct INTEGER DEFAULT 0,
  source_other INTEGER DEFAULT 0,

  -- Sync metadata
  synced_at TEXT DEFAULT (datetime('now')),
  raw_data TEXT,                     -- Original API response (JSON)

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL,
  FOREIGN KEY (release_id) REFERENCES distribution_releases(id) ON DELETE SET NULL,

  -- One record per track per platform per territory per day
  UNIQUE(external_track_id, platform, territory, date)
);

-- Playlist placements
CREATE TABLE IF NOT EXISTS playlist_placements (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Track info
  track_id TEXT,
  isrc TEXT,
  external_track_id TEXT,

  -- Playlist info
  platform TEXT NOT NULL,
  playlist_id TEXT NOT NULL,
  playlist_name TEXT NOT NULL,
  playlist_owner TEXT,               -- Editorial, user, artist
  playlist_type TEXT CHECK (playlist_type IN ('editorial', 'algorithmic', 'user', 'artist', 'label')),
  playlist_followers INTEGER,
  playlist_url TEXT,

  -- Position
  position INTEGER,                  -- Track position in playlist

  -- Timing
  added_at TEXT,
  removed_at TEXT,
  is_active INTEGER DEFAULT 1,

  -- Impact tracking
  streams_from_playlist INTEGER DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL
);

-- Aggregated analytics (pre-computed for performance)
CREATE TABLE IF NOT EXISTS streaming_analytics_aggregates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Scope
  track_id TEXT,
  release_id TEXT,
  artist_id TEXT,                    -- For artist-level aggregates
  platform TEXT,                     -- NULL = all platforms
  territory TEXT,                    -- NULL = global

  -- Time period
  period_type TEXT NOT NULL CHECK (period_type IN ('day', 'week', 'month', 'year', 'all_time')),
  period_start TEXT NOT NULL,        -- YYYY-MM-DD
  period_end TEXT NOT NULL,

  -- Aggregated metrics
  total_streams INTEGER DEFAULT 0,
  unique_listeners INTEGER DEFAULT 0,
  total_saves INTEGER DEFAULT 0,
  total_shares INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,

  -- Averages
  avg_daily_streams REAL,
  avg_skip_rate REAL,
  avg_completion_rate REAL,

  -- Comparisons
  streams_change_percent REAL,       -- vs previous period
  listeners_change_percent REAL,

  -- Top territories (JSON array)
  top_territories TEXT,              -- [{ "code": "US", "streams": 1000 }]

  computed_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (release_id) REFERENCES distribution_releases(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analytics_track ON streaming_analytics(track_id);
CREATE INDEX IF NOT EXISTS idx_analytics_platform ON streaming_analytics(platform);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON streaming_analytics(date);
CREATE INDEX IF NOT EXISTS idx_analytics_isrc ON streaming_analytics(isrc);
CREATE INDEX IF NOT EXISTS idx_playlists_track ON playlist_placements(track_id);
CREATE INDEX IF NOT EXISTS idx_playlists_active ON playlist_placements(is_active);
CREATE INDEX IF NOT EXISTS idx_aggregates_track ON streaming_analytics_aggregates(track_id);
CREATE INDEX IF NOT EXISTS idx_aggregates_period ON streaming_analytics_aggregates(period_type, period_start);
