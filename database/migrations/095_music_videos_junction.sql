-- Migration: Music Videos Junction Table and Track-Video Relationships
-- Purpose: Enable bidirectional linking between tracks and their music videos
--          Support multiple video types per track (official, lyric, visualizer, live, etc.)

-- ============================================================================
-- MUSIC VIDEOS JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS music_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT NOT NULL,                           -- References tracks.id
  video_uid TEXT,                                   -- References videos.uid (Cloudflare Stream)
  video_type TEXT NOT NULL DEFAULT 'official',      -- 'official', 'lyric', 'visualizer', 'live', 'behind-the-scenes', 'performance'
  r2_key TEXT,                                      -- For direct R2 storage (if not using Stream)
  stream_video_id TEXT,                             -- Cloudflare Stream ID (if hosted on Stream)
  title TEXT,                                       -- Display title override (optional)
  is_primary BOOLEAN DEFAULT FALSE,                 -- Is this the main video for the track?
  sort_order INTEGER DEFAULT 0,                     -- Order when displaying multiple videos
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_music_videos_track_id ON music_videos(track_id);
CREATE INDEX IF NOT EXISTS idx_music_videos_video_uid ON music_videos(video_uid);
CREATE INDEX IF NOT EXISTS idx_music_videos_stream_video_id ON music_videos(stream_video_id);
CREATE INDEX IF NOT EXISTS idx_music_videos_is_primary ON music_videos(is_primary);

-- ============================================================================
-- UPDATE TRACKS TABLE (Add reverse lookup for primary video)
-- ============================================================================

ALTER TABLE tracks ADD COLUMN primary_video_id INTEGER REFERENCES music_videos(id);
CREATE INDEX IF NOT EXISTS idx_tracks_primary_video_id ON tracks(primary_video_id);

-- ============================================================================
-- UPDATE VIDEOS TABLE (Add track relationship)
-- ============================================================================

ALTER TABLE videos ADD COLUMN track_id TEXT REFERENCES tracks(id);
ALTER TABLE videos ADD COLUMN video_type TEXT DEFAULT 'standalone' CHECK (video_type IN (
  'standalone',       -- Not linked to a track
  'music-video',      -- Official music video
  'lyric',           -- Lyric video
  'visualizer',      -- Visualizer
  'live',            -- Live performance
  'behind-the-scenes', -- BTS content
  'performance'      -- Studio performance
));

CREATE INDEX IF NOT EXISTS idx_videos_track_id ON videos(track_id);
CREATE INDEX IF NOT EXISTS idx_videos_video_type ON videos(video_type);

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- Usage Example:
-- 1. Create track in tracks table
-- 2. Upload video to Cloudflare Stream or R2
-- 3. Create entry in music_videos linking track_id to video_uid
-- 4. Optionally set is_primary=TRUE for main video
-- 5. Update tracks.primary_video_id to point to the primary music_videos entry
-- 
-- Storage Organization:
-- - Videos on Cloudflare Stream: Use video_uid/stream_video_id
-- - Videos on R2: Use r2_key with path like: music/videos/{album-slug}/{track-slug}-{type}.mp4
-- 
-- Bidirectional Access:
-- - From track: tracks.primary_video_id -> music_videos -> video_uid/r2_key
-- - From video: videos.track_id -> tracks
-- - All videos for track: SELECT * FROM music_videos WHERE track_id = ?
-- 
-- ============================================================================
