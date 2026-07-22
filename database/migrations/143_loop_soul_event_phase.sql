-- Loop Soul merge: event phase as a global D1 setting.
-- Source: loop-soul-hub migrations/0002_event_phase.sql @ 3f093ea.

-- Loop Soul — event phase → D1 (make the phase a GLOBAL, server-side setting).
--
-- Until now the active phase lived in a per-browser `ls_phase` cookie set from
-- /admin. That is a launch-night footgun: an admin flipping to `live` would
-- change it ONLY in their own browser, so every attendee would still see The
-- Gathering and the Portal would never open — and it looks fine when the admin
-- tests it. Moving phase into D1 makes the flip authoritative for every visitor,
-- exactly like the other admin-editable stores (event_overrides, run_of_show).
--
-- Scoped per event_id like every other store. Presence of a row = an admin has
-- set a phase; absence = fall back to NEXT_PUBLIC_DEFAULT_PHASE / the seed.
CREATE TABLE IF NOT EXISTS event_phase (
  event_id TEXT PRIMARY KEY,
  phase    TEXT NOT NULL CHECK (phase IN ('pre', 'live', 'archived'))
);
