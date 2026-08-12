-- 149 — capacity becomes data, not code.
--
-- Capacity lived in the `MOCK_CURRENT_EVENT` constant in src/lib/loop/hub.ts,
-- so the number printed on the poster and counted at the door could only be
-- changed by editing source and deploying. The venue sets that number, and they
-- had not confirmed it — a hotel handing back "60, not 75" the week of the
-- announcement should not be a code change.
--
-- NOTE: `ALTER TABLE ... ADD COLUMN` is NOT idempotent in SQLite — re-running
-- this file against a database that already has the column fails with
-- "duplicate column name". Use scripts/loop/apply_149_event_capacity.ts, which
-- checks PRAGMA table_info first.

ALTER TABLE event_overrides ADD COLUMN capacity INTEGER;
