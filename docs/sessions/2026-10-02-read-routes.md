# 2026-10-02 · The read routes swept

Branch `claude/clever-pare-7d5cfb`, stacked on `claude/unruffled-goldstine-331edc`
(the write sweep, `2026-10-02-clips-banner-and-clip-count.md`). Not merged:
main waits on the owner.

## The sweep

Every exported GET under `src/app/api`: 220 handlers. 90 sit behind
`src/middleware.ts` (`/api/admin/**`, `/api/command-center/**`,
`/api/loop/admin/**`). Of the other 130, 87 named no verifier in their code:
84 by the write guard's old text reading, and three that named one only
inside `writeAuditLog(...)` (`GET /api/videos/cleanup`, `GET /api/videos`,
`GET /api/videos/[id]`). Each of the 87 was read, sorted into public
catalogue, per-user, admin data or secrets, and every caller of every gate
candidate was searched for across the repo (app, scripts, CI, `vercel.json`).

## Gated

`requireAdmin` first, before any database, R2, Stream or outside call.
Commits 7fb6ee2, 36aef5c, faee3f6.

- **Orders**: `GET /api/orders` was `SELECT * FROM orders` for anyone: every
  order's customer email, name, shipping and billing address. The same
  class as the customer leak. The checkout's POST stays open.
- **BI** (9): ad campaigns and metrics, expenses and summary, product costs,
  reports, social growth.
- **Analytics** (9): attribution (revenue by clip, gallery, source), cohorts,
  LTV, dashboard, export (fan activity as CSV), funnel GET and detail (the
  fan POST stays open), reports, watch-through.
- **Intel** (2): commerce (revenue, recent orders), overview.
- **Social** (10): accounts, posts, a post, its analytics (calls PostForMe on
  the owner's key, and writes), sync status, sync log, studio campaigns and
  slots.
- **Arsenal** (2): `videos` returned every video, hidden ones included, with
  its Stream uid, original filename and social drafts: the hidden-video
  leak `claude/mystifying-hugle-0cde7d` fixed in `/api/videos`, by another
  door. `release-order` returned hidden parents with their uids.
- **Settings, health, debug** (10): connections, entities, migration status,
  `health/db`, `shopify/test-config` (an Admin API call, returns the shop's
  email), `clip-debug`, `users?action=email-status`, clip engagement counts,
  Stream status by uid, and `fix-audio-mime-types`, whose GET ran the R2
  rewrite the write sweep gated on POST.
- **`GET /api/videos/status`** let an `X-User-Email` header naming any
  registered user pass for an admin. Nothing sends it there.
- **`/api/videos/cleanup`**: see below.

Every caller is an admin screen on this origin, which sends the session
cookie (Orders, Analytics, Finance, Expenses, Reports, Ad Campaigns, Social
Growth, Social Accounts and Analytics tabs, Social Studio, Command Center,
Arsenal). Many have no caller at all. `/api/analytics/export` opens in a new
tab or a download link, same origin, so the cookie goes too.

## Found on the way, fixed

- **`POST /api/videos/cleanup` deleted from R2 for anyone.** It lists the
  bucket and deletes every object no `videos` row points at, a thousand a
  call: masters, stems, gallery photos, brand assets, all in the one bucket.
  The write guard passed it because its audit call names
  `getUserFromRequest`. Its GET handed out the first thousand keys in the
  bucket, and the media proxy presigns any key under `warehouse/` or
  `music/` that belongs to no track, so any master among them could be
  fetched. Both gated.
- **The guard's blind spot.** `src/lib/api/routeHandlers.ts` now reads the
  route files for both guards, and a verifier counts only in code: not in a
  comment, not inside `writeAuditLog(...)`. That also caught
  `POST /api/test-analyze` (a dev script's route, now gated) and
  `POST /api/featured/rsvp` (writes a handle to the audit log; listed as
  public).
- **The live stream key.** `GET /api/stream/live-input` returned `rtmps`
  (the stream key) and `whip` (the WebRTC publish URL) to anyone, and a
  visit created the input if there was none. The public `/live` page (linked
  from nowhere) uses the uid alone. Now an admin gets everything and may
  create; anyone else gets the uid and playback URLs, or null. Commit
  4b381fa.

## Open, for the owner (`KNOWN_OPEN` in `routeReadAuth.test.ts`)

1. **Unreleased audio, two gaps in `src/lib/loop/audioAccess.ts`.**
   `trackByMediaKey` (line 74) knows a key only when it equals a track's
   `audio_url`. A key that belongs to a track another way returns null, and
   the media proxy (`src/app/api/media/audio/[...key]/route.ts:54`) serves it
   to anyone: a track's HLS files (`<song>.hls/…`, beside a `.web.` file,
   see `deriveHlsUrl` in `src/lib/release/audioSource.ts:163`), and the key
   of a track whose `audio_url` still names `media.odubo.studio`. Meanwhile
   `GET /api/tracks/[id]` (line 8) and `GET /api/albums/[id]` (its
   `SELECT * FROM tracks`, line 25) hand out `audio_url` and the stem URLs
   for any track, and the first adds `hls_url`. `GET /api/tracks` withholds
   `audio_url` and `preview_url` for an unreleased album on purpose (not the
   stem columns, which nothing writes any more).
   Whether the unreleased album has either kind needs a look at live D1:
   `SELECT id, title, audio_url FROM tracks WHERE album_id = '<id>'`.
   Recommendation: withhold those fields in both routes exactly as
   `/api/tracks` does (unless `mayHearTrackId` says yes), and teach
   `trackByMediaKey` the `.hls/` sibling and the dead-host form. The stream
   route forwards the listener's cookies to the proxy, so entitled
   listeners keep playing.
2. **`GET /api/game/scores`** (`src/app/api/game/scores/route.ts:15`) sends
   every leaderboard player's email. The leaderboards
   (`src/components/game/Leaderboard.tsx:71`, `LeaderboardTicker.tsx`) show
   `display_name`, else the email's local part. Recommendation: work out
   that fallback name on the server and drop `email` from the response.
3. **`GET /api/moments/rsvp`** (`src/app/api/moments/rsvp/route.ts:63`)
   looks an RSVP up by email, Instagram handle or phone and returns all
   three plus the name. Given a gallery id (a small number) and someone's
   public Instagram handle, it hands over their email and phone if they
   RSVP'd. The only caller is the RSVP page with `?prefillEmail=` from the
   reminder email. Recommendation: drop the handle and phone lookups
   (no caller) and answer the email lookup with the RSVP's state only, or
   sign the manage link.
4. **`GET /api/loop/gallery/media/[...key]`** (line 17) presigns any
   `galleries/` key, private galleries included. Loop Wall keys carry 8
   random hex characters; moments uploads keep the original file name
   (`src/app/api/moments/upload-url/route.ts:83`), so a private gallery's
   `IMG_1234.jpg` can be guessed. Recommendation: find the photo by key and
   apply `readableGallery` (`src/lib/moments/access.ts`).
5. **`GET /api/connections/callback`** (`src/app/api/connections/callback/route.ts:22`)
   stores OAuth tokens over the owner's connection on a `state` that is
   unsigned base64 (`parseOAuthState`, `src/lib/platform-oauth.ts:262`), and
   redirects to the `returnUrl` inside it (line 127). Dormant: its UI is
   mounted nowhere. Recommendation: `requireAdmin` (the session cookie is
   SameSite=Lax, so the provider's redirect back carries it) and a signed
   state.
6. **`GET /api/featured-single`** (`src/app/api/featured-single/route.ts:24`)
   inserts a published `featured_pages` row for any `?mode=`. The featured
   pages redirect to `/` now, so nothing renders it. Recommendation: gate it
   (its only caller is `/featured/manage`) or stop creating on read.

## Listed, lower

- Four jobs fail open when `CRON_SECRET` is unset (`if (cronSecret && …)`):
  `GET /api/arsenal/sync` (line 441), `cron/cleanup-uploads` (42),
  `cron/email-sequences` (26), `cron/social-sync` (17). Recommendation:
  `requireCronOrAdmin`, after confirming `CRON_SECRET` is set in Vercel and
  in `cloudflare-worker-cron`, which calls `arsenal/sync` every 15 minutes
  with it as a bearer. Nothing in the repo schedules `social-sync`.
- `GET /api/health/env` stays public by design (2025-11-02, used to check a
  deploy): which env vars are set, never their values.
- The cart (`GET /api/store/cart/sync`) is keyed by the first 16 characters
  of a visitor id the browser makes (`src/hooks/useCart.ts:28`): a timestamp
  and five `Math.random` characters. No personal data in a cart.
  Recommendation: key it by the whole id, made with `crypto.randomUUID()`.
- `moments/join` and `loop/gift` take a code as the credential, with no
  rate limit on join. `moments/galleries/[id]/links` answers for private
  galleries too (product and track handles, the linking admin's user id).
- `GET /api/albums` and the featured routes include drafts;
  `clips/parents` names a public clip's parent even when the parent is
  hidden. Promotional metadata, not personal data.
- `GET /api/videos/stream/direct-upload` is a debug echo of the caller's
  Origin and the public site URL. Delete when convenient.
- The session cookie is set with `httpOnly: false`
  (`src/app/api/users/route.ts:546`) under a comment that says httpOnly, so
  any script on the page can read it.
- `src/proxy.ts` is dead: Next 15.4 runs `src/middleware.ts`.

## Merging

- With `claude/gifted-matsumoto-a1f193` (the Stream webhook, also on top of
  unruffled): merges clean; the guards, both gate tests and its own
  `streamWebhook.test.ts` pass on the merged tree (239 tests).
- With `claude/mystifying-hugle-0cde7d` (hidden videos): only the three
  conflicts `claude/unruffled-goldstine-331edc` already has with it,
  `videos/bulk-update`, `videos/crop` and `videos/description/generate`.
  Both sides add the same `requireAdmin` gate; keep either. Resolved that
  way on a trial tree, everything passes but the known `GET /api/videos`
  fallback. `routeReadAuth.test.ts` leaves `GET /api/videos` and
  `/api/videos/[id]` to that branch, so it needs no edit after.

## Verified

- `npx tsc --noEmit`, no `.next`: 850 before, 850 after, the same error list
  with positions stripped.
- `npm test`: 630 pass (528 + 102 new), the 2 known failures unchanged:
  `brandedEmailHTML` and the `GET /api/videos` fallback.
- Against the routes as they were, 99 of the new tests fail: all 90 gate
  tests, the three live-input tests for strangers and fans, the two new
  write gates, and both guards.
- ESLint: no touched file worse, five better (unused request parameters
  now used).
- Not tried live: no `.env.local` in this worktree, and nothing here is
  observable in a browser without D1. The admin path is covered by tests:
  the session cookie alone and a bearer token alone both get through.
