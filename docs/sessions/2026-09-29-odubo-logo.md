# 2026-09-29 · The Odubo logo, rebuilt and rolled out

The owner retired the MadisonSquare ODUBO ("too much of its own personality to
complement the danceman") and asked for ODUBO in Libre Baskerville over the
icon. Built, shown as a sheet (Bold recommended, Regular alternate, light,
black, size ladder), owner chose **Bold** and said roll it out. The decision
and the size rule live in `docs/decisions/odubo-logo.md`.

## What changed

**The files**
- `public/brand-logos/odubo-brand/odubo-lockup.svg`: the new standard logo.
- `public/brand-logos/odubo-brand/odubo-mark.svg`: the danceman alone, clean
  (no white export sliver), root fill.
- `src/lib/brand/marks.ts`: `ODUBO_LOCKUP`, `ODUBO_MARK` and their aspects.
  The only place a path to either file is written.
- `scripts/brand/build-odubo-lockup.py` + `scripts/brand/fonts/` (Libre
  Baskerville v2.005 variable, OFL): regenerates both files.

**The site** (brush ODUBO → new marks)
- Homepage first-visit entrance: full lockup at 180px.
- /loop playbill footer (`GatheringPoster`): lockup at 64px in the page's ink,
  drawn through a CSS mask in `currentColor`. Was MadisonSquare at 40px.
- Store chrome, dancer alone, all at **32px phone / 40px desktop**: the store
  browse header (`ProductBrowse`), product detail feed, product detail modal,
  cart modal, Maison modal, the product page. They ranged 24 to 80px before;
  the thin brush word hid the spread, the solid dancer would not have.
- 404 and the watch page's shop tile: dancer alone.
- `ProductDetailModal` dropped its `invert()` filter: on dark products it
  switched to a light header and inverted the oxblood logo to pale teal.

**The poster engine** (`src/lib/loop/poster/layout.ts`)
- `ODUBO_SRC` = `ODUBO_LOCKUP`. The lockup is stacked (0.87:1) where
  MadisonSquare was 2.58:1, so all four credits rows (event poster, living
  poster, ticket, Facebook cover) now size it on **height** (`ODUBO_H`), not
  width. On the old widths it would have stood three times taller.
- Air under the "presented by" labels raised (poster 28→38, ticket 18→26,
  banner 16→22) because ODUBO's caps now meet the label first.
- Rendered the whole kit before and after (`poster-kit.ts --out=…`). Ticket body
  is pixel-identical below its credits; the event poster's hero gives up a
  little height to the taller credits row on print and feed; story unchanged.
- Test fixture updated to the lockup's real ratio. 34/34 layout tests pass,
  including the living poster, which was not rendered (needs video frames).

**The press kit**
- `public/loop/press/logos/odubo-studio.svg` replaced; `npm run loop:press --
  --no-reels` rebuilt and **re-uploaded the zip to R2** and rewrote the
  manifest. Reels kept (6/6), artwork hashes unchanged.

## Not changed, on purpose
- The press kit **artwork** (posters, flyers, ticket, cover images) still shows
  MadisonSquare: it is the Vol 1 campaign as printed. Re-render only if the
  owner wants the kit and the printed posters in town to differ.
- `Danceman_Logo_Red.png` uses (emails, SEO/schema.org, footers, admin): already
  the dancer alone at small sizes.
- `odubo-logo.png` (quatrefoil seal), `odubo.png`/`odubo-white.png` (these are
  the **B.A.A.D** wordmark despite the name), the embossed dancer: not the ODUBO
  wordmark, untouched.

## Found in passing
- `src/app/store/StorePageClient.tsx` has no importers: `/store` renders
  `HomePageClient` with the store modal. Its logo was swapped for consistency
  only; the file is a deletion candidate.
- `tsc --noEmit`: 850 errors (baseline 855), none in changed lines.
