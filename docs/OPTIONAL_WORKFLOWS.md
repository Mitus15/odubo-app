# Optional Workflows & Enhancement Log

This document tracks shipped, polished subsystems that are production-ready along with adjacent, non-blocking enhancement ideas. Areas here are intentionally decoupled from core release requirements so we can iterate opportunistically.

---

## 1. Email RSVP & Reminder Hardening (2025-11-07)

### What shipped (production-ready)

- Centralized env helpers (`src/lib/env.ts`)
  - `getSiteUrl()`: consistent absolute URL base for emails
  - `getEmailEnv()` / `validateEmailEnv()`: collects and warns about email config
- Dispatcher hardening (`src/lib/momentsReminderDispatcher.ts`)
  - Absolute URLs for logo and links
  - Hidden preheader for better inbox preview
  - Alt text for logo, consistent serif brand font
  - Plain-text fallback body for deliverability
  - Self rate-limit: skip if called again within 60s (prevents dupes)
  - Uses Resend `from` from validated env
- Shared email template (`src/lib/emailTemplates.ts`)
  - Exported `brandedEmailHTML` for reuse and testing
- Unsubscribe flow
  - API route to clear reminder offsets / opt-ins
  - UI on RSVP management page to trigger unsubscribe
- Scripts
  - `scripts/send_specific_offset_reminder.ts` validated input, consistent subject, absolute URLs, and text fallback
  - `scripts/send_sample_reminder.ts` keeps branding consistency
- Tests (focused and passing)
  - `src/__tests__/env.test.ts` env helpers
  - `src/__tests__/validation.test.ts` email validation helpers
  - `src/__tests__/dispatcherRateLimit.test.ts` rate-limit early-return behavior
  - `src/__tests__/emailTemplates.test.ts` structural checks for branded HTML
- Jest stability
  - CommonJS config (`jest.config.cjs`), unit-only config (`jest.unit.config.cjs`)
  - `jest.setup.js` polyfills minimal `Request` and `performance` APIs

### Optional refinements (non-blocking)

- Stronger dispatcher rate limiting via D1 (`src/lib/rateLimit.ts`) keyed by job window
- Add HTML snapshot test for `brandedEmailHTML`
- Expand email input sanitization beyond RSVP scripts (server routes)
- Consolidate more scripts to use `getSiteUrl` / `validateEmailEnv`
- Gradual stabilization of broader Jest suites by polyfilling remaining browser APIs used by components

### Operational notes

- Ensure env: RESEND_API_KEY, RESEND_FROM_EMAIL (or EMAIL_FROM), NEXT_PUBLIC_SITE_URL
- Default site fallback: https://odubo.studio
- Reminder logs enforce idempotency via `UNIQUE(rsvp_id, offset_min, channel)`

---

## 2. Music Player UX & Queue Enhancements (2025-11-08)

### What shipped (production-ready)

- Mini player (MiniBar) error smoothing
  - Suppresses transient "Audio source not supported" during initial load window (grace extended from ~1.2s to 5s)
  - Removed buffering text & legacy waveform visual for cleaner minimalist state
  - Play/Pause derives from actual HTMLAudioElement events (prevents UI desync)
- Expanded full-screen player redesign (`ExpandedView.tsx`)
  - Mobile-first glass aesthetic, viewport-relative sizing
  - Gesture (swipe-down) close behavior
  - Removed waveform & mute button clutter
  - Reliable album art persistence (fixed disappearing edge case)
- Queue system overhaul (`QueueDrawer.tsx` + context)
  - Pinned "Now Playing" followed by reorderable "Up Next" list
  - Pointer-based drag & drop reordering
  - Accessible Move Up / Move Down buttons for keyboard users
  - Remove track buttons with immediate context state sync
- Physical shuffle implementation (`MusicPlayerContext.tsx`)
  - Shuffle now reorders the queue array (current track fixed at index 0) vs. virtual index mapping
  - Maintains `originalQueue` for integrity when toggling shuffle off/on
- Repeat-all loop reshuffle option
  - Added `reshuffleOnLoopEnd` state & toggle (visible only when Repeat All + Shuffle active)
  - Automatically reshuffles queue sequence at loop boundary while preserving current track

### Optional refinements (non-blocking)

- Persist user playback preferences (shuffle/repeat/reshuffle) to localStorage or user profile
- ARIA live announcements on reorder (announce new position, total tracks)
- Drag ghost preview & smoother crossfade between tracks
- Waveform could return as a lightweight progress visualization (SVG + off-main-thread precompute) if demanded
- Smart preloading of next 1–2 tracks post-shuffle for gapless transitions
- Crossfade prototype (configurable duration, disable for explicit content transitions) — requires dual audio buffer strategy
- Error telemetry aggregation (categorize load failures by source type) for proactive CDN/R2 tuning

### Operational notes

- Context: `MusicPlayerContext` now physically mutates queue on shuffle; ensure any future library-level shuffle respects this contract
- Reshuffle toggle only relevant when Shuffle + Repeat All simultaneously active (UI enforces condition)
- Accessibility: Move Up/Down buttons provide deterministic keyboard ordering independent of drag affordances

---

## 3. Upcoming / Candidate Areas

These are exploratory and intentionally uncommitted to any deadline:

- Album edit page UX expansion: cover art update, scroll ergonomics, inline metadata editing
- Preference persistence for player (see Music Player optional refinements)
- Advanced audio gapless & crossfade engine
- Enhanced rate limiting primitives (shared patterns between email + player telemetry)

---

## Changelog Conventions

- Sections numbered chronologically by initial ship date of the domain area
- "What shipped" lists are immutable snapshots; append new sections for additional domains instead of rewriting history
- Optional lists may be pruned or promoted to "shipped" in new numbered sections

