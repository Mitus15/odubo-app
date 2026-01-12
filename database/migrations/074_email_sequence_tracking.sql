-- Email Sequence Tracking
-- Tracks which emails in the welcome sequence have been sent to each subscriber

CREATE TABLE IF NOT EXISTS email_sequence_sends (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),

  -- Link to fan profile
  fan_profile_id TEXT NOT NULL,
  email TEXT NOT NULL,

  -- Sequence tracking
  sequence_type TEXT NOT NULL CHECK (sequence_type IN ('welcome', 'post_purchase', 'reengagement')),
  email_step TEXT NOT NULL, -- 'day0', 'day3', 'day7', etc.

  -- Send status
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced', 'opened', 'clicked')),
  resend_id TEXT, -- Resend email ID for tracking

  -- Timestamps
  sent_at TEXT DEFAULT (datetime('now')),
  opened_at TEXT,
  clicked_at TEXT,

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (fan_profile_id) REFERENCES fan_profiles(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_seq_fan ON email_sequence_sends(fan_profile_id);
CREATE INDEX IF NOT EXISTS idx_email_seq_email ON email_sequence_sends(email);
CREATE INDEX IF NOT EXISTS idx_email_seq_type_step ON email_sequence_sends(sequence_type, email_step);
CREATE INDEX IF NOT EXISTS idx_email_seq_sent_at ON email_sequence_sends(sent_at);

-- Prevent duplicate sends
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_seq_unique ON email_sequence_sends(fan_profile_id, sequence_type, email_step);
