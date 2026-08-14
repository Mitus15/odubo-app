-- 151 — the running thread between the owner and the promoter.
--
-- One flat, topic-tagged note thread for the Promoter Studio
-- (/loop/admin/studio). Two people working async on the same production —
-- notes replace "text me about it" so decisions and reactions live where the
-- tools are.
--
-- Deliberately NO event_id: this thread belongs to the PARTNERSHIP, not to a
-- volume. Volume 2 must open onto the same unbroken conversation.
--
-- `topic` is free text (a section name, a Playbook tab, or anything the writer
-- types) so a note can be attached to any subject, not a fixed list.
--
-- APPLIED TO REMOTE D1 via scripts/loop/apply_151_loop_notes.ts

CREATE TABLE IF NOT EXISTS loop_notes (
  id         TEXT PRIMARY KEY,
  author     TEXT NOT NULL DEFAULT '',
  topic      TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loop_notes_created
  ON loop_notes(created_at);
