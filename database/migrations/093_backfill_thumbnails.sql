-- Backfill poster_url and thumbnail for videos that have uid but empty thumbnails
UPDATE videos
SET
  poster_url = 'https://videodelivery.net/' || uid || '/thumbnails/thumbnail.jpg',
  thumbnail = 'https://videodelivery.net/' || uid || '/thumbnails/thumbnail.jpg',
  updated_at = datetime('now')
WHERE uid IS NOT NULL
  AND uid != ''
  AND (poster_url IS NULL OR poster_url = '');
