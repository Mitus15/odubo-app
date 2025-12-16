# Video Analysis Worker Guide

This guide documents how the video analysis pipeline works, how to run the worker locally, and how to troubleshoot issues when descriptions and timestamps don’t appear.

## Overview
- Purpose: Analyze a Cloudflare Stream video to produce an AI description and suggested clip timestamps. Writes results into the `videos` table (`description`, `mood`, `category`, `ai_description`).
- Trigger: Admin UI calls `POST /api/analyze-video-now` with `{ videoId, cfVideoId }`.
- Queue Storage: D1 table `job_status` holds job lifecycle: `PENDING → RUNNING → COMPLETED/FAILED`.
- Worker: `npm run worker:clips` processes `PENDING` jobs by downloading the video from Stream and calling Gemini.

## Code Trace
- Enqueue API: `src/app/api/analyze-video-now/route.ts`
  - Auth: `getUserFromRequest`, `isAdminUser`.
  - Creates `jobId` and calls `updateJobStatus(jobId, 'PENDING', null, videoId, cfVideoId)`.
- Job Status API: `src/app/api/jobs/[jobId]/route.ts`
  - Returns `{ job: { jobId, status, errorDetails, updated_at } }` from D1.
- DB helpers: `src/lib/db.ts`
  - `updateJobStatus(...)`: Upserts to `job_status`.
  - `queryDatabase(...)`, `executeQuery(...)`: Calls Cloudflare D1 HTTP API using `DATABASE_URL` and `CLOUDFLARE_D1_API_TOKEN`.
- Worker runner: `scripts/run_clip_worker.ts`
  - Claims next `PENDING` job, marks `RUNNING`, then calls `processClipJob(job)`.
  - `--watch` loops to process new jobs.
- Worker processor: `src/workers/clipProcessor.ts`
  - Calls Cloudflare Stream via `src/lib/cloudflareStream.ts` to get a downloadable URL.
  - Downloads MP4 to temp file, uploads to Gemini, requests analysis.
  - Parses Gemini JSON and writes fields to `videos` (`description`, `mood`, `category`, `ai_description`, `tags`).
  - Updates job to `COMPLETED` or `FAILED`.
  - Clip generation is currently disabled (by design), manual clip management is used.

## Required Migrations
- Ensure the job table exists:
  - `database/migrations/033_create_job_status.sql`
  - `database/migrations/034_create_video_markers.sql` (manual markers support)
  - Newer analytics tables: `database/migrations/20251210_02_insights_and_ai_jobs.sql`

Apply via Wrangler (already configured):
```zsh
npx wrangler d1 migrations apply odubo --remote
```

## Environment Variables (.env.local)
- D1: `DATABASE_URL`, `CLOUDFLARE_D1_API_TOKEN` (or `CLOUDFLARE_API_TOKEN`)
- Stream: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN` (or `CLOUDFLARE_API_TOKEN`)
- Gemini: `GEMINI_API_KEY` and optional `GEMINI_MODEL` (default `gemini-2.5-flash`)
- Optional R2 (thumbnails/media): `CLOUDFLARE_R2_PUBLIC_URL`, `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET_NAME`

## Running Locally
1) Start Next dev server (in another terminal):
```zsh
npm run dev
```
2) Start the analysis worker:
```zsh
npm run worker:clips
```
3) Queue an analysis job (from Admin UI or curl):
```zsh
curl -X POST 'http://localhost:3000/api/analyze-video-now' \
  -H 'Content-Type: application/json' \
  -d '{"videoId":104,"cfVideoId":"<STREAM_UID>"}'
```
4) Check job status:
```zsh
curl 'http://localhost:3000/api/jobs/<jobId>'
```

## Outputs
- Writes AI fields to `videos` row:
  - `description`, `mood`, `category`
  - `ai_description` (JSON with `suggestedClips`, optional `keyframeInstructions`)
  - `tags` inferred from analysis
- Leaves clip generation disabled (manual clip workflow is recommended).

## Troubleshooting
- 404 media errors in dev:
  - Use the dev proxy route `GET /api/r2-proxy/<key>` to serve R2 files locally.
  - Ensure `CLOUDFLARE_R2_PUBLIC_URL` is set to a reachable endpoint.
- Job never moves past `PENDING`:
  - Ensure worker is running (`npm run worker:clips`).
  - Verify `DATABASE_URL` and `CLOUDFLARE_D1_API_TOKEN` are set.
- Job `FAILED`:
  - Check worker terminal logs.
  - Confirm `cfVideoId` is valid and downloadable in Stream.
  - Verify `GEMINI_API_KEY` exists and has quota.
- Description didn’t show:
  - Confirm `src/workers/clipProcessor.ts` updates are allowed; schema accepts `ai_description` (we relaxed validation).
  - Refresh the Admin UI; the list no longer uses cache-busting but updates after save.

## Notes
- Cloudflare Stream customer subdomain must match your account; mismatches cause 404 on manifests.
- Admin gating relies on proxy cookie; client redirects are minimized to avoid reload loops.
- React Strict Mode is disabled in dev to reduce duplicate effects while iterating.

## File References
- Enqueue API: `src/app/api/analyze-video-now/route.ts`
- Jobs API: `src/app/api/jobs/[jobId]/route.ts`
- Worker Runner: `scripts/run_clip_worker.ts`
- Worker Processor: `src/workers/clipProcessor.ts`
- Stream API: `src/lib/cloudflareStream.ts`
- Gemini API: `src/lib/gemini.ts`
- DB Helpers: `src/lib/db.ts`
- Dev R2 Proxy: `src/app/api/r2-proxy/[...key]/route.ts`
