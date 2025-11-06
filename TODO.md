# Odubo Project TODO / Revisit List

This document tracks issues, features, and technical debt to revisit later.

## Moments Production Finalization Checklist (Event)

- [ ] Visibility toggle: config flag to choose public view mode (all vs moderated-only) per gallery or globally
- [ ] Viewer auto-refresh: poll `/api/moments/list` every 10–15s during event; pause on tab hidden
- [ ] Rate limiting: add RL to `/api/moments/upload-url` and `/api/moments/record` (proxy already hardened)
- [ ] Sentry/metrics: basic error tracking on core API routes; sample dashboard
- [ ] Moderation UI: add filters (unmoderated first), bulk approve/reject, and quick hide
- [ ] Consent: optional short consent copy on Capture; link to policy
- [ ] Admin controls: gallery-level quick actions (extend window, freeze uploads, rotate code)
- [ ] Export/backup: R2 prefix export script and D1 rows CSV export post-event
- [ ] Slideshow/live wall (optional): simple rotating grid from public list
- [ ] QA runbook: preflight checklist (QR redirect window, env audit, smoke tests, rate limits)

### 2025-11-05 — Moments Enhancements (Shipped + Pending)

Shipped today
- [x] Capture: allow download before upload (data URL → file)
- [x] Capture: keep modal open after upload; show “Open Gallery” CTA
- [x] Capture: soft client rate limit (3 uploads per 2 minutes per gallery)
- [x] Capture: front camera mirrored (preview and saved), no artificial zoom
- [x] Capture: true 9:16 and 3:4 via canvas crop (no letterboxing)
- [x] Styling: luxury brown glass UI across capture modal (no orange)
- [x] Featured → Moments: forward galleryId/code + ig; auto-open camera
- [x] Moments: auto-resolve code from galleryId (fetch `/api/moments/galleries/:id`)
- [x] Admin: delete photo (API + UI)
- [x] Admin: delete entire gallery from admin page
- [x] Gallery: lightbox modal with swipe and download

Pending / Next
- [ ] Server-side rate limit on `/api/moments/upload-url` and `/api/moments/record`
- [ ] Moderation UI filters (unmoderated first), pagination, bulk operations polish
- [ ] Public/private visibility switch per gallery; private mode enforces event code for viewing
- [ ] Lightbox accessibility: focus trap, Esc to close, keyboard arrows
- [ ] Device QA on iOS/Android; tune preview box sizing for smallest screens
- [ ] Minimal e2e tests for capture → upload → record → list
- [ ] Offline/spotty network: optional local queue with retry

## Livestream Integration (Cloudflare Stream)

- [x] Live Input API: `/api/stream/live-input` (GET/POST) to ensure a default RTMPS/WHIP input with automatic recording
- [x] Admin Live page: `/admin/live` shows ingest URL/key and a live preview
- [x] Public Live page: `/live` embeds the live player via Stream iframe
- [x] Admin nav: add Live link (📡)
- [ ] Webhook: implement `/api/webhooks/stream` to capture `video.ready` and auto-insert VOD into D1
- [ ] Videos import: “Import Stream UID” action in Admin → Videos (manual fallback)
- [ ] Live indicator: optional badge on site when live input status is active
- [ ] Docs: OBS/Streamlabs quick setup and event-day steps (`docs/LIVESTREAMING.md`)

## Outstanding/To Revisit

- [ ] Confirm Resend email delivery for all user flows (production + dev)
- [ ] Add more robust error handling/logging for email failures
- [ ] Support for custom sender address (not just onboarding@resend.dev)
- [ ] Add admin UI for managing users and password resets
- [ ] Improve user feedback for password reset errors (expired/invalid link)
- [ ] Remove debug logs (e.g., RESEND_API_KEY) before production
- [ ] Add tests for forgot/reset password flow
- [ ] Review .env and environment variable loading for all environments
- [ ] Clean up duplicate error logging in API route
- [ ] Add rate limiting to forgot password endpoint

## Cloudflare Admin Tools (D1 + R2) — Return To

- [ ] Storage UI: Add Move/Rename controls (API exists via `/api/admin/r2/move`)
- [ ] Storage UI: Bulk delete selection and confirm dialog
- [ ] Storage UI: Drag-and-drop uploads and upload queue with progress
- [ ] Storage UI: Inline previews for images/videos; basic metadata panel
- [ ] SQL Console: Saved queries and presets (with quick-run buttons)
- [ ] SQL Console: CSV export for SELECT results and copy-to-clipboard
- [ ] SQL Console: Query history with timestamps and re-run
- [ ] Migrations Panel: Optional UI to run known D1 migrations safely (embed scripts or store in D1)
- [ ] DB enforcement: Optionally finalize the single-row trigger in Cloudflare Console for `featured_pages`

# Admin UI & Upload Enhancements (recent additions)
- [ ] Add visual progress bars for Stream uploads and analysis
- [ ] Add preview modal/lightbox for thumbnail candidates (admin)
- [ ] Add animations/transitions for progress updates and status changes
- [ ] Add cancel/retry polling controls & server-side abort handling
- [ ] Add background status polling (pollSessionStatus) and reconnect handling
- [ ] Add keyboard navigation and accessibility for thumbnail picker
- [ ] Add tests for gated upload flow (end-to-end)
- [ ] Run dev server and smoke-test the UI after changes

---

  // TODO: Add loading indicator for video list fetch
  // TODO: Add error handling for initial fetch
  // TODO: Add pagination, search, or filter for large video lists
  // TODO: Add video/thumbnail preview before upload
  // TODO: Add progress indicator for uploads
  // TODO: Add client-side validation for all fields (e.g. URL, duration, credits)
  // TODO: Add success message after create/update
  // TODO: Add confirmation dialog for canceling edits
  // TODO: Add drag-and-drop file upload support
  // TODO: Add accessibility improvements (ARIA, keyboard navigation)
  // TODO: Add optimistic UI for create/update/delete
  // TODO: Add duplicate title/category check
  // TODO: Add sorting options for videos
  // TODO: Add video player or link to view uploaded video
  // TODO: Add bulk actions (delete/edit multiple videos)
  // TODO: Add role-based UI fallback if not admin
  // TODO: Add storage quota/cleanup logic if needed
  // TODO: Add account/profile management UI (login/logout/signup/forgot/reset password integration)
  // TODO: Add frontend check for existing session/token on protected pages
  // TODO: Add email verification and password strength validation on signup/reset
  // TODO: Add UI for changing password when logged in
  // TODO: Add error boundary or global error handling for auth flows
  // TODO: Add 2FA or advanced security features if required

## New Feature: Event Gallery (Moments)
- [ ] Product spec drafted in `docs/product-gallery-moments-spec.md`
- [ ] DB: galleries, gallery_photos tables + indexes
- [ ] API: create gallery, resolve by code, upload photo, list photos, admin moderation
- [ ] Client: Join (code/QR), Capture (camera + compression), Live Feed grid, Admin moderation UI
- [ ] Real-time: polling MVP; evaluate SSE/WebSocket later
- [ ] Storage: R2 objects + thumbnails, CDN cache headers
- [ ] Security: time window enforcement, rate limits, consent, EXIF strip, moderation
- [ ] UX: QR sharing, time-left indicator, slideshow/live wall optional
- [ ] Performance: client compression, lazy thumbs, ETag polling
- [ ] Open questions: visibility default, retention, watermark, attendee identity, live wall scope

### Event Gallery (Moments) - MVP tasks
- [ ] Scaffold pages/components: `/moments`, `/moments/join`, `/moments/admin`
- [ ] DB migration: `galleries` (id, code, title, starts_at, ends_at, created_by, config)
- [ ] DB migration: `gallery_photos` (id, gallery_id, uid, r2_key, thumbnail_key, user_name, moderated, created_at)
- [ ] API routes: create gallery (admin), join gallery (resolve code), upload photo (signed URL + direct R2 upload), list photos (paginated)
- [ ] Client: Join flow (enter code or scan QR) → receive upload token/URL
- [ ] Client: Capture/Upload UI (camera capture, client compression, EXIF strip, show progress)
- [ ] Admin: Moderation UI (approve/reject, bulk actions)
- [ ] Live Feed: Polling implementation for attendees; lazy-load thumbnails + ETag checks
- [ ] QR/Share: Generate and display QR code for quick join
- [ ] CDN: Configure cache TTLs and CDN headers for thumbnails
- [ ] Retention/cleanup: Scheduled job to prune expired galleries and objects

## Moments / Event Gallery

- [x] Create DB migration for galleries and gallery_photos (016)
- [x] Scaffold API endpoints: create, join, upload-url, list, record
- [x] Client pages: /moments, /moments/join, /moments/capture, /moments/admin
- [x] Enforce event window on capture page and max video length 7s
- [x] Use organized R2 keys: galleries/{galleryId}/photos and galleries/{galleryId}/videos
- [x] Record media_type in DB (migration 017)
- [x] Generate presigned PUT URLs for uploads (upload-url route)
- [x] Update /api/moments/record to accept media_type and thumbnail_key and return r2_url/thumbnail_url
- [x] Add server-side thumbnail generator script (Node + ffmpeg-static) and CLI wrapper
- [x] Hook thumbnail generator into uploads (Cloudflare Worker R2 put event) — worker snippet and job endpoint added
- [x] Admin moderation endpoints and UI to approve/reject content
- [ ] Verify and deploy worker; ensure ffmpeg available in production
- [ ] Add cleanup job for expired galleries and orphaned files
- [ ] Improve moderation UI (filters, pagination, bulk actions) — basic bulk actions implemented

Add more items as needed!

### Moments Mobile Capture UX (2025-10)

- [x] Enable scroll on capture page (prevent controls from being cut off on mobile)
- [x] Simplify capture to photos-only with reliable preview (canvas dataURL + Blob)
- [x] Add camera front/back switch (toggle with facingMode/deviceId)
- [x] Deterministic camera toggle with named devices and persistence (localStorage) + device dropdown
- [x] Staging/Preview documentation for mobile HTTPS testing (`docs/STAGING.md`)


### Music Player Modal

- [x] Fix the full screen music player modal
- [x] Implement horizontal scrolling for control buttons
