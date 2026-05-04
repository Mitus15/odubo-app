-- Migration: 131_cool_points.sql
-- Description: Create Cool Points system tables


-- Cool Points ledger (transaction log)
CREATE TABLE IF NOT EXISTS cool_points (
  id TEXT PRIMARY KEY,
  user_identifier TEXT NOT NULL,
  user_id TEXT, -- Clerk user ID
  action TEXT NOT NULL CHECK (action IN (
    'rsvp', 'checkin', 'upload_photo', 'upload_video', 
    'share', 'share_bonus', 'repurpose_approved', 'repurposed_used',
    'comment', 'like', 'referral', 'redeem', 'bonus', 'purchase_bonus'
  )),
  points INTEGER NOT NULL,
  reference_id TEXT, -- Related content/request ID
  reference_type TEXT, -- 'content', 'rsvp', 'repurpose', etc.
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User Cool Points balance (denormalized for performance)
CREATE TABLE IF NOT EXISTS cool_points_balance (
  user_identifier TEXT PRIMARY KEY,
  user_id TEXT, -- Clerk user ID
  balance INTEGER DEFAULT 0,
  lifetime_earned INTEGER DEFAULT 0,
  lifetime_redeemed INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Points actions config (for reference, not enforced)
CREATE TABLE IF NOT EXISTS cool_points_actions (
  action TEXT PRIMARY KEY,
  points INTEGER NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  daily_limit INTEGER, -- Max times this action can award points per day
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default points actions
INSERT OR IGNORE INTO cool_points_actions (action, points, description, daily_limit) VALUES
  ('rsvp', 10, 'RSVP to an event', 1),
  ('checkin', 25, 'Check in to event', 1),
  ('upload_photo', 15, 'Upload a photo', NULL),
  ('upload_video', 20, 'Upload a video', NULL),
  ('share', 20, 'Share content to social', NULL),
  ('share_bonus', 50, 'Bonus for 10 shares', 1),
  ('repurpose_approved', 50, 'Your content repurposed by others', NULL),
  ('repurposed_used', 100, 'Your repurposed content goes viral', NULL),
  ('comment', 5, 'Comment on content', 10),
  ('like', 2, 'Like content', 20),
  ('referral', 25, 'Refer a friend who RSVPs', NULL);

-- Redemption history
CREATE TABLE IF NOT EXISTS cool_points_redemptions (
  id TEXT PRIMARY KEY,
  user_identifier TEXT NOT NULL,
  user_id TEXT,
  reward_key TEXT NOT NULL,
  reward_name TEXT NOT NULL,
  points_spent INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  fulfilled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rewards catalog
CREATE TABLE IF NOT EXISTS cool_points_rewards (
  id TEXT PRIMARY KEY,
  reward_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL,
  reward_type TEXT CHECK (reward_type IN ('digital', 'physical', 'access', 'discount')),
  inventory INTEGER, -- NULL = unlimited
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default rewards
INSERT OR IGNORE INTO cool_points_rewards (id, reward_key, name, description, points_cost, reward_type) VALUES
  ('reward_stickers', 'stickers', 'Branded Sticker Pack', 'Cool Wrld sticker pack', 100, 'physical'),
  ('reward_photo_print', 'photo_print', 'Event Photo Print', 'Print of your favorite capture', 200, 'physical'),
  ('reward_bts', 'bts', 'Exclusive BTS Video', 'Behind-the-scenes footage', 250, 'digital'),
  ('reward_ticket_discount', 'ticket_discount', 'Event Ticket 10% Off', 'Discount on next event', 500, 'discount'),
  ('reward_early_access', 'early_access', 'Early Episode Access', 'Watch episodes before release', 750, 'access'),
  ('reward_merch', 'merch', 'Limited Edition Merch', 'Exclusive merchandise item', 1000, 'physical'),
  ('reward_meet_greet', 'meet_greet', 'Meet & Greet Access', 'VIP meet & greet', 2000, 'access');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_points_user ON cool_points(user_identifier);
CREATE INDEX IF NOT EXISTS idx_points_action ON cool_points(action);
CREATE INDEX IF NOT EXISTS idx_points_recent ON cool_points(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_balance_user ON cool_points_balance(user_identifier);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON cool_points_redemptions(user_identifier);

