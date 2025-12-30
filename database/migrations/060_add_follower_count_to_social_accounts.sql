-- Add follower count tracking to social_accounts
ALTER TABLE social_accounts ADD COLUMN follower_count INTEGER DEFAULT 0;
ALTER TABLE social_accounts ADD COLUMN follower_change INTEGER DEFAULT 0;
