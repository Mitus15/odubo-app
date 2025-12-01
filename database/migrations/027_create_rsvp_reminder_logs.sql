-- Migration 027: Create reminder logs to prevent duplicates and track delivery

CREATE TABLE IF NOT EXISTS gallery_rsvp_reminder_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rsvp_id INTEGER NOT NULL,
  gallery_id INTEGER NOT NULL,
  email TEXT,
  instagram_handle TEXT,
  offset_min INTEGER NOT NULL,
  scheduled_at TEXT NOT NULL,
  sent_at TEXT,
  channel TEXT NOT NULL, -- 'email' | 'instagram' | 'push'
  status TEXT NOT NULL, -- 'queued' | 'sent' | 'skipped' | 'failed'
  error TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (rsvp_id, offset_min, channel),
  FOREIGN KEY (rsvp_id) REFERENCES gallery_rsvps(id) ON DELETE CASCADE,
  FOREIGN KEY (gallery_id) REFERENCES galleries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rsvp_logs_gallery ON gallery_rsvp_reminder_logs(gallery_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_logs_status ON gallery_rsvp_reminder_logs(status);

