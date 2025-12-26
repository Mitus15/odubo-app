-- 051_create_global_settings.sql
-- Global application settings stored as key-value pairs

CREATE TABLE IF NOT EXISTS global_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  value_type TEXT DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT -- user_id of admin who last updated
);

-- Initialize store_published setting to false (safe default - store starts closed)
INSERT INTO global_settings (key, value, value_type, description, updated_by)
VALUES ('store_published', '0', 'boolean', 'Controls whether the store is publicly accessible', NULL);

-- Index for faster lookups (though this table will be tiny)
CREATE INDEX IF NOT EXISTS idx_global_settings_key ON global_settings(key);
