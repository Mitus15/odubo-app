-- =============================================================================
-- SOCIAL MEDIA METADATA
-- Platform-specific content for deploy (may differ from site description)
-- =============================================================================

ALTER TABLE videos ADD COLUMN social_description TEXT;
ALTER TABLE videos ADD COLUMN social_hashtags TEXT;  -- JSON array of hashtags
ALTER TABLE videos ADD COLUMN social_first_comment TEXT;  -- Links, credits, product links
ALTER TABLE videos ADD COLUMN social_visibility TEXT DEFAULT 'public';  -- public/unlisted/private
