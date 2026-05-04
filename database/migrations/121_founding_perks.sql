-- Migration: 121_founding_perks.sql
-- Description: Create founding perks configuration table


CREATE TABLE IF NOT EXISTS founding_perks (
  id TEXT PRIMARY KEY,
  perk_level TEXT NOT NULL CHECK (perk_level IN ('founding', 'early', 'supporter')),
  perk_key TEXT NOT NULL,
  perk_value TEXT NOT NULL,
  perk_description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for perk level lookups
CREATE INDEX IF NOT EXISTS idx_perks_level ON founding_perks(perk_level);

-- Index for active perks
CREATE INDEX IF NOT EXISTS idx_perks_active ON founding_perks(active);

-- Insert default founding perks
INSERT OR IGNORE INTO founding_perks (id, perk_level, perk_key, perk_value, perk_description) VALUES
  ('perk_early_access', 'founding', 'early_access', 'true', 'Get early access to new episodes'),
  ('perk_bts', 'founding', 'exclusive_content', 'bts', 'Access exclusive behind-the-scenes content'),
  ('perk_invite', 'founding', 'invite_links', 'true', 'Personal invite links for friends'),
  ('perk_community', 'founding', 'community_access', 'true', 'Access to founding member community'),
  ('perk_badge', 'founding', 'profile_badge', 'founder', 'Founding Member badge on profile');

