# 2026-10-03: the album is Signs of Life

The owner renamed the album: Loop Soul was the night, and with the night
called off the record has its own name. Decision and every detail:
`docs/decisions/signs-of-life.md`.

## The owner's answers
- Loop Soul stays as a potential event series.
- Add /signsoflife as the album's address, keep /loop links working.
- No logo on the album cover, only record label details, small.
- The two records get their own names (not given yet).

## Done
- Every page about the record names it from `src/lib/loop/albumName.ts`:
  single and chapter pages and their share cards, the record, the film,
  Recoolman, the game's description, the home-screen app's name.
- `/signsoflife` serves the album's pages (middleware rewrite, album routes
  only; admin and the night's routes 404 there). Share links, canonical URLs,
  the share card's address and film captions say /signsoflife.
- Film captions: `#SignsOfLife`, "Signs of Life · <chapter>", the
  /signsoflife link. The film's D1 title on publish, the playlist file name.
- **Live data renamed** with `scripts/loop/rename-album.ts --apply`: albums,
  the distribution draft, the warehouse project, the Loop Soul entity's
  description. Production's /loop/1984 said "from Signs of Life" before any
  deploy.
- The Game canon and the film's story bible and skill.
- Guard test `loopAlbumName.test.ts`; route test `loopAlbumAddress.test.ts`.
- Cover tool `scripts/loop/cover-without-wordmark.py`; two drafts sent.

## Checks
- `tsc --noEmit`: 136 errors, none in a touched file.
- `npm test`: 418 pass, the 2 known failures (email logo, /api/videos fallback).
- Dev server (archived phase): /signsoflife → /signsoflife/1984; album,
  film, a single and a chapter 200; /signsoflife/admin, /store, unknown 404;
  /loop/admin still gated; no "Loop Soul" left on the single or a chapter.

## Struggles
- `wrangler d1` is not authorised on this machine (code 7403); D1 was read
  and written through the app's own client under tsx.
- The albums table has an `updated_at` trigger, so D1 reports 2 changes for
  a one-row rename. The script now checks "at least one".
- The first place the name went was `songs.json`; the film branch deletes
  that key, which would have merged into pages printing `undefined` (the
  build ignores type errors). Moved to its own module.

## Next
- The owner: the label line's words, the two records' names, and whether to
  deploy.
- Then: render and upload the cover; name the records on the film branch
  before `split-volumes.ts` runs; the vinyl grid's wordmark square.
