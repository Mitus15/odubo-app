# Complete Video Flow: Upload → Deployment

**Complete journey from uploading a video to it being live on social media platforms**

---

## Phase 1: Upload (10-30 seconds)

### User Action
1. Go to Arsenal tab in admin
2. Click "Upload Video"
3. Select video file from computer
4. Fill in metadata:
   - Title
   - Artist name
   - Description
   - Credits

### What Happens

**Frontend (ArsenalTab.tsx):**
```
1. File selected → Read file format info
2. Start multipart upload:
   - Call /api/arsenal/multipart-upload (action: start)
   - Get uploadId and R2 key
3. Split file into 50MB chunks
4. Upload chunks in parallel to R2 (presigned URLs)
5. Complete upload:
   - Call /api/arsenal/multipart-upload (action: complete)
   - Wait for response (30s max)
6. Create video record:
   - Call /api/admin/videos (POST)
   - Save to database
```

**Backend (/api/arsenal/multipart-upload):**
```
1. action: start
   → Create R2 multipart upload
   → Return uploadId + key

2. action: get-urls
   → Generate presigned URLs for each chunk

3. action: complete
   → Complete R2 upload ✓
   → Copy to Cloudflare Stream ✓
   → Quick check (30s): Is Stream ready?
      - YES → Enable downloads → Return Stream MP4 URL ✓
      - NO  → Return R2 URL (temporary)
   → Trigger background job
   → Return: { uid, mp4_url }
```

**Database Record Created:**
```sql
INSERT INTO videos (
  uid,              -- Stream UID (e.g., "462ef7...")
  title,
  artist_name,
  description,
  url,              -- Stream embed URL (iframe)
  mp4_url,          -- Stream MP4 URL OR R2 URL (temporary)
  mp4_processing_status,  -- 'ready' or 'pending'
  is_public,        -- 0 (not public yet)
  publication_status, -- 'archived'
  ...
)
```

### Result
- ✅ Video uploaded to R2
- ✅ Video copied to Stream
- ✅ Database record created
- ✅ Small files: Have Stream MP4 URL immediately
- ⏳ Large files: Have R2 URL, being processed in background

---

## Phase 2: Background Processing (0-120 minutes)

### What Happens

**Vercel Cron Job (Every 5 minutes):**
```
/api/arsenal/process-stream-downloads runs automatically:

1. Find videos with status 'pending' or 'processing'
2. For each video:
   - Check Cloudflare Stream status
   - Is video ready?
     - NO → Skip, try again in 5 min
     - YES → Continue...
   - Enable MP4 downloads
   - Poll for download URL (up to 60 seconds)
   - Update database:
     - mp4_url = Stream MP4 URL
     - mp4_processing_status = 'ready'
3. Mark videos that timeout (> 2 hours) as 'failed'
```

**Timeline:**
- Small videos (< 100MB): Ready in 0-5 minutes
- Medium videos (100-500MB): Ready in 5-15 minutes
- Large videos (500MB-2GB): Ready in 15-60 minutes
- Huge videos (> 2GB): Ready in 60-120 minutes

### Result
- ✅ Video has Stream MP4 download URL
- ✅ Ready for deployment to social media
- ✅ Status: 'ready'

**You can monitor:**
```bash
npm run mp4:monitor
```

---

## Phase 3: Deployment Setup (User Action)

### User Action
1. Go to Arsenal tab
2. Find video in list
3. Click "Deploy" button
4. **Deployment Modal Opens:**
   - Select platforms: ☑ YouTube ☑ TikTok ☑ Instagram
   - Configure per-platform settings:
     - YouTube: Title, privacy (public/unlisted), category
     - TikTok: Allow duet/stitch settings
     - Instagram: Placement (Reels/Stories/Feed)
   - Set caption (shared across platforms)
   - Schedule: Now or pick date/time
5. Click "Deploy"

### What Happens

**Frontend:**
```javascript
// User clicks "Deploy"
const response = await fetch('/api/arsenal/deploy', {
  method: 'POST',
  body: JSON.stringify({
    video_id: 438,
    platforms: ['youtube', 'tiktok', 'instagram'],
    caption: "Pinnochio is in K-Town\n\nProd. By Mani Odubo",
    platform_configurations: {
      youtube: {
        title: "Pinnochio is in K-Town",
        privacy_status: "public",
        category_id: "10" // Music
      },
      tiktok: {
        allow_duet: true,
        allow_stitch: true
      },
      instagram: {
        placement: "REELS",
        share_to_feed: true
      }
    },
    schedule_at: "2026-02-11T18:00:00Z" // Optional
  })
});
```

**Backend (/api/arsenal/deploy):**
```
1. Verify user is admin ✓
2. Get video from database
3. Validate:
   - Video has Stream MP4 URL? ✓
   - URL is Stream download URL? ✓
   - Video not already deployed to these platforms? ✓
4. Get PostForMe social accounts for selected platforms
5. Build PostForMe request:
   - media: [{ url: video.mp4_url, type: 'video' }]
   - social_accounts: [youtube_id, tiktok_id, instagram_id]
   - caption
   - platform_configurations
   - schedule_at (if scheduled)
6. Call PostForMe API:
   POST /v1/social-posts
7. PostForMe returns:
   - post_id (e.g., "sp_NhgKb174se5XpvpBjrg")
   - status: "scheduled" or "published"
8. Create deployment records in video_deployments table:
   - One row per platform
   - All sharing same postforme_post_id
```

**Database Records Created:**
```sql
INSERT INTO video_deployments (
  video_id,           -- 438
  platform,           -- 'youtube'
  postforme_post_id,  -- 'sp_NhgKb174se5XpvpBjrg'
  status,             -- 'scheduled' or 'pending'
  scheduled_for,      -- Timestamp if scheduled
  deployed_at,        -- Current timestamp
  ...
)

-- Repeat for each platform (youtube, tiktok, instagram)
```

### Result
- ✅ PostForMe has the video
- ✅ Deployment records created
- ⏳ Waiting for PostForMe to publish
- ⏳ Need to sync platform URLs

---

## Phase 4: PostForMe Processing (0-60 minutes)

### What Happens on PostForMe Side

**If Scheduled:**
```
1. PostForMe holds the video
2. At scheduled time → Starts publishing
3. Posts to each platform's API:
   - YouTube API
   - TikTok API
   - Instagram Graph API
```

**If Immediate (Not Scheduled):**
```
1. PostForMe immediately starts publishing
2. Posts to each platform
```

**Per-Platform Timeline:**
- YouTube: 2-10 minutes (upload + processing)
- TikTok: 1-5 minutes
- Instagram: 1-5 minutes

### PostForMe Post Status Flow
```
draft/scheduled → processing → published (success)
                             → failed (error)
```

**Platform-Specific Status:**
Each platform in the post can have different status:
```javascript
{
  id: "sp_NhgKb174se5XpvpBjrg",
  status: "published", // Overall status
  platforms: [
    {
      platform: "youtube",
      status: "published",
      url: "https://youtube.com/watch?v=...",
      external_id: "abc123"
    },
    {
      platform: "tiktok",
      status: "published",
      url: "https://tiktok.com/@user/video/...",
      external_id: "xyz789"
    },
    {
      platform: "instagram",
      status: "failed",
      error: "Invalid aspect ratio"
    }
  ]
}
```

---

## Phase 5: Sync Platform URLs (Manual or Auto)

### What Happens

**Arsenal Sync Job (/api/arsenal/sync):**
```
Can be triggered:
- Manually: User clicks "Sync" in Arsenal
- Automatically: Could add to cron (not implemented yet)

1. Find all deployments with postforme_post_id but no external_url
2. Group by postforme_post_id (avoid duplicate API calls)
3. For each PostForMe post:
   - Call PostForMe API: GET /social-posts/{post_id}
   - Get per-platform status and URLs
   - Update video_deployments table:
     - external_url (YouTube/TikTok/Instagram URL)
     - external_id
     - status: 'synced'
   - Update legacy columns on videos table:
     - youtube_url or youtube_shorts_url
     - tiktok_url
     - instagram_reels_url
   - Make video public:
     - is_public = 1
     - publication_status = 'live'
```

**Database Updates:**
```sql
-- video_deployments table
UPDATE video_deployments
SET external_url = 'https://youtube.com/watch?v=abc123',
    external_id = 'abc123',
    status = 'synced',
    synced_at = NOW()
WHERE id = 123

-- videos table (legacy compatibility)
UPDATE videos
SET youtube_shorts_url = 'https://youtube.com/watch?v=abc123',
    is_public = 1,
    publication_status = 'live',
    postforme_post_id = 'sp_NhgKb174se5XpvpBjrg',
    postforme_status = 'published'
WHERE id = 438
```

### Result
- ✅ Platform URLs saved in database
- ✅ Video marked as public
- ✅ Video appears on your website (clips feed)
- ✅ Links to social media posts work

---

## Phase 6: Live on Social Media ✅

### Final State

**Database:**
```sql
-- videos table
id: 438
title: "Pinnochio is in K-Town"
uid: "462ef7147819d19406c41eaa44882daa"
mp4_url: "https://customer-xxx.cloudflarestream.com/.../downloads/default.mp4"
mp4_processing_status: "ready"
is_public: 1
publication_status: "live"
youtube_shorts_url: "https://youtube.com/watch?v=..."
tiktok_url: "https://tiktok.com/@maniodubo/video/..."
instagram_reels_url: "https://instagram.com/p/..."

-- video_deployments table (3 rows, one per platform)
video_id: 438
platform: "youtube"
postforme_post_id: "sp_NhgKb174se5XpvpBjrg"
external_url: "https://youtube.com/watch?v=..."
status: "synced"

video_id: 438
platform: "tiktok"
postforme_post_id: "sp_NhgKb174se5XpvpBjrg"
external_url: "https://tiktok.com/@maniodubo/video/..."
status: "synced"

video_id: 438
platform: "instagram"
postforme_post_id: "sp_NhgKb174se5XpvpBjrg"
external_url: "https://instagram.com/p/..."
status: "synced"
```

**Live Everywhere:**
- ✅ YouTube: Video live on channel
- ✅ TikTok: Video live on profile
- ✅ Instagram: Reel live on profile
- ✅ Your Website: Video in clips feed (odubo.studio)

---

## Complete Timeline

**From upload to live:**

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Upload                           10-30 seconds     │
├─────────────────────────────────────────────────────────────┤
│ Phase 2: Background Processing            0-120 minutes     │
│          (Small files: 0-5 min, Large: 60+ min)             │
├─────────────────────────────────────────────────────────────┤
│ Phase 3: Deployment Setup                 1-2 minutes       │
│          (User configures and clicks deploy)                │
├─────────────────────────────────────────────────────────────┤
│ Phase 4: PostForMe Processing             2-10 minutes      │
│          (Uploads to platforms)                             │
├─────────────────────────────────────────────────────────────┤
│ Phase 5: Sync Platform URLs               30 seconds        │
│          (Get URLs from PostForMe)                          │
├─────────────────────────────────────────────────────────────┤
│ Phase 6: LIVE ✅                                            │
└─────────────────────────────────────────────────────────────┘

BEST CASE (small video, no scheduling):
  Upload (30s) → Ready (5m) → Deploy (2m) → PostForMe (5m) → Sync (30s)
  = ~12 minutes from upload to live

TYPICAL CASE (medium video, no scheduling):
  Upload (30s) → Ready (15m) → Deploy (2m) → PostForMe (5m) → Sync (30s)
  = ~22 minutes from upload to live

WORST CASE (large video, scheduled for tomorrow):
  Upload (30s) → Ready (60m) → Deploy (2m) → Wait (24h) → PostForMe (10m) → Sync (30s)
  = 24 hours + processing time
```

---

## Key Endpoints

### Upload
- `POST /api/arsenal/multipart-upload` (start, get-urls, complete)
- `POST /api/admin/videos` (create video record)

### Background Processing
- `POST /api/arsenal/process-stream-downloads` (cron every 5min)

### Deployment
- `POST /api/arsenal/deploy` (deploy to platforms)
- `GET /api/admin/social/accounts` (get connected accounts)

### Sync
- `POST /api/arsenal/sync` (sync platform URLs)

### Monitoring
- `npm run mp4:monitor` (check MP4 processing status)
- `npx tsx scripts/audit-all-video-urls.ts` (audit URLs)

---

## Troubleshooting

### Upload stuck at "Processing..."
- Check upload didn't timeout
- Verify R2 and Stream credentials
- Check browser console for errors

### Video stuck in "pending" status
- Run: `npm run mp4:monitor`
- Check if Stream is transcoding
- Wait for background job (runs every 5 min)
- Manual trigger: `npm run mp4:backfill`

### Deploy button grayed out
- Video needs Stream MP4 URL (not R2 URL)
- Run: `npm run mp4:monitor` to check status
- If stuck, run: `npm run mp4:reset-stuck`

### Deploy succeeded but no platform URLs
- Need to sync: Click "Sync" in Arsenal
- Or call: `POST /api/arsenal/sync`
- Check PostForMe post status in logs

### Video on PostForMe but not on social media
- Check PostForMe dashboard
- Look for errors in platforms array
- Video might still be processing on platform
- Check platform-specific requirements (aspect ratio, length, etc.)

---

## Summary

**6 Phases:**
1. **Upload** → R2 + Stream (30s)
2. **Background Processing** → Stream MP4 URL ready (0-120m)
3. **Deployment Setup** → User configures and deploys (2m)
4. **PostForMe Processing** → Uploads to platforms (2-10m)
5. **Sync** → Get platform URLs (30s)
6. **LIVE** → Video on social media ✅

**Total Time:** 12 minutes (best) to 24+ hours (scheduled)

**Key Points:**
- Upload is fast (30s)
- Background job handles MP4 URL (automatic)
- Deployment triggers PostForMe (manual)
- Sync gets platform URLs (manual or auto)
- Video goes live on social media
