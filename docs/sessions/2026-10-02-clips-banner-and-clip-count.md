# 2026-10-02 · The /clips debug banner, D1 writes read where D1 puts them, and the write routes locked

Two small fixes found on 2026-09-29. Committed on branch
`claude/unruffled-goldstine-331edc`, not merged: main waits on the owner.

## What changed

- `src/app/clips/page.tsx`: the red "CLIPS PAGE DESKTOP TEST - CAN YOU SEE
  THIS?" bar is gone. Static JSX from 672a2d6 (2026-05-04), fixed at z-9999
  over both the phone feed and the desktop gallery. No state or flag fed it.
- `src/lib/db.ts`: `changedRows(response)` reads a write's row count from
  `result[0].meta.changes`, where D1 puts it.
- `src/app/api/admin/social/status/route.ts`: `clips_made_public` (GET, one
  item) and the batch total (POST) now use `changedRows`. Both read `.changes`
  off the top of the response, which D1 never sends, so they said 0 every time
  even when clips went public. The UPDATEs always ran; only the count lied.
- `src/__tests__/d1ChangedRows.test.ts`: three tests. With the old top-level
  read swapped back in, the first one fails.

## Verified

- `npx tsc --noEmit`: 850 before, 850 after, the same error list (positions
  stripped), none in the touched files.
- `npm test`: 390 pass (387 + 3 new). The 2 known failures are unchanged:
  `brandedEmailHTML` and the `GET /api/videos` fallback.
- /clips at 1440px: banner gone, desktop gallery mounts. This worktree has no
  `.env.local`, so `/api/clips` answers 500 and the gallery shows its own
  error. Fed two mock rows in the browser (no code change), it renders both
  cards, with a Shop tap only on the clip that has a product.
- /clips at 375px: banner gone, mute and back buttons clear.
- Not checked against live D1: a read-only probe was blocked by the session's
  permission policy. The response shape comes from `D1Envelope` in
  `src/lib/loop/db.ts` (marked "verified against live D1") and from
  `inserted()` in `src/lib/inbox/threads.ts`, which reads the same field in
  production.

## For the owner (not built)

The live phone clips feed (`PosterCard` via `ClipsFeed`, on / and /clips) has
no per-clip shop tap. It exists only on desktop /clips (`DesktopClipsGallery`)
and in `CinematicModal`. The phone logo menu's Shop button opens the whole
store, not the clip's product: `HomePageClient` never passes
`clipProductHandle` to `ExpandableLogoMenu`. Loop Soul film clips carry no
product on purpose, so this only matters for other clips with a
`shopify_product_handle`.

## Later the same day: the same misread everywhere, fixed

Commits a8940d7 (`lastRowId()` beside `changedRows()` in `src/lib/db.ts`) and
8610ea7 (the routes). Fifteen reads in thirteen routes looked for a write's
count or new id at the top of D1's response:

- likes (`src/app/api/likes/route.ts`): a saved like answered 500, and so did
  an unlike. Now 200, or 404 when there was nothing to unlike. Earlier today
  this read as a fan-facing bug; it is not. The like tables come only from the
  manual `POST /api/setup-likes`, `TrackActions` is mounted nowhere, and
  `LikeButton` renders only on /likes, which nothing links to. The feature is
  dormant; the fix is for when it wakes.
- brand-assets albums and social folders: the upload screens create one, then
  file the upload under the id that comes back. It came back undefined: "upload
  into a new album" stopped at "Please select or create an album", and an
  upload into a new folder went in with no folder.
- brand-assets categories and assets, social content, AI studio profiles and
  examples: created rows came back without their id.
- Woda (`src/app/api/arsenal/woda/route.ts`): `generationId` was always null,
  so feedback on a generation had nothing to attach to.
- moments clip record: `clip_id` came back undefined.
- tracks: returned `meta.last_row_id`, a rowid even when read right. A track's
  id is the UUID the route generates; that is what it returns now.
- arsenal/sync: the go-live phase never added to `madePublic`.
- arsenal/sync-from-stream: `ignored` was always 0; a duplicate counted as
  synced.

**How they were found.** Grep found four. Then two sweeps: typing
`executeQuery`'s result exactly for one tsc run (34 new errors, restored
after), and a syntax scan of every property read on its result. The scan
caught three that casts or `'x' in` checks hid from tsc (both arsenal syncs,
Woda). Left alone on purpose: `src/lib/hub/permissions.ts` and
`src/app/api/v2/auth/roles/route.ts` read `result.result[0].results` first,
with a dead `result.results` fallback, so they are right.
`src/app/api/tracks/route-new.ts` still has the misread, but it is not a route
and nothing imports it (dead since 2025-08-24).

**Tests.** `src/__tests__/d1Response.test.ts` (was `d1ChangedRows`) covers both
helpers. `src/__tests__/d1WriteResults.test.ts` runs six of the routes' own SQL
against `node:sqlite`, with `executeQuery` answering in D1's shape from what
SQLite reports; all eight tests fail with the six routes put back to HEAD.

**Verified.** `npx tsc --noEmit`: 850 before and after, the same error list.
`npm test`: 402 pass (390 + 12 new), the same 2 known failures. ESLint: no
touched file worse; arsenal/sync 6 → 4 (two `as any` gone).

`src/lib/loop/*` uses `@/lib/loop/db`, whose `executeQuery` returns the meta
itself, so those reads were right all along.

## Then: every write route says who may call it

The two open routes found above (sync-from-stream, setup-likes) led to a
sweep of all 341 POST/PUT/PATCH/DELETE handlers in `src/app/api`: 157 sit
behind a middleware gate (`/api/admin/**`, `/api/command-center/**`,
catalogue writes, `/api/loop/admin/**`), 99 verify their caller themselves,
and 85 did neither. Commits e858863, be08b7b, 8f01cf7, a984ced, 65e871f.

**Gated** (58 handlers, 48 files; `requireAdmin` first, before any database,
upload or outside call):
- Arsenal: sync-from-stream, link-parent, reorder, update, woda. They checked
  only that an `Authorization` header began with "Bearer ", so anything got
  in. That check also broke the admin's own buttons since 1ac485f
  (2026-02-06): Arsenal sends those calls with the session cookie and no
  header, so one of its two "sync from Stream" buttons, clip reorder, title
  edits and Woda all answered 401. Reorder and title edits ignore the answer,
  so they failed silently. They should work again (not tried live).
- social: posts (create, edit, delete, sync, publish to the owner's accounts
  through PostForMe), accounts, library upload into R2, studio campaigns and
  slots, sync.
- bi: ad campaigns and metrics, expenses, product costs, reports, social
  growth.
- connections: connect, disconnect, sync (their only caller,
  `PlatformConnections`, is mounted nowhere).
- linktree create, edit, delete (the click counter stays open);
  announcements create and delete (the site only reads them).
- DeepSeek spenders: `deepseek` (an open proxy to the owner's key), analytics
  insights, videos description/generate. The one server-side caller,
  `videos/[id]/process`, forwards the admin's bearer token.
- upload (into R2), videos crop / bulk-update / upload-enhanced, analytics
  report, entities, setup-likes, clip-debug, fix-audio-mime-types.
- cron compute-cohorts and compute-funnels: `requireCronOrAdmin` (Vercel
  Cron's bearer secret, or an admin; closed when `CRON_SECRET` is unset).
  Their GETs call the POST.
- **A read, found on the way:** `GET /api/customers/[id]` and
  `/api/customers/[id]/orders` checked nothing (the list route did). Anyone
  holding a customer id could read name, email, phone, spend, and orders
  with shipping and billing addresses. Gated, with the PUT beside them.

**Left open on purpose** (listed in `src/__tests__/routeWriteAuth.test.ts`
with reasons): fan analytics, engagement, contact, email capture, game
scores, the linktree click counter, Loop fan and pass flows, RSVP, the
checkout (`orders`, `shopify/checkout`), cart sync and stock check, the
invite acceptance (its own token), Loop admin logout. Verified another way:
`webhooks/shopify` (HMAC), `moments/thumbnail-job` (shared secret). No
effect: `films`, `products` POST (405), `webhooks/clerk`.

**Still open, needs the owner:** `POST /api/stream/webhook` checks a
signature only when its `cf-webhook-signature` header is present, so leaving
the header off skips the check. Cloudflare's docs describe a signed
`Webhook-Signature` header instead; confirm the scheme and set the secret
when fixing. Listed as `KNOWN_OPEN` in the guard test. Fixed later the same
day: `2026-10-02-stream-webhook-signature.md`.

**Tests.** `src/__tests__/adminWriteGates.test.ts` calls all 58 gated
handlers, and the two jobs' GETs, as a stranger and as a signed-in fan
(real signed tokens): 401 and 403, with nothing reached first. All 60 fail
against the routes as they were. It also shows the admin gets through
sync-from-stream on the session cookie alone. `routeWriteAuth.test.ts` reads
every write handler and fails on any that is ungated, unverified and
unlisted, or on a stale entry.

**Verified.** `npx tsc --noEmit`: 850, the same list. `npm test`: 528 pass
(402 + 126 new), the same 2 known failures. ESLint: no file worse, five
better (each had an unused request parameter).

## Found in passing (not fixed)

- `AlbumModal` (mounted by `AlbumEditClient` and `AlbumActions`) sends each
  track to `POST /api/tracks` as FormData; the route reads `req.json()`, so
  that upload should fail every time. It also expects `trackId`, not `id`.
- `executeQuery` could return D1's response typed exactly; tsc would then flag
  this whole class of misread. Today that costs four dead fallbacks in the
  permission code and `route-new.ts`.
- Reads were not swept. The customer leak turned up by chance; a sweep of
  GET handlers for private data is owed. Swept later the same day:
  `2026-10-02-read-routes.md`.
- `POST /api/orders` takes orders from the public checkout and writes
  `customers` and `orders` rows; worth a look at what stops invented ones.
- The Loop fan routes were left open as fan flows; their own code and pass
  checks were not reviewed here.
- `src/middleware.ts` still says `getUserFromRequest` decodes without
  verifying and that the repair is "still owed". It verifies now.
