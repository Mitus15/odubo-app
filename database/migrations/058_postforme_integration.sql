-- =============================================================================
-- POST FOR ME INTEGRATION
-- Store connected social accounts and sync history
-- =============================================================================

-- Connected social media accounts (via Post for Me)
CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Post for Me identifiers
  postforme_account_id TEXT NOT NULL,    -- Post for Me's account ID

  -- Platform info
  platform TEXT NOT NULL CHECK (platform IN (
    'instagram',
    'tiktok',
    'youtube',
    'twitter',
    'facebook',
    'linkedin',
    'threads',
    'pinterest',
    'bluesky'
  )),

  -- Account details
  account_handle TEXT,                    -- @username
  account_name TEXT,                      -- Display name
  profile_image_url TEXT,

  -- Status
  is_active INTEGER DEFAULT 1,

  -- Timestamps
  connected_at TEXT DEFAULT (datetime('now')),
  last_synced_at TEXT,

  UNIQUE(platform, postforme_account_id)
);

-- Sync history log
CREATE TABLE IF NOT EXISTS social_sync_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Sync details
  sync_type TEXT NOT NULL CHECK (sync_type IN (
    'accounts',      -- Syncing connected accounts
    'posts',         -- Syncing post metadata
    'analytics',     -- Syncing post analytics/metrics
    'full'           -- Full sync (all of the above)
  )),

  -- Status
  status TEXT NOT NULL CHECK (status IN (
    'started',
    'in_progress',
    'completed',
    'failed'
  )),

  -- Metrics
  accounts_synced INTEGER DEFAULT 0,
  posts_synced INTEGER DEFAULT 0,
  metrics_synced INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  error_details TEXT,                     -- JSON with stack trace, etc.

  -- Timing
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  duration_ms INTEGER,

  -- Trigger
  triggered_by TEXT DEFAULT 'cron' CHECK (triggered_by IN ('cron', 'manual', 'webhook'))
);

-- Mapping table: Post for Me post IDs to our social_content IDs
CREATE TABLE IF NOT EXISTS postforme_content_map (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  postforme_post_id TEXT NOT NULL UNIQUE,  -- Post for Me's post ID
  social_content_id TEXT NOT NULL,          -- Our social_content table ID

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (social_content_id) REFERENCES social_content(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_active ON social_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_sync_log_type ON social_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON social_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_log_started ON social_sync_log(started_at);
CREATE INDEX IF NOT EXISTS idx_postforme_map_post ON postforme_content_map(postforme_post_id);
CREATE INDEX IF NOT EXISTS idx_postforme_map_content ON postforme_content_map(social_content_id);
