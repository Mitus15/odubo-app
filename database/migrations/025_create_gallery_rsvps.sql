-- Migration 025: Create gallery_rsvps table for Moments RSVP and reminders

CREATE TABLE IF NOT EXISTS gallery_rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gallery_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  reminder_offsets TEXT, -- JSON array of minutes before start (e.g., [1440,60,15])
  channel TEXT DEFAULT 'email', -- future: 'email','sms','push'
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (gallery_id, email),
  FOREIGN KEY (gallery_id) REFERENCES galleries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gallery_rsvps_gallery_id ON gallery_rsvps(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_rsvps_email ON gallery_rsvps(email);

