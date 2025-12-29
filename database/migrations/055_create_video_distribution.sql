-- Video Distribution System
-- Manages music video releases to YouTube, Vevo, etc.

-- Video releases
CREATE TABLE IF NOT EXISTS video_releases (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Core metadata
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  video_type TEXT NOT NULL CHECK (video_type IN (
    'music_video',       -- Official music video
    'lyric_video',       -- Lyrics on screen
    'visualizer',        -- Audio visualizer
    'live_performance',  -- Live recording
    'behind_the_scenes', -- BTS content
    'short_form'         -- Vertical/short clips
  )),

  -- Description
  description TEXT,
  description_template TEXT,         -- Template with placeholders

  -- Associated music
  linked_track_id TEXT,              -- Internal track
  linked_release_id TEXT,            -- Distribution release
  isrc TEXT,

  -- Primary video asset
  primary_asset_id TEXT,

  -- Thumbnails
  thumbnail_url TEXT,
  thumbnail_r2_key TEXT,
  custom_thumbnails TEXT,            -- JSON array of thumbnail options

  -- Premiere settings
  premiere_enabled INTEGER DEFAULT 0,
  premiere_date TEXT,
  premiere_countdown_theme TEXT,

  -- Content ID / Rights
  content_id_enabled INTEGER DEFAULT 1,
  content_id_policy TEXT DEFAULT 'monetize', -- monetize, track, block

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'ready',
    'scheduled',
    'uploading',
    'processing',
    'live',
    'unlisted',
    'private',
    'removed'
  )),

  -- Metadata
  genre TEXT,
  tags TEXT,                         -- JSON array
  language TEXT DEFAULT 'en',
  made_for_kids INTEGER DEFAULT 0,
  age_restricted INTEGER DEFAULT 0,

  -- Credits
  director TEXT,
  producer TEXT,
  cinematographer TEXT,
  editor TEXT,
  credits_json TEXT,                 -- Full credits list

  -- Internal linking
  internal_video_id TEXT,            -- Link to videos table (hub)

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  scheduled_at TEXT,
  published_at TEXT,

  FOREIGN KEY (linked_track_id) REFERENCES tracks(id) ON DELETE SET NULL,
  FOREIGN KEY (linked_release_id) REFERENCES distribution_releases(id) ON DELETE SET NULL,
  FOREIGN KEY (internal_video_id) REFERENCES videos(id) ON DELETE SET NULL
);

-- Video assets (different versions/cuts)
CREATE TABLE IF NOT EXISTS video_assets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  release_id TEXT NOT NULL,

  -- Asset info
  label TEXT NOT NULL,               -- "Master", "Clean Version", "Vertical Cut"
  version_type TEXT CHECK (version_type IN (
    'master',
    'clean',
    'explicit',
    'extended',
    'radio_edit',
    'vertical',
    'square',
    'teaser'
  )),

  -- File info
  file_url TEXT,
  r2_key TEXT,
  cloudflare_uid TEXT,               -- Cloudflare Stream UID

  -- Technical specs
  duration_seconds INTEGER,
  width INTEGER,
  height INTEGER,
  aspect_ratio TEXT,                 -- "16:9", "9:16", "1:1"
  framerate REAL,
  codec TEXT,
  bitrate_kbps INTEGER,
  file_size_bytes INTEGER,

  -- Audio
  audio_codec TEXT,
  audio_bitrate_kbps INTEGER,
  audio_channels INTEGER,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  processing_error TEXT,

  -- Primary flag
  is_primary INTEGER DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (release_id) REFERENCES video_releases(id) ON DELETE CASCADE
);

-- Video platform targets
CREATE TABLE IF NOT EXISTS video_platforms (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  release_id TEXT NOT NULL,

  -- Platform
  platform TEXT NOT NULL CHECK (platform IN (
    'youtube',
    'vevo',
    'facebook',
    'instagram_reels',
    'tiktok',
    'twitter',
    'vimeo'
  )),

  enabled INTEGER DEFAULT 1,

  -- Platform-specific settings
  asset_id TEXT,                     -- Which asset to use
  title_override TEXT,
  description_override TEXT,
  tags_override TEXT,

  -- YouTube specific
  youtube_category TEXT,
  youtube_playlist_id TEXT,
  youtube_end_screen TEXT,           -- JSON config
  youtube_cards TEXT,                -- JSON config

  -- External IDs (after publish)
  external_id TEXT,
  external_url TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'scheduled',
    'uploading',
    'processing',
    'live',
    'unlisted',
    'private',
    'failed',
    'removed'
  )),
  status_message TEXT,

  -- Metrics (cached)
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  metrics_updated_at TEXT,

  -- Timing
  scheduled_at TEXT,
  published_at TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (release_id) REFERENCES video_releases(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES video_assets(id) ON DELETE SET NULL,
  UNIQUE(release_id, platform)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_video_releases_status ON video_releases(status);
CREATE INDEX IF NOT EXISTS idx_video_releases_track ON video_releases(linked_track_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_release ON video_assets(release_id);
CREATE INDEX IF NOT EXISTS idx_video_platforms_release ON video_platforms(release_id);
CREATE INDEX IF NOT EXISTS idx_video_platforms_status ON video_platforms(platform, status);
