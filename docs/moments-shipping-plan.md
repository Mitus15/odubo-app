# Moments App — Shipping Plan for Event

**Goal:** Ship a reliable, event-ready moments/galleries app with smooth upload → view → moderate flow.

---

## Stage 1: Critical Fixes & Admin Cleanup
*Make the system stable and admin usable.* ✅

- [x] Fix `/admin/moments/page.tsx` — dead page that fetches non-existent `/api/moments`. Redirect to `/moments/admin`.
- [x] Fix RSVP form — button disabled when email is empty but IG/phone should work too.
- [x] Fix `upload-proxy` — doesn't check `upload_mode` for admin-only galleries (security gap).
- [x] Fix `config` field inconsistency — some endpoints return JSON string, others return object.
- [x] Fix `/api/moments/events` GET handler — uses `executeQuery` instead of `queryDatabase`.

## Stage 2: Capture Flow (Upload Experience)
*Make the upload experience smooth for event attendees.* ✅

- [x] Unify upload strategies — remove duplicate direct+proxy code, single clean flow.
- [x] Replace `alert('Uploaded!')` with inline success state.
- [x] Add upload progress indicator.
- [x] Improve camera modal UI — clearer feedback, better error states.
- [x] Add drag-and-drop file upload on desktop.

## Stage 3: Gallery Viewing & Polish
*Make the gallery browsing experience polished.* ✅

- [x] Add pagination for large galleries (30 per page + Load More button).
- [ ] Add pull-to-refresh on mobile.
- [ ] Improve lightbox — smoother animations, better mobile gestures.
- [x] Add share button for individual photos.
- [x] Add gallery-level share URL.

## Stage 4: Event Flow & RSVP
*Make the event discovery and RSVP flow smooth.*

- [ ] Simplify `/moments/join` page — cleaner code entry flow.
- [ ] Improve RSVP form — better validation, clearer status feedback.
- [ ] Add event countdown timer if event hasn't started yet.
- [ ] Make RSVP reminder system testable.

## Stage 5: Admin Moderation
*Make admin moderation fast and efficient.*

- [ ] Clean up moderation panel UI.
- [ ] Add bulk actions with confirmation.
- [ ] Add moderation stats (approved/pending/rejected counts).
- [ ] Add search/filter by uploader.

---

**Current Stage: 4 (Event Flow & RSVP) — Ready for beta testing**
