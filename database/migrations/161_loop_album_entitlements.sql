-- 161 — the pre-order becomes a record, not a sentence.
--
-- The pass sheet, the Shopify listing and the confirmation email all said a
-- pass is a pre-order and the album is "yours when it lands". Nothing wrote
-- that down. A buyer who could not come on the night held a promise with no
-- ledger behind it.
--
-- One row per pass unit: who is owed the album, by which order. Keyed on the
-- order so a webhook retry cannot grant twice, and on the lowercased email so
-- the same inbox proof that recovers a pass (migration 160) also opens the
-- record. `notified_at` is set by the release action when the "it's out"
-- email goes; `claimed_at` the first time they listen.
CREATE TABLE IF NOT EXISTS loop_album_entitlements (
  id          TEXT PRIMARY KEY,
  album_id    TEXT NOT NULL,
  email       TEXT NOT NULL,              -- lowercase, trimmed
  source      TEXT NOT NULL DEFAULT 'pass' CHECK (source IN ('pass', 'manual', 'purchase')),
  order_id    TEXT,                       -- e.g. shopify:<id>#1; NULL for manual grants
  event_id    TEXT,
  granted_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notified_at TEXT,
  claimed_at  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loop_album_entitlements_order
  ON loop_album_entitlements(album_id, order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loop_album_entitlements_email
  ON loop_album_entitlements(album_id, email);
