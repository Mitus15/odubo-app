# Odubo Clips: Social-Ready Cropping Workflow

Last updated: 2025-11-30

## Objectives

- Enable admins to download single or multiple clips.
- Provide a "Social Ready" (9:16) vertical output without letterbox black bars.
- Persist these vertical clips in Cloudflare Stream and in the backend DB for use in the TikTok-like "clip" feed.

---

## High-Level Architecture

- Frontend: Next.js App Router UI under `src/app/admin/videos/page.tsx`.
- Backend API routes:
  - `GET /api/videos/[id]/download` — obtain ready-to-download MP4 URL from Cloudflare Stream.
  - `POST /api/videos/crop` — stream a one-off cropped MP4 back to the browser (used for ad‑hoc downloads).
  - `POST /api/analyze-video` — end-to-end pipeline: ensure download available, run Gemini analysis, create vertical cropped clips with FFmpeg, upload to Cloudflare Stream, store in DB.
- Services/Libraries:
  - Cloudflare Stream (source video, mp4 downloads, final clip storage).
  - FFmpeg (system v8.x) for cropping + encoding.
  - Google Gemini (semantic analysis → suggested clips + metadata).
  - Cloudflare D1 (metadata storage via HTTP API).
  - JSZip + FileSaver (bulk download in the browser).

---

## Data Flow

1. Admin opens a video in Admin → Clips tab.
2. If Re-Analyze is triggered:
   - API ensures an MP4 download is enabled for the video on Cloudflare (polls until ready).
   - Download the MP4 once to a local temp file.
   - Upload the same file to Gemini for analysis.
   - Parse Gemini JSON → list of suggested clips with time ranges.
   - For each clip:
     - Extract segment with FFmpeg, apply 9:16 center crop.
     - Encode with h264/aac, write to a temp file.
     - Upload the resulting file to Cloudflare Stream.
     - Insert a `type='clip'` record into D1 referencing the new Stream `uid`.
3. Admin can download per-clip or all clips as a ZIP from the UI.

---

## Key Files

- Frontend
  - `src/app/admin/videos/page.tsx`
    - `handleDownload()` and `handleDownloadAll()` for single/bulk.
    - Social Ready toggle affects whether `/api/videos/crop` is used client-side.
    - Robust error logging around `res.json()` to surface non-JSON responses.

- API
  - `src/app/api/videos/[id]/download/route.ts`
    - Was `POST`, now `GET` to match frontend; fetches/polls Cloudflare for MP4 URL.
  - `src/app/api/videos/crop/route.ts`
    - Streams FFmpeg output using `PassThrough`. Returns `video/mp4` for direct download.
  - `src/app/api/analyze-video/route.ts`
    - Node.js runtime.
    - Downloads source MP4 to temp file.
    - Gemini upload + JSON parsing (with sanitization).
    - FFmpeg crops each clip to 9:16 and writes to temp file.
    - Uploads to Cloudflare Stream using `uploadVideoStream`.
    - Inserts a `videos` row with `type='clip'`, linking to the newly uploaded vertical asset.

- Cloudflare
  - `src/lib/cloudflareStream.ts`
    - `enableDownloads`, `getDownloadUrl` helpers.
    - `uploadVideoStream(streamOrBuffer, metadata)` — accepts `Buffer` or stream; uses `formdata-node` `Blob` to satisfy `FormData.append`.

- Database
  - `src/lib/db.ts` — D1 HTTP API wrappers (`queryDatabase`, `executeQuery`, `getUserByEmail`, etc.).

---

## FFmpeg Crop & Encode Settings

- Crop to 9:16 while preserving height:
  - Filter: `crop=w=trunc(ih*9/16/2)*2:h=ih:x='max(0,min(iw-w,iw*FOCUS_X-w/2))':y=0`
  - `FOCUS_X` defaults to `0.5` (center); attempts to use Gemini keyframe `coordinate.x` near clip start when available.
- Encoding flags (current):
  - `-movflags +faststart`
  - `-vf <crop>,format=yuv420p`
  - `-pix_fmt yuv420p`
  - `-preset ultrafast`
  - `-crf 23`
  - `-max_muxing_queue_size 1024`
  - `-avoid_negative_ts make_zero`

These address color compatibility, muxing queue limits, and timestamp normalization.

---

## Error Log & Fixes (Chronological)

1) Frontend JSON parse failures on `/api/videos/[id]/download`
- Symptom: "Unexpected end of JSON input"; logs show `GET /api/videos/xx/download 405`.
- Root Cause: API handler defined as `POST`, frontend used `GET`.
- Fixes:
  - Changed route to `GET`.
  - Wrapped `res.json()` in try/catch and fallback to raw `res.text()` in the UI for clearer error messages.

2) Bulk ZIP download not functioning
- Symptom: Folder/bulk download inconsistencies.
- Mitigation so far:
  - Sequentialized fetching for each clip to avoid rate limits.
  - For Social Ready bulk, fall back to original MP4 if crop stream returns a small or invalid blob.
- Status: Needs re-test after backend stabilizations (see Next Steps).

3) Uploading cropped clips to Cloudflare Stream — `TypeError: parameter 2 is not of type 'Blob'`
- Root Cause: `FormData.append('file', stream)` with a Node `Buffer`/stream, but the `formdata-node` FormData expects a `Blob`.
- Fix:
  - Convert `Buffer` to `new Blob([buffer])` before appending.

4) Upload failures to Cloudflare — `TypeError: fetch failed (ECONNRESET)`
- Root Cause: Attempted to stream FFmpeg output directly to `fetch`/FormData; network instability during long streaming uploads caused resets.
- Fix:
  - Switched to a temp-file workflow:
    1. FFmpeg writes cropped output to a temp file.
    2. Read file into buffer.
    3. Append as `Blob` to FormData and upload.

5) `PassThrough is not defined` during analysis
- Root Cause: Leftover reference to `new PassThrough()` after switching to temp-file flow.
- Fix:
  - Removed `PassThrough` usage and import in `analyze-video` route.

6) Gemini response parse errors — invalid JSON
- Symptoms:
  - JSON wrapped in ```json ... ``` code fences.
  - Time values like `1:04.0` returned unquoted (invalid JSON).
- Fixes:
  - Strip code fences.
  - Sanitize/quote unquoted MM:SS(.ms) time values before `JSON.parse`.
  - `parseTime` helper to convert "1:04.0" → seconds.

7) FFmpeg `Conversion failed!` (exit code 234)
- Root Causes:
  - Pixel format incompatibilities; muxing limitations; timestamp issues.
- Fixes:
  - Force `yuv420p` and `format=yuv420p`.
  - Increase muxing queue size.
  - Use `-avoid_negative_ts make_zero`.

8) Clips times beyond video duration
- Mitigation: Clamp end times to video duration and skip out-of-bounds clips.

---

## Current Behavior

- Admin can re-analyze a video; backend generates vertical (9:16) cropped clips and saves them to Cloudflare Stream.
- New clips are stored in D1 with `type='clip'`, and include references like `related_projects = ["parent_id:<id>", "style:vertical", ...]`.
- Frontend can download single cropped clips or ZIP them (pending verification checklist below).

---

## Environment & Secrets

- Requires Node.js runtime for API routes using FFmpeg and local filesystem.
- FFmpeg v8.x must be available in PATH (package includes `fluent-ffmpeg` + `ffmpeg-static` dev dep; using system ffmpeg when present).
- Cloudflare credentials:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_STREAM_API_TOKEN` or `CLOUDFLARE_API_TOKEN`
- D1 HTTP API:
  - `DATABASE_URL`
  - `CLOUDFLARE_D1_API_TOKEN` or `CLOUDFLARE_API_TOKEN`
- Gemini API key available via existing integration.

---

## Operational Runbook

1) Restart dev server cleanly
```bash
rm -rf .next
npm run dev
```

2) Re-Analyze a video
- Admin → select video → AI Analysis tab → Re-Analyze.
- Watch logs for:
  - "Download URL ready"
  - "Saved source video to ..."
  - "FFmpeg finished for clip ..."
  - Successful Cloudflare upload and DB insert.

3) Verify clips in UI and downloads
- Clips tab should display new vertical clips.
- Try single-download and "Download All (.zip)".

---

## Troubleshooting Checklist

- 405 from `/api/videos/[id]/download` → Ensure route is `GET` and frontend uses `GET`.
- "Unexpected end of JSON input" (frontend) → Check server logs; the UI now shows raw text of failures.
- `TypeError: ... not of type 'Blob'` → Confirm using `Blob([buffer])` with `formdata-node`.
- `ECONNRESET` or intermittent uploads → Use temp-file workflow (implemented), ensure stable network.
- FFmpeg exit code 234 → Keep yuv420p, muxing queue, `avoid_negative_ts`. If persists, inspect source codec, consider adding `-vsync 2` or intermediate rescale.
- Gemini JSON parse errors → Sanitization rules are in place; if new formats appear, extend regex quoting as needed.

---

## Next Improvements

- Improve crop focus by interpolating across `keyframeInstructions` during the clip span.
- Background processing queue for clip generation to avoid request time limits.
- Replace `related_projects` string tags with a proper `parent_id` column and structured metadata.
- Add retries with backoff for Cloudflare uploads.
- Validate bulk ZIP workflow for large sets with progress UI.

---

## Summary

We evolved from a direct download/crop streaming approach to a robust server-side pipeline that:
- Ensures a stable MP4 source,
- Sanitizes and interprets AI-suggested clip ranges,
- Crops to 9:16 and encodes with compatible settings,
- Uploads finished clips to Cloudflare Stream,
- Persists clip metadata to D1 for the TikTok-like feed.

The major errors encountered (405, JSON parsing, Blob/stream incompatibilities, ECONNRESET, FFmpeg conversion failures) have been systematically resolved with method fixes, better error reporting, temp-file based processing, and encoding stabilizers.
