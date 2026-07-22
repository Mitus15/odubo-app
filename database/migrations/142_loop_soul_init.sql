-- Loop Soul merge (feat/loop-soul-merge): initial schema, folded into odubo's D1.
-- Source: loop-soul-hub migrations/0001_init.sql @ 3f093ea. Zero name collisions
-- with odubo's existing tables (verified against migrations 001-141).

-- Loop Soul — initial schema.
--
-- These tables are a direct transcription of the six in-memory stores that ran
-- the app until now; each store's interface WAS the schema. Everything is scoped
-- by `event_id` so each monthly event starts fresh automatically.

-- ── Bracket ballots (src/lib/votes.ts) ──────────────────────────────────────
-- One row per (voter, matchup). Tallies are DERIVED by counting these rows and
-- are never stored, which is what makes "vote once, change it freely" correct:
-- casting and changing are the same upsert.
CREATE TABLE IF NOT EXISTS ballots (
  event_id   TEXT NOT NULL,
  matchup_id TEXT NOT NULL,
  voter_id   TEXT NOT NULL,
  side       TEXT NOT NULL CHECK (side IN ('a', 'b')),
  PRIMARY KEY (event_id, matchup_id, voter_id)
);

-- ── Nomination longlist + upvotes (src/lib/anthem-candidates.ts) ────────────
CREATE TABLE IF NOT EXISTS candidates (
  event_id     TEXT NOT NULL,
  id           TEXT NOT NULL, -- iTunes trackId
  title        TEXT NOT NULL,
  artist       TEXT NOT NULL,
  preview_url  TEXT,
  artwork_url  TEXT,
  suggested_by TEXT NOT NULL, -- voterId, or "house"
  created_at   INTEGER NOT NULL,
  hidden       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, id)
);

CREATE TABLE IF NOT EXISTS candidate_upvotes (
  event_id     TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  voter_id     TEXT NOT NULL,
  PRIMARY KEY (event_id, candidate_id, voter_id)
);
-- The per-voter like budget (UPVOTE_LIMIT) is counted by this index.
CREATE INDEX IF NOT EXISTS idx_upvotes_voter ON candidate_upvotes (event_id, voter_id);

-- ── Cycle clock + locked seeds (src/lib/anthem-rounds.ts) ───────────────────
-- Only ADMIN OVERRIDES live here. The default cutoffs stay derived from the
-- event date in code — the DB records deviations, not the schedule itself.
CREATE TABLE IF NOT EXISTS round_overrides (
  event_id  TEXT NOT NULL,
  round_key TEXT NOT NULL CHECK (round_key IN ('nominations', 'qf', 'sf', 'final')),
  closes_at INTEGER NOT NULL, -- epoch ms
  PRIMARY KEY (event_id, round_key)
);

-- Presence of rows here IS the "bracket is locked" signal (stageNow reads it).
CREATE TABLE IF NOT EXISTS bracket_seeds (
  event_id     TEXT NOT NULL,
  position     INTEGER NOT NULL, -- 0..7, seed order is meaningful
  candidate_id TEXT NOT NULL,
  PRIMARY KEY (event_id, position)
);

-- ── Event codes (src/lib/event-codes.ts) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_codes (
  event_id    TEXT NOT NULL,
  code        TEXT NOT NULL,
  redeemed_by TEXT,             -- voterId once redeemed; NULL while unused
  created_at  INTEGER NOT NULL,
  order_id    TEXT,             -- set when auto-issued for a ticket order
  email       TEXT,
  PRIMARY KEY (event_id, code)
);
-- Makes "one code per order" a database guarantee, not just app logic — this is
-- what keeps the Eventbrite webhook idempotent even if it fires twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_codes_order
  ON event_codes (event_id, order_id) WHERE order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS event_holders (
  event_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  PRIMARY KEY (event_id, voter_id)
);

-- Per-event override of the ANTHEM_SUGGEST_GATE env default.
CREATE TABLE IF NOT EXISTS event_gate (
  event_id TEXT PRIMARY KEY,
  mode     TEXT NOT NULL CHECK (mode IN ('open', 'ticket'))
);

-- ── Run of Show (src/lib/content-store.ts) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS run_of_show (
  event_id  TEXT NOT NULL,
  position  INTEGER NOT NULL, -- order is meaningful
  id        TEXT NOT NULL,
  time      TEXT NOT NULL DEFAULT '',
  title     TEXT NOT NULL DEFAULT '',
  detail    TEXT NOT NULL DEFAULT '',
  performer TEXT,
  role      TEXT,
  instagram TEXT,
  PRIMARY KEY (event_id, position)
);

-- Marks that an admin has SAVED a run of show for this event, which is not the
-- same as "has rows". Without it we could not tell "never edited → show the
-- RUN_OF_SHOW defaults" apart from "admin deliberately deleted every row →
-- show nothing", and an empty save would silently resurrect the defaults.
CREATE TABLE IF NOT EXISTS run_of_show_saved (
  event_id TEXT PRIMARY KEY
);

-- ── Editable event details (src/lib/event-store.ts) ─────────────────────────
-- Overrides layered on the seed event. `date` is deliberately absent: it drives
-- the anthem schedule, so it is not editable yet.
CREATE TABLE IF NOT EXISTS event_overrides (
  event_id TEXT PRIMARY KEY,
  title    TEXT,
  theme    TEXT,
  venue    TEXT
);
