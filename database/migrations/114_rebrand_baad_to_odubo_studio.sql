-- =============================================================================
-- REBRAND: BAAD → odubo studio
-- Rename the BAAD entity to odubo studio
-- =============================================================================

UPDATE entities SET
  id = 'odubo-studio',
  name = 'odubo studio',
  slug = 'odubo-studio',
  description = 'odubo studio',
  updated_at = datetime('now')
WHERE id = 'baad';

-- Also update any foreign key references in social_accounts, social_posts, and social_media_library
UPDATE social_accounts SET entity_id = 'odubo-studio' WHERE entity_id = 'baad';
UPDATE social_posts SET entity_id = 'odubo-studio' WHERE entity_id = 'baad';
UPDATE social_media_library SET entity_id = 'odubo-studio' WHERE entity_id = 'baad';
