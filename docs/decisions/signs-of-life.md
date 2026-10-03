# The album is Signs of Life

**Decided 2026-10-03 by the owner.** "Since the event is not a thing anymore,
the album is no longer called Loop Soul. I want it to be called Signs of Life."

Loop Soul was the name of two things: the album and the night it was going to
be played at. The night was called off for good on 2026-09-29
([loop-night-archived](loop-night-archived.md)). Now the names split:

| Name | What it is |
|---|---|
| **Signs of Life** | The album by Mani Odubo. Fourteen songs, the one-take film, Recoolman's flight, the singles. |
| **Loop Soul** | The live night. A possible event series. Keeps its name everywhere the night is meant: the pass, the ticket, the door, the store's pass, the legal page, the Wall, the camera filter, the press kit, the journal. |

This overrules [loop-soul-is-the-album](loop-soul-is-the-album.md) on the
name only. Everything else in that doc about the record still stands.

## Where the name lives

- **Code:** `src/lib/loop/albumName.ts`, `ALBUM_NAME`. One constant, no
  imports. Every page about the record reads it; none spells the name. Its
  own module on purpose: the film branch restructures `songs.json`, and a
  name kept there would have merged away silently (the build ignores type
  errors, so a page would have printed `undefined`).
- **Data:** D1 `albums.title`, `distribution_releases.title` and
  `warehouse_projects.title` are `Signs of Life`, and the `loop-soul` entity
  now describes an event series. Done by `scripts/loop/rename-album.ts`
  (dry run by default, `--apply` to write, re-runs change nothing). A single's
  "from Signs of Life" comes from `albums.title`, so it went live with the
  data, before any deploy.
- **The guard:** `src/__tests__/loopAlbumName.test.ts` fails if "Loop Soul"
  appears outside a comment on any page about the record, or anywhere in
  `songs.json`.
- **Canon:** the Game canon's section is now "Signs of Life, the album's
  book" (`~/Documents/Apps/Game/game/docs/CANON.md`, not a git repo). Only the
  name changed: the heading, the opening paragraph (with a dated note that it
  was Loop Soul) and two bullets.

## The album's address: /signsoflife

Owner's pick: add `/signsoflife`, keep `/loop` working.

- The middleware serves `/signsoflife`, `/signsoflife/album`,
  `/signsoflife/film` and `/signsoflife/<song>` from the same `/loop` pages
  (a rewrite: the address bar keeps the new name). The list is
  `src/lib/loop/albumAddress.ts`.
- **Only the album's routes.** `/signsoflife/admin`, `/store`, `/code`,
  `/press` and the rest 404, so `/loop/admin`'s gate still has exactly one
  door. Tested in `loopAlbumAddress.test.ts`.
- **What a link people pass around says is `/signsoflife/<slug>`:** the share
  button, the canonical URL, `og:url`, the share card's printed address and a
  film clip's caption (`sharePath` in `singles.ts`).
- **Navigation inside the site stays on `/loop/<slug>`** (`singlePath`). The
  installed home-screen app's scope is `/loop`; links outside it would open
  in a browser sheet.
- `/signsoflife` alone lands on the front single at the album's address
  (`/signsoflife/1984` today), via a header the middleware sets.
- Every `/loop` link already posted, printed or sent keeps working.

## The album cover: no logo

Owner: "No logo on the album cover except record label details in small
size."

- **The streaming cover** (`public/loop/press/cover/loop-soul-cover-art-mani-version.png`,
  the same art in R2 for the distributor and the single pages) carries the
  drawn loop∞Soul wordmark top right. `scripts/loop/cover-without-wordmark.py`
  takes it off (the field from just below, blended; nothing else moves) and
  sets an optional small label line in its place: `--label="..."`. Two drafts
  went to the owner on 2026-10-03, one bare and one reading ODUBO STUDIO.
  **Waiting on the owner for the label line's words**, then: render, upload
  to R2, point `albums.cover_art_url` and the distribution draft at it, and
  replace the press kit copy.
- **The vinyl covers** come from `npm run film:grid`, which lives on the
  unmerged film branch (`claude/billie-jean-gloss`). Its 16 square album grid
  ends on a Danceman square and a wordmark square. The wordmark square has to
  become the small label line. Not touched here: that branch is another
  session's work in progress.

## The two records

The album is pressed and released as two records (songs 1 to 9, songs 10 to
14; `docs/decisions/loop-vinyl.md` on the film branch). **The owner wants each record to have its own
name**, not "Vol. 1" and "Vol. 2". The names are not given yet.

⚠️ The film branch's `songs.json` calls them "Loop Soul Vol. 1" and "Loop Soul
Vol. 2", and its `scripts/loop/split-volumes.ts` writes those titles into D1.
**Do not run the split until the records have their names.** The guard test
fails on that branch until they do, which is the point.

## Merging the film branch after this

`claude/billie-jean-gloss` (and `claude/album-performance-social-plan-4084d5`
under it) was written before the rename. A trial merge conflicts in four files:

- `src/lib/loop/film/songs.json` and `src/lib/loop/songs.ts`: take the film
  branch's structure (the `albums` map). `albumTitle` and `ALBUM_TITLE` are
  gone on both sides; the album's name is `ALBUM_NAME` now.
- `src/app/loop/[single]/page.tsx` and `src/app/loop/album/page.tsx`: take the
  film branch's logic, then name the album with `ALBUM_NAME` wherever it says
  "Loop Soul", and keep `sharePath` for the canonical URL.

Then run `npm test -- loopAlbumName` until it passes. It lists every line still
to change.

## Still says Loop Soul, and is the owner's call

- **The home-screen icon and the intro animation on /loop pages** are the
  infinity, Loop Soul's mark. They show on the album's pages too.
- **The game is called Soul Loop** (`/game/soul-loop`), a play on the old name.
  Its description now says Signs of Life; its name was left alone.
- **Outside the code:** the @loopsoul.ca handle and the loopsoul.ca domain, the
  Shopify `loop-soul` collection (the night's merch drop), the pass emails'
  sender name ("Loop Soul", `loop_settings.email_from`), the admin's Ark
  project titled "Loop Soul", and three draft announcement posts (the night's).
