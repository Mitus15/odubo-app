-- Migration: 132_repurposing.sql
-- Description: Create repurposing requests table for content sharing between users


CREATE TABLE IF NOT EXISTS repurposing_requests (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES my_moments_contents(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL, -- Who wants to use it
  requester_identifier TEXT NOT NULL,
  owner_id TEXT NOT NULL, -- Who owns it
  owner_identifier TEXT NOT NULL,
  intended_use TEXT CHECK (intended_use IN ('tiktok', 'instagram', 'youtube', 'twitter', 'other')),
  caption_preview TEXT, -- Preview of how they'll credit you
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  response_message TEXT, -- Optional message from owner
  expires_at DATETIME, -- When approved request expires
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME
);

-- Track when repurposed content is used
CREATE TABLE IF NOT EXISTS repurposing_usage (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES repurposing_requests(id) ON DELETE CASCADE,
  deployed_url TEXT, -- Where it was posted
  deployed_platform TEXT,
  virality_score INTEGER DEFAULT 0, -- Views/likes engagement
  original_creator_earnings INTEGER DEFAULT 0, -- Points earned from this
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for content lookups
CREATE INDEX IF NOT EXISTS idx_repurpose_content ON repurposing_requests(content_id);

-- Index for owner lookups (incoming requests)
CREATE INDEX IF NOT EXISTS idx_repurpose_owner ON repurposing_requests(owner_id);

-- Index for requester lookups (outgoing requests)
CREATE INDEX IF NOT EXISTS idx_repurpose_requester ON repurposing_requests(requester_id);

-- Index for pending requests
CREATE INDEX IF NOT EXISTS idx_repurpose_pending ON repurposing_requests(status, created_at);

-- Index for usage tracking
CREATE INDEX IF NOT EXISTS idx_usage_request ON repurposing_usage(request_id);

