# Odubo Developer Audit and Operations Guide

## Executive summary

- Scope: Moments module (events/galleries), admin flows, D1 migrations, R2 integration, security, and deployment.
- Current status: Stable. Admin UI compiles and runs; Moments APIs and DB are in place; migrations applied via D1 HTTP path; R2 storage organized; audit logs and rate limits active.
- Key decisions:
  - Use D1 HTTP API with API token for queries and migrations (wrangler optional).
  - Treat “events” and “galleries” as a unified concept in the admin UI; keep both DB tables for future flexibility.
  - Strict admin gating via JWT; add D1-backed rate limiting and audit logging to sensitive endpoints.

## System overview (text diagram)

- Next.js (App Router)
  - Admin UI: `src/app/admin/tabs/MomentsTab.tsx`
  - Public flows: `src/app/moments/join`, `src/app/moments/capture`, `src/app/moments/admin`
  - API routes under `src/app/api/*`
- Cloudflare D1 (SQL over HTTP)
  - Queries via `src/lib/db.ts` with `DATABASE_URL` + `CLOUDFLARE_D1_API_TOKEN`
  - Migrations in `database/migrations/*.sql`
- Cloudflare R2 (object storage)
  - Upload URLs generated in Moments API; keys organized under `galleries/{galleryId}/...`
  - Worker utilities for thumbnails and file organization in `src/worker/*` and `scripts/*`
- Security
  - JWT admin auth (`src/lib/auth.ts`)
  - D1-backed rate limiting (`src/lib/rateLimit.ts`)
  - Audit logging (`src/lib/audit.ts`, table: `audit_logs`)

## Data model (relevant tables)

- galleries
  - id (TEXT PK), name, code (unique), description, featured (BOOLEAN), created_at
- gallery_photos
  - id (TEXT PK), gallery_id (FK galleries), url, media_type (image|video), status/moderation fields, created_at
- events
  - id (TEXT PK), name, description, starts_at, ends_at, capacity, ticket_price, is_public, status, created_by, created_at
- audit_logs
  - id, actor_user_id, ip, user_agent, route, action, payload, created_at
- rate limit storage (implementation-level table depending on code in `src/lib/rateLimit.ts`)

Indexes and FKs are defined in migrations `016_*` through `020_*` and earlier auth-related migrations.

## Moments API surface (primary endpoints)

- Galleries/events
  - GET `/api/moments/list`: List galleries with counts and featured flags
  - POST `/api/moments/create`: Create gallery/event (admin)
  - GET `/api/moments/galleries`: List galleries (admin)
  - GET|PATCH|DELETE `/api/moments/galleries/[id]`: Read/Update/Delete gallery (admin)
  - GET `/api/moments/join?code=...`: Resolve join code → gallery
- Media capture & upload
  - POST `/api/moments/upload-url`: Presigned URL for direct R2 upload
  - POST `/api/moments/record`: Record uploaded media in DB (link to gallery)
  - POST `/api/moments/thumbnail-job`: Worker-trigger for thumbnails (shared secret)
- Moderation
  - POST `/api/moments/moderate`: Approve/Reject items
- Events table endpoints
  - GET|POST `/api/moments/events`: Manage standalone events (parallel to galleries)

All admin routes require valid admin JWT; rate limiting and audit logging are applied.

## Admin UI: unified “events/galleries”

- File: `src/app/admin/tabs/MomentsTab.tsx`
- Capabilities:
  - Create, edit, update, delete galleries/events
  - Toggle featured
  - Copy join codes and shareable links
  - Quick actions to open capture and moderation pages
- Rationale: Keep UI unified now; preserve events table for future richer event features.

## Environment variables (minimum viable set)

- Application
  - NEXT_PUBLIC_APP_URL: Base URL used by client links
  - NEXT_PUBLIC_SITE_URL: Site origin for security headers (optional)
  - JWT_SECRET: Secret used for signing/validating admin JWTs
  - NODE_ENV: development|production
- Cloudflare D1
  - DATABASE_URL: D1 HTTP API endpoint for the target database (…/query)
  - CLOUDFLARE_D1_API_TOKEN: API token with D1 read/write permissions
- Cloudflare R2
  - CLOUDFLARE_R2_PUBLIC_URL: Public base URL for served objects
  - CLOUDFLARE_R2_BUCKET_NAME: Bucket name
  - CLOUDFLARE_R2_ENDPOINT: S3-compatible endpoint
  - CLOUDFLARE_R2_ACCESS_KEY_ID: Access key
  - CLOUDFLARE_R2_SECRET_ACCESS_KEY: Secret key
- Cloudflare Stream (if used)
  - CLOUDFLARE_ACCOUNT_ID
  - CLOUDFLARE_STREAM_API_TOKEN or CLOUDFLARE_API_TOKEN
  - CLOUDFLARE_STREAM_WEBHOOK_SECRET (for webhooks)
- Email (password reset/verification)
  - RESEND_API_KEY
  - RESEND_FROM_EMAIL
- Workers & media processing
  - THUMBNAIL_JOB_SECRET (protects thumbnail job endpoint)
  - FFMPEG_PATH (optional local binary path for thumbnailing scripts)
- Shopify (optional storefront integration present in repo)
  - SHOPIFY_STORE_URL
  - NEXT_PUBLIC_SHOPIFY_API_KEY
  - SHOPIFY_ADMIN_ACCESS_TOKEN
  - SHOPIFY_STOREFRONT_VERSION (default 2024-07)

See code references via `process.env` in `src/lib/db.ts`, Moments API routes, Stream helpers, and scripts under `scripts/`.

## Local development

- Prereqs: Node 18+, npm/pnpm, a D1 database and API token, R2 credentials for upload tests.
- Setup
  - Create `.env.local` with variables above (keep secrets out of VCS).
  - Ensure `DATABASE_URL` points to dev/staging D1 and token has proper scope.
- Run
  - `npm run dev` (Next.js dev server; Turbopack).
  - Admin UI at `/admin` → Moments tab.
- Migrations
  - Preferred: HTTP runner under `scripts/apply_required_migrations.mjs` (uses `DATABASE_URL` + `CLOUDFLARE_D1_API_TOKEN`).
  - Alternative: Wrangler task available: “Run D1 migration for is_admin column” for remote (Cloudflare) using `wrangler.toml`.

## Deployment

- Cloudflare Pages hosts the Next.js app.
- D1 migrations: Apply via HTTP runner or Wrangler prior to release.
- R2: Ensure bucket and public URL configured; worker functions for thumbnails can be deployed separately if needed.
- Secrets: Configure env vars in Cloudflare Pages project (production and preview).

## Security posture

- Admin auth: JWT with strict verification (jose). Admin users flagged via `users.is_admin`.
- Rate limiting: D1-backed with in-memory fallback; applied to sensitive endpoints.
- Audit logs: `audit_logs` captures actor, IP, UA, route, action, payload.
- CORS and CSP: Basic headers provided; WAF deployment guides exist in root docs.

## Operational playbooks

- Rotate tokens
  - Update Pages project environment variables (D1 token, R2 keys). Redeploy.
- Investigate abuse spikes
  - Check audit logs by route/time range; tune rate limit thresholds.
- Recover from failed migration
  - Use `scripts/apply_required_migrations.mjs` for idempotent runs; inspect `database/migrations` order.
- Verify R2 health
  - Call `/api/health/cloudflare` (checks R2 and Stream credentials).
- Verify Moments E2E
  - Create a gallery in admin → copy join link → upload a test photo/video via capture → confirm thumbnail job and moderation flow.

## End-to-end Moments flow

1) Admin creates a gallery/event → receives join code/link.
2) Guest visits join link → redirected to capture page.
3) Capture uploads directly to R2 using presigned URL from `/api/moments/upload-url`.
4) After upload, client calls `/api/moments/record` to persist metadata in D1.
5) Worker (optional) triggers `/api/moments/thumbnail-job` to create/upload thumbnails.
6) Admin moderates items via `/moments/admin` UI.

## Quality gates snapshot (as of this audit)

- Build/Typecheck: Dev server runs clean; Moments admin compiles.
- Lint: Standard config present; no blocking issues known.
- Tests: Jest config exists; few to no formal tests around Moments yet.

## Requirements coverage

- D1 migrations for Moments, audit logs: Done
- Admin JWT gating with rate limiting and audits: Done
- Moments endpoints (list/create/join/upload-url/record/moderate/galleries CRUD): Done
- R2 organization and thumbnail pipeline: Done
- Unified Moments admin UI: Done
- Formal events table + endpoints for future growth: Done
- Optional consolidation of events↔galleries at DB layer: Deferred (by design)

## Next steps (sensible, low-risk)

- Add minimal integration tests for Moments endpoints (happy path + one error case).
- Add a smoke test script that creates a gallery, uploads a small file to R2, records it, and asserts it appears in list.
- Harden `/api/moments/thumbnail-job` scheduling (retry/backoff; idempotency markers on objects).
- Document admin JWT acquisition/refresh in README.
- Consolidate env var docs across README and docs/ to single source of truth.

## Video module audit (admin page + backend)

### Overview

The video module manages on-demand videos using Cloudflare Stream for ingest/transcode/delivery and D1 as the source of truth for metadata. The Admin Videos page provides a wizard-like flow: direct upload → session creation → thumbnail candidate suggestion → finalize to persist a video row. There are also metadata-only create/update paths and Stream sync utilities.

Key files:
- Admin UI: `src/app/admin/videos/page.tsx`
- API routes: `src/app/api/videos/*`
  - Core: `videos/route.ts` (GET list, POST create, PATCH status, DELETE with R2 cleanup)
  - Item: `videos/[id]/route.ts` (GET, PUT, DELETE + Stream metadata sync/deletion)
  - Upload: `videos/upload/route.ts` (direct file upload to Stream)
  - Direct upload URL: `videos/stream/direct-upload/route.ts`
  - Upload session: `videos/upload-session/create/route.ts`, `videos/upload-session/status/route.ts`
  - Thumbnail AI: `videos/thumbnail/suggest/route.ts`, `videos/thumbnail/candidates/route.ts`
  - Finalize: `videos/finalize/route.ts`
  - Maintenance: `videos/status/route.ts`, `videos/sync-all/route.ts`, `videos/[id]/sync/route.ts`, `videos/cleanup/route.ts`, `videos/bulk-delete/route.ts`
- Stream client: `src/lib/cloudflareStream.ts`
- DB schema: `database/schema.sql` (base `videos`) + migrations `005`, `006`, `015`

### Data model

- `videos`
  - Core: id, uid, title, artist_name, description, url (prefer Stream embed), poster_url, thumbnail, duration, category, is_public, type, mood, credits (JSON text), related_projects (JSON text), status, publication_status, stream_video_id, created_at, updated_at
- `video_upload_sessions`
  - id, uid (Stream asset), meta_json (payload from admin), status lifecycle: uploaded → analyzing → awaiting_choice → finalizing → done | aborted
- `videos_thumbnail_candidates`
  - session_id, uid, url, pct, sharpness/exposure proxies, ai_score, rank, rationale
- `videos_analysis`
  - optional cache for transcript/mood/themes when AI analysis is enabled

Indexes: `idx_videos_publication_status`, `idx_video_upload_sessions_*`, `idx_videos_thumbnail_candidates_session`, `idx_videos_analysis_uid`.

### Admin UI flow

1) Create (with file):
   - Request Stream direct-upload URL (`/api/videos/stream/direct-upload`) with metadata
   - POST file to uploadURL (client → Stream)
   - Create session (`/api/videos/upload-session/create`)
   - Trigger thumbnail suggestion (`/api/videos/thumbnail/suggest`)
   - Poll candidates (`/api/videos/thumbnail/candidates`)
   - Finalize (`/api/videos/finalize`) to insert into `videos` with embed/thumbnail URLs
2) Create (metadata-only) or Update:
   - POST/PUT to `/api/videos` or `/api/videos/[id]`, optional Stream metadata sync
3) Maintenance:
   - Sync single/all to Stream, check status, cleanup, or delete with best-effort R2/Stream asset deletion

Security measures in UI calls:
- Admin gating (JWT) enforced in API handlers
- Rate limits on sensitive endpoints (upload, session, suggest)

### API surface (summary)

- GET `/api/videos`: list with fallback to older schema, cache headers
- POST `/api/videos`: metadata-only create (admin)
- PATCH `/api/videos`: status update (admin)
- DELETE `/api/videos`: delete by id in body (admin, cleans R2 keys if applicable)
- GET `/api/videos/[id]`, PUT `/api/videos/[id]`, DELETE `/api/videos/[id]`
- POST `/api/videos/stream/direct-upload`: Stream direct upload URL (admin, RL)
- POST `/api/videos/upload`: direct upload via server as fallback (admin, RL)
- POST `/api/videos/upload-session/create`: create upload session (admin, RL)
- GET `/api/videos/upload-session/status`: check processing status (admin)
- POST `/api/videos/thumbnail/suggest`: generate candidates via sharp + optional Gemini (admin)
- GET `/api/videos/thumbnail/candidates`: read back top-ranked candidates (admin)
- POST `/api/videos/finalize`: insert video row, set Stream thumbnailTimestampPct if chosen (admin)
- GET `/api/videos/status`: fetch Stream processing status (admin)
- POST `/api/videos/sync-all`, POST `/api/videos/[id]/sync`: metadata sync helpers
- POST `/api/videos/cleanup`, DELETE `/api/videos/bulk-delete`: maintenance utilities

### Environment and credentials

Required for Stream integration:
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_STREAM_API_TOKEN or CLOUDFLARE_API_TOKEN
- NEXT_PUBLIC_SITE_URL (optional: CORS allowedOrigins for Stream)

General app variables (reuse): JWT_SECRET, DATABASE_URL, CLOUDFLARE_D1_API_TOKEN.

Optional AI:
- GEMINI_API_KEY (enables AI ranking in thumbnail suggest; gracefully degrades when absent)

### Security posture (video)

Strengths:
- Admin gating consistently applied to create/update/delete and all session/thumbnail actions
- Rate limiting applied to hot endpoints (upload, direct-upload, session-create)
- Best-effort cleanup of R2 objects and Stream assets on delete

Gaps:
- Audit logging not consistently recorded for all video actions (create/update/delete/finalize/sync). Add `writeAuditLog` calls with actor, IP, UA, and resource id.
- Some maintenance endpoints may need stricter scoping/confirmation (e.g., bulk-delete)
- If signed URLs are required (is_public=false), ensure consumer routes enforce signature validation consistently when using HLS URLs (currently using Stream embed which handles auth via Stream settings)

### Performance and resilience

Strengths:
- Direct upload to Stream reduces server bandwidth and improves reliability
- Polling pattern for processing progress, resilient to temporary failures
- Lazy metadata sync to Stream on PUT to keep external state updated

Gaps / improvements:
- Add resumable upload handling feedback in UI (Stream supports; UI assumes single POST to uploadURL)
- Add background job/retry for finalize failures; mark sessions abandoned after TTL and surface admin cleanup
- Cache `/api/videos` list with revalidation hooks on mutate; consider pagination/search params at UI level
- Consider server actions or RSC data fetching for admin list to reduce client-overfetch on slow networks

### Findings (code quality)

- Validation: zod used on create/update; good. Ensure uniform parsing for booleans and JSON fields
- Types: Admin UI normalizes fields defensively; consider extracting a shared Video type in `src/types`
- Error handling: API returns consistent JSON; UI shows simple alerts—add inline toasts and retries
- Observability: Add audit logs and optionally lightweight metrics (counts per action)

### Recommendations (actionable)

1) Add audit logging to all video admin endpoints (create, update, delete, upload-session, suggest, finalize, sync)
2) Add minimal tests:
   - GET /api/videos returns array and respects schema fallback
   - POST /api/videos (metadata-only) creates row with publication_status
   - Finalize flow: insert a fake session and ensure finalize writes a row
3) Enhance UI status: surface processing state, candidate count, and finalize errors as toasts
4) Pagination/search/sort on Admin list; add filter by publication_status (live/archived)
5) Add a cleanup job for stale `video_upload_sessions` (>24h without finalize)

### Operational playbooks (video)

- Sync a single video to Stream: POST `/api/videos/[id]/sync`
- Diagnose stuck processing: GET `/api/videos/status?streamVideoId=...`; if error, re-upload or contact Stream support
- Clear stale sessions: mark `video_upload_sessions.status='aborted'` and re-run upload
- Remove a video entirely: DELETE `/api/videos/[id]` (best-effort R2+Stream cleanup)

### Quality gates snapshot (video)

- Build/Typecheck: PASS (admin page compiles; APIs load under Node runtime)
- Lint: PASS (no blocking rules observed in changed files)
- Tests: MISSING (add minimal integration coverage as above)

### Requirements coverage (video)

- Admin upload via Stream direct URL: Done
- Thumbnail suggestion with AI assist: Done (degrades when no key)
- Finalize and persist to D1: Done
- Metadata-only create/update/delete: Done
- Stream metadata sync helpers: Done
- Audit logs on all actions: Deferred (recommend add now)

## Thumbnail pipeline audit

### Current state

- Candidate generation
  - Source: Cloudflare Stream frames via temporary thumbnail URLs.
  - Implementation: `src/app/api/videos/thumbnail/suggest/route.ts` samples ~12–16 timestamps, fetches images, scores with sharp-based metrics (brightness, contrast, entropy) and a Laplacian-clarity proxy; sorts and optionally re-ranks with Gemini when GEMINI_API_KEY is set.
  - Persistence: Top candidates (<=3) stored in `videos_thumbnail_candidates` with score attributes and rank; session moves to `awaiting_choice`.
- Selection and finalize
  - Admin UI (`AdminVideosPage`) shows candidates and lets the user pick; the finalize endpoint sets `thumbnailTimestampPct` on Stream (best-effort), inserts a row in `videos`, and records Stream embed and thumbnail URLs.
  - Session status moves to `done` after finalize.
- Session lifecycle
  - Created in `video_upload_sessions`; we now have a cleanup endpoint to abort stale sessions (>24h) and prune very old done/aborted sessions (>7d). Candidates remain associated to sessions.
- Viewing
  - The DB stores `poster_url`/`thumbnail` from Stream; embeds use `iframe.videodelivery.net/{uid}`. A Stream webhook updates DB status/duration/thumbnail when processing completes, improving post-upload consistency.

### Gaps and risks

- No explicit `thumbnail_timestamp_pct` column in `videos` to reflect the chosen frame; today we only best-effort update Stream and reference its current thumbnail URL.
- No manual thumbnail upload/override path in the admin UI; candidate flow is the only option.
- Candidate and analysis retention policies are coarse (session cleanup exists; candidate pruning TTL is not enforced yet).
- No re-suggest mechanism post-finalize (e.g., regenerate candidates later) nor a way to apply a new pct after publish.
- No local caching of thumbnails (R2) if CDN access is constrained/offline; all thumbnails are Stream-hosted.
- Scoring is basic; no face detection or composition heuristics; Gemini assist is optional and can fail open.
- UX lacks resumable upload progress feedback beyond simple states.

### Recommendations

1) Schema additions and retention
   - Add `videos.thumbnail_timestamp_pct REAL` to store chosen pct; optionally `videos.chosen_candidate_id INTEGER` (FK) for traceability.
   - Add a job/endpoint to prune `videos_thumbnail_candidates` older than N days or after finalize.
2) Admin controls
   - Provide a “Upload custom thumbnail” override, stored in R2 and mirrored to Stream via `updateVideo`.
   - Add "Regenerate candidates" + "Reapply thumbnail" tools for previously finalized videos.
3) Robustness
   - On finalize, retry setting `thumbnailTimestampPct` and verify by re-fetching Stream details; fall back to storing pct even if Stream update fails.
   - Optionally copy the final chosen thumbnail into R2 for long-term stability and to decouple from Stream changes.
4) Scoring improvements (optional)
   - Add basic face detection/center-of-mass composition signals and penalize motion blur using multiple close frames.
   - Cache analysis in `videos_analysis` with `provider` + `model` fields (already present) for repeatability.

### Implemented changes (2025-11-01)

- Schema: Added `videos.thumbnail_timestamp_pct REAL` and `videos.chosen_candidate_id INTEGER` via migration `021_add_video_thumbnail_pct.sql`.
- Finalize: `/api/videos/finalize` now persists `thumbnail_timestamp_pct` and prunes that session’s `videos_thumbnail_candidates` after completion.
- Pruning: New admin route `/api/videos/thumbnail/prune` supports pruning by session or TTL.
- Manual override: New admin route `/api/videos/thumbnail/upload` accepts a JPEG/PNG poster upload to R2 and updates `videos.poster_url`/`thumbnail`.
- Admin UI: `src/app/admin/videos/page.tsx` now includes a per-row “Upload Poster” control that calls the upload endpoint and refreshes the list.
- Auditing: All the above endpoints write audit logs (action names prefixed with `videos.*`).

Operational note:
- Ensure migration 021 is applied in each environment before relying on `thumbnail_timestamp_pct`. Consider scheduling `/api/videos/upload-session/cleanup` and `/api/videos/thumbnail/prune` (TTL mode) as periodic jobs.

## Upload-to-view flow audit and gaps

### Current flow

1) Admin initiates upload
   - Direct to Stream: `/api/videos/stream/direct-upload` returns an `uploadURL` and `uid`; the client posts the file directly to Stream.
   - Metadata-only: `/api/videos` can create rows without files, for external URLs or manual entries.
2) Session and analysis
   - `/api/videos/upload-session/create` creates a session bound to the Stream `uid` and admin metadata.
   - `/api/videos/thumbnail/suggest` generates candidates; UI polls `/api/videos/thumbnail/candidates` and status.
3) Finalize
   - `/api/videos/finalize` sets `thumbnailTimestampPct` (if selected), inserts into `videos` with embed and poster URLs, and marks session `done`.
4) Processing status
   - Admin can query `/api/videos/status?streamVideoId=...`.
   - Webhook `/api/stream/webhook` updates DB status/duration/thumbnail as Stream finishes processing.
5) Viewing
   - Frontend uses Stream embed URL (`iframe.videodelivery.net/{uid}`) for playback.

### Gaps

- End-user player page UX is not described in this doc; ensure a consistent public listing/detail page with SEO (schema.org VideoObject), captions, and poster usage.
- No resumable-upload progress UI; Stream supports it, but the admin UI treats direct-upload as a single POST.
- No global pagination/filter/sort on public video listings (admin now has basic pagination/filter by publication_status).
- Access control nuances: if `is_public=false`, ensure Stream is configured for signed URLs or token-gated playback; the current embed approach likely needs Stream Signed URLs configuration and app-side signature issuance.
- Analytics/observability minimal for viewers (no play events captured back to D1).

### Action plan to close gaps

1) Add a public “Videos” index and detail pages with server-rendered metadata and optional signed URL handling.
2) Implement resumable uploader progress indicators (tus/resumable support via Stream Upload API) and error retries.
3) Introduce signed URL issuance endpoint when `is_public=false`; toggle Stream `requireSignedURLs` accordingly.
4) Store `thumbnail_timestamp_pct` on finalize; render and reapply on Stream (idempotent) and optionally copy to R2.
5) Add basic analytics endpoints to record play, watch time, and completion.

## Consolidation plan (video module + CMS)

### What to consolidate

- API surface
  - Prefer a single canonical GET list endpoint (`/api/videos`) with limit/offset/filter; remove or alias legacy `route-new.ts`.
  - Ensure item endpoints (`/api/videos/[id]`) are the only mutation surface besides finalize/upload/session tools.
- Types and validation
  - Extract a shared `Video` type and zod schema in `src/types` to reuse across UI and API; normalize boolean/JSON fields in one place.
  - Add `thumbnail_timestamp_pct` and standardize `publication_status` across modules (videos/albums/tracks) for CMS uniformity.
- Admin UX
  - Reuse filter/pagination components; add search by title/category/type; unify status toggles with CMS patterns.
  - Add manual thumbnail override and re-suggest UI.
- Data hygiene
  - Scheduled cleanup of stale sessions and old candidates; add a reindex task for Stream metadata sync.
- Observability
  - Maintain audit logging across all actions (now added); add lightweight metrics counters per action route.

### Rollout steps

1) Schema migration: add `thumbnail_timestamp_pct` to `videos` and optional `chosen_candidate_id`.
2) API updates: finalize writes pct; re-suggest endpoint accepts `videoId` post-publish; add delete/prune candidates.
3) Admin UI: manual thumbnail upload, re-suggest, and search/pagination; signed URL toggle if private.
4) Public pages: index/detail with SEO, poster usage, and optional signed playback.
5) Housekeeping: deprecate `route-new.ts`, document the canonical endpoints in README and this doc.
