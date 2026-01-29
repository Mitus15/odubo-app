-- Site settings table for global configuration
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Homepage mode: 'auto' (default), 'clips', or 'music'
-- 'auto' = show clips if any exist, otherwise show music
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('homepage_mode', 'auto');
