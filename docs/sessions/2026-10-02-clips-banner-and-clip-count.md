# 2026-10-02 · The /clips debug banner, and the clip count the social sync reports

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

## Same misread elsewhere (not fixed here)

Other callers of `executeQuery` from `@/lib/db` read its response at the wrong
depth. Found by reading the code, not by running it:

- `src/app/api/likes/route.ts:176` and `:235` read `result.meta.*`. `meta` is
  not at the top, so the like or unlike is written and the route then throws
  into its 500. Used by `LikeButton` and `TrackActions`.
- `src/app/api/arsenal/sync/route.ts:375-378`: the go-live phase never adds
  to `madePublic`.
- `src/app/api/arsenal/sync-from-stream/route.ts:170`: `ignored` is always 0;
  a duplicate counts as synced.
- `src/app/api/tracks/route.ts:100`: a new track comes back without its id.

`src/lib/loop/*` uses `@/lib/loop/db`, whose `executeQuery` returns the meta
itself, so those reads are right.
