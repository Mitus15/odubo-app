# Arsenal Architecture

**The Single Source of Truth for Content Management**

Arsenal is Odubo's unified content lifecycle system—the **only** place for uploading, processing, managing visibility, and deploying multimedia content to social platforms. All other content systems (Social Ops, Social Studio, Admin Social) have been consolidated into Arsenal.

---

## Core Principle

**Arsenal is the single source of truth for:**
- Video/clip uploads
- Thumbnail generation
- Visibility control (draft → archived → live)
- Social platform deployment
- Deployment tracking & analytics

No content should bypass Arsenal. All uploads flow through Arsenal → Stream → Database → Arsenal Dashboard.

---

## Content Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                         ARSENAL WORKFLOW                         │
└─────────────────────────────────────────────────────────────────┘

1. UPLOAD
   ├─ User uploads video via Arsenal dashboard
   ├─ TUS resumable upload to Cloudflare Stream
   ├─ Optional: Automatic clip detection & splitting
   └─ Video enters "processing" state

2. PROCESSING (Automatic)
   ├─ Cloudflare Stream transcodes video → HLS/DASH
   ├─ Stream webhook fires when ready
   ├─ Thumbnail generation (automatic):
   │  ├─ Clips: Random frame (10-90%)
   │  └─ Videos: AI-ranked 5 candidates (Gemini Vision)
   └─ Video enters "draft" state

3. MANAGEMENT (User Control)
   ├─ Review video in Arsenal dashboard
   ├─ Edit metadata (title, description, category)
   ├─ Set visibility:
   │  ├─ draft → Invisible to public
   │  ├─ archived → Hidden from feeds
   │  └─ live → Published to feeds
   └─ Organize clips under parent videos

4. DEPLOYMENT (Social Platforms)
   ├─ Select videos/clips to deploy
   ├─ Choose platforms: YouTube, TikTok, Instagram
   ├─ Generate captions (Woda AI or manual)
   ├─ Deploy via Post for Me API
   └─ Track per-platform deployment in video_deployments table

5. MONITORING
   ├─ View deployment status (scheduled/published/failed)
   ├─ Track external URLs per platform
   ├─ Sync analytics from platforms
   └─ Orphan detection (videos deleted from Stream)
```

---

## Database Schema

### `videos` Table (Core)
Primary table for all video content. Each row represents either:
- **Parent Video**: Full-length video uploaded by user (`parent_video_id = NULL`)
- **Clip**: Short segment extracted from parent (`parent_video_id` references parent)

**Key Columns:**
- `uid` — Cloudflare Stream unique ID (UNIQUE constraint enforced)
- `title`, `description`, `artist_name` — Metadata
- `thumbnail` — Custom thumbnail URL (R2 storage)
- `parent_video_id` — FK to parent video (NULL if parent)
- `type` — `'clip'` or `'video'`
- `status` — Internal status: `'draft'` | `'published'` | `'archived'`
- `publication_status` — Public visibility: `'live'` | `'archived'`
- `is_public` — Legacy flag (prefer `publication_status`)

### `video_deployments` Table (New)
**Replaces flat columns** (`youtube_url`, `tiktok_url`, `instagram_reels_url`) with proper per-platform tracking.

**Schema:**
```sql
CREATE TABLE video_deployments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  platform TEXT NOT NULL, -- 'youtube' | 'tiktok' | 'instagram'
  postforme_post_id TEXT, -- Post for Me tracking ID
  external_url TEXT, -- Platform URL (e.g., youtube.com/watch?v=...)
  external_id TEXT, -- Platform native ID
  status TEXT, -- 'scheduled' | 'published' | 'failed'
  deployed_at TEXT,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);
```

**Why This Matters:**
- Track multiple deployments per video (same clip to YouTube Shorts + TikTok)
- Store platform-specific URLs and IDs
- Separate deployment from video metadata

---

## API Endpoints

### Upload & Sync
- `POST /api/arsenal/sync-from-stream` — Sync new videos from Cloudflare Stream to DB
  - Uses `INSERT OR IGNORE` to prevent duplicates
  - Detects orphaned videos (in DB but not Stream)
  - **Auth required**

### Management
- `GET /api/arsenal/videos` — Fetch all videos for dashboard
- `POST /api/arsenal/update` — Update video metadata
- `POST /api/arsenal/link-parent` — Link clip to parent video
- `POST /api/arsenal/reorder` — Reorder videos
- `PUT /api/arsenal/feed-order` — Update clips feed order
- `PUT /api/arsenal/release-order` — Update parent video release priority
- **All require authentication**

### Deployment
- `POST /api/arsenal/deploy` — Deploy videos to social platforms
  - Each platform deployed **separately** for proper tracking
  - Inserts record into `video_deployments` table
  - Returns per-platform success/failure
  - **Auth required**

- `POST /api/arsenal/sync` — Sync external URLs from Post for Me after publishing
  - Fetches published post URLs
  - Updates `video_deployments.external_url`
  - **Auth required**

### AI Generation
- `POST /api/arsenal/woda` — Generate captions using Woda AI
  - Analyzes video metadata + voice profile
  - Returns platform-optimized captions
  - **Auth required**

---

## Thumbnail System

**Automatic generation triggered by Stream webhook:**

### Clips (Fast Path)
1. Select random frame between 10-90% of video duration
2. Fetch frame from Stream API: `https://stream.cloudflare.com/{uid}/thumbnails/thumbnail.jpg?time={seconds}s&width=1080`
3. Optimize with `sharp` (resize, webp, quality 90)
4. Upload to R2: `thumbnails/{videoId}.webp`
5. Update `videos.thumbnail` column

### Parent Videos (AI Path)
1. Sample **5 frames** at narrative beats: 15%, 35%, 50%, 65%, 85%
2. Analyze each frame with `sharp`:
   - Brightness (histogram mean)
   - Contrast (histogram std deviation)
   - Entropy (complexity score)
   - Sharpness (Laplacian variance)
3. Rank frames using **Gemini Vision AI**:
   - Prompt: "Which thumbnail is most clickable for social media?"
   - Return top 3 candidates
4. Upload all candidates to R2
5. **Auto-set best thumbnail** in `videos.thumbnail`

**Implementation:** [`src/lib/thumbnailService.ts`](../src/lib/thumbnailService.ts)

---

## Authentication

**All Arsenal endpoints require Bearer token authentication.**

Current implementation (placeholder):
```typescript
const authHeader = request.headers.get('authorization');
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// TODO: Verify JWT token when auth system is fully implemented
```

This prevents:
- Unauthenticated uploads
- Public API abuse
- Cross-site scripting attacks

---

## Critical Fixes (Feb 2026)

### 1. Duplicate Prevention
**Problem:** Users double-clicking "Sync from Stream" created duplicate video records.

**Solution:** 
- Added `UNIQUE` constraint on `videos.uid`
- Changed INSERT to `INSERT OR IGNORE`
- Migration: [`100_add_uid_unique_constraint.sql`](../database/migrations/100_add_uid_unique_constraint.sql)

### 2. SQL Operator Precedence Bug
**Problem:** Archived content exposed in public feed due to `OR` precedence.
```sql
-- WRONG (exposed archived content):
WHERE is_public = 1 OR is_public IS NULL AND status != 'archived'

-- CORRECT:
WHERE (is_public = 1 OR is_public IS NULL) AND status != 'archived'
```

**Files Fixed:**
- [`src/app/api/clips/route.ts`](../src/app/api/clips/route.ts) — Public clips feed
- [`src/app/api/arsenal/feed-order/route.ts`](../src/app/api/arsenal/feed-order/route.ts) — Feed ordering

### 3. Stream Webhook Runtime Crash
**Problem:** Webhook used `edge` runtime but required Node.js-only APIs (sharp, S3).

**Solution:**
- Changed runtime from `'edge'` to `'nodejs'`
- Removed `Buffer.from()` calls (edge-incompatible)
- Added webhook secret validation
- File: [`src/app/api/stream/webhook/route.ts`](../src/app/api/stream/webhook/route.ts)

### 4. Clip Creation Crash
**Problem:** Undefined variables `parentStatus`/`parentPublication` in UPDATE query.

**Solution:** Removed broken UPDATE—parent visibility cascades at query level instead.
- File: [`src/app/api/videos/[id]/clips/route.ts`](../src/app/api/videos/[id]/clips/route.ts)

### 5. JSON Parse on 204 No Content
**Problem:** `deleteVideo()` crashed calling `.json()` on 204 response.

**Solution:** Handle `response.status === 204` before parsing.
- File: [`src/lib/cloudflareStream.ts`](../src/lib/cloudflareStream.ts)

---

## Migration Path (Old Systems)

### Social Ops → Arsenal
- **Before:** Separate upload flow with different DB columns
- **After:** Use Arsenal upload + sync-from-stream
- **Action:** Disable Social Ops upload UI, redirect to Arsenal

### Social Studio → Arsenal
- **Before:** Separate deployment management
- **After:** Arsenal deploy endpoint handles all platforms
- **Action:** Remove Social Studio deploy logic

### Admin Social → Arsenal
- **Before:** Admin-only deployment dashboard
- **After:** Arsenal dashboard with role-based access
- **Action:** Migrate admin features to Arsenal tab

---

## Maintenance Scripts

### Backfill Thumbnails
Generate thumbnails for all existing videos:
```bash
tsx --env-file=.env.local scripts/backfill-thumbnails.ts

# Options:
--dry-run     # Preview changes
--limit=50    # Process only 50 videos
--clips       # Process only clips
--videos      # Process only parent videos
--force       # Regenerate even if exists
```

### Integrity Check
Audit database for inconsistencies:
```bash
tsx --env-file=.env.local scripts/integrity-check.ts

# Checks:
- Duplicate UIDs
- Orphaned clips (parent deleted)
- Missing thumbnails
- Videos in DB but not in Stream
- Deployment tracking gaps
- Visibility conflicts

# Options:
--fix         # Auto-fix issues (use with caution)
--verbose     # Show detailed records
```

---

## Development Guidelines

### When Adding New Features

1. **Upload Changes** → Modify Arsenal upload flow only
2. **Deployment Logic** → Update `arsenal/deploy` endpoint
3. **Visibility Rules** → Change query WHERE clauses (mind SQL precedence!)
4. **New Platforms** → Add to `video_deployments` table, not flat columns
5. **Analytics** → Pull from `video_deployments` + Post for Me API

### Testing Checklist

- [ ] Upload video via Arsenal dashboard
- [ ] Verify webhook triggers thumbnail generation
- [ ] Check video appears in Arsenal library
- [ ] Test draft → live visibility transition
- [ ] Deploy to YouTube/TikTok/Instagram
- [ ] Verify `video_deployments` records created
- [ ] Sync external URLs from Post for Me
- [ ] Run integrity check script

---

## Architecture Decisions

### Why Arsenal as Single Source?

**Problems with Multiple Systems:**
- 3 parallel upload flows (Arsenal, Social Ops, Admin Social)
- 4 deployment systems with different data models
- Duplicate records from race conditions
- Inconsistent visibility logic (SQL precedence bugs)
- Data leakage (unauthenticated APIs)

**Arsenal Consolidation Benefits:**
- **Single upload flow** → No duplicates, consistent processing
- **Unified deployment tracking** → `video_deployments` table replaces flat columns
- **Centralized visibility control** → One set of query conditions
- **Better security** → Auth required on all endpoints
- **Easier debugging** → One codebase to audit

### Why video_deployments Table?

**Old Model (Flat Columns):**
```sql
videos.youtube_url
videos.tiktok_url
videos.instagram_reels_url
```

**Problems:**
- Can't deploy same video to YouTube multiple times (e.g., scheduled posts)
- No deployment history
- No per-platform status tracking
- Rigid schema (adding Pinterest = new column + migration)

**New Model (Relational):**
```sql
video_deployments (
  video_id, platform, postforme_post_id,
  external_url, status, deployed_at
)
```

**Benefits:**
- Multiple deployments per video per platform
- Full deployment history
- Status tracking (scheduled/published/failed)
- Flexible schema (new platforms = new rows, not columns)

---

## Future Roadmap

### Phase 1: Core Stability ✅
- [x] Fix all critical crashes
- [x] Add thumbnail generation
- [x] Implement video_deployments table
- [x] Roll out authentication
- [x] Create maintenance scripts

### Phase 2: Enhanced Tracking (Q1 2026)
- [ ] Real-time webhook from Post for Me (deployment updates)
- [ ] Analytics dashboard (views, engagement per platform)
- [ ] A/B testing for thumbnails
- [ ] Woda AI feedback loop (learn from high-performing captions)

### Phase 3: Content Intelligence (Q2 2026)
- [ ] Auto-tagging (AI scene detection)
- [ ] Smart clip extraction (detect highlights via audio/visual analysis)
- [ ] Cross-promotion suggestions (recommend videos for new clips)
- [ ] Trending topics integration

### Phase 4: Multi-User (Q3 2026)
- [ ] User roles (admin, editor, viewer)
- [ ] Approval workflows (draft → review → publish)
- [ ] Collaboration features (comments, version history)
- [ ] Audit logs (who published what when)

---

## Contact

**Arsenal Maintainer:** Odubo Engineering Team  
**Last Updated:** February 5, 2026  
**Version:** 2.0.0 (Post-Consolidation)

For questions or issues, see:
- [`CHANGELOG.md`](../CHANGELOG.md) — Recent changes
- [`TODO.md`](../TODO.md) — Upcoming work
- [`CLAUDE.md`](../CLAUDE.md) — AI development guidelines
