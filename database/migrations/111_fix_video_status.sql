-- Migration 111: Fix video status for Alone + Pour Salem, fix featured_schedule date

-- Set Alone and Pour Salem to live
UPDATE videos SET publication_status = 'live', is_public = 1, updated_at = datetime('now')
WHERE id IN (440, 441) AND publication_status != 'live';

-- Fix Pour Salem featured_schedule: released Feb 27, not Feb 28
UPDATE featured_schedule SET starts_at = '2026-02-27 13:00:00'
WHERE video_id = 441;
