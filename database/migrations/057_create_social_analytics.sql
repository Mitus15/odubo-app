-- =============================================================================
-- COMPREHENSIVE SOCIAL & CROSS-PLATFORM ANALYTICS
-- Track performance across Instagram, TikTok, YouTube, Twitter/X
-- =============================================================================

-- Social content posts (any content published to social platforms)
CREATE TABLE IF NOT EXISTS social_content (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Platform info
  platform TEXT NOT NULL CHECK (platform IN (
    'instagram',      -- Posts, Reels, Stories
    'tiktok',         -- Videos
    'youtube',        -- Shorts, Videos
    'twitter',        -- Posts, Videos
    'facebook',       -- Posts, Reels
    'threads'         -- Posts
  )),

  -- Content type
  content_type TEXT NOT NULL CHECK (content_type IN (
    'clip',           -- Short-form (< 60s) - Reels, TikToks, Shorts
    'long_form',      -- Long-form video (YouTube)
    'story',          -- Ephemeral content
    'post',           -- Static image/carousel
    'live',           -- Live stream
    'premiere'        -- Scheduled premiere
  )),

  -- External identifiers
  external_id TEXT,             -- Platform's post/video ID
  external_url TEXT,            -- Direct link

  -- Internal linking
  internal_video_id INTEGER,    -- Link to videos table (clips)
  internal_track_id TEXT,       -- Link to tracks table (if music content)
  internal_release_id TEXT,     -- Link to distribution release

  -- Content metadata
  title TEXT,
  caption TEXT,
  hashtags TEXT,                -- JSON array of hashtags
  mentions TEXT,                -- JSON array of @mentions
  audio_id TEXT,                -- Platform's audio/sound ID
  audio_name TEXT,              -- Sound name (for trending sounds)

  -- Publishing
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived', 'deleted')),
  published_at TEXT,
  scheduled_at TEXT,

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (internal_video_id) REFERENCES videos(id) ON DELETE SET NULL,
  FOREIGN KEY (internal_track_id) REFERENCES tracks(id) ON DELETE SET NULL
);

-- Daily metrics per social content
CREATE TABLE IF NOT EXISTS social_metrics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  content_id TEXT NOT NULL,

  -- Time period
  date TEXT NOT NULL,           -- YYYY-MM-DD

  -- Core engagement
  views INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,

  -- Video-specific
  watch_time_seconds INTEGER DEFAULT 0,
  avg_watch_percent REAL,       -- 0-100
  replays INTEGER DEFAULT 0,

  -- Engagement rates (calculated, stored for performance)
  engagement_rate REAL,         -- (likes+comments+shares+saves) / reach * 100

  -- Follower impact
  profile_visits INTEGER DEFAULT 0,
  follows INTEGER DEFAULT 0,
  unfollows INTEGER DEFAULT 0,

  -- Link/action clicks
  link_clicks INTEGER DEFAULT 0,
  sticker_taps INTEGER DEFAULT 0,

  -- Platform-specific (JSON for flexibility)
  platform_data TEXT,           -- { "stitches": 5, "duets": 3 } for TikTok etc.

  -- Sync
  synced_at TEXT DEFAULT (datetime('now')),

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (content_id) REFERENCES social_content(id) ON DELETE CASCADE,
  UNIQUE(content_id, date)
);

-- Platform account metrics (overall account health)
CREATE TABLE IF NOT EXISTS social_account_metrics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  platform TEXT NOT NULL,
  account_id TEXT,              -- Platform account ID
  account_handle TEXT,          -- @username

  -- Time period
  date TEXT NOT NULL,           -- YYYY-MM-DD

  -- Follower metrics
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  follower_change INTEGER DEFAULT 0,  -- Net change that day

  -- Content metrics
  posts_count INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,

  -- Audience demographics (JSON)
  audience_gender TEXT,         -- { "male": 45, "female": 52, "other": 3 }
  audience_age TEXT,            -- { "18-24": 30, "25-34": 45, ... }
  audience_locations TEXT,      -- [{ "country": "US", "percent": 40 }, ...]

  -- Best posting times (JSON)
  active_hours TEXT,            -- [{ "hour": 14, "engagement": 0.8 }, ...]

  synced_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),

  UNIQUE(platform, date)
);

-- Cross-platform attribution (track how social drives other actions)
CREATE TABLE IF NOT EXISTS cross_platform_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Session tracking
  session_id TEXT,
  user_fingerprint TEXT,        -- Hashed device/browser fingerprint

  -- Source (where they came from)
  source_platform TEXT NOT NULL, -- instagram, tiktok, youtube, twitter, organic, direct
  source_content_id TEXT,       -- Link to social_content if applicable
  source_campaign TEXT,         -- UTM campaign
  source_medium TEXT,           -- UTM medium (bio_link, story_link, etc.)

  -- Action taken
  event_type TEXT NOT NULL CHECK (event_type IN (
    'site_visit',               -- Landed on odubo.com
    'clip_view',                -- Watched a clip
    'clip_complete',            -- Completed a clip
    'music_play',               -- Played a track
    'music_save',               -- Saved/added to library
    'stream_click',             -- Clicked to streaming platform
    'shop_view',                -- Viewed store
    'product_view',             -- Viewed specific product
    'add_to_cart',              -- Added to cart
    'purchase',                 -- Completed purchase
    'follow',                   -- Followed on another platform
    'newsletter_signup',        -- Email signup
    'download'                  -- Downloaded anything
  )),

  -- Event details
  event_data TEXT,              -- JSON with event-specific data
  value_cents INTEGER,          -- If purchase, the value

  -- Destination (where action happened)
  destination_platform TEXT,    -- spotify, apple_music, odubo, etc.
  destination_url TEXT,

  -- Timing
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (source_content_id) REFERENCES social_content(id) ON DELETE SET NULL
);

-- Aggregated cross-platform attribution (for fast queries)
CREATE TABLE IF NOT EXISTS attribution_summary (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Dimensions
  source_platform TEXT NOT NULL,
  content_type TEXT,            -- clip, long_form, story, post, NULL = all
  event_type TEXT NOT NULL,
  destination_platform TEXT,

  -- Time period
  period_type TEXT NOT NULL CHECK (period_type IN ('day', 'week', 'month')),
  period_start TEXT NOT NULL,

  -- Metrics
  event_count INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  total_value_cents INTEGER DEFAULT 0,

  -- Conversion rate from source to this event
  conversion_rate REAL,

  computed_at TEXT DEFAULT (datetime('now')),

  UNIQUE(source_platform, content_type, event_type, destination_platform, period_type, period_start)
);

-- Long-form video performance (YouTube, etc.)
CREATE TABLE IF NOT EXISTS longform_metrics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Platform & video
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'vimeo', 'facebook')),
  external_id TEXT NOT NULL,    -- Video ID
  external_url TEXT,

  -- Internal linking
  video_release_id TEXT,        -- Link to video_releases
  internal_video_id INTEGER,

  -- Time period
  date TEXT NOT NULL,

  -- Views & watch time
  views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  watch_time_minutes INTEGER DEFAULT 0,
  avg_view_duration_seconds INTEGER,
  avg_view_percent REAL,        -- 0-100

  -- Engagement
  likes INTEGER DEFAULT 0,
  dislikes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,

  -- Subscriber impact
  subscribers_gained INTEGER DEFAULT 0,
  subscribers_lost INTEGER DEFAULT 0,

  -- Traffic sources (percentages)
  traffic_search REAL DEFAULT 0,
  traffic_suggested REAL DEFAULT 0,
  traffic_browse REAL DEFAULT 0,
  traffic_external REAL DEFAULT 0,
  traffic_playlist REAL DEFAULT 0,
  traffic_notification REAL DEFAULT 0,

  -- Revenue (if monetized)
  revenue_cents INTEGER DEFAULT 0,
  rpm_cents INTEGER,            -- Revenue per mille
  cpm_cents INTEGER,            -- Cost per mille (ads)

  -- Audience retention (JSON - timestamp: percent watching)
  retention_curve TEXT,

  synced_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (video_release_id) REFERENCES video_releases(id) ON DELETE SET NULL,
  UNIQUE(platform, external_id, date)
);

-- Trending sounds/audio tracking
CREATE TABLE IF NOT EXISTS trending_audio (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  platform TEXT NOT NULL,
  audio_id TEXT NOT NULL,
  audio_name TEXT,
  audio_author TEXT,

  -- Is this our audio?
  is_owned INTEGER DEFAULT 0,
  linked_track_id TEXT,

  -- Metrics
  uses_count INTEGER DEFAULT 0,
  uses_change_24h INTEGER DEFAULT 0,
  uses_change_7d INTEGER DEFAULT 0,

  -- Trending status
  is_trending INTEGER DEFAULT 0,
  trending_rank INTEGER,

  date TEXT NOT NULL,
  synced_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (linked_track_id) REFERENCES tracks(id) ON DELETE SET NULL,
  UNIQUE(platform, audio_id, date)
);

-- Competitor tracking (optional, for benchmarking)
CREATE TABLE IF NOT EXISTS competitor_metrics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  platform TEXT NOT NULL,
  competitor_handle TEXT NOT NULL,
  competitor_name TEXT,

  date TEXT NOT NULL,

  followers INTEGER DEFAULT 0,
  follower_change INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  avg_engagement_rate REAL,

  synced_at TEXT DEFAULT (datetime('now')),

  UNIQUE(platform, competitor_handle, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_content_platform ON social_content(platform);
CREATE INDEX IF NOT EXISTS idx_social_content_type ON social_content(content_type);
CREATE INDEX IF NOT EXISTS idx_social_content_published ON social_content(published_at);
CREATE INDEX IF NOT EXISTS idx_social_metrics_content ON social_metrics(content_id);
CREATE INDEX IF NOT EXISTS idx_social_metrics_date ON social_metrics(date);
CREATE INDEX IF NOT EXISTS idx_cross_platform_session ON cross_platform_events(session_id);
CREATE INDEX IF NOT EXISTS idx_cross_platform_source ON cross_platform_events(source_platform);
CREATE INDEX IF NOT EXISTS idx_cross_platform_event ON cross_platform_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cross_platform_created ON cross_platform_events(created_at);
CREATE INDEX IF NOT EXISTS idx_longform_platform ON longform_metrics(platform, external_id);
CREATE INDEX IF NOT EXISTS idx_longform_date ON longform_metrics(date);
CREATE INDEX IF NOT EXISTS idx_attribution_lookup ON attribution_summary(source_platform, event_type, period_type, period_start);
