-- Store Announcements System
-- Allows admin to create announcements shown in store modal with badge indicator

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  link_text TEXT,
  image_url TEXT,                   -- Optional banner image

  -- Targeting
  target TEXT DEFAULT 'store' CHECK (target IN ('store', 'all', 'moments', 'media')),

  -- Scheduling & Priority
  priority INTEGER DEFAULT 0,       -- Higher = shown first
  starts_at TEXT,                   -- When announcement becomes active
  ends_at TEXT,                     -- When announcement expires

  -- Status
  is_active INTEGER DEFAULT 1,

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for querying active announcements
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, target);
CREATE INDEX IF NOT EXISTS idx_announcements_dates ON announcements(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority DESC);
