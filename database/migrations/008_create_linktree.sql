-- ============================================================================
-- LinkTree / Connectivity Hub
-- Branded link aggregator for digital presence management
-- ============================================================================

CREATE TABLE IF NOT EXISTS linktree (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Link Details
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('streaming', 'social', 'video', 'fashion', 'admin', 'store', 'other')),
  platform TEXT,                -- e.g., 'spotify', 'instagram', 'tiktok'
  icon_url TEXT,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_featured INTEGER NOT NULL DEFAULT 0,
  
  -- Analytics & Management
  click_count INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TEXT,
  last_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_posted_at TEXT,          -- When content was last posted to this platform
  managed_by TEXT,              -- Admin user managing this link
  notes TEXT,                   -- Internal notes
  
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for category-based queries
CREATE INDEX IF NOT EXISTS idx_linktree_category ON linktree(category, display_order);

-- Index for active links (user-facing queries)
CREATE INDEX IF NOT EXISTS idx_linktree_active ON linktree(is_active, is_featured, display_order);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_linktree_clicks ON linktree(click_count DESC);

-- Sample data (your branded links)
INSERT INTO linktree (title, url, category, platform, display_order, is_active, is_featured) VALUES
-- Streaming Platforms
('Spotify', 'https://open.spotify.com/artist/your-artist-id', 'streaming', 'spotify', 1, 1, 1),
('Apple Music', 'https://music.apple.com/artist/your-artist-id', 'streaming', 'apple_music', 2, 1, 1),
('YouTube Music', 'https://music.youtube.com/channel/your-channel-id', 'streaming', 'youtube_music', 3, 1, 0),
('Tidal', 'https://tidal.com/artist/your-artist-id', 'streaming', 'tidal', 4, 1, 0),

-- Social Media
('Instagram', 'https://instagram.com/odubo', 'social', 'instagram', 1, 1, 1),
('TikTok', 'https://tiktok.com/@odubo', 'social', 'tiktok', 2, 1, 1),
('Twitter/X', 'https://x.com/odubo', 'social', 'twitter', 3, 1, 0),

-- Video Platforms
('YouTube', 'https://youtube.com/@odubo', 'video', 'youtube', 1, 1, 1),
('Vimeo', 'https://vimeo.com/odubo', 'video', 'vimeo', 2, 1, 0),

-- Fashion
('Fashion Instagram', 'https://instagram.com/odubo.fashion', 'fashion', 'instagram', 1, 1, 0),

-- Store
('Official Store', 'https://store.odubo.com', 'store', 'shopify', 1, 1, 1);
