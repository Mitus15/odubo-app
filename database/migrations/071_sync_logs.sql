-- Sync Logs
-- Track execution of data sync jobs (streaming analytics, social data, etc.)
-- Provides visibility into data freshness and sync health

CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Job identification
  job_type TEXT NOT NULL CHECK (job_type IN (
    'streaming_csv_import',   -- Manual CSV upload
    'streaming_api_sync',     -- API sync from DSP
    'social_sync',            -- Social platform data sync
    'commerce_sync',          -- Shopify order/customer sync
    'fan_profile_update',     -- Fan scoring recalculation
    'insight_compute',        -- Correlation engine run
    'aggregate_compute',      -- Pre-compute dashboard aggregates
    'segment_refresh',        -- Refresh fan segment membership
    'cleanup'                 -- Data cleanup/maintenance
  )),

  -- Scope
  platform TEXT,              -- Specific platform (spotify, instagram, etc.)
  entity_type TEXT,           -- What was synced (tracks, posts, orders, etc.)
  entity_id TEXT,             -- Specific entity if applicable

  -- Status
  status TEXT NOT NULL CHECK (status IN (
    'started',    -- Job started
    'running',    -- In progress
    'success',    -- Completed successfully
    'partial',    -- Completed with some failures
    'failed',     -- Failed completely
    'cancelled'   -- Manually cancelled
  )),

  -- Progress tracking
  progress_percent INTEGER DEFAULT 0,
  current_step TEXT,          -- Current operation description

  -- Statistics
  records_fetched INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Data range processed
  data_start_date TEXT,       -- Oldest data synced
  data_end_date TEXT,         -- Most recent data synced

  -- Timing
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER,

  -- Error tracking
  error_message TEXT,
  error_details TEXT,         -- JSON - stack trace, context
  retry_count INTEGER DEFAULT 0,

  -- Trigger info
  triggered_by TEXT,          -- 'cron', 'manual', 'webhook', user_id
  trigger_source TEXT,        -- API endpoint or cron job name

  -- Metadata
  metadata TEXT,              -- JSON - additional context

  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sync_logs_job ON sync_logs(job_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_platform ON sync_logs(platform);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON sync_logs(started_at DESC);

-- Get latest sync per job type
CREATE INDEX IF NOT EXISTS idx_sync_logs_latest ON sync_logs(job_type, platform, started_at DESC);

-- Data import records (track individual file imports)
CREATE TABLE IF NOT EXISTS data_imports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Import type
  import_type TEXT NOT NULL CHECK (import_type IN (
    'streaming_csv',      -- Streaming data CSV
    'social_csv',         -- Social metrics CSV
    'orders_csv',         -- Order data CSV
    'fans_csv',           -- Fan list CSV
    'custom'              -- Custom data import
  )),

  -- Source
  source_platform TEXT,       -- Platform data came from
  source_filename TEXT,       -- Original filename
  source_format TEXT,         -- csv, json, xlsx
  source_size_bytes INTEGER,

  -- Storage
  r2_key TEXT,                -- Where file is stored (if kept)

  -- Processing
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Awaiting processing
    'validating',   -- Checking format/data
    'processing',   -- Importing records
    'completed',    -- Done
    'failed',       -- Failed
    'cancelled'     -- User cancelled
  )),

  -- Stats
  total_rows INTEGER,
  processed_rows INTEGER DEFAULT 0,
  inserted_rows INTEGER DEFAULT 0,
  updated_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,

  -- Date range of imported data
  data_start_date TEXT,
  data_end_date TEXT,

  -- Mapping configuration (JSON)
  -- Maps CSV columns to database fields
  column_mapping TEXT,

  -- Validation results (JSON)
  validation_errors TEXT,     -- [{ "row": 5, "field": "date", "error": "invalid format" }]

  -- Error summary
  error_summary TEXT,

  -- Uploaded by
  uploaded_by TEXT,

  started_at TEXT,
  completed_at TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_imports_type ON data_imports(import_type);
CREATE INDEX IF NOT EXISTS idx_imports_status ON data_imports(status);
CREATE INDEX IF NOT EXISTS idx_imports_platform ON data_imports(source_platform);
CREATE INDEX IF NOT EXISTS idx_imports_created ON data_imports(created_at DESC);

-- System health metrics (for monitoring dashboard)
CREATE TABLE IF NOT EXISTS system_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  metric_type TEXT NOT NULL CHECK (metric_type IN (
    'api_latency',        -- External API response time
    'sync_duration',      -- Sync job duration
    'error_rate',         -- Error percentage
    'data_freshness',     -- Age of most recent data
    'queue_depth',        -- Pending jobs
    'storage_usage',      -- R2/D1 usage
    'rate_limit_remaining' -- API rate limits
  )),

  platform TEXT,          -- Which platform/service
  value REAL NOT NULL,
  unit TEXT,              -- ms, percent, bytes, count

  metadata TEXT,          -- JSON additional context

  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_platform ON system_metrics(platform);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded ON system_metrics(recorded_at DESC);

-- Keep only 7 days of detailed metrics
-- (Aggregate older data in a separate job)
