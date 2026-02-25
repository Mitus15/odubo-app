-- 109: App-wide key/value config (featured_video_id, etc.)
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO app_config (key, value) VALUES ('featured_video_id', '424');
