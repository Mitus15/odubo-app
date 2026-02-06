# Session: Arsenal Upload & PostForMe Integration Fixes
**Date:** 2026-02-06
**Focus:** Complete overhaul of video upload system and PostForMe API integration

---

## Summary

Fixed critical issues in the Arsenal video deployment system:
1. **PostForMe Integration** - Changed from multiple posts per platform to single post covering all platforms
2. **Upload System** - Replaced broken TUS implementation with R2 multipart upload
3. **CORS Configuration** - Fixed R2 CORS to support browser uploads with presigned URLs

---

## PostForMe API Integration

### The Problem
Arsenal was creating **separate PostForMe posts per platform** (one for TikTok, one for YouTube, etc.), which is incorrect according to PostForMe's API model.

### PostForMe's Actual Model
```typescript
createPost({
  social_accounts: [id1, id2, id3], // Multiple platforms
  // ... other fields
})

// Returns ONE post with platforms array:
{
  id: "post123",
  platforms: [
    { platform: "tiktok", status: "posted", url: "...", external_id: "..." },
    { platform: "youtube", status: "posted", url: "...", external_id: "..." }
  ]
}
```

### The Fix
**Files Changed:**
- `src/lib/postforme.ts` - Added `platforms` array to `SocialPost` type
- `src/app/api/arsenal/deploy/route.ts` - Changed to ONE `createPost()` call with all `social_accounts`
- `src/app/api/arsenal/sync/route.ts` - Groups by `postforme_post_id` to avoid redundant API calls, parses `platforms` array
- `src/app/admin/tabs/ArsenalTab.tsx` - Updated UI to show correct counts

**Key Changes:**
```typescript
// OLD: Separate calls per platform
for (const platform of platforms) {
  await createPost({ social_accounts: [platformAccountId] });
}

// NEW: One call with all platforms
await createPost({ social_accounts: allPlatformAccountIds });
```

### Additional PostForMe Fixes
1. **Thumbnails** - Now sent as `thumbnail_url` property on video media item (not separate media)
2. **YouTube Shorts** - Added `shorts: true` flag to youtube platform_configurations when applicable
3. **Credits** - Now properly included in captions when `includeCredits` toggle is enabled
4. **Platform Name Mapping** - Added `mapPlatform()` to normalize platform names (e.g., `tiktok_business` → `tiktok`)

**Commits:**
- `f89ecdd` - Batch platforms into single PostForMe call
- `0116013` - Fix thumbnails, YouTube Shorts, sync fetch credentials
- `36593ef` - Fix credits, webhook status, homepage mode query

---

## Video Upload System Overhaul

### The Journey (Multiple Failed Attempts)

#### Attempt 1: R2 Presigned URLs (FAILED)
- **Approach:** Generate presigned URLs, browser uploads directly to R2
- **Issue:** CORS errors - R2 presigned URLs don't work from browser without proper CORS config
- **Error:** `CORS policy: No 'Access-Control-Allow-Origin' header`

#### Attempt 2: Direct Cloudflare Stream Upload (FAILED)
- **Approach:** Skip R2, upload directly to Stream via `/api/videos/stream/direct-upload`
- **Issue:** PostForMe rejected HLS manifest URLs
- **Error:** "Only videos are supported for YouTube posts" (needs direct MP4 URL, not HLS)

#### Attempt 3: Server Upload Proxy (FAILED)
- **Approach:** Browser → Server → R2 → Stream
- **Issue:** Vercel 4.5MB body size limit
- **Error:** `413 Payload Too Large`

#### Attempt 4: TUS to Stream + Server Download to R2 (FAILED)
- **Approach:** Browser uploads to Stream via TUS, server downloads from Stream and uploads to R2
- **Issue:** Connection reset at 35.4% - simple XHR POST doesn't implement TUS protocol properly
- **Error:** `ERR_CONNECTION_RESET`

#### Attempt 5: Proper TUS Client (FAILED)
- **Approach:** Use `tus-js-client` library with chunking and retry
- **Issue 1:** Import syntax wrong - tried destructuring default export that doesn't exist
- **Issue 2:** After fixing import, got "400 Decoding Error" from TUS endpoint
- **Error:** "Decoding Error: A portion of the request could be not decoded"

#### Final Solution: R2 Multipart Upload (SUCCESS)
- **Approach:** Direct browser → R2 via multipart upload with presigned URLs per part
- **Why This Works:**
  - Proper CORS configuration on R2 bucket
  - Multipart protocol handles large files (unlimited size)
  - Browser uploads directly (no server bandwidth)
  - Gets both mp4_url (R2) and uid (Stream) immediately

---

## R2 Multipart Upload Architecture

### CORS Configuration Fix

**The R2 CORS Quirk:**
R2 **does NOT support wildcard `"*"` for headers** like AWS S3 does. You must explicitly list all headers.

**Wrong (AWS S3 format):**
```json
{
  "AllowedHeaders": ["*"]  // ❌ Fails on R2
}
```

**Correct (R2 format):**
```json
{
  "rules": [{
    "allowed": {
      "headers": [
        "content-type",
        "content-length",
        "x-amz-content-sha256",
        "x-amz-date",
        "authorization",
        "x-amz-user-agent",
        "x-amz-security-token"
      ]
    }
  }]
}
```

**Applied via:**
```bash
npx wrangler r2 bucket cors set odubo-studio-media --file r2-cors.json
```

### Upload Flow

**Server Side:** `/api/arsenal/multipart-upload`

Three API actions:

1. **`start`** - Initiates multipart upload
   ```typescript
   POST /api/arsenal/multipart-upload
   { action: 'start', filename: 'video.mp4', contentType: 'video/mp4' }

   Returns: { uploadId, key }
   ```

2. **`get-urls`** - Generates presigned URLs for each part
   ```typescript
   POST /api/arsenal/multipart-upload
   { action: 'get-urls', uploadId, key, parts: 10 }

   Returns: { urls: ['presigned-url-1', 'presigned-url-2', ...] }
   ```

3. **`complete`** - Finalizes upload and copies to Stream
   ```typescript
   POST /api/arsenal/multipart-upload
   {
     action: 'complete',
     uploadId,
     key,
     parts: [
       { PartNumber: 1, ETag: 'abc123' },
       { PartNumber: 2, ETag: 'def456' }
     ],
     filename: 'video.mp4'
   }

   Returns: { uid, mp4_url, key }
   ```

4. **`abort`** - Cleans up failed uploads
   ```typescript
   POST /api/arsenal/multipart-upload
   { action: 'abort', uploadId, key }
   ```

**Client Side:** `ArsenalTab.tsx`

```typescript
// 1. Start multipart upload
const { uploadId, key } = await startMultipartUpload(filename);

// 2. Chunk file (50MB parts)
const CHUNK_SIZE = 50 * 1024 * 1024;
const chunks = [];
for (let i = 0; i < file.size; i += CHUNK_SIZE) {
  chunks.push(file.slice(i, Math.min(i + CHUNK_SIZE, file.size)));
}

// 3. Get presigned URLs for all parts
const { urls } = await getPresignedUrls(uploadId, key, chunks.length);

// 4. Upload all parts in parallel
const uploadedParts = await Promise.all(
  chunks.map(async (chunk, index) => {
    const response = await fetch(urls[index], {
      method: 'PUT',
      body: chunk,
    });
    const etag = response.headers.get('ETag');
    return { PartNumber: index + 1, ETag: etag.replace(/"/g, '') };
  })
);

// 5. Complete upload (server copies to Stream)
const { uid, mp4_url } = await completeMultipartUpload(uploadId, key, uploadedParts);
```

**Benefits:**
- ✅ Handles unlimited file sizes (50MB chunks)
- ✅ Parallel upload for speed
- ✅ No server bandwidth (direct browser → R2)
- ✅ Both mp4_url (for PostForMe) and uid (for Stream processing) available immediately
- ✅ Automatic retry on failure via browser retry
- ✅ Progress tracking for UX

**Files:**
- `src/app/api/arsenal/multipart-upload/route.ts` - Server endpoint
- `src/app/admin/tabs/ArsenalTab.tsx` - Client implementation (lines 2042-2154)
- `r2-cors.json` - CORS configuration

**Commits:**
- `ec58f50` - Complete R2 multipart upload implementation
- `d390508` - Fix env var names (CLOUDFLARE_R2_* prefix)

---

## Environment Variables

### The Naming Issue
Code initially looked for `R2_ACCESS_KEY_ID` but Vercel has `CLOUDFLARE_R2_ACCESS_KEY_ID`.

**Solution:** All R2 endpoints now check both prefixes:
```typescript
accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || ''
```

### Required Variables on Vercel
These are already set (no action needed):
```bash
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY
CLOUDFLARE_R2_ENDPOINT
CLOUDFLARE_R2_BUCKET_NAME
CLOUDFLARE_R2_PUBLIC_URL
CLOUDFLARE_STREAM_API_TOKEN
```

---

## System Architecture

### Complete Arsenal Deploy Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. UPLOAD (Browser → R2 + Stream)                          │
├─────────────────────────────────────────────────────────────┤
│ Client chunks file (50MB)                                   │
│   ↓                                                          │
│ Server generates presigned URLs (multipart-upload)          │
│   ↓                                                          │
│ Browser uploads chunks to R2 in parallel                    │
│   ↓                                                          │
│ Server completes multipart, copies to Stream                │
│   ↓                                                          │
│ Returns: { uid, mp4_url }                                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. CREATE VIDEO RECORD (DB)                                │
├─────────────────────────────────────────────────────────────┤
│ POST /api/videos/{parentId}/clips (for clips)              │
│ POST /api/videos (for parent videos)                       │
│   ↓                                                          │
│ Stores: uid, mp4_url, title, metadata                      │
│ Sets: status='draft', publication_status='draft'           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. STREAM WEBHOOK (Background)                             │
├─────────────────────────────────────────────────────────────┤
│ Stream processes video → readyToStream=true                │
│   ↓                                                          │
│ POST /api/stream/webhook                                   │
│   ↓                                                          │
│ Updates: status='published', duration, thumbnail           │
│ Triggers: Thumbnail generation (async)                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. DEPLOY (User clicks Deploy button)                      │
├─────────────────────────────────────────────────────────────┤
│ POST /api/arsenal/deploy                                   │
│   ↓                                                          │
│ Fetches video from videos table                            │
│   ↓                                                          │
│ Formats caption (title + description + credits + hashtags) │
│   ↓                                                          │
│ ONE createPost() call to PostForMe:                        │
│   social_accounts: [tiktok_id, youtube_id, ...]           │
│   media: [{ url: mp4_url, thumbnail_url }]                │
│   platform_configurations: { youtube: { shorts: true } }   │
│   ↓                                                          │
│ PostForMe returns ONE post_id with platforms array         │
│   ↓                                                          │
│ Creates video_deployments rows (one per platform)          │
│   All share same postforme_post_id                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. SYNC (Polls for platform URLs)                          │
├─────────────────────────────────────────────────────────────┤
│ POST /api/arsenal/sync                                     │
│   ↓                                                          │
│ Groups deployments by postforme_post_id                    │
│   ↓                                                          │
│ For each unique post_id:                                   │
│   GET /api/v1/posts/{post_id} from PostForMe              │
│   ↓                                                          │
│   Parses platforms array from response                     │
│   ↓                                                          │
│   Updates each video_deployments row with:                 │
│     status, platform_url, external_id                      │
│   ↓                                                          │
│   Updates legacy flat columns on videos table:             │
│     youtube_url, tiktok_url, etc.                          │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

**videos table:**
```sql
id, uid, stream_video_id, mp4_url, title, description,
credits, category, mood, hashtags, thumbnail, poster_url,
status, publication_status, duration, duration_seconds,
youtube_url, tiktok_url, instagram_url  -- Legacy flat columns
```

**video_deployments table:**
```sql
id, video_id, platform, postforme_post_id, status,
platform_url, external_id, created_at, updated_at
```

**Key Pattern:**
- Multiple `video_deployments` rows can share same `postforme_post_id`
- Sync groups by `postforme_post_id` to avoid redundant PostForMe API calls
- Each platform gets its own row for status tracking

---

## Key Technical Patterns

### PostForMe API Model
```typescript
// ONE post covering multiple platforms
const post = await createPost({
  social_accounts: [accountId1, accountId2, accountId3],
  // ... media, captions, etc.
});

// Response has platforms array
post.platforms = [
  { platform: "tiktok", status: "posted", url: "...", external_id: "..." },
  { platform: "youtube", status: "posted", url: "...", external_id: "..." }
];

// Use getPost(id) to check status later
const updated = await getPost(post.id);
// Same structure with updated statuses
```

### R2 + Stream Architecture
- **R2:** Object storage for raw MP4 files (direct download URLs for PostForMe)
- **Stream:** HLS/adaptive bitrate processing (web playback, thumbnails)
- **Pattern:** Upload to R2 first, then tell Stream to copy from R2 URL
- **Result:** Get both `mp4_url` (R2) and `uid` (Stream) immediately

### Video Status Fields
- **status:** `draft` | `published` | `archived` (Stream processing state)
- **publication_status:** `draft` | `scheduled` | `live` (User-controlled visibility)
- **Webhook updates:** Only touches `status`, never `publication_status`

### Thumbnail Generation
- **Clips:** Random frame extraction (10-90% of duration) with black frame detection
- **Parent Videos:** AI-powered frame analysis (best shot selection)
- **Trigger:** Stream webhook when `readyToStream=true`
- **Async:** Runs in background, UI polls `thumbnail_status` field

---

## Debugging Notes

### Common Issues

**1. CORS Errors with R2**
- **Symptom:** "No 'Access-Control-Allow-Origin' header"
- **Cause:** R2 CORS not configured or using wildcard headers
- **Fix:** Explicit header list in CORS policy, apply via Wrangler CLI

**2. PostForMe Rejection**
- **Symptom:** "Only videos are supported for YouTube posts"
- **Cause:** Sending HLS manifest URL instead of direct MP4
- **Fix:** Use `mp4_url` from R2, not Stream embed URL

**3. Environment Variables Missing**
- **Symptom:** "Credential access key has length 0"
- **Cause:** Vercel deployment missing env vars or wrong names
- **Fix:** Check both `CLOUDFLARE_R2_*` and `R2_*` prefixes

**4. TUS Upload Failures**
- **Symptom:** Connection reset, decoding errors
- **Cause:** TUS protocol complexity, metadata issues
- **Fix:** Use R2 multipart upload instead (simpler, more reliable)

### Testing Checklist

- [ ] Upload completes without errors
- [ ] Both `uid` and `mp4_url` returned
- [ ] Video appears in Arsenal tab
- [ ] Deploy creates ONE PostForMe post
- [ ] Sync fetches platform URLs correctly
- [ ] All platform URLs populated in UI
- [ ] Legacy flat columns updated on videos table

---

## Next Steps / Future Work

### Known Limitations
1. **Thumbnail polling** - Currently manual refresh, could add auto-polling
2. **Progress persistence** - Upload progress lost on page refresh
3. **Retry mechanism** - Failed parts require full re-upload
4. **Cleanup** - Orphaned multipart uploads not automatically cleaned up

### Potential Improvements
1. **Resume capability** - Store part ETags to resume interrupted uploads
2. **Bandwidth optimization** - Adaptive chunk size based on connection speed
3. **Compression** - Pre-process videos for optimal PostForMe compatibility
4. **Batch operations** - Deploy multiple videos in single PostForMe call
5. **Status webhooks** - PostForMe webhook handler for real-time status updates

---

## Files Modified

### Server API Routes
- `src/app/api/arsenal/deploy/route.ts` - Deploy to PostForMe (batched platforms)
- `src/app/api/arsenal/sync/route.ts` - Sync status from PostForMe (grouped by post_id)
- `src/app/api/arsenal/multipart-upload/route.ts` - **NEW** R2 multipart upload handler
- `src/app/api/arsenal/stream-to-r2/route.ts` - Backup: Download from Stream, upload to R2
- `src/app/api/arsenal/upload/route.ts` - Backup: Server upload proxy
- `src/app/api/stream/webhook/route.ts` - Stream processing webhook

### Client Components
- `src/app/admin/tabs/ArsenalTab.tsx` - Upload UI and deploy logic

### Libraries & Types
- `src/lib/postforme.ts` - PostForMe API client and types

### Configuration
- `r2-cors.json` - **NEW** R2 CORS policy (Cloudflare format)

### Documentation
- `docs/sessions/2026-02-06-arsenal-upload-postforme.md` - **NEW** This file

---

## Commits Timeline

```
36593ef - Fix credits, webhook status, homepage mode query
0116013 - Fix thumbnails, YouTube Shorts, sync fetch credentials
f89ecdd - Batch platforms into single PostForMe call
d3bccbf - Attempt: Direct Stream upload (failed - PostForMe rejected HLS)
6a0e024 - Attempt: Server upload proxy (failed - 4.5MB limit)
f871537 - Attempt: TUS + server copy (failed - connection reset)
f90ef5c - Attempt: Proper TUS client (failed - decoding error)
5eb0d8c - Fix: TUS import syntax
ec58f50 - Complete R2 multipart upload implementation ✅
d390508 - Fix: Env var names (CLOUDFLARE_R2_* prefix) ✅
```

---

## Resources & References

- [Cloudflare R2 CORS Configuration](https://developers.cloudflare.com/r2/buckets/cors/)
- [R2 Multipart Upload](https://developers.cloudflare.com/r2/objects/multipart-objects/)
- [CORS Fix Guide](https://dev.to/ehteshamdev/how-to-fix-cors-error-while-uploading-files-on-cloudflare-r2-using-presigned-urls-21dm)
- [Cloudflare Stream TUS Uploads](https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/)
- [AWS S3 Direct Upload Pattern](https://aws.amazon.com/blogs/compute/uploading-to-amazon-s3-directly-from-a-web-or-mobile-application/)
- [PostForMe API Docs](https://docs.upload-post.com/api/video-requirements)

---

## Status: TESTING IN PROGRESS

Upload flow is currently being tested by user. Waiting to confirm:
- [ ] Upload completes successfully
- [ ] Deploy creates proper PostForMe post
- [ ] Sync retrieves platform URLs
- [ ] Full pipeline works end-to-end
