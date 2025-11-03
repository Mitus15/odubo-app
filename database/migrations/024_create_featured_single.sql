-- Singleton featured page configuration
CREATE TABLE IF NOT EXISTS featured_single (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title TEXT,
  subtitle TEXT,
  date_text TEXT,
  venue TEXT,
  album_link TEXT,
  moments_link TEXT,
  cover_image_url TEXT,
  background_video_url TEXT,
  extra_links_json TEXT, -- JSON array of {label, href}
  is_published INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Best-effort migration from existing featured_pages data
INSERT OR IGNORE INTO featured_single (
  id, title, subtitle, date_text, venue, album_link, moments_link,
  cover_image_url, background_video_url, extra_links_json, is_published,
  created_by, created_at, updated_at
)
SELECT 1, title, subtitle, date_text, venue, album_link, moments_link,
       cover_image_url, background_video_url, extra_links_json, is_published,
       created_by, created_at, updated_at
FROM featured_pages
ORDER BY CASE WHEN COALESCE(is_active, 0) = 1 THEN 0 ELSE 1 END, is_published DESC, updated_at DESC
LIMIT 1;

-- Timestamp trigger
CREATE TRIGGER IF NOT EXISTS update_featured_single_timestamp 
AFTER UPDATE ON featured_single
BEGIN
  UPDATE featured_single SET updated_at = datetime('now') WHERE id = 1;
END;
