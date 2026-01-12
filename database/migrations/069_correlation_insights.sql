-- Correlation Insights
-- Pre-computed cross-domain analysis results
-- Discovers patterns like "Instagram post X drove streams to Track Y"

CREATE TABLE IF NOT EXISTS correlation_insights (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Insight classification
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'social_to_streams',      -- Social post → streaming spike
    'social_to_sales',        -- Social post → product sales
    'clip_to_streams',        -- Clip engagement → streaming spike
    'clip_to_sales',          -- Clip engagement → product sales
    'stream_to_sales',        -- Streaming activity → merch purchase
    'playlist_impact',        -- Playlist placement → stream growth
    'content_affinity',       -- Content type preferences by segment
    'timing_insight',         -- Best posting/release times
    'territory_insight',      -- Geographic patterns
    'fan_journey',            -- Common fan conversion paths
    'churn_risk',             -- Fans at risk of churning
    'revenue_attribution'     -- Revenue by source channel
  )),

  -- Insight severity/importance
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Correlation details
  source_entity_type TEXT,    -- 'social_post', 'clip', 'track', 'playlist', 'campaign'
  source_entity_id TEXT,      -- ID of the source
  source_entity_name TEXT,    -- Denormalized name for display

  target_entity_type TEXT,    -- 'track', 'product', 'album', 'fan_segment'
  target_entity_id TEXT,
  target_entity_name TEXT,

  -- Statistical measures
  correlation_score REAL,     -- -1 to 1 (negative = inverse correlation)
  confidence REAL,            -- 0 to 1 (statistical confidence)
  sample_size INTEGER,        -- Number of data points used

  -- Impact quantification
  impact_value REAL,          -- Quantified impact (streams, dollars, etc.)
  impact_unit TEXT,           -- 'streams', 'dollars', 'percent', 'fans'
  impact_baseline REAL,       -- What it would have been without this
  impact_lift_percent REAL,   -- % improvement over baseline

  -- Time context
  period_start TEXT,          -- Start of analysis period
  period_end TEXT,            -- End of analysis period
  lag_days INTEGER,           -- Days between cause and effect (if applicable)

  -- Human-readable explanation
  title TEXT NOT NULL,        -- Short headline: "Instagram Reel drove 3.2K streams"
  description TEXT,           -- Detailed explanation
  recommendation TEXT,        -- Actionable next step
  evidence TEXT,              -- JSON array of supporting data points

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active',     -- Currently valid insight
    'expired',    -- Past validity period
    'dismissed',  -- User dismissed
    'actioned'    -- User took recommended action
  )),

  -- User interaction
  viewed_at TEXT,
  actioned_at TEXT,
  dismissed_at TEXT,
  feedback TEXT,              -- User feedback on insight quality

  -- Computation tracking
  computed_at TEXT DEFAULT (datetime('now')),
  computation_duration_ms INTEGER,
  algorithm_version TEXT,     -- Track which algorithm generated this
  expires_at TEXT,            -- When to recompute

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_insights_type ON correlation_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON correlation_insights(priority);
CREATE INDEX IF NOT EXISTS idx_insights_status ON correlation_insights(status);
CREATE INDEX IF NOT EXISTS idx_insights_computed ON correlation_insights(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_source ON correlation_insights(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_insights_target ON correlation_insights(target_entity_type, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_insights_confidence ON correlation_insights(confidence DESC);

-- Fan segments for targeting and analysis
CREATE TABLE IF NOT EXISTS fan_segments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  name TEXT NOT NULL,
  description TEXT,

  -- Segment definition (JSON query builder format)
  -- { "rules": [{ "field": "stage", "operator": "equals", "value": "super_fan" }] }
  filter_definition TEXT NOT NULL,

  -- Computed stats (updated by job)
  fan_count INTEGER DEFAULT 0,
  avg_engagement_score REAL,
  avg_purchase_propensity REAL,
  total_revenue_cents INTEGER DEFAULT 0,

  -- Top characteristics (JSON for dashboard display)
  top_locations TEXT,         -- [{ "code": "US", "count": 500 }]
  top_acquisition_sources TEXT,
  age_distribution TEXT,

  -- Segment type
  segment_type TEXT DEFAULT 'custom' CHECK (segment_type IN (
    'system',     -- Auto-generated (e.g., "Super Fans", "At Risk")
    'custom',     -- User-created
    'smart'       -- AI-generated
  )),

  -- Status
  is_active INTEGER DEFAULT 1,

  -- Ownership
  created_by TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_segments_active ON fan_segments(is_active);
CREATE INDEX IF NOT EXISTS idx_segments_type ON fan_segments(segment_type);

-- Fan segment membership (which fans belong to which segments)
CREATE TABLE IF NOT EXISTS fan_segment_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment_id TEXT NOT NULL,
  fan_id TEXT NOT NULL,

  -- When they entered/exited
  joined_at TEXT DEFAULT (datetime('now')),
  exited_at TEXT,

  -- Current membership status
  is_member INTEGER DEFAULT 1,

  FOREIGN KEY (segment_id) REFERENCES fan_segments(id) ON DELETE CASCADE,
  FOREIGN KEY (fan_id) REFERENCES fan_profiles(id) ON DELETE CASCADE,

  UNIQUE(segment_id, fan_id)
);

CREATE INDEX IF NOT EXISTS idx_segment_members_segment ON fan_segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_members_fan ON fan_segment_members(fan_id);
CREATE INDEX IF NOT EXISTS idx_segment_members_active ON fan_segment_members(is_member);
