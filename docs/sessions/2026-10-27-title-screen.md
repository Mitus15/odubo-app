# 2026-10-27: the site set in the room (site plan, Phase 1)

His go: "go ahea" (after the plan read-back). Branch `claude/site-title-screen`, off main 3940571a.
Every decision, with his words, is in `docs/decisions/the-title-screen.md`.

## How it went

1. **A title screen on the Brand Kit's sand paper.** He found it "less artistic, and more
   corporate".
2. **The room.** The page takes the level's field colour, so the dancer stands in a colour with no
   edge.
3. **His notes, the same night:**
   - more colours;
   - Gear's space, swipe and button;
   - every screen size;
   - Odubo Studio, not Mani, is the site's name;
   - the danceman alone in the header, and symbols in place of words;
   - Gear's colours from the pieces;
   - a Yeezy-style grid;
   - one danceman, flying into the outro;
   - silent copies, with no HUD in the video;
   - "a rectangle to cover the hud";
   - a coded HUD;
   - three pages, with the lock kept for the game.

## His look from the phone, the same day

Preview c89e4c99 on his phone. His notes: the gear shadows and reflection too hard, the piece's page
a different store (dark, huge photo, "Back to Shop" into the old store, and its close into the
clips), the danceman and the video blurry at first, then: the piece should fly into its page like
the danceman, everything faster, and "sweep the whole public facing app".

What changed is in `docs/decisions/the-title-screen.md` under "His notes from his phone".
Debugging worth keeping:

- **The blurry start was three things.** Chrome now plays HLS natively and opens on 240p; the
  clips' hls.js settings started low, capped on a "3g" guess, and gave a fragment 1.5 s before
  dropping to 240p; and hls.js starts loading before a MANIFEST_PARSED listener can set the start
  level (fix: `autoStartLoad: false`, then `startLoad`).
- **Stream's stills are darker than the room** (SD formula on an HD copy); `/stills/<uid>.jpg`
  corrects them with sharp's `recomb`.
- **The in-app browser pane cannot run view transitions** (every one, even a trivial one, aborts
  with InvalidStateError) and throttles timers to 1 s, so hls.js's bandwidth reads are wrong
  there. The flight and the video were checked in a separate headless Chrome driven over CDP
  (scratchpad scripts `flight.cjs`, `video.cjs`), with the flight slowed 6x to see its path.
- **lib/levels is read by client code** (RoomScreen, FocusView), so nothing in it may import a
  server-only library: the still's sharp step lives in `lib/stillsServer.ts`.
- **next.config gives every `*.png` / `*.jpg` a year's immutable Cache-Control**, over a route's
  own. The share cards have no extension for that reason; the stills set
  `Vercel-CDN-Cache-Control`.

## On a weak line, the same night

He found only two pieces' photos on /gear, and the videos slow on poor wifi. What changed is in
`docs/decisions/the-title-screen.md` under "On a weak line". Debugging worth keeping:

- **Only the eager photos stood.** The row's first two photos were `loading="eager"`, the rest lazy,
  and on his iPhone the lazy ones in the sideways row never loaded. Chromium loads them, so the
  in-app browser cannot show this; the row now asks for its photos itself.
- **What a phone waits for on the home page** (measured on the preview, compressed): HTML 12 KB,
  CSS 46 KB (render-blocking), fonts 73 KB, the still 27 KB, script 315 KB before hydration, and
  hls.js 157 KB more off Apple. Stream's copy: 1080p averages 0.79 Mbps in 4 s pieces (231 KB the
  first), so the video was never the heavy part; the wait was the order.
- **Stream's `clientBandwidthHint` caps the manifest to one rendition**, it does not reorder it, so
  it cannot set where Apple's player starts.
- **The checks** ran in headless Chrome over CDP with the line throttled (scratchpad `net/slow.cjs`:
  `home`, `apple` with `navigator.vendor` faked, `focus`, `gear`). Not checked on an iPhone.

## Where it stands

- **Home and /links:**
  - three pages: the room, the lock, the outro;
  - a tap on the dancer opens `FocusView`: the performances swiped through, the coded HUD, and an
    X or the phone's back to come out.
- **/gear:**
  - the pieces stand on the lacquer floor, each in a room tinted from its own photo
    (`lib/store/pieceLook.ts`, read on the server);
  - a Yeezy-style grid one tap away.
- **/levels, /levels/[id], /music:** all set in the room.
- **The site copies:**
  - all 15 songs are clean and silent, with the seal kept, in BT.709, on Stream, and linked in
    `campaigns.site_video`;
  - migration 170 was run through the D1 API on his go;
  - made by `scripts/loop/posts/site_copies.py`; the ledger and log are in Work files/catalogue;
  - each opens and closes like its YouTube cut, fading in from its field and out to it (his word,
    the same night), cut from the renders already made, no render again.
- **Film tool:** `compose --hud=none` and `--marker=none`, and the plain stage
  `data/loop/film/shows/site.json`. Its 147 tests pass.
- **`db.ts`:** reads retry once when a connection drops.

## Checked

**On the dev server**, with real D1, at 375×812, 375×640, 812×375, 768×1024 and 1366×860.
Each copy's colour was read from the browser's own decode (within 3 to 5 levels of its room).

**Tests:** `npm test` passes, except the 2 failures that were already there. tsc stands at 845
errors (the baseline is 850).

**Not checked:** a phone, and the live site.

## Next

- His look on a phone, from the Vercel preview. Merging to main is the deploy, so it waits on his
  OK.
- **Not built:**
  - the outfit in each level;
  - the welcome emails in the game's voice;
  - the old 15-second popup, still to come off /clips, /store and /media;
  - what lives on the lock page ("the game, once its time").
- **To clear up:** two unused Stream uploads from before the colour fix (in the ledger's
  `replaced`).
