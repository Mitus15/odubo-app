-- Fan Profiles
-- Unified fan intelligence - single profile per fan across all touchpoints
-- Links anonymous visitors, social followers, customers, and listeners

CREATE TABLE IF NOT EXISTS fan_profiles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Internal identity (if user has account)
  user_id TEXT,                   -- Links to users table if registered

  -- Contact info (from purchases, signups)
  email TEXT,
  phone TEXT,

  -- Anonymous tracking
  fingerprint_hash TEXT,          -- Device/browser fingerprint for anonymous tracking

  -- Social platform identifiers
  instagram_id TEXT,
  instagram_handle TEXT,
  tiktok_id TEXT,
  tiktok_handle TEXT,
  twitter_id TEXT,
  twitter_handle TEXT,
  youtube_channel_id TEXT,
  spotify_id TEXT,
  apple_music_id TEXT,

  -- Demographics (aggregated from multiple sources)
  display_name TEXT,              -- Best known name
  profile_image_url TEXT,
  estimated_age_range TEXT,       -- '18-24', '25-34', '35-44', '45-54', '55+'
  estimated_gender TEXT,          -- 'male', 'female', 'other', 'unknown'
  primary_location TEXT,          -- ISO country code
  city TEXT,
  region TEXT,                    -- State/province
  timezone TEXT,

  -- Engagement scoring (0-100)
  engagement_score INTEGER DEFAULT 0,        -- Overall activity level
  loyalty_score INTEGER DEFAULT 0,           -- Consistency over time
  purchase_propensity INTEGER DEFAULT 0,     -- Likelihood to buy
  influence_score INTEGER DEFAULT 0,         -- Social reach/impact

  -- Lifecycle stage
  stage TEXT DEFAULT 'new' CHECK (stage IN (
    'new',         -- Just discovered, minimal interaction
    'engaged',     -- Regular engagement (watches clips, streams music)
    'super_fan',   -- High engagement + purchases
    'dormant',     -- Was engaged, now inactive (30+ days)
    'churned'      -- No activity 90+ days
  )),

  -- Content preferences (JSON)
  content_preferences TEXT,       -- { "clips": true, "music": true, "merch": false }
  favorite_tracks TEXT,           -- JSON array of track IDs
  favorite_products TEXT,         -- JSON array of product handles

  -- Notification preferences (JSON)
  notification_preferences TEXT,  -- { "email": true, "sms": false, "push": true }

  -- Activity timestamps
  first_seen_at TEXT,             -- First known interaction
  last_active_at TEXT,            -- Most recent interaction

  -- Denormalized totals (updated via triggers/jobs)
  total_clip_views INTEGER DEFAULT 0,
  total_clip_completions INTEGER DEFAULT 0,
  total_music_plays INTEGER DEFAULT 0,
  total_music_saves INTEGER DEFAULT 0,
  total_site_visits INTEGER DEFAULT 0,
  total_purchases INTEGER DEFAULT 0,
  total_spent_cents INTEGER DEFAULT 0,
  average_order_value_cents INTEGER DEFAULT 0,

  -- Source attribution
  acquisition_source TEXT,        -- How they first found us (instagram, tiktok, spotify, etc.)
  acquisition_campaign TEXT,      -- UTM campaign that brought them

  -- Tags for segmentation (JSON array)
  tags TEXT,                      -- ["vip", "early_supporter", "contest_winner"]

  -- Notes (for manual CRM use)
  notes TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_fan_user ON fan_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_fan_email ON fan_profiles(email);
CREATE INDEX IF NOT EXISTS idx_fan_instagram ON fan_profiles(instagram_handle);
CREATE INDEX IF NOT EXISTS idx_fan_tiktok ON fan_profiles(tiktok_handle);
CREATE INDEX IF NOT EXISTS idx_fan_spotify ON fan_profiles(spotify_id);
CREATE INDEX IF NOT EXISTS idx_fan_fingerprint ON fan_profiles(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_fan_stage ON fan_profiles(stage);
CREATE INDEX IF NOT EXISTS idx_fan_engagement ON fan_profiles(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_fan_loyalty ON fan_profiles(loyalty_score DESC);
CREATE INDEX IF NOT EXISTS idx_fan_purchase_propensity ON fan_profiles(purchase_propensity DESC);
CREATE INDEX IF NOT EXISTS idx_fan_last_active ON fan_profiles(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_fan_acquisition ON fan_profiles(acquisition_source);

-- Unique constraints for identity resolution
CREATE UNIQUE INDEX IF NOT EXISTS idx_fan_email_unique ON fan_profiles(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fan_instagram_unique ON fan_profiles(instagram_id) WHERE instagram_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fan_spotify_unique ON fan_profiles(spotify_id) WHERE spotify_id IS NOT NULL;
