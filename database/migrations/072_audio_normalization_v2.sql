-- Migration: 072_audio_normalization_v2.sql
-- Description: Add columns for dynamics-sensitive audio normalization
--
-- New approach: Asymmetric normalization
-- - Reduce loud clips to ceiling (-14 LUFS)
-- - Gentle boost for quiet clips (max +3dB)
-- - Preserve high dynamic range content

-- Store analysis results for each clip
ALTER TABLE videos ADD COLUMN audio_loudness_lufs REAL;
-- The measured integrated loudness in LUFS (e.g., -14, -20)

ALTER TABLE videos ADD COLUMN audio_loudness_range_lu REAL;
-- The measured loudness range in LU (dynamic range indicator)

ALTER TABLE videos ADD COLUMN audio_gain_applied_db REAL;
-- The actual gain applied during normalization (can be negative for reduction)

ALTER TABLE videos ADD COLUMN audio_analyzed_at TEXT;
-- Timestamp when audio was analyzed

-- Index for finding clips by normalization status
CREATE INDEX IF NOT EXISTS idx_videos_audio_analysis
ON videos(type, audio_loudness_lufs)
WHERE type = 'clip';
