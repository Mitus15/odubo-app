# The album is Signs of Life

**Decided 2026-10-03 by the owner.** "Since the event is not a thing anymore,
the album is no longer called Loop Soul. I want it to be called Signs of Life."

Loop Soul was the name of two things: the album and the night it was going to
be played at. The night was called off for good on 2026-09-29
([loop-night-archived](loop-night-archived.md)). Now the names split:

| Name | What it is |
|---|---|
| **Signs of Life** | The album by Mani Odubo, the whole work: fourteen songs, the one-take film, Recoolman's flight, the singles, the home-screen app. **And** the name of its second record (songs 10 to 14). |
| **Loop Soul** | The album's first record (songs 1 to 9, all three singles). **And** the live night, a possible event series, which keeps its name everywhere the night is meant: the pass, the ticket, the door, the store's pass, the legal page, the Wall, the camera filter, the press kit, the journal. |

The record names came the same day, after the rename: "1 side could be loop
soul and the other could be signs of life", with the first record Loop Soul
and the whole called Signs of Life.

**Why it reads right.** The flight runs from Welcome (a soul formed from the
dust) to Ghost World (a ghost world saved). The first record is the life, the
loop: Loop Soul. The second crosses to the other side and ends in the ghost
world, where signs of life mean the most, so the whole takes its name from
where it lands. And everything already out (the 1984 flyers, every shared
link, the drawn mark) said Loop Soul, which stays true of the record 1984 is
on.

**The one rule.** "Signs of Life" now names the whole and a part. On its own
it means the whole (the film, the app, Recoolman's world, a chapter's page).
Where the records appear together they are named as a pair, in order: Loop
Soul, then Signs of Life. The risk it guards against: on a streaming service
the second record stands alone, and a stranger could take its five songs for
the whole album.

This overrules [loop-soul-is-the-album](loop-soul-is-the-album.md) on the
name only. Everything else in that doc about the record still stands.

## Where the name lives

- **Code:** `src/lib/loop/albumName.ts`: `ALBUM_NAME` (the whole) and
  `RECORD_NAMES` (`{1: "Loop Soul", 2: "Signs of Life"}`). No imports. Every page about the record reads it; none spells the name. Its
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
  is spelled out (outside a comment) on any page about the work, if the song
  list's record titles are anything but `RECORD_NAMES`, or if anything else
  in the song list says Loop Soul. A page naming the first record reads
  `RECORD_NAMES[1]` or the data, never the literal.
- **Until the split, D1 holds one album** (all fourteen songs) and it is
  titled Signs of Life, the whole. So a single says "from Signs of Life"
  today; after the split its record is Loop Soul and it will say so.
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

Owner, 2026-10-03: **record 1 is Loop Soul** (songs 1 to 9, Welcome to
Makunahea), **record 2 is Signs of Life** (songs 10 to 14, The Other Side to
Ghost World). Two releases on streaming and two pressings, record 2 after
record 1 (`docs/decisions/loop-vinyl.md` on the film branch).

⚠️ The film branch's `songs.json` still calls them "Loop Soul Vol. 1" and
"Loop Soul Vol. 2", and its `scripts/loop/split-volumes.ts` writes those
titles into D1. **Set them to `Loop Soul` and `Signs of Life` before the split
runs.** The split then renames the album row that exists (today "Signs of
Life", the whole) to Loop Soul, creates Signs of Life for songs 10 to 14, and
does the same to the distribution drafts. The guard test fails on that branch
until the titles are right, which is the point.

Each record needs its own streaming cover; the face drafted above is record
1's unless the owner says otherwise. Record 2 has none yet.

## Merging the film branch after this

`claude/billie-jean-gloss` (and `claude/album-performance-social-plan-4084d5`
under it) was written before the rename. A trial merge conflicts in four files:

- `src/lib/loop/film/songs.json` and `src/lib/loop/songs.ts`: take the film
  branch's structure (the `albums` map), with the titles `Loop Soul` and
  `Signs of Life`. `albumTitle` and `ALBUM_TITLE` are gone on both sides; the
  whole's name is `ALBUM_NAME` now.
- `src/app/loop/[single]/page.tsx` and `src/app/loop/album/page.tsx`: take the
  film branch's logic, then replace each "Loop Soul" by what it means: the
  whole is `ALBUM_NAME`, a record is `albumOfVolume(n).title` (or
  `RECORD_NAMES[n]`). Keep `sharePath` for the canonical URL.

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
