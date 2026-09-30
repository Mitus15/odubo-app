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

## Effects that dance with him

All deterministic, all on the song's own bar grid (`beats.py`: tempo from
shape.json, the phase and the downbeat from the master's onsets):
- **freeze**: time warps rather than cuts. Near each downbeat the picture
  crawls for 0.18 s, then runs a little fast to be back on time by the next
  bar line, so a clip's length and its sync never change (the living poster's
  method, `living-poster.ts:865`, rebuilt as a source-frame map).
- **flip**: the field alternates each bar with its sibling colour (the hue
  turned 28 degrees, same lightness and chroma, ink still 7:1).
- **the shadow**: in step, or lagging a beat where The Game pulls.
- **the Warhol grid** (`film:grid`): one moment in all fourteen colourways,
  closed by the Danceman and the wordmark. The album post.

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

## The gloss look (2026-09-29, later)

The owner asked how far the June take could go toward the iPod ads' clean
silhouettes with the cover's glossy tri-tone. Tested on the golden 20 s.

**The cutout was the limit, not the style.** The selfie segmenter swelled
into the dark TV whenever his head or arms crossed it, and lost his feet.
Robust Video Matting (`matte.py`), a video model for whole bodies with a
memory of earlier frames, keeps his head, hands and sneakers and needs no
screen rule. It runs at 20 fps on the M1 Pro. It is GPL-3.0, so it loads from
the torch hub cache and is never vendored. The selfie segmenter stays as the
fallback (`--matte=selfie`).

**The style is cut from fields, at the output size.** `figure --look=gloss`
writes the outline and the light as smooth fields at the mask's size;
compose cuts them after scaling, with a one pixel anti-aliased edge
(`cut()`). An edge is a clean curve at any scale, not an upscaled staircase,
and styling costs the same for a 4K take (33 s for the golden 20 s, down
from 166 s when the fields were worked at full size).

**What the cover is.** Its ring is the ground's own colour (sand on sand),
not `SAND_DEEP`: the light opens him to the field he stands on. The pools nest
by themselves because the core is a higher level of the same smooth field.

Tried and dropped, with reasons:

| Tried | What it did | Instead |
| --- | --- | --- |
| tone from raw brightness | light jeans read as lit, the figure opened into outlines | light against its neighbourhood (`GLOSS_SHAPE`): creases and edges of limbs, not pale cloth |
| his own tone range (percentiles) | how much of him was lit changed with clothes and pose | a fixed share lit (`GLOSS_LIT` 80/93), anchors eased over time |
| a thin rim (0.3% of height) | pools touched the outline, a double contour | 0.8%: he reads as one shape first |
| every tone melting (`blend`) | airbrushed, not glossy | only the core melts into its ring (`gloss`); outline and ring stay hard |
| 0.22% outline smoothing | the segmenter's wobble survived | 0.5% |

Not proven: a 4K take shot to the spec. A pool on his face can read as an
opening in the head when he faces the camera; watch it on the real take.

## The seed, and the growth (2026-09-29, later)

The owner: the badge "should be smaller", and "the kingdom of God is like a
mustard seed". So the badge is the least of all seeds on his heart, and each
clip's outro is the parable: it grows into the Danceman, the greatest. He
also asked for smoother tracking and a smoother final transition.

- **Size.** 0.11 of his shoulder width (was 0.26): about 20 px on the
  1080x1920 clip, down from 47. Still reads as the quatrefoil.
- **Tracking.** The take is recorded, so the heart is smoothed both ways in
  time (`HeartPath`: a centred median for the pose model's glitches, then a
  Gaussian; size and angle much more than position). Measured on the golden
  20 s: the old tracker ran 4 frames (133 ms) behind his body and about 10 px
  off his heart; the new one has no lag and sits within a pixel. Frame to frame
  shake as drawn: 1.12 px before, 0.47 px now. Side-on is judged against his
  widest (the 90th percentile over 10 s), so a long turn stays a turn.
- **Drawing.** The badge is drawn at sub-pixel precision (`stamp`), from a
  pyramid of signed distance fields (`outro.Marks`), so it glides instead of
  stepping pixel to pixel, is sharp at 20 px and at 600 px, and its ink keyline
  is the same field pushed outward.
- **The growth.** One continuous motion over the last 1.5 s of the dance and
  the 1.5 s after: position, size, colour and shape each ease in and out, and
  they overlap. Size grows steadily in proportion (log scale), so it doubles
  and doubles again instead of inflating at the end. It turns to ink from the
  edge in (the keyline draws in while the white shrinks away), because a
  colour fade passes through a dull brown that sinks into some fields. The
  in-between of seal and Danceman happens while it is still small. He fades
  over 1 s (was 0.6). Clip lengths are unchanged.

## The seal is the player's marker, and the right seal (2026-09-29, later)

The owner set the chest badge aside: it did not read as embroidery. Instead,
"a character-like icon, as if someone was using a controller": the sign a
game puts on the character you play, tasteful, and the foundation of how
the game will look. `--marker=` on compose, cut and grid:

- `crown` (default): the seal floating over his head, as the Sims (EA) mark
  the one being played. 0.2 of his facing shoulder width, rising and settling
  once a bar from each downbeat. Never hides when he turns away, never
  shrinks when he turns side-on: the player's marker stays on the player.
- `ground`: the seal flat on the floor under his stance, as sports games ring
  the player you hold, turning once every eight bars. Its ending still shows
  the in-between of seal and Danceman at size; needs its own if chosen.
- `heart`: the first design, kept for comparison.

**The owner chose the crown (2026-09-30).** `ground` and `heart` stay as
options for comparison, not for use. The canon (the badge on the heart, a
circumcision of the heart) is untouched until he says how it reads now.

**The seal was the wrong drawing.** `public/brand-logos/odubo-icon.svg` had a
point on top: the old seal. The right one is closed, indented top and bottom,
with the four-pointed star in the middle, and the only file drawing it was
`odubo-logo.png`. Every vector on the owner's drive had the point too.
`scripts/brand/build-odubo-seal.py` traces the PNG (averaged with its mirrors:
the drawing is symmetric to 99.4%, so the seal is now exactly symmetric) into
`public/brand-logos/odubo-brand/odubo-seal.svg`, 99.4% the same shape as the
drawing, registered as `ODUBO_SEAL` in `src/lib/brand/marks.ts`. The old SVG is
deleted; nothing else used it.

The growth now turns the seal into the Danceman early, while it is small
(u 0.15 to 0.55), so the in-between is brief and it is the Danceman that grows.

## The vinyl's cover is the grid (2026-09-30)

The owner: the grid for the vinyl, the face for streaming. The grid is the
whole album in one image (fourteen squares, one per song in its colour, closed
by the Danceman and the wordmark); the face cover reads at thumbnail size on
Spotify, where the grid's squares turn to specks. This settles what the cover
contest (`loop-cover-contest.md`) was for, now that the night is off.

`film:grid` draws the gloss look through the same `compose.paint` as the
clips, cut at each square's own size, and `--size=vinyl` renders 3788 px: a
12.375 in jacket with 1/8 in bleed each side at 300 dpi (2 s). Waiting on: the
real take, the owner's pick of the moment, his colours per song, and the
pressing plant's template.
