-- Command Center State
-- User preferences, panel layouts, and workspace configurations

-- User workspace preferences
CREATE TABLE IF NOT EXISTS command_center_preferences (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,

  -- Current workspace
  active_workspace TEXT DEFAULT 'default',

  -- Panel states (JSON)
  panel_states TEXT,                 -- { "music-distribution": { "open": true, "expanded": false, "position": 0 } }

  -- Layout preferences
  sidebar_collapsed INTEGER DEFAULT 0,
  panel_layout TEXT DEFAULT 'grid',  -- grid, stack, focus

  -- Recent activity
  recent_releases TEXT,              -- JSON array of recent release IDs
  recent_tracks TEXT,                -- JSON array of recent track IDs
  pinned_items TEXT,                 -- JSON array of pinned items

  -- Notification preferences
  notify_release_status INTEGER DEFAULT 1,
  notify_analytics_weekly INTEGER DEFAULT 1,
  notify_playlist_adds INTEGER DEFAULT 1,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id)
);

-- Saved workspaces (presets)
CREATE TABLE IF NOT EXISTS command_center_workspaces (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT,                      -- NULL = system preset

  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,                         -- Emoji or icon name

  -- Preset type
  preset_type TEXT DEFAULT 'custom' CHECK (preset_type IN ('system', 'custom')),

  -- Configuration
  panels TEXT NOT NULL,              -- JSON: [{ "id": "music-distribution", "position": 0, "size": "large" }]
  panel_layout TEXT DEFAULT 'grid',

  -- Visibility
  is_default INTEGER DEFAULT 0,      -- User's default workspace

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Distributor credentials (encrypted)
CREATE TABLE IF NOT EXISTS distributor_credentials (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Distributor
  distributor TEXT NOT NULL UNIQUE,  -- labelgrid, distrokid, tunecore, cdbaby

  -- Connection status
  connected INTEGER DEFAULT 0,
  connection_type TEXT,              -- api_key, oauth

  -- Credentials (encrypted)
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,

  -- OAuth (if applicable)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TEXT,

  -- Account info
  account_id TEXT,
  account_name TEXT,
  account_email TEXT,

  -- Rate limiting
  rate_limit_remaining INTEGER,
  rate_limit_reset_at TEXT,

  -- Last sync
  last_sync_at TEXT,
  last_sync_status TEXT,
  last_sync_error TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Activity log for command center actions
CREATE TABLE IF NOT EXISTS command_center_activity (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT,

  -- What happened
  action TEXT NOT NULL,              -- release_created, release_submitted, track_added, etc.
  entity_type TEXT,                  -- release, track, video, etc.
  entity_id TEXT,

  -- Context
  details TEXT,                      -- JSON with action-specific data
  status TEXT,                       -- success, error, pending

  -- Related items
  release_id TEXT,
  track_id TEXT,
  video_release_id TEXT,

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (release_id) REFERENCES distribution_releases(id) ON DELETE SET NULL,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL,
  FOREIGN KEY (video_release_id) REFERENCES video_releases(id) ON DELETE SET NULL
);

-- Insert default system workspaces
INSERT OR IGNORE INTO command_center_workspaces (id, name, description, icon, preset_type, panels) VALUES
  ('ws-distribution', 'Distribution', 'Focus on releasing music', '🚀', 'system',
   '[{"id":"music-distribution","position":0,"size":"large"},{"id":"discography","position":1,"size":"small"}]'),

  ('ws-analytics', 'Analytics', 'Monitor streaming performance', '📊', 'system',
   '[{"id":"analytics-dashboard","position":0,"size":"large"},{"id":"discography","position":1,"size":"small"}]'),

  ('ws-video', 'Video', 'Manage video releases', '🎬', 'system',
   '[{"id":"video-distribution","position":0,"size":"large"},{"id":"social-distribution","position":1,"size":"medium"}]'),

  ('ws-social', 'Social', 'Plan and schedule social posts', '📱', 'system',
   '[{"id":"social-distribution","position":0,"size":"large"}]'),

  ('ws-full', 'Command Center', 'Full control panel', '🎛️', 'system',
   '[{"id":"music-distribution","position":0,"size":"medium"},{"id":"video-distribution","position":1,"size":"medium"},{"id":"analytics-dashboard","position":2,"size":"medium"},{"id":"social-distribution","position":3,"size":"medium"}]');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cc_prefs_user ON command_center_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_cc_workspaces_user ON command_center_workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_cc_activity_user ON command_center_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_cc_activity_entity ON command_center_activity(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cc_activity_created ON command_center_activity(created_at);
