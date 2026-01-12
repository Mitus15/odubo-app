-- Dashboard Widgets
-- User-configurable dashboard layout and widget settings
-- Each user can customize their intelligence dashboard

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,

  -- Widget identification
  widget_type TEXT NOT NULL CHECK (widget_type IN (
    'metric_card',        -- Single KPI with trend
    'chart_line',         -- Time series line chart
    'chart_bar',          -- Bar chart
    'chart_pie',          -- Pie/donut chart
    'chart_area',         -- Stacked area chart
    'chart_funnel',       -- Conversion funnel
    'leaderboard',        -- Ranked list (top tracks, top fans)
    'map',                -- Geographic heatmap
    'feed',               -- Activity feed / timeline
    'table',              -- Data table
    'insight_card',       -- AI insight with recommendation
    'platform_status',    -- Connection status grid
    'comparison'          -- Period-over-period comparison
  )),

  -- Display settings
  title TEXT,
  subtitle TEXT,
  icon TEXT,              -- Icon name or emoji

  -- Data configuration (JSON)
  data_source TEXT,       -- API endpoint or query identifier
  config TEXT,            -- {
                          --   "metric": "streams",
                          --   "platform": "spotify",
                          --   "period": "7d",
                          --   "groupBy": "day",
                          --   "filters": { "territory": "US" }
                          -- }

  -- Grid position (12-column grid)
  grid_x INTEGER DEFAULT 0,
  grid_y INTEGER DEFAULT 0,
  grid_w INTEGER DEFAULT 3,   -- Width in columns (1-12)
  grid_h INTEGER DEFAULT 2,   -- Height in rows

  -- Dashboard assignment
  dashboard_id TEXT DEFAULT 'main',  -- For multiple dashboards later

  -- Display order (for mobile/list view)
  sort_order INTEGER DEFAULT 0,

  -- State
  is_visible INTEGER DEFAULT 1,
  is_expanded INTEGER DEFAULT 0,
  refresh_interval INTEGER DEFAULT 300,  -- Seconds (0 = manual only)
  last_refreshed_at TEXT,

  -- Cache
  cached_data TEXT,           -- JSON cached response
  cached_at TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_widgets_user ON dashboard_widgets(user_id);
CREATE INDEX IF NOT EXISTS idx_widgets_dashboard ON dashboard_widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_widgets_visible ON dashboard_widgets(is_visible);
CREATE INDEX IF NOT EXISTS idx_widgets_order ON dashboard_widgets(user_id, sort_order);

-- Dashboard presets (templates for quick setup)
CREATE TABLE IF NOT EXISTS dashboard_presets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  name TEXT NOT NULL,
  description TEXT,

  -- Preset type
  preset_type TEXT DEFAULT 'system' CHECK (preset_type IN (
    'system',     -- Built-in presets
    'custom'      -- User-saved layouts
  )),

  -- Widget configuration (JSON array)
  -- [{ "widget_type": "metric_card", "config": {...}, "grid_x": 0, ... }]
  widgets_config TEXT NOT NULL,

  -- Target audience
  recommended_for TEXT,   -- 'artists', 'labels', 'managers'

  -- Stats
  use_count INTEGER DEFAULT 0,

  is_active INTEGER DEFAULT 1,

  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Default dashboard presets
INSERT OR IGNORE INTO dashboard_presets (id, name, description, preset_type, widgets_config, recommended_for) VALUES
(
  'preset_artist_overview',
  'Artist Overview',
  'Essential metrics for independent artists: streams, social growth, and sales',
  'system',
  '[
    {"widget_type": "metric_card", "title": "Total Streams", "config": {"metric": "streams", "period": "30d"}, "grid_x": 0, "grid_y": 0, "grid_w": 3, "grid_h": 1},
    {"widget_type": "metric_card", "title": "Revenue", "config": {"metric": "revenue", "period": "30d"}, "grid_x": 3, "grid_y": 0, "grid_w": 3, "grid_h": 1},
    {"widget_type": "metric_card", "title": "Clip Views", "config": {"metric": "clip_views", "period": "30d"}, "grid_x": 6, "grid_y": 0, "grid_w": 3, "grid_h": 1},
    {"widget_type": "metric_card", "title": "New Fans", "config": {"metric": "new_fans", "period": "30d"}, "grid_x": 9, "grid_y": 0, "grid_w": 3, "grid_h": 1},
    {"widget_type": "chart_line", "title": "Performance Trend", "config": {"metrics": ["streams", "clip_views"], "period": "30d", "groupBy": "day"}, "grid_x": 0, "grid_y": 1, "grid_w": 8, "grid_h": 3},
    {"widget_type": "leaderboard", "title": "Top Tracks", "config": {"metric": "streams", "limit": 5}, "grid_x": 8, "grid_y": 1, "grid_w": 4, "grid_h": 3}
  ]',
  'artists'
),
(
  'preset_commerce_focus',
  'Commerce Focus',
  'Sales and conversion metrics for merchandise-focused artists',
  'system',
  '[
    {"widget_type": "metric_card", "title": "Revenue", "config": {"metric": "revenue", "period": "30d"}, "grid_x": 0, "grid_y": 0, "grid_w": 3, "grid_h": 1},
    {"widget_type": "metric_card", "title": "Orders", "config": {"metric": "orders", "period": "30d"}, "grid_x": 3, "grid_y": 0, "grid_w": 3, "grid_h": 1},
    {"widget_type": "metric_card", "title": "Avg Order", "config": {"metric": "aov", "period": "30d"}, "grid_x": 6, "grid_y": 0, "grid_w": 3, "grid_h": 1},
    {"widget_type": "metric_card", "title": "Conversion", "config": {"metric": "conversion_rate", "period": "30d"}, "grid_x": 9, "grid_y": 0, "grid_w": 3, "grid_h": 1},
    {"widget_type": "chart_funnel", "title": "Sales Funnel", "config": {"stages": ["clip_view", "shop_visit", "add_to_cart", "purchase"]}, "grid_x": 0, "grid_y": 1, "grid_w": 6, "grid_h": 3},
    {"widget_type": "leaderboard", "title": "Top Products", "config": {"metric": "sales", "limit": 5}, "grid_x": 6, "grid_y": 1, "grid_w": 6, "grid_h": 3}
  ]',
  'artists'
);
