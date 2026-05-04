-- Migration: 123_fan_content_rights.sql
-- Description: Create fan content rights table for managing permissions on fan-submitted content


CREATE TABLE IF NOT EXISTS fan_content_rights (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('gallery_photo', 'clip', 'community_post')),
  content_id TEXT NOT NULL,
  contributor_identifier TEXT NOT NULL,
  rights_granted TEXT NOT NULL, -- JSON: {episode: true, promo: true, social: true}
  rights_revoked BOOLEAN DEFAULT FALSE,
  consent_given BOOLEAN DEFAULT FALSE,
  consent_timestamp DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for content lookups
CREATE INDEX IF NOT EXISTS idx_rights_content ON fan_content_rights(content_type, content_id);

-- Index for contributor lookups
CREATE INDEX IF NOT EXISTS idx_rights_contributor ON fan_content_rights(contributor_identifier);

-- Index for consent status
CREATE INDEX IF NOT EXISTS idx_rights_consent ON fan_content_rights(consent_given);

