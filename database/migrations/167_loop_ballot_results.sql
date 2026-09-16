-- The declared outcome of a member ballot.
--
-- The standings are DERIVED and live: options come from featured Wall shots
-- and album tracks, and votes keep arriving. That is right for a vote in
-- progress and wrong for a result. Unfeature a shot after the room has voted
-- and the leaderboard silently rewrites what happened — so the outcome is
-- DECLARED, once, and frozen here.
--
-- `result` is JSON because the two ballots resolve to different shapes: the
-- cover's outcome is a single winner, the tracklist's is an order. One table
-- rather than a second migration when the running order gets frozen too.
--   cover     → {"winner": "pic:ab12cd34"}
--   tracklist → {"order": ["trk:3", "trk:1", ...]}
--
-- Renumbered from 157 (used on main by the contest branch base). 156 was used against remote D1 by the brand consolidation
-- without a file landing in the repo (see MEMORY.md, 2026-09-05).
CREATE TABLE IF NOT EXISTS loop_ballot_results (
  event_id    TEXT NOT NULL,
  kind        TEXT NOT NULL,          -- 'cover' | 'tracklist'
  result      TEXT NOT NULL,          -- JSON, see above
  declared_at TEXT NOT NULL,
  declared_by TEXT,                   -- 'loop-admin'
  note        TEXT,                   -- optional: why, for the Journal
  PRIMARY KEY (event_id, kind)
);
