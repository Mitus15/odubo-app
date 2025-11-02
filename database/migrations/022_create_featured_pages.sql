-- Featured pages for reusable “album cover” style experiences
CREATE TABLE IF NOT EXISTS featured_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_featured_pages_slug ON featured_pages(slug);
CREATE INDEX IF NOT EXISTS idx_featured_pages_published ON featured_pages(is_published);
