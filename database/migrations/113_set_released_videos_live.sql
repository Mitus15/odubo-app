-- Set all released videos and their clips to live
-- Covers: K-Town (424), Pinnochio (438), David In The City (439), Alone (440), Pour Salem (441)

-- Fix Pinnochio is_public
UPDATE videos SET is_public = 1, updated_at = datetime('now')
WHERE id = 438 AND is_public = 0;

-- Set Alone clips to live (460-469)
UPDATE videos SET publication_status = 'live', is_public = 1, updated_at = datetime('now')
WHERE parent_video_id = 440 AND publication_status != 'live';

-- Set Pour Salem clips to live (470-479)
UPDATE videos SET publication_status = 'live', is_public = 1, updated_at = datetime('now')
WHERE parent_video_id = 441 AND publication_status != 'live';
