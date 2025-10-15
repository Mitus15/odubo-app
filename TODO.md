# Odubo Project TODO / Revisit List

This document tracks issues, features, and technical debt to revisit later.

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

Add more items as needed!
