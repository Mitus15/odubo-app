-- Migration 102: Add CASCADE delete for clips when parent video is deleted
-- SQLite doesn't allow adding FK constraints to existing tables, so we use a trigger

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS delete_clips_on_parent_delete;

-- Create trigger to auto-delete clips when parent video is deleted
CREATE TRIGGER delete_clips_on_parent_delete
AFTER DELETE ON videos
FOR EACH ROW
WHEN OLD.parent_video_id IS NULL
BEGIN
  -- Delete all clips that reference this parent video
  DELETE FROM videos WHERE parent_video_id = OLD.id;
END;
