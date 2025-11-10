-- Add separate time_text for featured pages to allow distinct display of time next to date
ALTER TABLE featured_pages ADD COLUMN time_text TEXT;
