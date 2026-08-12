-- Loop Soul — The Loop Journal (per-volume community magazine).
--
-- One issue per event, scoped by `event_id` like every other Loop store. The
-- issue is the magazine's editorial frame (headline + standfirst + published
-- flag); the anthem champion and the run-of-show recap are DERIVED from the
-- tables that already exist — the event writes most of its own issue. The one
-- thing that must be curated by hand is the photography.
--
-- Presence of a `journal_issues` row = an admin has started drafting; the
-- `published` flag is what makes the issue public. Draft state is visible only
-- through /admin.

CREATE TABLE IF NOT EXISTS journal_issues (
  event_id     TEXT PRIMARY KEY,
  headline     TEXT,
  standfirst   TEXT,
  published    INTEGER NOT NULL DEFAULT 0,
  -- Set once, on first publish (ISO string). Survives unpublish → republish so
  -- the issue keeps its original date, like a real print run.
  published_at TEXT
);

-- ── Iconic Moments (admin-curated photo list) ───────────────────────────────
-- Same shape as run_of_show: full-replace on save, ordered by `position`.
-- `image_url` is a full URL (R2 / Stream still) — the Portal submission
-- pipeline that will feed this lands in a follow-up; until then admins paste
-- URLs. No `_saved` marker table needed: unlike the run of show there is no
-- seed list to resurrect, so "no rows" already means exactly "no moments".
CREATE TABLE IF NOT EXISTS journal_moments (
  event_id  TEXT NOT NULL,
  position  INTEGER NOT NULL,
  id        TEXT NOT NULL,
  image_url TEXT NOT NULL,
  caption   TEXT NOT NULL DEFAULT '',
  credit    TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (event_id, id)
);
