# Arsenal Upload System

## Quick Reference

**Endpoint:** `/api/arsenal/multipart-upload`
**Client:** `src/app/admin/tabs/ArsenalTab.tsx` (lines 2042-2154)
**Architecture:** Direct browser → R2 multipart upload → Stream copy

---

## Flow Diagram

```
┌─────────────┐
│   Browser   │
└─────┬───────┘
      │ 1. Start upload
      ↓
┌─────────────────────────────────────┐
│ POST /api/arsenal/multipart-upload  │
│ { action: 'start', filename, type } │
└─────┬───────────────────────────────┘
      │ Returns: { uploadId, key }
      ↓
┌─────────────┐
│   Browser   │ Chunks file (50MB)
└─────┬───────┘
      │ 2. Get presigned URLs
      ↓
┌─────────────────────────────────────┐
│ POST /api/arsenal/multipart-upload  │
│ { action: 'get-urls', uploadId,     │
│   key, parts: 10 }                  │
└─────┬───────────────────────────────┘
      │ Returns: { urls: [...] }
      ↓
┌─────────────┐
│   Browser   │ Uploads parts to R2 (parallel)
└─────┬───────┘
      │ PUT to each presigned URL
      │ Collects ETags
      ↓
┌───────────────────────┐
│  Cloudflare R2        │
│  (Object Storage)     │
└───────────────────────┘
      │ 3. Complete upload
      ↓
┌─────────────┐
│   Browser   │
└─────┬───────┘
      │
      ↓
┌─────────────────────────────────────┐
│ POST /api/arsenal/multipart-upload  │
│ { action: 'complete', uploadId,     │
│   key, parts: [{PartNumber, ETag}] }│
└─────┬───────────────────────────────┘
      │ Completes multipart upload
      │ Tells Stream to copy from R2
      ↓
┌───────────────────────┐
│  Cloudflare Stream    │
│  (Video Processing)   │
└───────────────────────┘
      │ Returns: { uid, mp4_url, key }
      ↓
┌─────────────┐
│   Browser   │ Creates video record in DB
└─────────────┘
```

---

## API Actions

### 1. Start Upload

**Request:**
```typescript
POST /api/arsenal/multipart-upload
{
  action: 'start',
  filename: 'video.mp4',
  contentType: 'video/mp4'
}
```

**Response:**
```typescript
{
  success: true,
  uploadId: 'abc123...',
  key: 'videos/source/2026/02/1738876543-video.mp4'
}
```

**What it does:**
- Calls `CreateMultipartUploadCommand` on R2
- Generates unique key with timestamp and date hierarchy
- Returns upload ID for subsequent requests

---

### 2. Get Presigned URLs

**Request:**
```typescript
POST /api/arsenal/multipart-upload
{
  action: 'get-urls',
  uploadId: 'abc123...',
  key: 'videos/source/2026/02/1738876543-video.mp4',
  parts: 10
}
```

**Response:**
```typescript
{
  success: true,
  urls: [
    'https://r2-presigned-url-part-1...',
    'https://r2-presigned-url-part-2...',
    // ... 10 URLs total
  ]
}
```

**What it does:**
- Generates presigned URL for each part (1 to N)
- Each URL allows PUT request for that part number
- URLs expire in 3600 seconds (1 hour)

---

### 3. Complete Upload

**Request:**
```typescript
POST /api/arsenal/multipart-upload
{
  action: 'complete',
  uploadId: 'abc123...',
  key: 'videos/source/2026/02/1738876543-video.mp4',
  parts: [
    { PartNumber: 1, ETag: 'etag1...' },
    { PartNumber: 2, ETag: 'etag2...' },
    // ... all parts
  ],
  filename: 'video.mp4'
}
```

**Response:**
```typescript
{
  success: true,
  uid: 'stream-video-uid',
  mp4_url: 'https://media.odubo.studio/videos/source/2026/02/1738876543-video.mp4',
  key: 'videos/source/2026/02/1738876543-video.mp4'
}
```

**What it does:**
1. Calls `CompleteMultipartUploadCommand` on R2
2. Calculates public mp4_url from key
3. Tells Cloudflare Stream to copy video from R2 URL
4. Returns both uid (Stream) and mp4_url (R2)

---

### 4. Abort Upload (On Failure)

**Request:**
```typescript
POST /api/arsenal/multipart-upload
{
  action: 'abort',
  uploadId: 'abc123...',
  key: 'videos/source/2026/02/1738876543-video.mp4'
}
```

**Response:**
```typescript
{
  success: true
}
```

**What it does:**
- Calls `AbortMultipartUploadCommand` on R2
- Cleans up partial upload (frees storage)
- Should be called on any failure during upload

---

## Client Implementation

### File Chunking

```typescript
const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB
const totalParts = Math.ceil(file.size / CHUNK_SIZE);
const chunks: Blob[] = [];

for (let partNum = 0; partNum < totalParts; partNum++) {
  const start = partNum * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, file.size);
  chunks.push(file.slice(start, end));
}
```

### Parallel Upload with Progress

```typescript
let completedParts = 0;
const uploadedParts: Array<{ PartNumber: number; ETag: string }> = [];

const uploadPromises = chunks.map(async (chunk, index) => {
  const partNumber = index + 1;
  const url = urls[index];

  const response = await fetch(url, {
    method: 'PUT',
    body: chunk,
    headers: { 'Content-Type': file.type },
  });

  if (!response.ok) {
    throw new Error(`Failed to upload part ${partNumber}`);
  }

  const etag = response.headers.get('ETag');
  if (!etag) {
    throw new Error(`No ETag returned for part ${partNumber}`);
  }

  uploadedParts[index] = {
    PartNumber: partNumber,
    ETag: etag.replace(/"/g, ''), // Remove quotes
  };

  completedParts++;
  const percentage = ((completedParts / totalParts) * 100).toFixed(1);
  setUploadProgress(`Uploading: ${percentage}%`);
});

await Promise.all(uploadPromises);
```

**Key Points:**
- Upload all parts in parallel for speed
- Track progress by counting completed parts
- Collect ETags for completion step
- Remove quotes from ETag header values

---

## CORS Configuration

**File:** `r2-cors.json`

```json
{
  "rules": [{
    "allowed": {
      "origins": [
        "https://admin.odubo.studio",
        "https://odubo.studio",
        "http://localhost:3000"
      ],
      "methods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "headers": [
        "content-type",
        "content-length",
        "x-amz-content-sha256",
        "x-amz-date",
        "authorization",
        "x-amz-user-agent",
        "x-amz-security-token"
      ]
    },
    "exposeHeaders": ["ETag"],
    "maxAgeSeconds": 3600
  }]
}
```

**Apply with:**
```bash
npx wrangler r2 bucket cors set odubo-studio-media --file r2-cors.json
```

**Critical Points:**
- ❌ Cannot use `"*"` for headers (unlike AWS S3)
- ✅ Must explicitly list all headers
- ✅ Must expose `ETag` header (needed for multipart completion)
- ✅ Must use Cloudflare format with `rules` and `allowed` objects

---

## Environment Variables

**Required (already on Vercel):**
```bash
CLOUDFLARE_ACCOUNT_ID="835a09fb1a9d192ae03fc64b602fcc47"
CLOUDFLARE_R2_ACCESS_KEY_ID="..."
CLOUDFLARE_R2_SECRET_ACCESS_KEY="..."
CLOUDFLARE_R2_ENDPOINT="https://835a09fb1a9d192ae03fc64b602fcc47.r2.cloudflarestorage.com"
CLOUDFLARE_R2_BUCKET_NAME="odubo-studio-media"
CLOUDFLARE_R2_PUBLIC_URL="https://media.odubo.studio"
CLOUDFLARE_STREAM_API_TOKEN="..."
```

**Code checks both prefixes:**
```typescript
accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
```

---

## Error Handling

### Client Side

```typescript
try {
  // Upload flow...
} catch (error) {
  // Abort multipart upload to clean up
  await fetch('/api/arsenal/multipart-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'abort', uploadId, key }),
  }).catch(console.error); // Don't throw if abort fails

  throw error; // Re-throw original error
}
```

### Common Errors

**"Credential access key has length 0"**
- Cause: Environment variables missing or wrong prefix
- Fix: Check Vercel env vars, ensure CLOUDFLARE_R2_* variables exist

**"CORS policy: No 'Access-Control-Allow-Origin'"**
- Cause: CORS not configured on R2 bucket or using wildcard headers
- Fix: Apply r2-cors.json via Wrangler CLI

**"No ETag returned for part N"**
- Cause: R2 didn't return ETag header (shouldn't happen)
- Fix: Check if part upload actually succeeded, retry part

**"Failed to copy to Stream"**
- Cause: Stream can't access R2 URL or video format unsupported
- Fix: Check mp4_url is publicly accessible, check Stream API logs

---

## Performance Characteristics

**Upload Speed:**
- Parallel uploads significantly faster than sequential
- 50MB chunk size balances speed vs memory usage
- Typical 500MB video: ~10 parts, 2-5 minutes on good connection

**Resource Usage:**
- Browser memory: ~100MB (one chunk in memory at a time)
- Server CPU: Minimal (just generates presigned URLs)
- Server bandwidth: Zero (direct browser → R2)
- R2 costs: Standard storage + data transfer

**Scalability:**
- Supports unlimited file sizes (chunks scale)
- No Vercel function timeout (upload is client-side)
- No Vercel body size limit (bypassed via presigned URLs)

---

## Comparison to Previous Approaches

| Approach | Pros | Cons | Result |
|----------|------|------|--------|
| **R2 Presigned (simple)** | Fast, direct | CORS issues without proper config | ❌ Failed |
| **Direct Stream** | Simple | PostForMe rejects HLS URLs | ❌ Failed |
| **Server Proxy** | Full control | 4.5MB Vercel limit | ❌ Failed |
| **TUS to Stream** | Resumable | Complex, decoding errors | ❌ Failed |
| **R2 Multipart (current)** | Scalable, direct, both URLs | Requires CORS config | ✅ Success |

---

## Future Improvements

**Resume Capability**
- Store part ETags in localStorage
- On retry, check which parts already uploaded
- Only upload missing parts

**Adaptive Chunk Size**
- Detect connection speed
- Adjust chunk size dynamically (25MB on slow, 100MB on fast)

**Progress Persistence**
- Save upload state to DB
- Survive page refreshes
- Resume from where left off

**Automatic Cleanup**
- Background job to abort orphaned multipart uploads
- Free R2 storage from failed uploads

**Compression**
- Pre-process videos with FFmpeg Web Assembly
- Optimize for PostForMe platform requirements
- Reduce upload size and time
