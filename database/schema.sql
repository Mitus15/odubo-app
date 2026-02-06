-- Cloudflare D1 Database Schema for Odubo Studio
-- Complete multimedia entertainment platform with film, music, gaming, studio, and e-commerce
-- Run this in your D1 database console or via Wrangler CLI

-- =============================================================================
-- FILM MANAGEMENT SYSTEM
-- =============================================================================

-- Films table
CREATE TABLE IF NOT EXISTS films (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  publisher TEXT NOT NULL,
  
  -- Media Files (Cloudflare ecosystem)
  video_id TEXT, -- Cloudflare Stream video ID
  video_url TEXT, -- Cloudflare Stream HLS URL
  sample_video_id TEXT, -- Cloudflare Stream sample video ID  
  sample_video_url TEXT, -- Cloudflare Stream sample HLS URL
  poster_url TEXT, -- Cloudflare R2 URL
  poster_key TEXT, -- R2 object key
  
  -- Video metadata from Cloudflare Stream
  video_duration INTEGER, -- Duration in seconds
  video_thumbnail TEXT, -- Cloudflare Stream thumbnail URL
  video_status TEXT DEFAULT 'pending', -- 'pending', 'ready', 'error'
  
  -- Film metadata
  genre TEXT,
  duration_formatted TEXT, -- Human readable duration (e.g., "2m 35s")
  language TEXT,
  country TEXT,
  budget TEXT,
  description TEXT,
  
  -- System fields
  upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  featured BOOLEAN DEFAULT FALSE
);

-- Credits table (normalized for better querying)
CREATE TABLE IF NOT EXISTS film_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  film_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'director', 'photographer', 'writer', etc.
  name TEXT NOT NULL,
  FOREIGN KEY (film_id) REFERENCES films (id) ON DELETE CASCADE
);

-- Keywords/Tags table
CREATE TABLE IF NOT EXISTS film_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  film_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  FOREIGN KEY (film_id) REFERENCES films (id) ON DELETE CASCADE
);

-- Festivals table
CREATE TABLE IF NOT EXISTS film_festivals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  film_id TEXT NOT NULL,
  festival_name TEXT NOT NULL,
  year INTEGER,
  award TEXT, -- Optional award received
  FOREIGN KEY (film_id) REFERENCES films (id) ON DELETE CASCADE
);

-- Awards table (separate from festivals for standalone awards)
CREATE TABLE IF NOT EXISTS film_awards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  film_id TEXT NOT NULL,
  award_name TEXT NOT NULL,
  year INTEGER,
  category TEXT,
  FOREIGN KEY (film_id) REFERENCES films (id) ON DELETE CASCADE
);

-- =============================================================================
-- MUSIC STREAMING SYSTEM
-- =============================================================================

-- Albums/Releases table
CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  release_type TEXT NOT NULL, -- 'album', 'ep', 'single', 'compilation', 'mixtape'
  release_date DATE,
  record_label TEXT,
  genre TEXT,
  subgenre TEXT,
  cover_art_url TEXT, -- Cloudflare R2 cover art URL
  cover_art_key TEXT, -- R2 object storage key
  total_tracks INTEGER,
  total_duration INTEGER, -- Total duration in seconds
  explicit_content BOOLEAN DEFAULT FALSE,
  featured BOOLEAN DEFAULT FALSE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Individual tracks table
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  album_id TEXT,
  title TEXT NOT NULL,
  track_number INTEGER NOT NULL,
  disc_number INTEGER DEFAULT 1,
  duration INTEGER NOT NULL, -- Duration in seconds
  duration_formatted TEXT, -- Human-readable duration (e.g., "3:45")
  audio_id TEXT, -- Cloudflare Stream audio ID
  audio_url TEXT, -- Cloudflare Stream audio playback URL
  preview_url TEXT, -- 30-second preview URL
  waveform_url TEXT, -- Audio waveform visualization URL
  audio_status TEXT DEFAULT 'pending', -- 'pending', 'ready', 'error'
  isrc TEXT, -- International Standard Recording Code
  explicit_content BOOLEAN DEFAULT FALSE,
  date_recorded DATE,
  recording_studio TEXT,
  bpm INTEGER,
  key_signature TEXT, -- Musical key (e.g., "C Major", "A Minor")
  language TEXT,
  lyrics TEXT, -- Full song lyrics
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (album_id) REFERENCES albums (id) ON DELETE CASCADE
);

-- Music credits table
CREATE TABLE IF NOT EXISTS track_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'artist', 'featured_artist', 'producer', 'songwriter', etc.
  name TEXT NOT NULL,
  is_featured BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
);

-- Multi-genre classification for tracks
CREATE TABLE IF NOT EXISTS track_genres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT NOT NULL,
  genre TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
);

-- User-created playlists
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_art_url TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  total_tracks INTEGER DEFAULT 0,
  total_duration INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Playlist track associations (many-to-many)
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
);

-- =============================================================================
-- USER MANAGEMENT & ANALYTICS
-- =============================================================================

-- Central user profiles
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  password_hash TEXT, -- bcrypt hashed password for email/password auth
  first_name TEXT,
  last_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE, -- Admin flag
  avatar_url TEXT, -- Profile picture URL (Cloudflare R2)
  avatar_key TEXT, -- R2 object storage key
  auth_provider TEXT DEFAULT 'email', -- 'email', 'google', 'spotify', 'apple'
  auth_provider_id TEXT, -- External provider user ID
  shopify_customer_id TEXT, -- Shopify customer ID for e-commerce
  email_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  subscription_tier TEXT DEFAULT 'free', -- 'free', 'premium', 'studio', 'enterprise'
  subscription_expires DATETIME,
  total_spent DECIMAL(10,2) DEFAULT 0.00, -- Total Shopify purchases
  referral_code TEXT UNIQUE, -- User's referral code
  referred_by TEXT, -- References users(id)
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referred_by) REFERENCES users (id)
);

-- Session management
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  browser TEXT,
  ip_address TEXT,
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Media consumption tracking
CREATE TABLE IF NOT EXISTS user_media_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  media_type TEXT NOT NULL, -- 'film', 'track', 'album'
  media_id TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- 'view', 'play', 'pause', 'skip', 'like', 'share'
  progress_seconds INTEGER,
  total_duration INTEGER,
  completion_rate DECIMAL(5,2), -- Percentage completed (0-100)
  quality TEXT, -- Playback quality
  device_type TEXT,
  session_id TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES user_sessions (id)
);

-- Gaming analytics
CREATE TABLE IF NOT EXISTS user_game_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  game_type TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'start', 'end', 'achievement', 'level_up', 'purchase'
  level INTEGER,
  score INTEGER,
  duration_seconds INTEGER,
  achievements TEXT, -- JSON array of achievements earned
  in_game_purchases DECIMAL(10,2) DEFAULT 0.00,
  device_type TEXT,
  session_id TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES user_sessions (id)
);

-- Shopify order tracking
CREATE TABLE IF NOT EXISTS shopify_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  shopify_order_id TEXT UNIQUE NOT NULL,
  order_number TEXT,
  order_status TEXT NOT NULL, -- 'pending', 'paid', 'shipped', 'delivered', 'cancelled'
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_status TEXT, -- 'pending', 'paid', 'refunded', 'failed'
  fulfillment_status TEXT, -- 'unfulfilled', 'fulfilled', 'shipped'
  shipping_address TEXT, -- JSON shipping address data
  billing_address TEXT, -- JSON billing address data
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  tax_amount DECIMAL(10,2) DEFAULT 0.00,
  referral_source TEXT, -- 'game', 'film', 'music', 'direct', 'social'
  shopify_created_at DATETIME,
  shopify_updated_at DATETIME,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Order line items
CREATE TABLE IF NOT EXISTS shopify_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT,
  product_title TEXT NOT NULL,
  variant_title TEXT,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  sku TEXT,
  category TEXT,
  FOREIGN KEY (order_id) REFERENCES shopify_orders (id) ON DELETE CASCADE
);

-- User preferences for personalization
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  preference_type TEXT NOT NULL, -- 'film_genre', 'music_genre', 'product_category', 'notification'
  preference_value TEXT NOT NULL,
  weight DECIMAL(3,2) DEFAULT 1.00, -- Preference strength (0-1)
  source TEXT, -- 'explicit', 'inferred', 'collaborative'
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Marketing campaign tracking
CREATE TABLE IF NOT EXISTS user_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  campaign_type TEXT NOT NULL, -- 'email', 'social', 'game_popup', 'retargeting'
  campaign_id TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'impression', 'click', 'conversion', 'signup'
  source_media TEXT, -- Related media that led to campaign
  conversion_value DECIMAL(10,2) DEFAULT 0.00,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Social connections
CREATE TABLE IF NOT EXISTS user_social_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  connected_user_id TEXT NOT NULL,
  connection_type TEXT NOT NULL, -- 'friend', 'follower', 'blocked'
  platform TEXT, -- 'internal', 'spotify', 'social_media'
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (connected_user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- =============================================================================
-- STUDIO PRODUCTION & CREATIVE TOOLS
-- =============================================================================

-- Studio projects
CREATE TABLE IF NOT EXISTS studio_projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_type TEXT NOT NULL, -- 'beat', 'track', 'film', 'podcast', 'remix'
  status TEXT DEFAULT 'draft', -- 'draft', 'in_progress', 'review', 'completed', 'archived'
  bpm INTEGER,
  key_signature TEXT,
  time_signature TEXT DEFAULT '4/4',
  genre TEXT,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  is_collaborative BOOLEAN DEFAULT FALSE,
  file_url TEXT, -- Cloudflare R2 project file URL
  file_key TEXT, -- R2 object storage key
  preview_url TEXT,
  duration_seconds INTEGER,
  last_saved DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Beat sequencer data
CREATE TABLE IF NOT EXISTS beat_sequences (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  sequence_name TEXT NOT NULL,
  sequence_data TEXT NOT NULL, -- JSON pattern data
  instrument_kit TEXT,
  pattern_length INTEGER DEFAULT 16,
  swing DECIMAL(3,2) DEFAULT 0.00,
  velocity_map TEXT, -- JSON velocity data per step
  effects_chain TEXT, -- JSON effects and settings
  is_loop BOOLEAN DEFAULT TRUE,
  position_in_project INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES studio_projects (id) ON DELETE CASCADE
);

-- Project collaborators
CREATE TABLE IF NOT EXISTS project_collaborators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'owner', 'producer', 'writer', 'editor', 'viewer'
  permissions TEXT, -- JSON permissions object
  invited_by TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'removed'
  last_active DATETIME,
  invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES studio_projects (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users (id)
);

-- =============================================================================
-- CONTACT & COMMUNICATION MANAGEMENT
-- =============================================================================

-- Contact management
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  contact_type TEXT NOT NULL, -- 'client', 'collaborator', 'label', 'venue', 'press', 'fan', 'vendor'
  first_name TEXT NOT NULL,
  last_name TEXT,
  company TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  social_instagram TEXT,
  social_twitter TEXT,
  social_linkedin TEXT,
  address TEXT, -- JSON address object
  notes TEXT,
  tags TEXT, -- JSON array of tags
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  lead_source TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'do_not_contact'
  last_contacted DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Contact interaction tracking
CREATE TABLE IF NOT EXISTS contact_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL, -- 'email', 'call', 'meeting', 'message', 'social', 'event'
  subject TEXT,
  content TEXT,
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  platform TEXT,
  duration_minutes INTEGER,
  outcome TEXT,
  follow_up_date DATE,
  attachments TEXT, -- JSON array of attachment URLs
  is_important BOOLEAN DEFAULT FALSE,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- =============================================================================
-- PRODUCT CATALOG & E-COMMERCE
-- =============================================================================

-- Product catalog
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  shopify_product_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  product_type TEXT, -- 'clothing', 'music', 'merch', 'digital', 'accessory'
  vendor TEXT,
  category TEXT,
  subcategory TEXT,
  tags TEXT, -- JSON array of tags
  handle TEXT UNIQUE,
  seo_title TEXT,
  seo_description TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  weight DECIMAL(8,3),
  dimensions TEXT, -- JSON dimensions object
  materials TEXT,
  care_instructions TEXT,
  origin_country TEXT,
  related_media TEXT, -- JSON array of related film/music IDs
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product variants
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  shopify_variant_id TEXT UNIQUE,
  title TEXT NOT NULL,
  sku TEXT UNIQUE,
  barcode TEXT,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  option1 TEXT, -- Size, Color, etc.
  option2 TEXT,
  option3 TEXT,
  inventory_quantity INTEGER DEFAULT 0,
  inventory_policy TEXT DEFAULT 'deny', -- 'deny', 'continue'
  weight DECIMAL(8,3),
  requires_shipping BOOLEAN DEFAULT TRUE,
  taxable BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  position INTEGER,
  is_available BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

-- Product media
CREATE TABLE IF NOT EXISTS product_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  media_type TEXT NOT NULL, -- 'image', 'video', '360_view', 'ar_model'
  media_url TEXT NOT NULL,
  media_key TEXT NOT NULL,
  alt_text TEXT,
  position INTEGER,
  is_primary BOOLEAN DEFAULT FALSE,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  variant_ids TEXT, -- JSON array of associated variant IDs
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

-- =============================================================================
-- GAMING & LEADERBOARDS
-- =============================================================================

-- Game configuration
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  game_name TEXT NOT NULL,
  game_type TEXT NOT NULL, -- 'endless_runner', 'puzzle', 'rhythm', 'arcade'
  version TEXT DEFAULT '1.0.0',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  max_score INTEGER,
  scoring_system TEXT, -- JSON scoring rules
  difficulty_levels TEXT, -- JSON difficulty settings
  power_ups TEXT, -- JSON available power-ups
  achievements TEXT, -- JSON achievement definitions
  game_modes TEXT, -- JSON available game modes
  leaderboard_reset TEXT DEFAULT 'never', -- 'daily', 'weekly', 'monthly', 'season', 'never'
  thumbnail_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Game sessions
CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  session_start DATETIME NOT NULL,
  session_end DATETIME,
  duration_seconds INTEGER,
  final_score INTEGER NOT NULL,
  high_score_achieved BOOLEAN DEFAULT FALSE,
  level_reached INTEGER,
  distance_traveled INTEGER, -- For endless runner
  coins_collected INTEGER DEFAULT 0,
  power_ups_used TEXT, -- JSON power-ups used
  deaths INTEGER DEFAULT 0,
  achievements_unlocked TEXT, -- JSON achievements earned
  game_mode TEXT,
  difficulty TEXT,
  device_type TEXT,
  platform TEXT,
  network_quality TEXT,
  crash_occurred BOOLEAN DEFAULT FALSE,
  version_played TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
);

-- Leaderboards
CREATE TABLE IF NOT EXISTS leaderboards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  leaderboard_type TEXT NOT NULL, -- 'all_time', 'daily', 'weekly', 'monthly', 'seasonal'
  score INTEGER NOT NULL,
  rank INTEGER,
  level INTEGER,
  distance INTEGER,
  time_survived INTEGER,
  coins_total INTEGER DEFAULT 0,
  achievements_count INTEGER DEFAULT 0,
  streak_count INTEGER DEFAULT 0,
  multiplier_max DECIMAL(4,2) DEFAULT 1.00,
  perfect_runs INTEGER DEFAULT 0,
  reset_period DATE,
  is_verified BOOLEAN DEFAULT TRUE,
  device_fingerprint TEXT,
  screenshot_url TEXT,
  replay_data TEXT, -- JSON replay data
  achieved_at DATETIME NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES game_sessions (id) ON DELETE CASCADE
);

-- Game achievements
CREATE TABLE IF NOT EXISTS game_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  session_id TEXT,
  achievement_id TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  achievement_description TEXT,
  achievement_type TEXT NOT NULL, -- 'score', 'distance', 'survival', 'collection', 'special'
  threshold_value INTEGER,
  achieved_value INTEGER,
  rarity TEXT DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
  points_awarded INTEGER DEFAULT 0,
  badge_url TEXT,
  is_hidden BOOLEAN DEFAULT FALSE,
  first_to_unlock BOOLEAN DEFAULT FALSE,
  unlock_order INTEGER,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES game_sessions (id)
);

-- =============================================================================
-- VIDEO STORAGE (Cloudflare R2)
-- =============================================================================
-- NOTE: The videos table has evolved via migrations (005,006,008,015,021,095,096) to include
-- additional metadata, publication gating, thumbnail selection, and relationship fields.
-- This base schema definition reflects the CURRENT expected structure for fresh setups.
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT,                              -- Stable unique identifier (migration 008)
  title TEXT,
  artist_name TEXT,                     -- Added for parity with music assets (migration 006)
  description TEXT,
  url TEXT,                             -- Cloudflare Stream embed URL (or direct fallback)
  mp4_url TEXT,                         -- R2 MP4 URL for deployment (migration 065)
  poster_url TEXT,                      -- Poster/thumbnail image URL (R2 or Stream generated)
  thumbnail TEXT,                       -- Alias/fallback (legacy)
  duration TEXT,                        -- Formatted or raw duration string
  category TEXT,
  is_public INTEGER,                    -- 1/0 flag for public visibility
  type TEXT,                            -- e.g. music-video | short-film | feature | clip
  mood TEXT,                            -- free-text mood classification
  credits TEXT,                         -- JSON array of credit objects
  related_projects TEXT,                -- JSON array of related project IDs
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')), -- lifecycle status (migration 005)
  stream_video_id TEXT,                 -- Underlying Cloudflare Stream UID (redundant with uid but kept)
  publication_status TEXT NOT NULL DEFAULT 'archived' CHECK (publication_status IN ('live','archived')), -- gating status (migration 015)
  thumbnail_timestamp_pct REAL,         -- Selected thumbnail timestamp percentage (migration 021)
  chosen_candidate_id INTEGER,          -- Chosen candidate (optional; migration 021)
  
  -- Music Relationships (migration 095, 096)
  track_id TEXT,                        -- References tracks.id (for music videos)
  album_id TEXT,                        -- References albums.id (direct album link)
  video_type TEXT DEFAULT 'standalone', -- Type of music video content
  
  -- Clip Relationships (undocumented prior migrations)
  parent_video_id INTEGER,              -- References videos.id for parent video (NULL for parents)
  clip_index INTEGER,                   -- Order/position within parent's clips (1, 2, 3...)
  total_siblings INTEGER,               -- Total number of clips for this parent
  
  -- Scheduling (migration 097)
  scheduled_for TEXT,                   -- ISO 8601 datetime for scheduled deployment (NULL = no schedule)
  
  created_at TEXT,                      -- Creation timestamp
  updated_at TEXT,                      -- Last update timestamp (migration 006)
  
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Helpful indexes consolidated (some created by migration 009 + 015):
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category);
CREATE INDEX IF NOT EXISTS idx_videos_type ON videos(type);
CREATE INDEX IF NOT EXISTS idx_videos_publication_status ON videos(publication_status);
CREATE INDEX IF NOT EXISTS idx_videos_scheduled_for ON videos(scheduled_for);

-- =============================================================================
-- VIDEO UPLOAD SESSIONS (deferred creation until thumbnail selection)
-- =============================================================================
CREATE TABLE IF NOT EXISTS video_upload_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,                    -- Matches videos.uid / Stream UID
  meta_json TEXT NOT NULL,              -- JSON metadata captured at upload time
  status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded | analyzing | awaiting_choice | finalizing | done | aborted
  created_by TEXT,                      -- Email or identifier of creator
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_video_upload_sessions_uid ON video_upload_sessions(uid);
CREATE INDEX IF NOT EXISTS idx_video_upload_sessions_status ON video_upload_sessions(status);

-- =============================================================================
-- VIDEO THUMBNAIL CANDIDATES (per-session AI & heuristic ranked frames)
-- =============================================================================
CREATE TABLE IF NOT EXISTS videos_thumbnail_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  uid TEXT NOT NULL,                    -- For easier joins without session lookup
  url TEXT NOT NULL,                    -- Frame image URL
  timestamp_s REAL,                     -- Approximate timestamp in seconds
  pct REAL,                             -- Normalized position (0..1)
  sharpness REAL,                       -- Heuristic clarity score
  exposure REAL,                        -- Approximate brightness/exposure metric
  face_score REAL,                      -- Reserved for future face detection weight
  ai_score REAL,                        -- Combined heuristic/AI scoring
  rank INTEGER,                         -- Final ordered rank (1 = best)
  rationale TEXT,                       -- AI or heuristic rationale string
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(session_id) REFERENCES video_upload_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_videos_thumbnail_candidates_session ON videos_thumbnail_candidates(session_id);

-- =============================================================================
-- VIDEO ANALYSIS CACHE (transcripts, moods, themes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS videos_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,                    -- Reference to videos.uid
  transcript_json TEXT,                 -- JSON transcript if generated
  chorus_timestamps_json TEXT,          -- Future: musical structure markers
  mood TEXT,                            -- AI-classified mood
  genre TEXT,                           -- AI-classified genre
  themes_json TEXT,                     -- JSON array of thematic tags
  provider TEXT,                        -- AI provider name
  model TEXT,                           -- AI model identifier
  diagnostics_json TEXT,                -- Performance / debug metrics
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_videos_analysis_uid ON videos_analysis(uid);
-- =============================================================================

-- PERFORMANCE INDEXES
-- =============================================================================

-- Film indexes
CREATE INDEX IF NOT EXISTS idx_films_genre ON films(genre);
CREATE INDEX IF NOT EXISTS idx_films_featured ON films(featured);
CREATE INDEX IF NOT EXISTS idx_films_upload_date ON films(upload_date);
CREATE INDEX IF NOT EXISTS idx_films_video_status ON films(video_status);
CREATE INDEX IF NOT EXISTS idx_film_credits_film_id ON film_credits(film_id);
CREATE INDEX IF NOT EXISTS idx_film_credits_role ON film_credits(role);
CREATE INDEX IF NOT EXISTS idx_film_keywords_film_id ON film_keywords(film_id);
CREATE INDEX IF NOT EXISTS idx_film_keywords_keyword ON film_keywords(keyword);

-- Music indexes
CREATE INDEX IF NOT EXISTS idx_albums_artist_name ON albums(artist_name);
CREATE INDEX IF NOT EXISTS idx_albums_genre ON albums(genre);
CREATE INDEX IF NOT EXISTS idx_albums_release_date ON albums(release_date);
CREATE INDEX IF NOT EXISTS idx_albums_featured ON albums(featured);
CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
CREATE INDEX IF NOT EXISTS idx_tracks_track_number ON tracks(track_number);
CREATE INDEX IF NOT EXISTS idx_tracks_audio_status ON tracks(audio_status);
CREATE INDEX IF NOT EXISTS idx_track_credits_track_id ON track_credits(track_id);
CREATE INDEX IF NOT EXISTS idx_track_credits_role ON track_credits(role);
CREATE INDEX IF NOT EXISTS idx_track_genres_track_id ON track_genres(track_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id ON playlist_tracks(track_id);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_shopify_customer_id ON users(shopify_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_media_activity_user_id ON user_media_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_media_activity_media_type ON user_media_activity(media_type);
CREATE INDEX IF NOT EXISTS idx_media_activity_timestamp ON user_media_activity(timestamp);
CREATE INDEX IF NOT EXISTS idx_game_activity_user_id ON user_game_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_game_activity_timestamp ON user_game_activity(timestamp);

-- E-commerce indexes
CREATE INDEX IF NOT EXISTS idx_shopify_orders_user_id ON shopify_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_order_id ON shopify_orders(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_status ON shopify_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_published ON products(is_published);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);

-- Studio indexes
CREATE INDEX IF NOT EXISTS idx_studio_projects_user_id ON studio_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_projects_type ON studio_projects(project_type);
CREATE INDEX IF NOT EXISTS idx_studio_projects_status ON studio_projects(status);
CREATE INDEX IF NOT EXISTS idx_beat_sequences_project_id ON beat_sequences(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_id ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_user_id ON project_collaborators(user_id);

-- Contact indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact_id ON contact_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_timestamp ON contact_interactions(timestamp);

-- Gaming indexes
CREATE INDEX IF NOT EXISTS idx_games_type ON games(game_type);
CREATE INDEX IF NOT EXISTS idx_games_active ON games(is_active);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_score ON game_sessions(final_score);
CREATE INDEX IF NOT EXISTS idx_leaderboards_game_id ON leaderboards(game_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_type ON leaderboards(leaderboard_type);
CREATE INDEX IF NOT EXISTS idx_leaderboards_score ON leaderboards(score);
CREATE INDEX IF NOT EXISTS idx_leaderboards_rank ON leaderboards(rank);
CREATE INDEX IF NOT EXISTS idx_game_achievements_user_id ON game_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_game_achievements_game_id ON game_achievements(game_id);

-- =============================================================================
-- AUTOMATED TRIGGERS
-- =============================================================================

-- Update timestamps trigger for films
CREATE TRIGGER IF NOT EXISTS update_films_timestamp 
AFTER UPDATE ON films
BEGIN
  UPDATE films SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update timestamps trigger for albums
CREATE TRIGGER IF NOT EXISTS update_albums_timestamp 
AFTER UPDATE ON albums
BEGIN
  UPDATE albums SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update timestamps trigger for tracks
CREATE TRIGGER IF NOT EXISTS update_tracks_timestamp 
AFTER UPDATE ON tracks
BEGIN
  UPDATE tracks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update timestamps trigger for users
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update timestamps trigger for playlists
CREATE TRIGGER IF NOT EXISTS update_playlists_timestamp 
AFTER UPDATE ON playlists
BEGIN
  UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update playlist track count and duration
CREATE TRIGGER IF NOT EXISTS update_playlist_stats_insert
AFTER INSERT ON playlist_tracks
BEGIN
  UPDATE playlists 
  SET 
    total_tracks = (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = NEW.playlist_id),
    total_duration = (SELECT COALESCE(SUM(t.duration), 0) 
                     FROM playlist_tracks pt 
                     JOIN tracks t ON pt.track_id = t.id 
                     WHERE pt.playlist_id = NEW.playlist_id),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.playlist_id;
END;

CREATE TRIGGER IF NOT EXISTS update_playlist_stats_delete
AFTER DELETE ON playlist_tracks
BEGIN
  UPDATE playlists 
  SET 
    total_tracks = (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = OLD.playlist_id),
    total_duration = (SELECT COALESCE(SUM(t.duration), 0) 
                     FROM playlist_tracks pt 
                     JOIN tracks t ON pt.track_id = t.id 
                     WHERE pt.playlist_id = OLD.playlist_id),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.playlist_id;
END;

-- Update album track count and duration
CREATE TRIGGER IF NOT EXISTS update_album_stats_insert
AFTER INSERT ON tracks
WHEN NEW.album_id IS NOT NULL
BEGIN
  UPDATE albums 
  SET 
    total_tracks = (SELECT COUNT(*) FROM tracks WHERE album_id = NEW.album_id),
    total_duration = (SELECT COALESCE(SUM(duration), 0) FROM tracks WHERE album_id = NEW.album_id),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.album_id;
END;

CREATE TRIGGER IF NOT EXISTS update_album_stats_delete
AFTER DELETE ON tracks
WHEN OLD.album_id IS NOT NULL
BEGIN
  UPDATE albums 
  SET 
    total_tracks = (SELECT COUNT(*) FROM tracks WHERE album_id = OLD.album_id),
    total_duration = (SELECT COALESCE(SUM(duration), 0) FROM tracks WHERE album_id = OLD.album_id),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.album_id;
END;

-- Update user total spent from Shopify orders
CREATE TRIGGER IF NOT EXISTS update_user_spent_insert
AFTER INSERT ON shopify_orders
BEGIN
  UPDATE users 
  SET 
    total_spent = (SELECT COALESCE(SUM(total_amount), 0) 
                  FROM shopify_orders 
                  WHERE user_id = NEW.user_id AND order_status = 'paid'),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_spent_update
AFTER UPDATE ON shopify_orders
BEGIN
  UPDATE users 
  SET 
    total_spent = (SELECT COALESCE(SUM(total_amount), 0) 
                  FROM shopify_orders 
                  WHERE user_id = NEW.user_id AND order_status = 'paid'),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.user_id;
END;

-- Update leaderboard ranks automatically
CREATE TRIGGER IF NOT EXISTS update_leaderboard_ranks
AFTER INSERT ON leaderboards
BEGIN
  UPDATE leaderboards 
  SET rank = (
    SELECT COUNT(*) + 1 
    FROM leaderboards l2 
    WHERE l2.game_id = NEW.game_id 
    AND l2.leaderboard_type = NEW.leaderboard_type 
    AND l2.score > NEW.score
  )
  WHERE id = NEW.id;
  
  -- Update ranks for all entries in same leaderboard
  UPDATE leaderboards 
  SET rank = (
    SELECT COUNT(*) + 1 
    FROM leaderboards l2 
    WHERE l2.game_id = leaderboards.game_id 
    AND l2.leaderboard_type = leaderboards.leaderboard_type 
    AND l2.score > leaderboards.score
  )
  WHERE game_id = NEW.game_id 
  AND leaderboard_type = NEW.leaderboard_type;
END;
