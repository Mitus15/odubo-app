# Arsenal System Documentation

**Arsenal** is Odubo's unified video management and social media deployment system. It handles video uploads, processing, clip generation, and cross-platform publishing via PostForMe.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Upload Flow](#upload-flow)
3. [Deploy Flow](#deploy-flow)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Integration Points](#integration-points)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Components

```
Browser Upload → R2 Storage → Cloudflare Stream → Database
                                      ↓
                              MP4 Download URL
                                      ↓
                                  PostForMe API → Social Platforms
```

### Key Services

1. **Cloudflare R2**: Object storage for source video files
2. **Cloudflare Stream**: Video transcoding and HLS delivery
3. **PostForMe**: Social media publishing API (YouTube, TikTok, Instagram)
4. **Cloudflare D1**: SQLite database for metadata

### Data Flow

1. **Upload**: Browser → R2 (multipart) → Stream (copy from R2 URL)
2. **Processing**: Stream transcodes → HLS for web + MP4 download for social
3. **Deploy**: PostForMe fetches MP4 → Publishes to platforms

---

## Upload Flow

### Step 1: Client-Side Upload (Arsenal Tab)

**File:** `src/app/admin/tabs/ArsenalTab.tsx`

1. User selects video file
2. Client detects source format (MOV, AVI, MP4, etc.)
3. File is split into 50MB chunks
4. Multipart upload to R2 via API

### Step 2: Multipart Upload to R2

**Endpoint:** `POST /api/arsenal/multipart-upload`

**Actions:**

#### `action: "start"`
- Creates multipart upload session in R2
- Generates unique key: `videos/source/YYYY/MM/timestamp-filename.mp4`
- **Always uses `.mp4` extension** (even if source is MOV/AVI)
- Returns: `uploadId`, `key`

#### `action: "get-urls"`
- Generates presigned URLs for each chunk
- Returns array of upload URLs (1 per chunk)

#### `action: "complete"`
- Completes multipart upload in R2
- Copies video to Cloudflare Stream via `/stream/copy` API
- **Enables MP4 downloads** on Stream
- **Polls for download URL** (up to 30 seconds)
- Returns:
  ```json
  {
    "uid": "stream-video-id",
    "mp4_url": "https://customer-xxx.cloudflarestream.com/.../downloads/default.mp4",
    "key": "videos/source/2026/02/...",
    "source_format": "mov"
  }
  ```

**Critical:** The `mp4_url` is the **Stream MP4 download URL**, not the R2 URL. This is required for PostForMe compatibility.

### Step 3: Save to Database

**Endpoint:** `POST /api/videos`

Client calls this endpoint with data from upload completion:

```json
{
  "title": "Video Title",
  "uid": "stream-video-id",
  "mp4_url": "https://customer-xxx.cloudflarestream.com/.../downloads/default.mp4",
  "url": "https://iframe.videodelivery.net/stream-video-id",
  "source_format": "mov",
  "poster_url": "...",
  "thumbnail": "..."
}
```

---

## Deploy Flow

### Overview

Deploy publishes videos to social platforms (YouTube, TikTok, Instagram) via PostForMe API.

**Endpoint:** `POST /api/arsenal/deploy`

### Key Principles

1. **One PostForMe call per video** covering all selected platforms
2. **One `video_deployments` row per platform** (all share same `postforme_post_id`)
3. **PostForMe requires direct MP4 URLs** (no HLS manifests, no MOV disguised as MP4)

### Deploy Request

```json
{
  "videoIds": [424, 425],
  "platforms": ["youtube", "tiktok", "instagram"],
  "metadata": {
    "title": "Video Title",
    "description": "Video description",
    "hashtags": ["music", "artist"],
    "youtube": {
      "madeForKids": false,
      "category": "10",
      "asShort": false
    }
  },
  "scheduleAt": "2026-02-10T12:00:00Z" // optional
}
```

### Deploy Process

1. **Fetch videos** from database
2. **Get connected social accounts** from PostForMe
3. **Map platforms** to account IDs
4. **For each video:**
   - Construct video URL (use `mp4_url` from database)
   - Build caption with title, description, hashtags, credits
   - Build platform-specific configurations
   - **Call PostForMe** `createPost()` once with all platform accounts
   - **Create `video_deployments` rows** (one per platform, same `postforme_post_id`)

### PostForMe API Call

```typescript
await createPost({
  caption: "Title\n\nDescription\n\nCredits\n\n#hashtags",
  social_accounts: ["youtube-account-id", "tiktok-account-id"],
  media: [
    {
      url: "https://customer-xxx.cloudflarestream.com/.../downloads/default.mp4",
      type: "video",
      thumbnail_url: "https://videodelivery.net/uid/thumbnails/thumbnail.jpg"
    }
  ],
  platform_configurations: {
    youtube: {
      title: "Video Title",
      privacy_status: "public",
      made_for_kids: false,
      category_id: "10",
      shorts: false
    }
  }
});
```

### PostForMe Response

```json
{
  "id": "post-123",
  "status": "published",
  "platforms": [
    {
      "platform": "youtube",
      "status": "published",
      "url": "https://youtube.com/watch?v=xxx",
      "external_id": "xxx"
    },
    {
      "platform": "tiktok",
      "status": "processing",
      "url": null,
      "external_id": null
    }
  ]
}
```

### Database Updates

For each platform in the response, create a `video_deployments` row:

```sql
INSERT INTO video_deployments (
  video_id,
  platform,
  postforme_post_id,
  external_url,
  external_id,
  status,
  deployed_at
) VALUES (
  424,
  'youtube',
  'post-123',
  'https://youtube.com/watch?v=xxx',
  'xxx',
  'published',
  '2026-02-07T...'
);
```

---

## Database Schema

### `videos` Table

```sql
CREATE TABLE videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT,                    -- Cloudflare Stream UID
  title TEXT NOT NULL,
  mp4_url TEXT,                -- Stream MP4 download URL (for PostForMe)
  source_format TEXT,          -- Original format: mov, mp4, avi, mkv, etc.
  url TEXT,                    -- HLS/iframe URL (for web playback)
  poster_url TEXT,
  thumbnail TEXT,
  duration INTEGER,
  duration_seconds REAL,
  parent_video_id INTEGER,     -- NULL = parent video, NOT NULL = clip
  category TEXT,
  type TEXT,
  mood TEXT,
  credits TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Key Fields:**
- `uid`: Stream video ID
- `mp4_url`: **Must be Stream MP4 download URL** for PostForMe compatibility
- `source_format`: Track original format (mov, avi, etc.) to identify non-MP4 sources
- `parent_video_id`: NULL for parent videos, references parent ID for clips

### `video_deployments` Table

```sql
CREATE TABLE video_deployments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  platform TEXT NOT NULL,             -- youtube, tiktok, instagram
  postforme_post_id TEXT,             -- PostForMe post ID (shared across platforms)
  external_url TEXT,                  -- Platform-specific URL
  external_id TEXT,                   -- Platform-specific video ID
  status TEXT,                        -- published, processing, failed
  deployed_at TIMESTAMP,
  FOREIGN KEY (video_id) REFERENCES videos(id)
);
```

**Key Principles:**
- One row per platform
- Multiple rows can share the same `postforme_post_id` (one PostForMe call, multiple platforms)
- `external_url` and `external_id` populated after platform confirms publish

---

## API Endpoints

### Upload Endpoints

#### `POST /api/arsenal/multipart-upload`
**Purpose:** Handle chunked video uploads to R2 and Stream

**Actions:**
- `start`: Initiate multipart upload
- `get-urls`: Get presigned URLs for chunks
- `complete`: Finalize upload, copy to Stream, enable downloads
- `abort`: Cancel upload

**Returns:** `uid`, `mp4_url` (Stream download URL), `key`, `source_format`

#### `POST /api/videos`
**Purpose:** Create video record in database

**Accepts:** Video metadata including `uid`, `mp4_url`, `source_format`

### Deploy Endpoints

#### `POST /api/arsenal/deploy`
**Purpose:** Deploy videos to social platforms via PostForMe

**Request:**
```json
{
  "videoIds": [424],
  "platforms": ["youtube", "tiktok"],
  "metadata": { ... },
  "scheduleAt": "2026-02-10T12:00:00Z"
}
```

**Response:**
```json
{
  "message": "Deployed 1 video(s) to 2 platform(s)",
  "results": [
    {
      "videoId": 424,
      "platforms": ["youtube", "tiktok"],
      "success": true,
      "postId": "post-123"
    }
  ]
}
```

#### `GET /api/arsenal/sync`
**Purpose:** Sync deployment status from PostForMe

- Groups deployments by `postforme_post_id`
- Fetches latest status from PostForMe
- Updates `video_deployments` with platform URLs/status

### Clip Generation

#### `POST /api/videos/[id]/clips`
**Purpose:** Generate clips from parent video using Cloudflare Stream clipping API

**Request:**
```json
{
  "clips": [
    {
      "title": "Intro",
      "start": 0,
      "end": 30,
      "mood": "energetic",
      "category": "teaser"
    }
  ]
}
```

**Process:**
1. Calls Stream clipping API for each clip
2. Enables MP4 downloads on each clip
3. Waits for download URLs
4. Creates video records with parent reference

---

## Integration Points

### Cloudflare Stream

**Purpose:** Video transcoding, HLS delivery, MP4 downloads

**Key Operations:**

1. **Copy from URL:**
   ```typescript
   POST /accounts/{account_id}/stream/copy
   {
     "url": "https://media.odubo.studio/videos/source/...",
     "meta": { "name": "Video Title" }
   }
   ```

2. **Enable Downloads:**
   ```typescript
   POST /accounts/{account_id}/stream/{uid}/downloads
   { "id": "default" }
   ```

3. **Get Download URL:**
   ```typescript
   GET /accounts/{account_id}/stream/{uid}/downloads
   // Returns: { result: { default: { status: "ready", url: "..." } } }
   ```

**URLs:**
- HLS Playback: `https://videodelivery.net/{uid}/manifest/video.m3u8`
- Iframe Embed: `https://iframe.videodelivery.net/{uid}`
- **MP4 Download**: `https://customer-{id}.cloudflarestream.com/{uid}/downloads/default.mp4`

### PostForMe API

**Purpose:** Social media publishing

**Library:** `src/lib/postforme.ts`

**Key Functions:**

```typescript
// Get connected social accounts
const { data: accounts } = await getAccounts();

// Create post (one call for multiple platforms)
const { data: post } = await createPost({
  caption: string,
  social_accounts: string[],
  media: Array<{ url: string, type: 'video', thumbnail_url?: string }>,
  platform_configurations?: Record<string, any>,
  schedule_at?: string
});

// Get post status
const { data: post } = await getPost(postId);
// Returns: { id, status, platforms: [...] }
```

**Platform Mapping:**
- PostForMe may return `tiktok_business` → normalize to `tiktok` via `mapPlatform()`

**Critical Requirements:**
- **Direct MP4 URLs only** (no HLS manifests)
- **Real MP4 format** (not MOV disguised as .mp4)
- Stream download URLs meet both requirements ✅

---

## Troubleshooting

### Issue: "Failed to post all media. Failed to process. Please check media URLs"

**Cause:** PostForMe received non-MP4 URL or HLS manifest

**Solutions:**
1. Check `mp4_url` in database points to Stream download URL:
   ```sql
   SELECT mp4_url FROM videos WHERE id = 424;
   -- Should be: https://customer-xxx.cloudflarestream.com/.../downloads/default.mp4
   -- NOT: https://media.odubo.studio/... (R2 URL)
   -- NOT: https://videodelivery.net/.../manifest/video.m3u8 (HLS)
   ```

2. Check source format:
   ```sql
   SELECT source_format, mp4_url FROM videos WHERE id = 424;
   -- If source_format = 'mov', ensure mp4_url is Stream download URL
   ```

3. Backfill if needed:
   ```bash
   npm run mp4:backfill -- --videos
   ```

### Issue: Stream Download Not Ready

**Cause:** Stream takes time to generate MP4 downloads (especially for large files)

**Solutions:**
1. Upload endpoint waits up to 30s automatically
2. For backfill, script waits up to 60s per video
3. Large files (>1GB) may take 2-3 minutes - run backfill again later

### Issue: Authentication Errors

**Cause:** Invalid or missing Cloudflare tokens

**Solutions:**
1. Check environment variables:
   ```bash
   CLOUDFLARE_ACCOUNT_ID=835a09fb1a9d192ae03fc64b602fcc47
   CLOUDFLARE_STREAM_API_TOKEN=xxx
   CLOUDFLARE_D1_API_TOKEN=xxx
   DATABASE_URL=https://api.cloudflare.com/client/v4/accounts/.../d1/database/...
   ```

2. Update Vercel environment variables:
   ```bash
   vercel env add CLOUDFLARE_D1_API_TOKEN production
   ```

3. Redeploy:
   ```bash
   git commit --allow-empty -m "trigger deploy" && git push
   ```

### Issue: Missing lucide-react Dependency

**Cause:** TranscodingProgress component needs lucide-react

**Solution:**
```bash
npm install lucide-react
git add package.json package-lock.json
git commit -m "fix: add lucide-react dependency"
git push
```

---

## Scripts & Commands

### Backfill MP4 URLs

```bash
# Dry run (see what would change)
npm run mp4:backfill -- --dry-run

# Backfill parent videos
npm run mp4:backfill -- --videos

# Backfill clips
npm run mp4:backfill -- --clips

# Backfill everything
npm run mp4:backfill

# Limit to N videos (for testing)
npm run mp4:backfill -- --limit=5
```

### Database Queries

```bash
# Check video formats
npx wrangler d1 execute odubo --remote --command="
  SELECT source_format, COUNT(*) as count
  FROM videos
  GROUP BY source_format
"

# Find videos without Stream MP4 URLs
npx wrangler d1 execute odubo --remote --command="
  SELECT id, title, source_format, mp4_url
  FROM videos
  WHERE mp4_url NOT LIKE '%cloudflarestream.com%downloads%'
  LIMIT 10
"

# Check deployment status
npx wrangler d1 execute odubo --remote --command="
  SELECT v.id, v.title, d.platform, d.status, d.external_url
  FROM videos v
  JOIN video_deployments d ON v.id = d.video_id
  WHERE v.id = 424
"
```

---

## Best Practices

### When Uploading Videos

1. **Always capture source format** on upload
2. **Wait for Stream MP4 download URL** before saving to database
3. **Use Stream download URL** as `mp4_url` (not R2 URL)
4. **Test with small files first** when making upload changes

### When Deploying Videos

1. **Verify `mp4_url` format** before deploying
2. **Check PostForMe account connections** first
3. **Use descriptive titles and captions** for better social performance
4. **Monitor deployment status** via sync endpoint

### When Making Changes

1. **Test locally** with real uploads
2. **Document in this file** for future reference
3. **Update backfill scripts** if schema changes
4. **Never clear .env.local** without backing up first ⚠️

---

## Future Improvements

- [ ] Auto-retry Stream download polling if not ready
- [ ] Background worker for clip generation
- [ ] Batch deployment to reduce API calls
- [ ] Analytics integration for post performance
- [ ] Automated caption generation via AI
- [ ] Video compression before upload for bandwidth savings

---

**Last Updated:** 2026-02-07
**Maintainer:** Odubo Engineering Team
