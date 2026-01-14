-- Social CMS Enhancements - Content Command Center
-- Migration: 077_social_cms_enhancements.sql
-- Purpose: Add AI analysis, content types, source tracking, and calendar support

-- =====================================================
-- CONTENT TYPE AND AI ANALYSIS FIELDS
-- =====================================================

-- Content type classification (AI-driven)
ALTER TABLE social_content ADD COLUMN content_type TEXT;

-- AI suggested type when it discovers a new category
ALTER TABLE social_content ADD COLUMN ai_suggested_type TEXT;

-- Full AI analysis JSON blob
-- Structure: { content_type, captions: {ig, tt, yt}, hashtags: {ig, tt, yt}, optimal_times, performance_factors }
ALTER TABLE social_content ADD COLUMN ai_analysis TEXT;

-- AI suggested caption (primary suggestion)
ALTER TABLE social_content ADD COLUMN ai_suggested_caption TEXT;

-- AI performance prediction score (0-100)
ALTER TABLE social_content ADD COLUMN ai_performance_score INTEGER;

-- When AI analysis was last performed
ALTER TABLE social_content ADD COLUMN ai_analyzed_at DATETIME;

-- =====================================================
-- PER-PLATFORM POSTING STATUS
-- =====================================================

-- Platform-specific status tracking
-- JSON: {"instagram": "posted", "tiktok": "scheduled", "youtube": "draft"}
ALTER TABLE social_content ADD COLUMN platform_status TEXT;

-- Platform-specific post IDs (for linking back to native posts)
-- JSON: {"instagram": "abc123", "tiktok": "xyz789", "youtube": "def456"}
ALTER TABLE social_content ADD COLUMN platform_post_ids TEXT;

-- =====================================================
-- SOURCE TRACKING (CENTRAL HUB)
-- =====================================================

-- Where the content was imported from
-- Values: upload, clips, brand_assets, moments, media_hub
ALTER TABLE social_content ADD COLUMN import_source TEXT;

-- ID from the source table (generic reference)
ALTER TABLE social_content ADD COLUMN import_source_id INTEGER;

-- Direct reference to assets table (for brand assets imports)
ALTER TABLE social_content ADD COLUMN asset_id INTEGER;

-- Direct reference to photos table (for moments imports)
ALTER TABLE social_content ADD COLUMN moments_photo_id INTEGER;

-- Direct reference to hub_videos table (for media hub imports)
ALTER TABLE social_content ADD COLUMN hub_video_id INTEGER;

-- =====================================================
-- IDEAS CAPTURE
-- =====================================================

-- How the idea was captured
-- Values: quick_note, calendar, external, from_content
ALTER TABLE social_content ADD COLUMN idea_source TEXT;

-- Additional notes for ideas
ALTER TABLE social_content ADD COLUMN idea_notes TEXT;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Calendar queries (scheduled content by date range)
CREATE INDEX IF NOT EXISTS idx_social_content_calendar
  ON social_content(scheduled_for, status);

-- Source lookups (find content by import source)
CREATE INDEX IF NOT EXISTS idx_social_content_source
  ON social_content(import_source, import_source_id);

-- Content type filtering
CREATE INDEX IF NOT EXISTS idx_social_content_type
  ON social_content(content_type);

-- AI analysis status (find unanalyzed content)
CREATE INDEX IF NOT EXISTS idx_social_content_ai
  ON social_content(ai_analyzed_at);

-- =====================================================
-- DAILY METRICS FOR TREND ANALYSIS
-- =====================================================

CREATE TABLE IF NOT EXISTS social_metrics_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL REFERENCES social_content(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,  -- instagram, tiktok, youtube
  date DATE NOT NULL,

  -- Core metrics
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,

  -- Calculated metrics
  engagement_rate REAL,  -- (likes + comments + shares + saves) / views * 100

  -- Timestamps
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Unique constraint: one record per content per platform per day
  UNIQUE(content_id, platform, date)
);

CREATE INDEX IF NOT EXISTS idx_social_metrics_daily_content
  ON social_metrics_daily(content_id);
CREATE INDEX IF NOT EXISTS idx_social_metrics_daily_date
  ON social_metrics_daily(date);
CREATE INDEX IF NOT EXISTS idx_social_metrics_daily_platform
  ON social_metrics_daily(platform);

-- =====================================================
-- AI INSIGHTS STORAGE
-- =====================================================

CREATE TABLE IF NOT EXISTS social_ai_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER REFERENCES social_content(id) ON DELETE CASCADE,

  -- Insight type: performance, trend, suggestion, comparison
  insight_type TEXT NOT NULL,

  -- The insight text from Gemini
  insight_text TEXT NOT NULL,

  -- Confidence score if applicable
  confidence REAL,

  -- Timestamps
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_social_ai_insights_content
  ON social_ai_insights(content_id);
CREATE INDEX IF NOT EXISTS idx_social_ai_insights_type
  ON social_ai_insights(insight_type);
