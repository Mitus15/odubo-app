# 2026-10-02 · The /clips debug banner, and D1 writes read where D1 puts them

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

## Found in passing (not fixed)

- `POST /api/arsenal/sync-from-stream` accepts any `Authorization: Bearer …`
  (a TODO says the token is never verified). Anyone can make it list
  Cloudflare Stream and write rows into `videos` (archived, not public).
- `POST /api/setup-likes` runs its CREATE TABLEs with no auth at all.
- `AlbumModal` (mounted by `AlbumEditClient` and `AlbumActions`) sends each
  track to `POST /api/tracks` as FormData; the route reads `req.json()`, so
  that upload should fail every time. It also expects `trackId`, not `id`.
- `executeQuery` could return D1's response typed exactly; tsc would then flag
  this whole class of misread. Today that costs four dead fallbacks in the
  permission code and `route-new.ts`.
