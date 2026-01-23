-- 087_revenue_attribution.sql
-- Add entry-point content attribution to orders
-- Enables "Which content drove this purchase?" queries

-- ============================================
-- ENTRY CONTENT ATTRIBUTION ON ORDERS
-- Track what content (clip, gallery, album) the customer
-- first engaged with before purchasing
-- ============================================

-- Entry clip that brought customer to site/store
ALTER TABLE commerce_orders ADD COLUMN entry_clip_id INTEGER;

-- Entry gallery (Moments) that brought customer to site/store
ALTER TABLE commerce_orders ADD COLUMN entry_gallery_id INTEGER;

-- Entry album/track that brought customer to site/store
ALTER TABLE commerce_orders ADD COLUMN entry_album_id INTEGER;

-- First path customer landed on (for funnel analysis)
ALTER TABLE commerce_orders ADD COLUMN entry_path TEXT;

-- Session ID for linking to fan_activity journey
ALTER TABLE commerce_orders ADD COLUMN session_id TEXT;

-- ============================================
-- INDEXES FOR ATTRIBUTION QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_commerce_orders_entry_clip
  ON commerce_orders(entry_clip_id) WHERE entry_clip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_entry_gallery
  ON commerce_orders(entry_gallery_id) WHERE entry_gallery_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_entry_album
  ON commerce_orders(entry_album_id) WHERE entry_album_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_session
  ON commerce_orders(session_id) WHERE session_id IS NOT NULL;

-- ============================================
-- COHORT TRACKING TABLE
-- Track fan retention and LTV by acquisition cohort
-- ============================================

CREATE TABLE IF NOT EXISTS fan_cohorts (
  cohort_week TEXT NOT NULL,        -- ISO week: '2025-W03'
  source TEXT DEFAULT 'all',        -- Traffic source (utm_source) or 'all'

  -- Acquisition metrics
  fans_acquired INTEGER DEFAULT 0,

  -- Retention metrics (% still active at week N)
  week_1_retained INTEGER DEFAULT 0,
  week_2_retained INTEGER DEFAULT 0,
  week_4_retained INTEGER DEFAULT 0,
  week_8_retained INTEGER DEFAULT 0,
  week_12_retained INTEGER DEFAULT 0,

  -- LTV metrics (cumulative spend in cents)
  ltv_week_1_cents INTEGER DEFAULT 0,
  ltv_week_4_cents INTEGER DEFAULT 0,
  ltv_week_12_cents INTEGER DEFAULT 0,
  ltv_total_cents INTEGER DEFAULT 0,

  -- Engagement metrics
  avg_clips_viewed REAL DEFAULT 0,
  avg_music_plays REAL DEFAULT 0,
  conversion_rate REAL DEFAULT 0,   -- % who made at least 1 purchase

  -- Timestamps
  computed_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  PRIMARY KEY (cohort_week, source)
);

CREATE INDEX IF NOT EXISTS idx_fan_cohorts_week ON fan_cohorts(cohort_week);
CREATE INDEX IF NOT EXISTS idx_fan_cohorts_source ON fan_cohorts(source);

-- ============================================
-- FUNNEL SESSIONS TABLE
-- Track step-by-step funnel progression per session
-- ============================================

CREATE TABLE IF NOT EXISTS funnel_sessions (
  session_id TEXT PRIMARY KEY,
  fan_id INTEGER,
  source TEXT,                      -- utm_source

  -- Funnel step timestamps (NULL = didn't reach this step)
  first_clip_view_at TEXT,
  last_clip_view_at TEXT,
  clip_view_count INTEGER DEFAULT 0,

  shop_visit_at TEXT,

  first_product_view_at TEXT,
  last_product_view_at TEXT,
  product_view_count INTEGER DEFAULT 0,
  product_view_duration_ms INTEGER DEFAULT 0,

  add_to_cart_at TEXT,
  cart_value_cents INTEGER DEFAULT 0,
  cart_item_count INTEGER DEFAULT 0,

  checkout_start_at TEXT,

  purchase_at TEXT,
  purchase_value_cents INTEGER DEFAULT 0,
  purchase_order_id TEXT,

  -- Exit tracking
  exit_step TEXT,                   -- Last step reached before leaving
  session_duration_ms INTEGER DEFAULT 0,

  -- Entry content attribution
  entry_clip_id INTEGER,
  entry_gallery_id INTEGER,
  entry_path TEXT,

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_funnel_sessions_fan ON funnel_sessions(fan_id);
CREATE INDEX IF NOT EXISTS idx_funnel_sessions_source ON funnel_sessions(source);
CREATE INDEX IF NOT EXISTS idx_funnel_sessions_created ON funnel_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_sessions_purchase ON funnel_sessions(purchase_at)
  WHERE purchase_at IS NOT NULL;

-- ============================================
-- ATTRIBUTION SUMMARY TABLE
-- Pre-computed attribution metrics for fast queries
-- ============================================

CREATE TABLE IF NOT EXISTS content_attribution (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Content identification
  content_type TEXT NOT NULL,       -- 'clip', 'gallery', 'album', 'direct'
  content_id INTEGER,               -- ID of clip/gallery/album (NULL for direct)
  content_title TEXT,

  -- Period
  period_start TEXT NOT NULL,       -- YYYY-MM-DD
  period_end TEXT NOT NULL,
  period_type TEXT DEFAULT 'day',   -- day, week, month

  -- Attribution metrics
  sessions INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,

  -- Funnel metrics
  shop_visits INTEGER DEFAULT 0,
  product_views INTEGER DEFAULT 0,
  add_to_carts INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,

  -- Revenue
  revenue_cents INTEGER DEFAULT 0,
  avg_order_value_cents INTEGER DEFAULT 0,

  -- Conversion rates (stored for fast access)
  visit_to_shop_rate REAL DEFAULT 0,
  shop_to_purchase_rate REAL DEFAULT 0,

  computed_at TEXT DEFAULT (datetime('now')),

  UNIQUE(content_type, content_id, period_start, period_type)
);

CREATE INDEX IF NOT EXISTS idx_content_attribution_type
  ON content_attribution(content_type, period_start);
CREATE INDEX IF NOT EXISTS idx_content_attribution_revenue
  ON content_attribution(revenue_cents DESC);
