-- Add a single-curated flag to featured pages
ALTER TABLE featured_pages ADD COLUMN is_active INTEGER DEFAULT 0;

-- Ensure only one active featured at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_featured_active_unique
ON featured_pages(is_active)
WHERE is_active = 1;
