-- Fan Activity
-- Individual touchpoint events for fan profiles
-- Every meaningful interaction is logged here for journey analysis

CREATE TABLE IF NOT EXISTS fan_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fan_id TEXT NOT NULL,

  -- Activity classification
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    -- Content consumption
    'clip_view',          -- Watched a clip
    'clip_complete',      -- Watched clip to completion
    'clip_share',         -- Shared a clip
    'clip_like',          -- Liked a clip

    -- Music engagement
    'music_play',         -- Played a track
    'music_save',         -- Saved to library
    'music_share',        -- Shared a track
    'music_playlist_add', -- Added to playlist

    -- Commerce
    'shop_visit',         -- Visited store
    'product_view',       -- Viewed product page
    'add_to_cart',        -- Added item to cart
    'cart_abandon',       -- Left items in cart
    'purchase',           -- Completed purchase
    'refund',             -- Refund processed

    -- Social engagement
    'social_follow',      -- Followed on social platform
    'social_unfollow',    -- Unfollowed
    'social_like',        -- Liked a social post
    'social_comment',     -- Commented on social post
    'social_share',       -- Shared social post
    'social_mention',     -- Mentioned in their post

    -- Direct engagement
    'newsletter_signup',  -- Joined email list
    'newsletter_open',    -- Opened newsletter
    'newsletter_click',   -- Clicked newsletter link
    'rsvp',               -- RSVPd to event
    'event_attend',       -- Attended event
    'dm_received',        -- Sent a DM

    -- Site engagement
    'site_visit',         -- Visited website
    'page_view',          -- Viewed specific page
    'search',             -- Searched on site
    'app_open'            -- Opened mobile app (future)
  )),

  -- What was interacted with
  content_id TEXT,              -- clip_id, track_id, product_handle, post_id, etc.
  content_type TEXT,            -- 'clip', 'track', 'album', 'product', 'post', 'page'
  content_title TEXT,           -- Denormalized for quick access

  -- Where it happened
  platform TEXT,                -- 'odubo', 'instagram', 'tiktok', 'spotify', 'apple_music', etc.
  device_type TEXT,             -- 'mobile', 'desktop', 'tablet'

  -- Attribution
  source TEXT,                  -- utm_source
  medium TEXT,                  -- utm_medium
  campaign TEXT,                -- utm_campaign
  referrer TEXT,                -- Referring URL

  -- Session context
  session_id TEXT,              -- Link to user_sessions if available

  -- Value (for purchases/transactions)
  value_cents INTEGER,
  currency TEXT DEFAULT 'USD',

  -- Engagement metrics
  duration_seconds INTEGER,     -- For views: how long they watched
  completion_percent REAL,      -- For content: how much they consumed (0-100)

  -- Metadata (JSON for flexible additional data)
  metadata TEXT,                -- { "variant": "size-L", "quantity": 2 }

  -- Timestamp
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (fan_id) REFERENCES fan_profiles(id) ON DELETE CASCADE
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_fan_activity_fan ON fan_activity(fan_id);
CREATE INDEX IF NOT EXISTS idx_fan_activity_type ON fan_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_fan_activity_created ON fan_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_fan_activity_content ON fan_activity(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_fan_activity_platform ON fan_activity(platform);
CREATE INDEX IF NOT EXISTS idx_fan_activity_session ON fan_activity(session_id);
CREATE INDEX IF NOT EXISTS idx_fan_activity_source ON fan_activity(source);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_fan_activity_fan_type_created ON fan_activity(fan_id, activity_type, created_at);
CREATE INDEX IF NOT EXISTS idx_fan_activity_type_created ON fan_activity(activity_type, created_at);

-- Trigger to update fan_profiles totals
CREATE TRIGGER IF NOT EXISTS update_fan_totals_on_activity
AFTER INSERT ON fan_activity
BEGIN
  UPDATE fan_profiles SET
    last_active_at = datetime('now'),
    total_clip_views = CASE WHEN NEW.activity_type = 'clip_view'
      THEN total_clip_views + 1 ELSE total_clip_views END,
    total_clip_completions = CASE WHEN NEW.activity_type = 'clip_complete'
      THEN total_clip_completions + 1 ELSE total_clip_completions END,
    total_music_plays = CASE WHEN NEW.activity_type = 'music_play'
      THEN total_music_plays + 1 ELSE total_music_plays END,
    total_music_saves = CASE WHEN NEW.activity_type = 'music_save'
      THEN total_music_saves + 1 ELSE total_music_saves END,
    total_site_visits = CASE WHEN NEW.activity_type = 'site_visit'
      THEN total_site_visits + 1 ELSE total_site_visits END,
    total_purchases = CASE WHEN NEW.activity_type = 'purchase'
      THEN total_purchases + 1 ELSE total_purchases END,
    total_spent_cents = CASE WHEN NEW.activity_type = 'purchase' AND NEW.value_cents IS NOT NULL
      THEN total_spent_cents + NEW.value_cents ELSE total_spent_cents END,
    updated_at = datetime('now')
  WHERE id = NEW.fan_id;
END;
