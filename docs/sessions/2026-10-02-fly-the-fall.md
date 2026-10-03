# The fall: /fly rebuilt (2026-10-02)

**Branch** `worktree-fly-the-fall`. **Decision record** `docs/decisions/fly-the-fall.md`.
**Game note** `docs/game/SOUL-LOOP.md`.

## What happened

1. Phase 1 (the forward glide) was merged to main and pushed live (`d8b9ee9`). The owner
   played it on his phone: too twitchy, boring after a while, only the middle mattered,
   proximity scoring could not be judged, and the world meant nothing. His concept: Welcome
   sends Recoolman down from heaven; the game is a downward dive, a metaphor for life;
   anywhere is reachable; skill should make it more fun; people should race later.
2. Decisions taken with him (see the decision record): the sky for the whole album; deepest
   when the song ends wins; a hit slows you, never ends you; each song a level, the intro
   and interludes skippable cutscenes; every song plays in the game now (he confirmed the
   leak risk); Songs and Album modes; sensitivity 14.
3. Built: a new deterministic engine (2D steering, floors with holes, flow is speed),
   courses per song, the shaft camera, shadow and glow, ghosts, medals per level, the
   game's own audio route and player, both modes, cutscenes, the landing.

## How it was built

- The engine core (detmath, rng, rules, album table, course, patterns, floor, director,
  FallEngine, record, bots) by the lead.
- Three helpers in parallel on separate files: the engine test suite (it found and fixed
  three bugs: a −0 aim that broke bit-exact replays, the same in stored ghosts, and a
  ghost sliding at the start of a run), the audio route and player, and the album
  sequencer with saved progress.
- The scene and game shell by the lead, tuned in a browser at 375×812.
- A review: five reviewers (flow, engine, rendering, audio, UX) and a skeptic per
  finding; 27 confirmed, all fixed (below).

## Tuning, measured with bots

- **First bot runs**: the safe path alone reached gold on hard levels. The safe hole shrank
  to medium at high intensity and paid more, and small steady gains reset the drain timer.
  Fixed: the safe hole always pays 0.015, flow drains all the time (0.02/s, plus 0.04/s after
  2.5 s idle), the kiss band is 0.6 m, and the safe hole never shrinks below 4.4 m.
- **Lattices** paid nothing (every cell was a free wide hole): some cells are now pinched
  narrow.
- **Now**: the safe pilot holds about 30.2 m/s on every level. Careful and bold bots reach
  34 to 61 m/s depending on the level. Medals are set per level from these numbers.

## Fixed in review

- Grid levels built up to 1,314 floor pieces against a pool of 760: whole floors could go
  undrawn yet solid. Pools are now 2048/320/32, overflow waits for a free slot, and a
  test checks every level fits with 20% to spare.
- Menus could not scroll by touch (the steering surface cancelled every touchmove): lists
  are marked `data-fly-scroll` and left alone.
- A song file a few ms shorter than songs.json could strand a level: the clock now always
  finishes the song in silence, and the game steps a level to its end when its song ends.
- Album hand-offs inside the frame drew the next stage from the last one's position, and
  the clouds were lost; the view now resyncs on a new run.
- The Welcome camera rolled 90° in one frame; its up vector now blends.
- Others: practice runs (`?t`, `?flow`) never save an album best; a continued album that
  lands reads as finished; the passing card waits through a cutscene and sits below the
  title; the title's fall is silent (no flashes or buzz); late taps can no longer skip a
  level or pause a finished one; lock-screen Play while hidden is ignored; keys release
  on blur; Enter and Space press focused buttons; touch targets are at least 44 px; the
  result screens scroll in landscape; song links refresh after five hours; the phone
  pausing the song shows the pause screen; dust no longer jumps at the 2 km rebase; the
  reflection map renders once per sky; cutscene skies stay open.
- Also: a song that says it plays but never moves (a device with no audio output) goes
  on in silence after 2.5 s rather than freezing; "Loading the song" shows while a song
  keeps the fall waiting.

## Verified

- `npm test -- --testPathPattern=src/__tests__/fly`: 10 suites, 460+ tests, all passing
  (determinism, replay, course invariants, flyability of every level at 30 and 70 m/s,
  scoring, album sequencing, progress storage, audio gate and player, pool capacity).
- `npx tsc --noEmit`: no errors in any flight file. ESLint clean.
- Every one of the 14 songs streams through the game route (302 to `audio/mp4`, byte
  ranges); a bad token and an unknown slug are 404; the site's own track route still 404s
  an unreleased song for an anonymous visitor.
- Production has `ANTHEM_VOTE_SECRET` (the token fallback) and the R2 settings.
- Headless Chrome at 375×812: title, songs list, Welcome cutscene and Skip, 1984 and Rap
  levels, the result screen, an album hand-off through an interlude.

## For the owner

- Play it: https://www.odubostudio.com/fly (Album, or Songs).
- Tell me: steering feel (`?sens=` to try other values; `?accel=0` turns off the flick
  boost), the camera, whether holes and the shadow read, whether flow feels like speed,
  and each level's look. Medals are a first guess.
- To close the songs again: D1 `loop_settings`, key `fly_all_songs`, value `off`.
- Canon: proposed wording for CANON.md is in the chat; not yet applied.
- Optional: set `FLY_AUDIO_SECRET` in Vercel (it falls back to `ANTHEM_VOTE_SECRET`).

## Next

- Signature mechanics per song, with the owner.
- Leaderboards verified by replay, world ghosts (migration 170).
- Live races.
