-- 159 — the inbox: one place where a customer's message arrives already
-- attached to who they are and what they bought.
--
-- Until now the store's contact form sent an email and kept nothing. Replies
-- happened in the owner's Gmail, between job alerts and venue threads, and no
-- record survived of who asked what. These four tables make the conversation
-- the record, whichever door it came through: the store form, an email reply
-- to support@, or the customer's own thread page.
--
-- Contacts are keyed on email, case-insensitively, because that is the only
-- identity a store buyer reliably has. `customer_id` is a soft pointer into
-- `customers` on purpose: D1 enforces foreign keys, and a customer row being
-- deleted must never take a conversation with it.
CREATE TABLE IF NOT EXISTS inbox_contacts (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name          TEXT,
  phone         TEXT,
  customer_id   TEXT,
  notes         TEXT,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A thread is one conversation. `token` is the customer's key to it: an
-- unguessable string that grants read and reply on this thread and nothing
-- else, the same trust as the email address itself. It travels in the
-- customer's link and in the plus-address every outbound email replies to.
--
-- `ack_message_id` is the RFC Message-ID of the acknowledgement we sent when
-- the thread opened; a customer replying to that acknowledgement must land
-- here, so it is indexed alongside the per-message ids.
CREATE TABLE IF NOT EXISTS inbox_threads (
  id              TEXT PRIMARY KEY,
  contact_id      TEXT NOT NULL,
  token           TEXT NOT NULL UNIQUE,
  subject         TEXT,
  topic           TEXT NOT NULL DEFAULT 'general'
                  CHECK (topic IN ('order', 'refund', 'shipping', 'general')),
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'waiting', 'closed')),
  order_number    TEXT,
  last_message_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_direction  TEXT NOT NULL DEFAULT 'in' CHECK (last_direction IN ('in', 'out')),
  unread_count    INTEGER NOT NULL DEFAULT 0,
  ack_message_id  TEXT,
  references_json TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inbox_threads_status ON inbox_threads(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_contact ON inbox_threads(contact_id);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_ack ON inbox_threads(ack_message_id);

-- One row per message, in either direction, plus internal notes that the
-- customer never sees. Idempotency lives in the constraints, not in code:
-- `resend_email_id` is unique so a webhook delivered twice is one message;
-- `submission_id` is unique so a double tap on the store form is one message.
-- Both are written with INSERT OR IGNORE, the event_codes pattern.
CREATE TABLE IF NOT EXISTS inbox_messages (
  id                  TEXT PRIMARY KEY,
  thread_id           TEXT NOT NULL,
  direction           TEXT NOT NULL CHECK (direction IN ('in', 'out', 'note')),
  channel             TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'email', 'sms')),
  body_text           TEXT NOT NULL,
  body_html           TEXT,
  from_email          TEXT,
  resend_email_id     TEXT UNIQUE,
  provider_message_id TEXT,
  submission_id       TEXT UNIQUE,
  delivery_status     TEXT NOT NULL DEFAULT 'received'
                      CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'failed', 'received')),
  delivery_error      TEXT,
  author_user_id      TEXT,
  created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_thread ON inbox_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_provider_id ON inbox_messages(provider_message_id);

-- Attachment metadata as Resend reports it. The bytes stay with Resend behind
-- a temporary download URL until a later pass copies them to R2.
CREATE TABLE IF NOT EXISTS inbox_attachments (
  id           TEXT PRIMARY KEY,
  message_id   TEXT NOT NULL,
  filename     TEXT,
  content_type TEXT,
  size         INTEGER,
  r2_key       TEXT,
  download_url TEXT,
  expires_at   TEXT,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inbox_attachments_message ON inbox_attachments(message_id);
