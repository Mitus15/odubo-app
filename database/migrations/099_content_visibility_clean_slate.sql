-- =============================================================================
-- CONTENT VISIBILITY: CLEAN SLATE
-- Hide all existing clips/videos until they are distributed
-- Migration: 099_content_visibility_clean_slate.sql
-- =============================================================================

-- Hide ALL existing clips - they will become visible when distributed via PostForMe
UPDATE videos 
SET publication_status = 'archived',
    is_public = 0,
    updated_at = datetime('now')
WHERE type = 'clip';

-- Hide ALL existing videos (music videos, films, etc.) - same logic
UPDATE videos 
SET publication_status = 'archived',
    is_public = 0,
    updated_at = datetime('now')
WHERE type != 'clip' OR type IS NULL;

-- Note: After running this migration, all content will be hidden from public pages.
-- Content becomes visible when:
-- 1. You distribute it via Social CMS → PostForMe
-- 2. The publish route automatically sets publication_status = 'live'
