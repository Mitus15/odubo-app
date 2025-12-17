-- Clip engagement metrics for ranking algorithm
-- Stores aggregate counts per clip for fast queries
CREATE TABLE IF NOT EXISTS clip_engagement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id INTEGER NOT NULL UNIQUE,
  view_count INTEGER DEFAULT 0,
  watch_time_seconds INTEGER DEFAULT 0,
  completion_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  shop_click_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clip_engagement_clip ON clip_engagement(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_engagement_views ON clip_engagement(view_count DESC);

-- Individual view events for detailed analytics
-- Used for funnel analysis and engagement calculations
CREATE TABLE IF NOT EXISTS clip_view_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id INTEGER NOT NULL,
  session_id TEXT,
  watch_duration_ms INTEGER,
  completed INTEGER DEFAULT 0,
  source TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clip_views_clip ON clip_view_events(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_views_session ON clip_view_events(session_id);
CREATE INDEX IF NOT EXISTS idx_clip_views_created ON clip_view_events(created_at);
CREATE INDEX IF NOT EXISTS idx_clip_views_source ON clip_view_events(utm_source);

-- Funnel events for conversion tracking
-- Tracks user journey from clips through to purchase
CREATE TABLE IF NOT EXISTS funnel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  session_id TEXT,
  clip_id INTEGER,
  product_handle TEXT,
  order_id TEXT,
  value_cents INTEGER,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  referrer TEXT,
  data_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_funnel_session ON funnel_events(session_id);
CREATE INDEX IF NOT EXISTS idx_funnel_event ON funnel_events(event_type);
CREATE INDEX IF NOT EXISTS idx_funnel_clip ON funnel_events(clip_id);
CREATE INDEX IF NOT EXISTS idx_funnel_product ON funnel_events(product_handle);
CREATE INDEX IF NOT EXISTS idx_funnel_created ON funnel_events(created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_source ON funnel_events(utm_source);
