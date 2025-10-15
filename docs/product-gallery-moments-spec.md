# Event Gallery (Moments) – Product Spec

Goal
- Let hosts create time-boxed event galleries (“Moments”) joined by code.
- Attendees capture and upload photos via in-browser camera; photos appear instantly in the live gallery.

Core concept
- A gallery (Moment) has: title, code, start/end time, visibility, optional watermark.
- Users enter code, grant camera access, take photos; uploads saved to that gallery if within window.
- Live grid updates in near real time; slideshow mode optional.

Roles
- Host/Admin: create/manage galleries, moderate, export, close.
- Attendee: join with code, capture/upload, view feed.

Host flow
- Create: title, description, code (auto/custom), start/end, visibility, watermark toggle.
- Share: QR + short link with code.
- Manage: approve/remove photos, extend/close, export ZIP/CSV.

Attendee flow
- Join with code (+ optional display name); local session.
- Camera capture (MediaDevices), client-side compression, EXIF stripping.
- Instant upload during window; show success + live grid.
- Outside window: closed state or optional queue.

Real-time
- MVP: polling 3–5s; later SSE/WebSocket.
- Slideshow/live wall: fullscreen, auto-advance.

Storage & data
- R2 for images; generate thumbs.
- D1 tables:
  - galleries(id, code UNIQUE, title, description, start_at, end_at, status, visibility, created_by, created_at)
  - gallery_photos(id, gallery_id, object_key, url, width, height, taken_at, uploader_session_id, status, created_at)
- Indexes: galleries.code, gallery_photos.gallery_id+created_at.

APIs (MVP)
- POST /api/galleries (admin)
- GET /api/galleries/by-code/:code
- POST /api/galleries/:id/photos (multipart or signed PUT)
- GET /api/galleries/:id/photos?cursor=…
- Admin: PATCH/DELETE moderation endpoints.

Rules/guardrails
- Enforce time window; rate limit per code/IP/session.
- Moderation flags; optional watermark.
- Privacy: consent prompt, EXIF stripped, public link warning.

UX essentials
- Join page (code/QR, time-left), Capture page (shutter, upload states), Feed grid, Admin moderation.

Performance
- Client compression target: max 1920px, ~85% JPEG/WebP.
- Thumbnails: small/medium; Next/Image + CDN cache.
- Polling with ETag/If-None-Match.

Acceptance criteria (MVP)
- Host creates gallery with code+window.
- Attendee joins, captures, uploads; photo appears within 5s.
- Persisted in R2 + D1; responsive grid with thumbs.
- Window enforced; uploads blocked when closed.
- Basic admin delete works.

Open questions
- Default visibility/public link? Retention period?
- Watermark default? Max file size/formats?
- Anonymous vs named attendees?
- Live wall required for launch?
