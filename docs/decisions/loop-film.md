# The Loop Soul film: one take, every surface

Decided 2026-09-29 with the owner. The Oct 10 night was called off; the album
goes out as a film of the whole album danced in one take, cut into clips, then
singles, then the album. The approved plan is in the owner's plan file
(`~/.claude/plans/users-maniodubo-documents-apple-add-ref-declarative-tome.md`);
this records what was built and where it departs from that plan.

## The look

The 2004 iPod silhouette ads sampled into the Loop Soul cover: an ink figure
with pale highlight cuts on one flat colour per song, no room, ever. His
shadow on the ground. The quatrefoil seal on his heart as the one bright
thing. Each clip ends with the badge leaving his heart for the centre and
becoming the Danceman.

## Decisions, and why

- **One pipeline, label maps in the middle.** `figure` writes a label map
  (field, ink, mid, highlight) and an alpha, not colour. Colourways, downbeat
  flips and the Warhol grid are a lookup at compose time; the expensive stages
  (segmentation, styling) run once per take.
- **One compose engine, any aspect.** The field is flat, so the virtual camera
  can pull back past what the phone saw. 9:16 and 16:9 are rendered from the
  same data, never cropped from each other; the clips and the film match.
- **Palette relative to sand, in OKLCH.** Each colourway keeps the cover's
  relationships to sand; sand reproduces the cover exactly (tested). Ink always
  reads at 7:1 or better on the defaults.
- **Two grounds.** The camera holds a steady median ground; the shadow meets
  his lowest point this frame, and holds the floor when he is in the air.
- **Alignment by listening.** The playlist is played aloud with a tone at the
  head; each master locks to the room audio by onset cross-correlation, refined
  between samples. Correlation is the lock signal (present 0.3 to 0.7, absent
  under 0.1, measured); z is not, because music repeats every beat.
- **Pose on the GPU.** MediaPipe 1.0.1's pose detector aborts on the CPU
  delegate on macOS; the GPU delegate works with RGBA frames.
- **The empty room trims the mask.** A per-pixel median over the whole take is
  the room without him; where the segmenter is unsure and the pixel is just the
  room, it is the room. Only small holes are filled: a large hole is real air.

## Where it departs from the plan

| Plan | Built | Why |
| --- | --- | --- |
| tables `film_chapters`, `film_cards`, `film_world` | `loop_film_*` | D1 already has `films` and `film_*` for the older Films feature |
| the morph by `flubber` (npm) | signed distance fields (numpy, scipy) | no new dependency; works on marks of any topology |
| `preorder.ts` reads a vinyl ship date | pre-order by product tags (`preorder`, `ships:<when>`) | `DROP_DATE` switches the WHOLE store; a vinyl date there would make every piece a pre-order |
| the vinyl via `loop-soul-drop.ts` | its own script, `loop-soul-vinyl.ts` | the drop filer only updates; creating is a different, rarer act |
| publish schedules through PostForMe | publish stages social drafts | `stage-reel.mjs` holds that posting is a person pressing publish; kept |
| `run.mjs` | `run.py` | the pipeline is Python end to end |
| the badge at 0.28 down the torso | 0.30 down, 0.22 toward his left shoulder | on the heart, per the canon |
| KJV margin notes: strip all braces | strip only braces with a colon | braces also hold the translators' supplied words ("Blessed {is} the man"); the planned regex would have deleted them |

## What is proven, and what is not

- Proven on 20 s of the June take (`npm run film:golden`, 4.5 minutes): all
  stages, a 9:16 clip with card and outro (song and tease audio), the 16:9 song
  cut and film, check-sync PASS (music within 5 ms).
- Not proven: a take shot to the spec (there is none yet), the full 52 minute
  run (about 2 h segmenting, 1 h styling, several hours composing at 4K), the
  transcription with the turbo model (waiting on disk), a real publish.
- The June take's TV behind him confuses the segmenter where his head
  overlaps it; the shoot spec rules screens out.

## Files

`scripts/loop/film/` (the pipeline), `src/lib/loop/film/` (palette, naming,
store, public, caption, kjv, songs), `/loop/admin/film`, `/recoolman`,
`/loop/<slug>`, `/loop/film`, `/game/soul-loop`, `database/migrations/168_loop_film.sql`,
`.claude/skills/loop-film/SKILL.md`.
