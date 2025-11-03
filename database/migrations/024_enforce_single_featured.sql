-- Enforce a single row in featured_pages
CREATE TRIGGER IF NOT EXISTS trg_featured_pages_singleton
BEFORE INSERT ON featured_pages
BEGIN
  SELECT CASE WHEN (SELECT COUNT(*) FROM featured_pages) >= 1 THEN RAISE(ABORT, 'only one featured row allowed') END;
END;
