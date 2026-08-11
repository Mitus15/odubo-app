-- 145: Gallery curation + the moderation columns that migration 018 promised.
--
-- `moderated_at` / `moderated_by` are already written by /api/moments/moderate
-- (moderate/route.ts:26) but were never created — the ALTERs in
-- 018_add_moderation_timestamps.sql are commented out, so that UPDATE fails on
-- a clean database. This makes the schema match the code.
--
-- `featured` is generic curation: any gallery can pin its best shots. First
-- consumer is Loop Soul's "Iconic Moments" (featured photos of an event
-- volume), but nothing here is Loop-specific.
--
-- NOTE: 144 is intentionally skipped — it belongs to the Loop Journal branch
-- (journal_issues / journal_moments, already applied to remote D1).
--
-- APPLIED TO REMOTE D1 2026-08-10 via scripts/loop/apply_145_gallery_curation.ts
-- (idempotent runner). On remote, moderated_at / moderated_by already existed
-- (added out-of-band at some earlier point); only `featured` + the index were
-- new. Running this file verbatim against remote would fail on the duplicate
-- columns — use the runner script.

ALTER TABLE gallery_photos ADD COLUMN moderated_at TEXT;
ALTER TABLE gallery_photos ADD COLUMN moderated_by TEXT;
ALTER TABLE gallery_photos ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_gallery_photos_featured
  ON gallery_photos(gallery_id, featured);
