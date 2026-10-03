# /fly: the fall

**2026-10-02.** The flight at `/fly` (phase 1, live since `d8b9ee9`) becomes a fall: Recoolman,
sent down from heaven, falls through the sky of the whole album. Owner's decisions and the
build's architecture, with the alternatives weighed.

## Why

The owner played phase 1 on his phone. Steering was twitchy; the speed barely ramped and the
world stopped changing after about 700 m; only the middle corridor mattered; "fly close to
the walls" could not be judged without touching them; the world meant nothing. What he
wanted all along: at the start of the album, Welcome, Mitus (Recoolman) is sent down from
heaven, and the game is a downward dive through obstacles, a metaphor for life, where you can
go anywhere and skill makes it more fun, and later people race.

## The owner's decisions

1. He falls **through the sky for the whole album**: each song a lower layer of sky, the
   Earth closer song by song, landing with Ghost World. This replaces the canon's "take-off
   at the end of Welcome" (CANON.md wording is proposed to the owner, not edited here).
2. A race is won by being **deepest when the song ends**. Everyone hears the whole song.
3. A hit **slows you down**; it never ends the run.
4. **Each song is a level; the intro and the three interludes are skippable cutscenes.**
5. **All 14 songs play in the game, for everyone**, past the album's release gate. He was
   told anyone can then save the files and pre-order early access is lost, and confirmed.
   Game-only, behind a kill switch; `/api/tracks` and `audioAccess.ts` are unchanged.
6. **Two modes:** Songs (each level alone) and Album (the whole album in order).
7. Default steering sensitivity **14** (was 18).

## Architecture

**Space is the course, time is the song.** Stone is laid out by depth, so a player who falls
faster reaches deeper, harder stone; the song only drives light, colour and the shadow's lag.
A level ends at exactly `seconds × 120` engine steps.

- **Engine** (`src/components/fly/engine/`): path space `s` (depth, down +), `x`, `y` (the
  cross-section, both steerable). Fixed 1/120 s steps, a critically damped spring toward a
  quantised aim (1/64 m), lateral speed capped at `max(12, 0.45 × speed)`. Only + − × ÷,
  `Math.sqrt` and friends inside a step; `detmath.ts` gives sine and cosine for course
  building. A source-scan test bans the rest. So a run replays bit for bit from its
  InputLog, which is how a leaderboard will verify depths (Build C).
- **Courses** (`course.ts`, `patterns.ts`): a safe path from floor to floor, each step no
  longer than `0.7 × 0.45 × (spacing − 70 × 0.35)`, so it is reachable at top speed after a
  0.35 s reaction. Each section is built from `rng(hash(seed, k))`, pure in k, in any order.
  Floors are boxes cut around holes (`floor.ts`), every hole edge on a 5 cm grid. Patterns:
  plates, grid (with pinched narrow cells), one way, cracks, open air; pillars, shards and
  gates between floors, kept out of a corridor around the safe line.
- **Scoring is flow, flow is speed** (`rules.ts`): narrow thread +0.14, medium +0.07, wide
  +0.015, the safe hole +0.015 whatever its size, gate +0.06, kiss +0.03..0.08 (closer pays
  more, within 0.6 m), hug +0.12/s alongside a pillar. Flow drains 0.02/s always and
  another 0.04/s after 2.5 s without a gain, so the safe path alone holds base speed (the
  bots measure about 30.2 m/s on every level) and only risk builds speed.
- **Judging closeness:** heaven's light is straight above, so his shadow falls on the stone
  below him (a shader decal, lagging a beat in 1984, News Peak and The Mind Pt 1); stone
  glows as he nears it; a kiss rings out across the stone it touched. Stone above him melts
  away (dithered), so the floor he just fell through never blocks the camera.
- **Medals per level**, like a racing game's target times (`album.ts` RECIPES), measured
  with bots (`bots.ts`): bronze just above the safe pilot, gold near the best bot.
  `flyMedals.test.ts` keeps them honest. To be retuned once the owner has played.
- **Audio**: the game owns two `<audio>` elements (`SongAudio.ts`), unlocked in the tap, the
  next album song preloaded and swapped in. The engine steps to the song's clock; a stall
  pauses the fall. The site's music player is paused when a run starts. Songs come from
  `/api/game/fly/audio/[slug]?k=<signed 6 h token>` minted by the dynamic page, redirecting
  to a 1 h R2 presign. Kill switch: D1 `loop_settings` key `fly_all_songs` = `off` gates the
  game like the album page (a released single still plays); no row means open; a read error
  means gated.
- **Rendering**: one instanced mesh per form kind; colours are uniforms on the LiveLook
  (`look.ts`) blended between skies, never a shader recompile. The camera hangs over his head
  and looks about 74° down; he sits in the lower third and floors rise from the middle.

## Alternatives weighed

- *A random endless world* (phase 1): rejected for racing. Fixed courses per song make skill
  learnable and runs comparable, the Trackmania model.
- *Points for proximity*: rejected. It could not be judged without touching. Depth is the
  one number; clean lines are worth speed.
- *Music-shaped geometry* (loud parts denser): rejected. Players at different speeds would
  meet the music at different depths; music drives light and colour only.
- *The site's global music player*: rejected for the game. Its `play()` comes after network
  round trips, so iOS refuses it outside the tap; the game needs a clock it controls.
- *A separate swept collision*: unnecessary. At 70 m/s one step is 0.58 m, under the
  thinnest stone plus his body (1.7 m), and a test enforces it.

## Later

- B: signature mechanics per song with the owner (beat-synced apertures, the badge).
- C: per-song leaderboard verified by replay, other players' ghosts (migration 170).
- D: live races.
