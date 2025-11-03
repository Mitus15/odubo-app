# Moments & Gallery — Event Readiness Report (2025-11-03)

## Executive summary

The Moments module is functionally end-to-end for an event: attendees can join with an event code, capture/upload photos (and basic videos), and anyone can view the gallery. R2 CORS is configured; uploads work on mobile; storage is organized per gallery; and a public viewer is live. We hardened the upload proxy for production and verified the full flow against production infrastructure.

To be truly event-ready, the capture/upload flow needs a lightweight “login” prompt for attendees to enter their Instagram handle, which is then stored with each upload. Viewing remains open to anyone.

## What’s in place today

- Data model
  - `galleries` with code, title, optional schedule window (starts_at/ends_at), config
  - `gallery_photos` storing r2_key, optional thumbnail_key, `user_name` (intended for Instagram), media_type, moderation flag
- Uploads
  - Primary: Presigned PUT to R2 via `/api/moments/upload-url`
  - Secondary: Server-side proxy `/api/moments/upload-proxy` (CORS-free fallback; now rate-limited and size/mime guarded)
  - Recording: `/api/moments/record` persists metadata and triggers video thumbnail job when media_type=video
- Viewing
  - Public gallery viewer page: `/moments/gallery/[id]`
  - Public galleries listing for the Moments index: `/api/moments/galleries/public`
  - Gallery list endpoint `/api/moments/list` returns moderated-only by default; valid event code or admin unlocks full list
- Organization
  - R2 storage keys: `galleries/<gallery-name-slug>/photos|videos/...` (falls back to gallery id)
  - Public base URL is respected when configured (e.g. `https://media.odubo.studio`)
- Admin & ops
  - In-app Moments schema apply (idempotent) from `/admin/db`
  - Admin storage UI for R2 (list/open/delete/move/rename)
  - Health/env endpoint to check config quickly
  - Audit logging hooks for key actions (e.g., uploads)

## End-to-end flow (current)

1) Join capture
   - User navigates to `/moments/join` and enters event code.
   - Flow links to `/moments/capture?code=<CODE>` (or `?galleryId=<ID>` for admins)

2) Request upload
   - Frontend POSTs to `/api/moments/upload-url` with `{ code | galleryId, fileName, contentType, mediaType }`.
   - Server resolves gallery (code preferred), enforces schedule window, and requires a valid code unless admin.
   - Responds with `{ key, uploadUrl, publicUrl? }` for direct PUT to R2.

3) Upload bytes
   - Browser PUTs the file to `uploadUrl` (R2 presigned URL) with `Content-Type`.
   - If a device/network blocks R2 CORS, the app can POST multipart to `/api/moments/upload-proxy` which streams the file to R2 server-side.

4) Record metadata
   - Frontend POSTs to `/api/moments/record` with `{ code | galleryId, r2_key, original_filename, user_name?, media_type }`.
   - Server enforces schedule window and code possession unless admin.
   - Video uploads trigger a background thumbnail job.

5) View gallery
   - Public viewer page `/moments/gallery/[id]` fetches `/api/moments/list?galleryId=<id>` (optionally with `code` to show all media).
   - Anyone can view moderated photos; code holders (or admins) can see all.

## Production validation (2025-11-03)

- Created a test gallery in D1 via script:
  - Title: `Moments E2E Test`
  - ID: `3`
  - Code: `BECY1L`
  - Window: open now → +2 hours
- Ran the connectivity script against production:
  - Request upload-url → OK; key `galleries/3/photos/test_...png`
  - PUT to R2 → OK
  - Record metadata → OK, uid `lnq90xtq`
  - List → OK (count increased); public URL resolved: `https://media.odubo.studio/galleries/3/photos/test_1762163654332.png`

Artifacts:
- Scripts: `scripts/create_gallery.mjs`, `scripts/test_moments_connectivity.mjs`
- NPM commands:
  - `npm run moments:create-gallery -- --title "My Test" --hours 2`
  - `npm run moments:test -- --baseUrl https://odubo.studio --galleryId 3 --code BECY1L`

## Security posture

- Access controls
  - Uploads require possession of the event code unless admin; viewing defaults to public (moderated-only).
  - Admin override via `ADMIN_EMAILS` and token roles.
- Rate limiting
  - Public list endpoint limited per IP.
  - Upload proxy tuned for events: pre-parse flood guard (≈10 rps per IP) and per-IP-per-gallery limit (300/min). Prevents abuse without hindering attendees on shared Wi‑Fi.
- Input and size constraints
  - Proxy enforces 50 MB max; MIME allowlist for images/videos.
  - Video uploads generate thumbnails server-side using ffmpeg.
- Audit logging
  - Upload proxy writes a non-blocking audit log with IP, galleryId, key, size, and content-type.
- Secrets and infra
  - D1 API token and R2 keys read from env; health endpoint verifies presence.
  - R2 CORS configured (manual verification); presigned PUT path is preferred.

## Functional readiness and gaps

Readiness (✅ = implemented, ⚠️ = recommended/prudent, ❌ = missing):

- Attendee capture and upload
  - ✅ Works with presigned PUT; proxy fallback available
  - ⚠️ Instagram handle capture required for events: UI needs to prompt and include `user_name` on record (currently defaults to `Anonymous`)
- Viewing
  - ✅ Public viewer shows moderated photos to everyone
  - ✅ With code/admin, full list is available
- Moderation
  - ✅ Server supports moderated flag and public-by-default list
  - ⚠️ UI for moderation exists in admin; consider a simple mobile-friendly moderator panel
- Storage and performance
  - ✅ Organized by gallery name; good for post-event curation
  - ⚠️ Proxy currently buffers file in memory; consider streaming upload in Node (Readable.fromWeb) to lower RAM for 50 MB edge cases
- Scale and throughput
  - ✅ Event-friendly RL for proxy; presigned PUT scales well via R2
  - ⚠️ Add RL to `/api/moments/upload-url` and `/api/moments/record` to resist code guessing/brute force
- Security and abuse prevention
  - ✅ Size/MIME constraints; schedule window enforced on upload and record
  - ⚠️ Longer/stronger codes recommended (8–10 chars) for public events; rotate post-event
  - ⚠️ Optional CSRF token for state-changing endpoints if you add authenticated attendee sessions later
  - ⚠️ EXIF stripping or privacy filter (optional) to avoid location data leakage in images
  - ❌ No malware/scanning pipeline (likely overkill for MVP, but note for enterprise readiness)
- Reliability and ops
  - ✅ Health/env endpoint present; audit logs captured on uploads
  - ⚠️ Add minimal dashboard metrics (uploads/min, errors, RL hits) and alerting during events

## Required change for event readiness

- Attendee handle requirement
  - Enforce a lightweight login/identification step on capture:
    - Prompt for Instagram handle (and optional display name)
    - Persist locally (LocalStorage) and attach it to `/api/moments/record` as `user_name`
    - Soft validation (e.g., `@name` or `name`) with simple regex
  - Backend already accepts `user_name` and persists it; viewer shows `user_name` when present.

## Implementation notes (how to meet the handle requirement)

- Frontend (`/moments/capture`)
  - Add a small form (drawer or modal) asking for handle on first visit or when empty
  - Store in `localStorage['moments.user_name']`
  - Include `user_name` in the record POST (replace the current `'Anonymous'` default)
  - Provide a quick “edit handle” link in the capture header
- Optional enhancements
  - Gate upload action until a handle is present
  - Add a “Remember me for this event” toggle (defaults true)

## Operations runbook (event day)

1) Create or open the event gallery
   - Use admin UI or `npm run moments:create-gallery -- --title "Event Name" --hours 6`
   - Set starts/ends window to match the event
   - Share event code with attendees

2) Validate infra
   - Health check: `/api/health/env` should return `ok: true`
   - Spot-check R2 CORS by uploading one photo via the device

3) Monitor
   - Keep an eye on audit logs and errors (500/429 rates)
   - If proxy sees heavy usage, consider temporarily raising the per-IP-per-gallery limit to 600/min

4) Post-event
   - Moderate content and export curated set
   - Rotate (or expire) the event code

## Appendix: Endpoints and contracts

- `POST /api/moments/upload-url`
  - Input: `{ code? | galleryId?, fileName, contentType, mediaType: 'photo'|'video' }`
  - Output: `{ success: true, key, uploadUrl, publicUrl? }`
  - Errors: 400 (missing id), 403 (schedule or code), 404 (not found), 500

- `POST /api/moments/upload-proxy` (multipart/form-data)
  - Fields: `file`, `code? | galleryId?`, `mediaType`, `fileName?`
  - Guards: RL pre (≈10 rps/IP) + per gallery (300/min/IP), 50 MB cap, MIME allowlist
  - Output: `{ success: true, key, publicUrl? }`

- `POST /api/moments/record`
  - Input: `{ code? | galleryId?, r2_key, original_filename?, user_name?, media_type }`
  - Output: `{ success: true, uid, r2_url, thumbnail_url? }`

- `GET /api/moments/list`
  - Query: `galleryId`, `code?`
  - Output: `[{ id, uid, r2_key, thumbnail_key, user_name, moderated, created_at, media_type, original_filename }]`
  - Behavior: public returns moderated-only; code or admin returns full list

- `GET /api/moments/galleries/public`
  - Query: `limit`, `offset`
  - Output: `{ galleries: [{ id, title, description, starts_at, ends_at, created_at, updated_at }] }`

## Conclusion

The Moments module is functionally ready and validated in production for a small-to-medium event. Add the lightweight Instagram-handle prompt on the capture page, plus a couple of defensive rate limits on upload-url/record, and you have a solid, attendee-friendly experience. For larger events or enterprise requirements, consider streaming uploads in the proxy, basic EXIF privacy, and simple operational metrics.
