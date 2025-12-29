-- Music Distribution System
-- Manages audio releases submitted to distributors (LabelGrid, etc.)

-- Distribution releases (albums, singles, EPs)
CREATE TABLE IF NOT EXISTS distribution_releases (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Core metadata
  title TEXT NOT NULL,
  release_type TEXT NOT NULL CHECK (release_type IN ('single', 'ep', 'album', 'compilation')),
  artist_name TEXT NOT NULL,
  label_name TEXT,

  -- Identifiers
  upc TEXT,                          -- Universal Product Code
  catalog_number TEXT,

  -- Artwork
  cover_art_url TEXT,
  cover_art_r2_key TEXT,

  -- Release dates
  original_release_date TEXT,        -- If previously released
  distribution_release_date TEXT,    -- Target release date

  -- Distributor info
  distributor TEXT DEFAULT 'labelgrid',
  distributor_release_id TEXT,       -- External ID from distributor

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',           -- Still editing
    'pending_review',  -- Submitted internally for review
    'ready',           -- Ready to submit to distributor
    'submitted',       -- Sent to distributor
    'processing',      -- Distributor processing
    'live',            -- Available on DSPs
    'takedown',        -- Requested removal
    'removed'          -- Removed from DSPs
  )),

  -- Pricing & Rights
  price_tier TEXT,
  territories TEXT DEFAULT '["worldwide"]',  -- JSON array
  explicit_content INTEGER DEFAULT 0,

  -- Metadata
  genre TEXT,
  subgenre TEXT,
  language TEXT DEFAULT 'en',
  copyright_line TEXT,               -- (C) 2024 Artist Name
  phonographic_line TEXT,            -- (P) 2024 Label Name

  -- Internal linking
  internal_album_id TEXT,            -- Link to albums table

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  submitted_at TEXT,
  live_at TEXT,

  FOREIGN KEY (internal_album_id) REFERENCES albums(id) ON DELETE SET NULL
);

-- Tracks within a distribution release
CREATE TABLE IF NOT EXISTS distribution_release_tracks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  release_id TEXT NOT NULL,

  -- Track position
  disc_number INTEGER DEFAULT 1,
  track_number INTEGER NOT NULL,

  -- Core metadata
  title TEXT NOT NULL,
  version TEXT,                      -- e.g., "Radio Edit", "Extended Mix"
  artist_name TEXT NOT NULL,
  featuring_artists TEXT,            -- JSON array

  -- Identifiers
  isrc TEXT,                         -- International Standard Recording Code

  -- Audio
  audio_url TEXT,
  audio_r2_key TEXT,
  duration_seconds INTEGER,

  -- Rights & Credits
  composers TEXT,                    -- JSON array of writer names
  producers TEXT,                    -- JSON array
  performers TEXT,                   -- JSON array

  -- Splits (royalty percentages)
  royalty_splits TEXT,               -- JSON: [{ "name": "...", "role": "writer", "percent": 50 }]

  -- Flags
  explicit INTEGER DEFAULT 0,
  instrumental INTEGER DEFAULT 0,

  -- Lyrics
  lyrics TEXT,
  lyrics_language TEXT,

  -- Internal linking
  internal_track_id TEXT,            -- Link to tracks table

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  rejection_reason TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (release_id) REFERENCES distribution_releases(id) ON DELETE CASCADE,
  FOREIGN KEY (internal_track_id) REFERENCES tracks(id) ON DELETE SET NULL
);

-- DSP targeting per release
CREATE TABLE IF NOT EXISTS distribution_release_dsps (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  release_id TEXT NOT NULL,

  dsp TEXT NOT NULL,                 -- spotify, apple_music, amazon, youtube_music, tidal, deezer, etc.
  enabled INTEGER DEFAULT 1,

  -- DSP-specific IDs (populated after live)
  external_id TEXT,
  external_url TEXT,

  -- Status per DSP
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'processing', 'live', 'rejected', 'removed')),
  live_at TEXT,

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (release_id) REFERENCES distribution_releases(id) ON DELETE CASCADE,
  UNIQUE(release_id, dsp)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dist_releases_status ON distribution_releases(status);
CREATE INDEX IF NOT EXISTS idx_dist_releases_distributor ON distribution_releases(distributor);
CREATE INDEX IF NOT EXISTS idx_dist_releases_internal_album ON distribution_releases(internal_album_id);
CREATE INDEX IF NOT EXISTS idx_dist_tracks_release ON distribution_release_tracks(release_id);
CREATE INDEX IF NOT EXISTS idx_dist_tracks_isrc ON distribution_release_tracks(isrc);
CREATE INDEX IF NOT EXISTS idx_dist_dsps_release ON distribution_release_dsps(release_id);
