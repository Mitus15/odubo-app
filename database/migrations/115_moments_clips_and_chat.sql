-- =============================================================================
-- Moments: Event Clips (Video Highlights)
-- Add table for video clip highlights from events
-- =============================================================================

-- Event Clips: Video highlights captured at events
CREATE TABLE IF NOT EXISTS event_clips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    user_id TEXT,
    user_name TEXT,
    r2_key TEXT NOT NULL,
    r2_url TEXT,
    thumbnail_key TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    caption TEXT,
    view_count INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    moderated INTEGER DEFAULT 0,
    moderated_by TEXT,
    moderated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient event clip queries
CREATE INDEX IF NOT EXISTS idx_event_clips_event_id ON event_clips(event_id);
CREATE INDEX IF NOT EXISTS idx_event_clips_moderated ON event_clips(moderated);
CREATE INDEX IF NOT EXISTS idx_event_clips_is_featured ON event_clips(is_featured);
CREATE INDEX IF NOT EXISTS idx_event_clips_created_at ON event_clips(created_at);

-- Event Chat: Real-time messaging for events
CREATE TABLE IF NOT EXISTS event_chat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    user_id TEXT,
    user_name TEXT,
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    media_r2_key TEXT,
    media_url TEXT,
    is_announcement INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    reply_to_id INTEGER REFERENCES event_chat(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for chat queries
CREATE INDEX IF NOT EXISTS idx_event_chat_event_id ON event_chat(event_id);
CREATE INDEX IF NOT EXISTS idx_event_chat_created_at ON event_chat(created_at);

-- Chat Read Receipts: Track unread messages
CREATE TABLE IF NOT EXISTS event_chat_read_receipts (
    event_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    last_read_message_id INTEGER REFERENCES event_chat(id),
    PRIMARY KEY (event_id, user_id)
);

-- User Profiles: Persistent identity across events
CREATE TABLE IF NOT EXISTS moments_user_profiles (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    email TEXT,
    phone TEXT,
    instagram_handle TEXT,
    avatar_r2_key TEXT,
    avatar_url TEXT,
    bio TEXT,
    is_verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Event Participants: Track who attended
CREATE TABLE IF NOT EXISTS event_participants (
    event_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_host INTEGER DEFAULT 0,
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_participants_user ON event_participants(user_id);