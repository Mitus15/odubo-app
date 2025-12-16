-- Restructure featured_pages to support multiple mode-specific rows
-- Each mode (event, product, music, video, app_update) gets its own row

-- Add unique constraint on mode to ensure one row per mode
CREATE UNIQUE INDEX IF NOT EXISTS idx_featured_pages_mode_unique ON featured_pages(mode);

-- Remove old slug-based unique constraint since we now key by mode
DROP INDEX IF EXISTS idx_featured_pages_slug;

-- Update any existing rows to have mode = 'event' if not set
UPDATE featured_pages SET mode = 'event' WHERE mode IS NULL OR mode = '';

-- Ensure is_published defaults work per mode
CREATE INDEX IF NOT EXISTS idx_featured_pages_mode_published ON featured_pages(mode, is_published);
