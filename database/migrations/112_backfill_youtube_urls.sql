-- Backfill YouTube URLs from channel "Mani Odubo Studios"
-- Channel: https://www.youtube.com/channel/UC2BnyGrYokkJr1lpAn4t0pg
-- Queried 2026-02-27 via yt-dlp

-- === FULL VIDEOS (youtube_url) ===

-- K-Town. (id 424)
UPDATE videos SET youtube_url = 'https://www.youtube.com/watch?v=mQ0IG56Xzxo' WHERE id = 424;

-- Pinnochio is in K-Town (id 438)
UPDATE videos SET youtube_url = 'https://www.youtube.com/watch?v=rU1TB2jckZ0' WHERE id = 438;

-- David In The City (id 439)
UPDATE videos SET youtube_url = 'https://www.youtube.com/watch?v=5lYD5T6PkKk' WHERE id = 439;

-- Alone (id 440)
UPDATE videos SET youtube_url = 'https://www.youtube.com/watch?v=r_ffjpX_z1o' WHERE id = 440;

-- Pour Salem (id 441)
UPDATE videos SET youtube_url = 'https://www.youtube.com/watch?v=yunwiYf8d0o' WHERE id = 441;


-- === SHORTS / CLIPS (youtube_shorts_url) ===

-- K-Town clips (parent 424)
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/bmOpbSSwIOo' WHERE id = 425; -- K-Town title → K-Town Title
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/UA86BdlFJPk' WHERE id = 426; -- K-Town Intro
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/VMj_RCm3R4M' WHERE id = 427; -- K-Town Chorus 1
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/C3Ndo_gBLNA' WHERE id = 428; -- K-Town Verse 1
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/MNUVl-ikdAk' WHERE id = 429; -- K-Town Verse 2
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/BlHjoFB9FwY' WHERE id = 430; -- K-Town Verse 3
-- K-Town Chorus 2 (id 431) — not found on YouTube Shorts
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/fsoIXUMo2zg' WHERE id = 432; -- K-Town Chorus 3
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/apband5Hs1E' WHERE id = 433; -- K-Town Outro 1
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/WbLEevFIRqM' WHERE id = 434; -- K-Town Outro 2

-- David In The City clips (parent 439)
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/gLN73bAiIKM' WHERE id = 448; -- David Intro
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/dMB1yhsq2xo' WHERE id = 449; -- David Chorus 1
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/LIycRS4tyIc' WHERE id = 450; -- David Verse 1
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/yP-3JiEJlv8' WHERE id = 451; -- David Verse 2
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/MY-qA13Yngc' WHERE id = 452; -- David Chorus 2
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/KMgRcElX_tQ' WHERE id = 453; -- In The City Transition
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/AlZpsU_fhXY' WHERE id = 454; -- In The City Intro
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/fP_Wq5n66eQ' WHERE id = 455; -- In The City Chorus 1
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/D2hVJPFwWL0' WHERE id = 456; -- In The City Verse 1
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/k0iylON-rAs' WHERE id = 457; -- In The City Kobe
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/Y1oaCgxtVwA' WHERE id = 458; -- In The City Chorus 2
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/NiXjK86R-Qg' WHERE id = 459; -- In the City For the Love

-- Alone clips (parent 440)
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/ysSldrxsfWw' WHERE id = 460; -- Alone Intro
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/_Pmb9vW1hYs' WHERE id = 461; -- Alone Title
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/3sXOZGkQJDw' WHERE id = 462; -- Alone Chorus 1
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/BfYhsWqILyo' WHERE id = 463; -- Alone Verse
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/nT9bsuREbXI' WHERE id = 464; -- Alone Chorus 2
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/_sXyh64lHtM' WHERE id = 465; -- Alone Bridge 1
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/d818_f1i9gE' WHERE id = 466; -- Alone Bridge 2
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/jbEWrfk4IPc' WHERE id = 467; -- Alone Chorus 3
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/xKRxsjfwcvc' WHERE id = 468; -- Alone Chorus 4
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/gNJ-lrUyx1I' WHERE id = 469; -- Alone Outro

-- Pour Salem clips (parent 441)
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/tUrQWHhDQ-Q' WHERE id = 470; -- Pour Salem Intro 1
UPDATE videos SET youtube_shorts_url = 'https://www.youtube.com/shorts/yNgtRxnEp7o' WHERE id = 471; -- Pour Salem Intro 2
-- Pour Salem Verse 1-4, Chorus 1-3, Outro (ids 472-479) — not yet on YouTube Shorts


-- === Also update video_deployments external_url for YouTube platform ===

UPDATE video_deployments SET external_url = 'https://www.youtube.com/watch?v=mQ0IG56Xzxo', status = 'published', synced_at = datetime('now')
WHERE video_id = 424 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/watch?v=rU1TB2jckZ0', status = 'published', synced_at = datetime('now')
WHERE video_id = 438 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/watch?v=5lYD5T6PkKk', status = 'published', synced_at = datetime('now')
WHERE video_id = 439 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/watch?v=r_ffjpX_z1o', status = 'published', synced_at = datetime('now')
WHERE video_id = 440 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/watch?v=yunwiYf8d0o', status = 'published', synced_at = datetime('now')
WHERE video_id = 441 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

-- Shorts deployments
UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/bmOpbSSwIOo', status = 'published', synced_at = datetime('now')
WHERE video_id = 425 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/UA86BdlFJPk', status = 'published', synced_at = datetime('now')
WHERE video_id = 426 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/VMj_RCm3R4M', status = 'published', synced_at = datetime('now')
WHERE video_id = 427 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/C3Ndo_gBLNA', status = 'published', synced_at = datetime('now')
WHERE video_id = 428 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/MNUVl-ikdAk', status = 'published', synced_at = datetime('now')
WHERE video_id = 429 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/BlHjoFB9FwY', status = 'published', synced_at = datetime('now')
WHERE video_id = 430 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/fsoIXUMo2zg', status = 'published', synced_at = datetime('now')
WHERE video_id = 432 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/apband5Hs1E', status = 'published', synced_at = datetime('now')
WHERE video_id = 433 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/WbLEevFIRqM', status = 'published', synced_at = datetime('now')
WHERE video_id = 434 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/gLN73bAiIKM', status = 'published', synced_at = datetime('now')
WHERE video_id = 448 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/dMB1yhsq2xo', status = 'published', synced_at = datetime('now')
WHERE video_id = 449 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/LIycRS4tyIc', status = 'published', synced_at = datetime('now')
WHERE video_id = 450 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/yP-3JiEJlv8', status = 'published', synced_at = datetime('now')
WHERE video_id = 451 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/MY-qA13Yngc', status = 'published', synced_at = datetime('now')
WHERE video_id = 452 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/KMgRcElX_tQ', status = 'published', synced_at = datetime('now')
WHERE video_id = 453 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/AlZpsU_fhXY', status = 'published', synced_at = datetime('now')
WHERE video_id = 454 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/fP_Wq5n66eQ', status = 'published', synced_at = datetime('now')
WHERE video_id = 455 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/D2hVJPFwWL0', status = 'published', synced_at = datetime('now')
WHERE video_id = 456 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/k0iylON-rAs', status = 'published', synced_at = datetime('now')
WHERE video_id = 457 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/Y1oaCgxtVwA', status = 'published', synced_at = datetime('now')
WHERE video_id = 458 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/NiXjK86R-Qg', status = 'published', synced_at = datetime('now')
WHERE video_id = 459 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/ysSldrxsfWw', status = 'published', synced_at = datetime('now')
WHERE video_id = 460 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/_Pmb9vW1hYs', status = 'published', synced_at = datetime('now')
WHERE video_id = 461 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/3sXOZGkQJDw', status = 'published', synced_at = datetime('now')
WHERE video_id = 462 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/BfYhsWqILyo', status = 'published', synced_at = datetime('now')
WHERE video_id = 463 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/nT9bsuREbXI', status = 'published', synced_at = datetime('now')
WHERE video_id = 464 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/_sXyh64lHtM', status = 'published', synced_at = datetime('now')
WHERE video_id = 465 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/d818_f1i9gE', status = 'published', synced_at = datetime('now')
WHERE video_id = 466 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/jbEWrfk4IPc', status = 'published', synced_at = datetime('now')
WHERE video_id = 467 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/xKRxsjfwcvc', status = 'published', synced_at = datetime('now')
WHERE video_id = 468 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/gNJ-lrUyx1I', status = 'published', synced_at = datetime('now')
WHERE video_id = 469 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/tUrQWHhDQ-Q', status = 'published', synced_at = datetime('now')
WHERE video_id = 470 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');

UPDATE video_deployments SET external_url = 'https://www.youtube.com/shorts/yNgtRxnEp7o', status = 'published', synced_at = datetime('now')
WHERE video_id = 471 AND platform = 'youtube' AND (external_url IS NULL OR external_url = '');
