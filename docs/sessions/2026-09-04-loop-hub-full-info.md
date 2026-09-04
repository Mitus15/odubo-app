# 2026-09-04 — The /loop hub carries the whole night

## What changed

The pre-phase /loop page (the page behind the printed poster's QR) used to be a
single locked viewport: slogan, figure, date line, Get Pass, two module
buttons. It now scrolls — the poster is the cover, the page is the sleeve's
back.

**Files:**

- `src/components/loop/gathering/GatheringPoster.tsx` — restructured into
  three sections:
  1. **The poster** (one full viewport, unchanged in spirit) — now carries the
     printed poster's big line, `AN ALBUM BY MANI ODUBO`, under the slogan,
     plus a "The full night ↓" scroll cue (anchor + smooth `scrollIntoView`,
     because the document doesn't scroll — the root layout's `<main>` does).
  2. **The Night** — the poster's info in full: the record performed front to
     back with the band, outdoors in the courtyard and recorded for the
     release; when (long date · doors · the album at 8); where; dress code
     (from `event.theme`); entry (live `priceLabel` · 19+ · admits one);
     barbecue; what the event code is. Closes with the closed-circle line —
     registration ends on the night.
  3. **Step Inside** — every door a guest needs: **1984, the lead single**
     (featured ink card → `/music`, which resolves to the newest album, where
     the album player and the stem field live), The Programme + Cover Contest
     (same ModuleSheets as before, now with one-line blurbs), The Store
     (`/loop/store`), Find Your Code (`/loop/code`), The Journal
     (`/loop/journal`, still conditional on a published issue), Legacy
     (`/loop/legacy`), and the Get Pass CTA restated at the end of the read.
- `src/components/loop/states/GatheringHome.tsx` — added a server-formatted
  `fullDateLabel` ("Saturday, September 26") for the info section; short label
  unchanged for the poster line, still venue-timezone authoritative.

## Decisions

- **19+ is stated on the hub** ("Entry" row). The artwork still doesn't carry
  it (known follow-up in the memory/worklist); the web page giving guests full
  info was the point of this change.
- **"The album at 8" is hardcoded copy** in the When row. It's the locked
  programme (2026-08-25, reaffirmed 2026-09-03); the authoritative hour-by-hour
  stays in D1 `run_of_show` behind The Programme module. If the 8pm slot ever
  moves, this line moves with it.
- **The 1984 card links to `/music`, not an album UUID** — same reasoning as
  the nav commit (d81e60f): the redirect owns the lookup. The card sells the
  stem field without claiming 1984 itself is a field yet (only News Peak has a
  published pack; 1984's stems are still to come).
- Module buttons left the hero for Step Inside — the hero stays a poster; the
  nav lives where the reading happens.

## Verified

- Rendered at 390×844 via headless Chrome: hero (credit line, live $5 price
  from `loop_settings`), The Night rows, Step Inside cards, footer.
- `tsc --noEmit`: no new errors (pre-existing baseline untouched).
- `next lint` on both files: clean.
- `npm test -- --testPathPattern="loop"`: same 3 pre-existing unrelated
  failures with and without the change (emailTemplates, videos.get,
  deliveryFieldMap).

## Worktree note

This worktree has no `node_modules`; a symlink to the main repo's was added
(untracked). Turbopack refuses it ("Next.js package not found") — run webpack
dev instead: `node node_modules/next/dist/bin/next dev -p <port>`.
