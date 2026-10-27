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
  - made by `scripts/loop/posts/site_copies.py`; the ledger and log are in Work files/catalogue.
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
