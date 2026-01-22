-- Analytics Indexes for Web Analytics System
-- Phase 1: Page view and visitor tracking optimization

-- ============================================
-- FAN_ACTIVITY INDEXES
-- Optimized for page analytics queries
-- ============================================

-- Efficient page analytics queries (page views by date)
CREATE INDEX IF NOT EXISTS idx_fan_activity_page_created
ON fan_activity(content_type, created_at) WHERE content_type = 'page';

-- Session analysis (all activity for a session)
CREATE INDEX IF NOT EXISTS idx_fan_activity_session_created
ON fan_activity(session_id, created_at);

-- Activity type + date for aggregation queries
CREATE INDEX IF NOT EXISTS idx_fan_activity_type_date
ON fan_activity(activity_type, date(created_at));

-- Visitor journey tracking
CREATE INDEX IF NOT EXISTS idx_fan_activity_fan_session
ON fan_activity(fan_id, session_id, created_at);

-- ============================================
-- FAN_PROFILES INDEXES
-- Visitor identity resolution
-- ============================================

-- Fingerprint lookup for anonymous to known linking
CREATE INDEX IF NOT EXISTS idx_fan_profiles_fingerprint
ON fan_profiles(fingerprint_hash) WHERE fingerprint_hash IS NOT NULL;

-- Combined identity lookup (email or fingerprint)
CREATE INDEX IF NOT EXISTS idx_fan_profiles_identity
ON fan_profiles(email, fingerprint_hash);

-- ============================================
-- BI_WEBSITE_METRICS INDEXES
-- Daily aggregation queries
-- ============================================

-- Already has idx_bi_website_date from migration 079

-- Source analysis
CREATE INDEX IF NOT EXISTS idx_bi_website_metrics_entry_type
ON bi_website_metrics(entry_type, date);
