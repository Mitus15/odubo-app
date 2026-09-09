-- 157 — the gift chain.
--
-- The single is given away unconditionally: nothing is gated behind a share.
-- These tables exist only so that passing it on is ATTRIBUTED — a link that
-- says "Sarah sent you this" spreads because it is a gift from a person, where
-- a bare link is a forward. Attribution is the whole mechanism; the counting is
-- a side effect that lets the owner thank the people who actually did the work.
--
-- No account, no email, no identity. A code and a first name, volunteered.

CREATE TABLE IF NOT EXISTS loop_gift_codes (
  code        TEXT PRIMARY KEY,           -- short, URL-safe, shown as ?from=
  name        TEXT NOT NULL,              -- first name only, as typed
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loop_gifts (
  code        TEXT NOT NULL,              -- who passed it on
  visitor     TEXT NOT NULL,              -- opaque per-browser id of who arrived
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- One row per person reached, not per page load: a refresh, a back button or
  -- a second visit from the same phone must not inflate anyone's count.
  PRIMARY KEY (code, visitor)
);

CREATE INDEX IF NOT EXISTS idx_loop_gifts_code ON loop_gifts(code);
