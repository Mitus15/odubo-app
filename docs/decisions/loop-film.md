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

## A dance to someone else's song: Billie Jean (2026-10-02)

The owner, of the gloss look: "it looks so clean", and asked to redo the
Billie Jean video for social in it. That take (`IMG_0191.MOV`, July 2026) is his dance to
Michael Jackson's song, first posted in the old green look, then recoloured
to sand (`media/social-2026-08/`).

**What it needed that the album does not.**
- **A song with no master and no chapter in D1.** `film:dance` (`dance.py`)
  writes the one chapter and the song's place in the take straight into
  `story.json` and `align.json`, the colourway resolved by `palette.ts`; the
  chapter carries its own song file and tempo, and `beats.chapter_grid` builds
  the bar grid from them. No card: a song that is not ours carries no
  scripture.
- **A portrait phone take.** `IMG_0191.MOV` is stored 1920x1080 with a -90
  rotation, and ffmpeg decodes it upright. `ingest.probe` read the stored size,
  so every stage would have squeezed him; it now reads the rotation.
- **A five minute take through the pose model.** mediapipe 1.0.1's GPU
  delegate keeps the Metal copy of every frame until the landmarker closes: 8
  MB a frame at 1080x1920, out of GPU memory at frame 1240 (measured with
  `footprint`). `seg.Pose` gives it frames at most 960 tall and rebuilds it
  every 500 frames. The matte itself was steady at 1.17 GB.

**The sync is his own.** He danced in headphones: the room audio carries no
music (full-take correlation 0.025, noise 0.009). Two independent measures
agree: his DaVinci edit is one continuous piece of the take, 15.90 s in
(silhouette IoU 0.8 to 0.96 against the green render, every second from 5 s
to 282 s), its audio is the MP3 1.167 s in (correlation 0.9, no drift), so the
song starts at take 14.733 s; and the accelerations of his wrists, hips and
ankles line up best with the song's onsets at 14.70 s, the next peaks one beat
either side. `--at=14.72`.

**The head stays ink.** On this take the white print across the back of his
shirt opened a pool of light just under his head, and when he faced the
camera a pool landed on his face: either way he read as headless. The look
test had warned of exactly this. `figure.head_quiet` keeps his head, neck and
the top of his back ink, from the pose, easing out over 0.3 shoulder widths;
light anywhere lower is untouched. The iPod ads never lit a head. Re-run
`film:figure` on the June take to bring the album's renders in line.

**The camera stays inside what the phone saw.** The owner, of the first
sample: "for a sec it seemed theres an arbitrary layer on the left". At take
158.7 s his arm reached past the phone's left edge; the camera, centred on
him, showed that edge as a straight cut through his arm and leg (he touches an
edge on 404 of 9,063 frames). Whenever the phone saw wider than the picture
(9:16 from a portrait take: 1242 px of phone for 1080 of picture), compose
now keeps the camera inside it, so a limb that leaves the phone's view leaves
ours at the same edge, as with any camera. He drifts off centre exactly as far
as he did in the phone. A 16:9 cut of a portrait take cannot be held this way
and would still show the edge.

**The cuts** (in `$FILM_WORK/billie-jean/out/`): the whole song from its first
kick (take 15.84 s) to the end of the take; a 60 s Reel (28 bars from take
147.45 s, the stretch where he moves most, measured per bar from the pose);
a 30 s cut (14 bars from 155.68 s). Each also silent, for adding the song from
a platform's own library.

**Downbeats, noted, not fixed.** `beats.grid` takes the loudest of the four
beats as the downbeat. On Billie Jean that is a snare beat, one beat before
the first kick. The marker's bob does not care; the freeze effect would land
on the wrong beat on a song like it.

## Four effects that dance with him (2026-10-03)

The owner asked what visual effects we could achieve, and picked four for a
look book on Billie Jean, built as film options for the Signs of Life film
too (`--effects=` on compose, cut and dance). Each is read from his body or
the drums, never random, and stays flat and hard-edged.

- **sidewalk** (`floor.py`): the Billie Jean pavement. A footfall is a foot
  that was moving and stops near the floor line (both ways in time, so a
  planted foot is one footfall). It lights the tile under it in the palette's
  highlight: tiles are anchored to the floor, seen from a camera at his chest,
  hold a moment and are gone within half a bar; only lit tiles show. The floor
  is glossy: his outline mirrored at the contact line, a step darker than the
  field, gone within 22% of his height.
- **close** (`effects.close_bars`): in each 8-bar phrase, the bar where his
  feet move most gets a 2.5x close-up of his feet, cut in and out on the
  downbeats; a phrase where his feet barely move gets none. `--close-bars=`
  picks by hand. The fields are cut at output size, so it is as sharp as the
  wide shot.
- **hits** (`hits.py`): Demucs separates the drums once (cached by song). In
  Billie Jean's drum stem both bands fire on every hit, so peak picking heard
  five kicks a second; hits are read on the beat grid instead and told kick or
  snare by the low/high balance averaged per place in the bar (1.1 on the
  kick's beats, 0.57 on the snare's): 565 of 574 beats, a clean
  kick-snare alternation. The field cuts to its sister colour on the snare and
  back on the kick.
- **echo** (`effects.motion_gate`): three earlier outlines (4, 8, 12 frames
  back at full trail) behind him, the lag scaled by how fast his hands and feet
  move, so they sit hidden under him when he is still. The first try mixed ink
  into the field and turned brown; they are the palette's mid and shadow now.
  The gate opens at his 80th percentile of limb speed and is full near his 96th.

**The beat grid, mended on the way.** `beats.pulse` refines the given tempo
within 0.3 bpm with the phase, and the onset times carry the envelope's own
delay (35 ms). With the drums separated, the downbeat is the kick's place the
song's first hit lands on, not the loudest beat (which was a snare on Billie
Jean). The grid is still a fixed tempo; Billie Jean's drums breathe up to 60 ms
against it mid-song (the video edit, most likely), so hits are searched 100 ms
either side of a beat and placed where they actually peak.

## The shadow, on the floor the tiles imply (2026-10-03)

The owner: the shadows "can be much better and match the material and
lighting of the floor that the tiles imply". Up close, two faults: the shadow
was a screen-space shear, blurred all over, painted over the floor; and on the
glossy floor it lay right over the reflection, two dark shapes knotted under
each foot.

`shadow.cast_on_floor` (compose; `cast` stays for the grid's stills):
- the same light as ever (a point h up lands 0.28 h toward the camera and to
  the side), then through the tiles' own perspective (the vanishing point at
  his chest height, the frame's centre), so it widens as it comes nearer and
  lies on the same floor as the tiles
- crisp where it leaves his soles, softening toward its end (2% of his height)
  and a little fainter there, as a shadow's edge goes with distance
- it darkens what is on the floor by the field's own shadow ratio instead of
  painting the shadow colour: a lit tile stays a tile inside it; the
  reflection now darkens what it lies on the same way
- on the glossy floor (`sidewalk`) the light is low and from the side
  (`floor.GLOSS_LIGHT`, squash 0.16, shear 1.6): the shadow lies along the
  floor, clear of the reflection beneath him

`cut`/`melt` moved to `edge.py`, the one drawing rule both compose and the
shadow use.

## The virtual stage: show files, props, the HUD (2026-10-03)

The owner wants a virtual stage: perform from anywhere, then light, dress and
cut it like a concert crossed with an effects edit, for social media rather
than one night. The pipeline already holds the stage (the performer lifted out
of any room, the floor, the light, the camera, the effects). What it lacked was
the show itself.

- **Show files** (`show.py`, `data/loop/film/shows/*.json`): a cue list in bars
  of the song (bar 1 is the first downbeat, from the kick). A cue sets the
  colour, the floor (plain or tiles), the light (key or spot), the effects, the
  camera, the props; it holds until a later cue changes it, like a lighting
  desk. A camera move lasts its `for` bars and returns wide. The old
  `--effects=` flags are a show with no cues. Mistyped cues are refused with
  their bar.
- **Props** (`props.py`): flat ink shapes on the same floor at their own depth,
  sized by its perspective, casting shadows in the same light; a lamp lights the
  floor under it. A street lamp and a microphone stand to start.
- **The spot** (`floor.spotlight`): overhead; the stage dims a step, a pool
  follows him, his shadow pools underfoot.
- **The HUD** (`hud.py`): the seal as player one, world-level numbering (the
  owner did not want "level 100": a season is a world, 1-1 to 1-17), the song,
  his real step count from the footfalls, a progress line. Clear of a Reel's
  top bar and buttons; it fades with him so the Danceman closes alone.

The first show (the street: lamp, spot, tiles, close-ups, echo, hits) was not
it for Billie Jean. The owner: the tiles alone with the subtle shadow and the
subtle effects "go a looong way once the HUD is there". `billie-jean.json` is
that: tiles, echo, two feet close-ups, the HUD. The lamp and the spot stay for
songs that call for them.

## Every staged piece is also a clip that sells (2026-10-03)

The owner runs the feed from /admin/social on his phone and wants every piece
featured on the site too, in the clips feed, opening its product: a lean,
repeatable engine. The site had the parts: a clip (`videos`, type clip) with a
`shopify_product_handle` gets a shop button that opens QuickShop, and the
status sync makes a draft's clip public when PostForMe delivers the post. The
gap: `stage-reel.mjs` wrote only the social draft, so a staged piece never
reached the feed and carried no product.

It now writes the hidden clip too, with `--product=<handle>` (checked in
Shopify first: a typo or an archived product is refused before any upload),
and points the draft at it (`social_content.video_id`). Posted through
PostForMe, the clip goes live by itself; posted by hand from the phone, make
it public in /admin/videos.

## The trail cusps on the jump clap (2026-10-03)

The owner, of the 1-1 Reel: "on the jump clap, the trail animation should
cusp. so trail to the clap and from the clap but not at the clap."

- **Finding the jump clap** (`effects.jump_claps`): his wrists at their
  closest (under 0.15 of his height) with both hands above his nose, and a
  snare within 0.12 s (the song's own clap). Arm swings that cross in front
  pass through "hands together" fast too, so speed alone flagged a dozen
  moments in one minute; overhead and on a snare leaves the two real ones in
  Billie Jean (take 126.47 s and 179.90 s). The cusp stays where his hands meet,
  not on the snare: he lands that clap two frames ahead of the beat, and the
  cusp is for the eye.
- **The cusp** (`effects.echo_lags`): near a clap no echo reaches further back
  than the frames between him and the clap, on both sides. The trail shortens
  as his hands come together, is gone on the clap, and grows back out of the
  clap pose, never reaching past it: a V in time. A first version eased the
  trail shut over 0.15 s before and capped it after, which closed in two frames
  and opened in twelve.

Staged 2026-10-03: `social_content` #8 "1-1 · Billie Jean", its clip `videos`
#553 hidden until posted, opening the Infinity Hoodie. #7 archived.

## Releasing a level: the song is home, the feed gets moments (2026-10-08)

The owner: the 4:48 performance is the core, but how is it worth something
to others "instead of forcing them essentially to watch 5 minutes of me
dancing"? Strangers on a feed give two seconds, then maybe fifteen; people
already hooked choose the whole thing, like a music video. So the full level
is the home (YouTube, the site), and the feed gets moments that each stand
alone and point back without a caption saying so: they are cut from the full
render, so the HUD's progress line and step count sit where they really are
in the level. "Your turn" (duets, putting viewers in the gloss) was proposed
and parked: he goes quiet after the release week, and it needs him there.

- **Moments** are bar-line cuts of the full render with its sound (loops on
  the music): the open (bars 1-4, the HUD at 000), the feet (70-73, the
  busiest close-up in the song), the clap (79-82, a close-up, then the jump
  clap with the trail's cusp).
- **Raw vs gloss** (`compose --plate`, `split.py`): the phone's own picture
  through the same camera, cut down the middle of him. The cut follows the
  middle of his ink, smoothed both ways (a fixed centre line left him wholly
  on the phone's side whenever the camera clamp held him off centre). The HUD
  lies across both halves: it belongs to the level, not the picture. The
  stretch must be rendered with the whole song's `--body`, or its scale
  differs; registered, it matches the full render to 0.1 grey levels.
- **The full render starts 1.12 s into the song**, not at the song's first
  sample (its sound against the master says so). Every bar time for the cuts
  is the song's grid minus 1.12 s.
- The raw side shows his face and the polo's logos. That is his call, so that
  draft waits in review.

Staged 2026-10-08, folder "1-1 · Billie Jean" (#10), every post dated and
captioned for its platforms, each with a hidden clip opening the Infinity
Hoodie: #8 the Reel (Mon, IG + TikTok), #9 the whole song (Mon, YouTube),
#13 the clap (Tue), #12 the feet (Wed), #11 raw vs gloss (Thu, review),
#10 the open (Fri); clips #555-558.

## Two songs in one take: Stromae (2026-10-12)

The owner danced Stromae's Fils de joie and Santé back to back in one phone
take (`IMG_0327.MOV`, 6:56, portrait), to test the gloss look on a new dance.
Take `img-0327`.

**The sync came from the room.** This time the song played aloud (Billie
Jean was danced in headphones). The room audio is quiet (-30 LUFS) and mostly
air handling, but Demucs pulls the music out of it, and Whisper on the vocals
stem heard each song's words (first section "madame", "un vrai métier"; second
"lever mon verre"), which told the two songs apart before the files arrived.
With the masters, each one's onset envelope against the separated room music
gives a clear peak (0.58 and 0.67 against 0.30 and 0.40 for the 50th best),
then the band-passed waveforms put it to the sample: Fils de joie's first
sample at take 8.158 s, Santé's at 222.449 s. Measured again on 15 s windows
every 20 s through each song: within 2 ms everywhere, no drift. Tempos are
exact integers (128 and 92 bpm, the best grid fit by a clear margin).

**Two songs in one take.** `film:dance setup` now takes `--slug` and adds
the song to the take's story and align (replacing one with the same slug,
refusing songs that overlap, never mixing into an album take's pulled story);
`cut --slug` says which song a piece is. compose's Timeline already chose a
chapter by where a moment falls, so nothing else changed.

**The crown fell into his head when he leaned in.** The crown sat the
neck's length times 0.55 over his eyes, the neck read per frame as eyes to
shoulders in the picture. Leaning toward the camera his head drops in front
of his shoulders and that distance collapses (Santé bar 53: 160 px to 7),
so the marker landed on, then inside, his head. His head is no smaller: the
neck is now the usual one, the 90th percentile over the last and next 5 s
(as the marker's width already was), and the crown moves with his eyes.

That cleared the crouch, but not a bowed head: looking down at his feet his
eyes drop far under the top of his head, and the marker sat inside it for four
seconds (Santé, take 398-402 s; missed on the contact sheets, found by
measuring). The matte is him, so the crown now reads it (`head.py`): in a
column narrower than his head, the matte from his eyes up without a break is
his head (a hand held up over it with air between is not), and the marker
only ever rises to clear it, keeping to the highest his head reaches over
0.15 s so the smoothing never sinks it in. Measured on every frame, the
marker's lowest point against the matte's top: frames touching his head went
from 185 to 8 (Fils de joie) and 626 to 7 (Santé); the rest are one or two
frames of a hand passing over his head. Read once per take at half size, 9 s
for 12,472 frames, cached as `head_top.v2.npy`.

**A long leg that is not a glitch.** A foot stepping toward the camera lands
low in the picture (Fils de joie Reel 28.7 s and 50.4 s); the tile lights
under it. That is perspective, as on Billie Jean, and stays.

**A foot on the frame's last row crashed the shadow.** Santé's whole song
stopped at take ~325 s: he stepped up to the camera, the floor line under
him fell on the picture's last row, and the shadow on the floor came out one
row tall, too small for the edge cut's gradient. Under two rows there is no
shadow to see: `cast_on_floor` now casts nothing there (`tests/test_body.py`,
OnTheFloor).

**The whole song ends where its music does**, not where its file does: each
master carries a few seconds of silence, and in them he walks up to the
phone. Fils de joie's last sound is at take 200.46 s (his arms-up finish),
Santé's at 411.10 s (he stands still from 409 s); the cuts take `--to=` there,
and the song's tail fades under the Danceman as always.

**The plain filter first; each song's own effects after** (owner, the same
day: "the effects we did b4 are billie jean specific. i just need the filter
each song first"). The tiles, the echo and the feet close-ups were Billie
Jean's. A new song's base is the gloss figure on its field with its shadow,
the game's layer (HUD, crown) and the Danceman; its effects are designed for
it afterwards. The base show files are `{floor: plain, light: key, effects:
[]}` plus the HUD.

**The credit.** "credit is important": a song that is not ours names its
artist on screen. The HUD's song line reads "FILS DE JOIE · STROMAE"
(`hud.credit`, from the show's `hud.artist` or the chapter's; `film:dance
setup` now requires `--artist`). Billie Jean was left as rendered, by his word.

**The first cuts** (superseded by the base versions; in `$FILM_WORK/img-0327/out/`): a 60 s Reel of each, chosen on
the music and the pose together (Fils de joie bars 1-32, the open through the
first chorus, also where he moves most; Santé bars 49-71, from the break to
the song's last bar, holding his busiest stretch), feet close-ups on the
bars his ankles move fastest; and each whole song. Show files
`data/loop/film/shows/{fils-de-joie,sante}{,-full}.json`. Colours were my
proposal from a sheet of eight (`out/colour-sheet.png`): vermilion
`#ee5a45` for Fils de joie, champagne `#efd28c` for Santé. The HUD's levels
(1-2, 1-3) are placeholders; the series numbering is his.

## The floor is the room's, and the camera is planned (2026-10-12)

The owner, of the base versions: the shadow "is struggling to be a shadow
sometimes and is jumpcutting like crazy... can we not simulate the actual
ground so that the shadow is cast naturally rather than painstakingly
tracked? and can we improve the gracefulness of the subject tracking by the
camera?" Measured on both songs before changing anything (output px):

| | Fils de joie | Santé |
|---|---|---|
| shadow's floor line, biggest one-frame jump | 242 | 290 |
| its jumps over 10 px | 318 | 404 |
| camera up/down, biggest one-frame jump | 50 | 66 |
| camera across, frames moving over 3 px | 844 | 1,344 |

Three causes. The shadow met him at the matte's lowest row this frame and
snapped to an old line whenever that rose past a threshold ("airborne"),
so every lifted foot, flicker at the soles, or shoe leaving the phone's
frame (the matte's last row) was a cut. The camera's height was a running
median of the last 3 s of soles, which moves in stairs. The camera's side
chased his hips one frame at a time, and switched to the middle of his whole
matte, arms and all, whenever the hips were lost.

**The floor is one plane.** The phone never moved, so the floor is fixed for
the whole take and he stands on it (`feet.py`). Each foot has a floor point:
its sole from the matte under that foot (the pose's sole, offset to the
matte's, where they disagree or the shoe has left the frame), counted as
planted when it is as low as it gets over half a second, carried straight
from where it left the floor to where it lands while it is up, glitches
out, smoothed both ways, and tucked 8 px up (a shadow starting behind the
shoe is hidden by it; one starting under it is a gap). The shadow is cast
from the line through both feet's points (`shadow.floor_line`, eased where
one foot is right in front of the other), so each sole meets its own
shadow, a lifted foot leaves its shadow on the floor, and a jump leaves all
of it. Biggest one-frame move of a floor point now: 20 px, a foot travelling
through the air; nothing snaps.

**The camera is planned like an operator's.** The whole take is recorded, so
the path is solved once for the piece (`camera.py`): the L1 sizes of its
speed, acceleration and jerk, weighted 10, 1, 100 (Grundmann, Kwatra, Essa,
auto-directed stabilisation), so the best path is still wherever it can be,
glides at a steady speed when it must and eases in and out; his torso must
stay within 18% of the width of the centre and the floor between his feet
within 4% of the height of the floor line. A linear programme (HiGHS), 2 s a
song. Fils de joie: the camera never moves (he stays in the zone). Santé:
still 80% of the time across, 98% up and down, fastest 1.5 px a frame. He
moves within a still frame, as on a tripod; when he travels, it follows.

**It never looks below the phone's frame.** Stepping close, his shoes left
the bottom of what the phone saw, and the picture showed them ending in a
straight cut over an empty floor (in every render until now). The camera's
path is bounded so the phone's last row is never above the picture's: his
feet leave at the bottom edge, as with any camera.

Tests: `tests/test_ground.py`. The old trackers (`shadow.Ground`, the
camera's per-frame follow) are no longer used by compose.

## The player has a name (2026-10-12)

The owner: "im 'playing' as Mitus Young History. there could be other
characters. this should be in HUD somehow as well", and Billie Jean too, with
its artist. The numbering already borrows Super Mario Bros' "WORLD 1-1", so
the HUD borrows its layout: where you are on one side, who is playing on the
other, the player's name with his score. Left: the seal, the level, the song
and its artist. Right: his steps (the word beside the number now) over
"MITUS YOUNG HISTORY". The two big lines share a baseline, the two small ones
another, so the sides mirror; the longest credit so far, "BILLIE JEAN ·
MICHAEL JACKSON", clears the name by 38 px. A show's `hud` takes `player`;
another character is another player. Billie Jean's Reel and whole song were
rendered again (`-v2`) with the credit, the player and the new floor and
camera; its effects are unchanged. The staged release-week drafts still hold
the October 3 files until he says to swap them.

**Then redrawn** (the owner: "i think we need to redesign the hud with the
new contents. the spacing seems a bit off"). Measured: four type sizes
(40, 58, 24, 20), the two big numbers 28 and 41 px tall at the cap, and the
song's credit and his name sharing one line edge to edge (38 px apart on
Billie Jean); the seal, his own icon, sat on the level's side. Two layouts
were drawn at real size; he chose "D": two sizes only (numbers Jost 700 40,
names Jost 500 20, letterspaced), grouped by meaning, every number over its
name. Left, the player: the seal as tall as the two rows, "056 STEPS" over
"MITUS YOUNG HISTORY". Right, the level: "1-1" over "BILLIE JEAN · MICHAEL
JACKSON". Rows 14 px apart, the progress line 24 px under them, all on the
1080 grid (`hud.BIG_PX, SMALL_PX, ROW_GAP, LINE_GAP`). The longest credit
now has 170 px of air to his name.

## An arm across him is drawn (2026-10-19)

The owner, on the Oct 19 training take: "you cant see what my arms are doing
when they are in front of me cause everythings just black with no outline",
and "for the filter in general". The figure is one ink shape, so an arm over
his chest or stomach is ink on ink: hands held together at the chest vanished
into a block, a forearm across the stomach was gone.

The camera does see it: his forearms and hands are skin, his shirt is cloth.
**`film:skin`** (`skin.py`) runs MediaPipe's multiclass selfie model
(`selfie_multiclass_256x256.tflite`, beside the other models), whose body-skin
class traced his forearms and hands cleanly over a black shirt and khaki
trousers, side-on and with hands behind his head. It works at 256 px, so it
gets square crops tiled down his outline (two for a standing figure), on the
GPU (11 ms a crop; 130 on the CPU), about 19 frames a second. A centred mean
over three frames steadies the edge. The GPU delegate keeps a copy of
every image until the segmenter closes (the pose's leak, 256 KB a crop): the
5:28 Planet Rock take ran out at frame 8100, so `seg.Skin` rebuilds it every
1000 crops. Output: `skin.mkv`, soft, the mask's size.

**The figure draws the arm's edge where it lies over him** (`figure.arm_lines`):
a line in the ring's colour, which is the ground's, as the rings of his light
already are, so nothing new enters the look. It is cut by the one drawing rule
(a smooth field crossing a level), so it is the same clean curve as his
outline, `ARM_LINE` (0.4% of the height, 8 px at 1920) wide. Only skin round
his arms counts (`arm_zone`: round each upper arm, forearm, wrist and hand
from the pose), so his neck and a bare knee are not arms, and the quiet head
is untouched. Where the arm meets the field his outline already draws it, so
the line runs only where the other side is him, out to his outline.

Considered: pose capsules alone (geometric, and wrong where the pose is off;
the skin is what the camera saw); drawing the line by carving the outline
(it would cut his shadow and the crown's anchor; the tone carries no such
side effects); a highlight-coloured line (it would read as a pool of light,
not an edge; not tried).

Limits: long sleeves or gloves give no skin, so a covered arm stays as
before. A take without `skin.mkv` is drawn as before (figure says so); run
`film:skin` then `film:figure` to redraw one. `film:run` runs skin after
segment. Tests: `tests/test_gloss.py` (Arms).

## The drawing moves to the GPU (2026-10-20)

The owner, on learning that only the learned steps (the matte, the pose, the
skin) used the GPU: "all this type of video work is gpu stuff. we should
know better." The drawing ran on one CPU core: `figure` at 8 to 13 frames a
second, `compose` at 10 to 12, so a ten minute take spent about 45 minutes
drawing, and every picture was encoded twice by libx264 on the CPU.

**What moved.**
- `figure` draws the gloss look on the GPU (`figure.GlossBatch`, four frames
  at a time): the outline and skin blurs, his light at both scales, its
  quantiles (a sort on the GPU), the tone scale, the cuts and the bytes.
- `compose` draws on a GPU frame (`gpu.Canvas`): the field, his shadow
  (`shadow.cast_on_floor_gpu`), the glossy reflection, the echoes, him (both
  looks), the spotlight, and every small stroke (the HUD, the seal, tiles,
  props) through one `gpu.lay`. It draws one frame ahead: the last frame comes
  down from the GPU while the next is drawn.
- Video: the phone's HEVC is decoded by VideoToolbox (`take.Reader`, the
  same RGB bytes as software decoding, a third of ffmpeg's CPU), pictures are
  encoded by `h264_videotoolbox` (`take.h264_args`), and `cut.mux` copies the
  picture when nothing is laid over it instead of encoding it a second time.
  The data streams stay lossless ffv1. Readers decode a few frames ahead and
  writers encode a few behind, on their own threads.

**How the look is kept.** `gpu.py` holds the operations the numpy code draws
with, each matched to OpenCV's own sampling: cv2's Gaussian kernel and its
mirrored border (reflect-101, however far out), INTER_AREA as a block mean,
bilinear and bicubic at pixel centres, and warps and remap at exact float
coordinates (OpenCV 5 no longer rounds them to 1/32 px; measured). The numpy
path stays as the reference and the fallback (`FILM_GPU=0`, or no Metal), and
`tests/test_gpu.py` holds the two together.

What walks the picture stays on the CPU, with cv2, exactly as before: the
distance in from his outline (cv2's 5x5 chamfer distance, not a GPU
approximation of it), the pieces of an arm, the arm zone's bones, the quiet
head. Each runs only in the box round what it measures (`figure.arm_lines_patch`,
`head_quiet_patch`; proven equal to the whole-frame versions), four frames at
once on threads while the GPU starts the next batch.

**What Metal taught us** (torch 2.9 on the M1 Pro):
1. A tensor size the GPU has not seen costs it a compile, 5 to 15 ms an
   operation. Compose's region round him changes size every frame, so the
   first port ran at 3 to 4 frames a second, slower than the CPU. Every layer
   is now drawn over the whole frame (he has no coverage outside his region,
   so nothing changes), small strokes are padded to 32 px sizes, and the
   shadow works in a band of rows rounded to 64.
2. A plain upload (`.to("mps")`) waits for every job queued before it.
   `gpu.send` uploads without waiting and keeps the array alive until a
   download has waited past it (`gpu.settle`).
3. `torch.compile` fuses a chain of elementwise steps into one kernel
   (`gpu.fused`): the tone scale's interpolation over four frames went from
   49 ms to 0.8 ms. Compiled for one size at a time: a warp compiled for any
   size ran 50 times slower (106 ms against 2). The first run on a Mac
   compiles for a few seconds; torch caches the kernels after that.

**Speed** on the test take (`arms-0344-a`: 12.2 s, 366 frames, 1080x1920,
the Planet Rock training show), old and new run back to back, twice, on the
owner's M1 Pro while his own apps kept the GPU 70 to 84% busy:

| | before | after | |
|---|---|---|---|
| `figure` (its own timer) | 40 s, 39 s (9.3 fps) | 9 s, 9 s (about 40 fps) | 4.3x |
| `figure`, the whole command | 40.1 s, 39.1 s | 11.1 s, 10.1 s | 3.7x |
| `compose` inside the cut (its own timer) | 31 s, 30 s (12 fps) | 5 s, 5 s (about 70 fps) | about 6x |
| `dance cut`, the whole command | 35.5 s, 35.2 s | 9.3 s, 9.4 s | 3.8x |
| CPU time: figure, dance cut | 79 s, 58 s | 27 s, 16 s | |

On a Mac that has never compiled the kernels: figure 11 s, compose 8 s.
Earlier, with another session's two matte runs on the same GPU, the same take
went 66 s to 17 s (figure) and 75 s to 8 s (compose). At these rates a ten
minute take draws in about 12 minutes instead of about 55.

**The same picture.** Frame by frame against the old code (grey 0 to 255):
- figure's streams: field, labels and alpha within 1 (the field's inside reads
  254 where it read 255 on 2.7% of pixels: the blur's float sum rounds the
  other way), tone within 7 on a handful of pixels.
- compose alone, on the same figure data, both written losslessly: max 1,
  mean 0.000013.
- the whole chain, new figure and new compose against old, losslessly:
  mean 0.000021; 152 pixels in 759 million differ by more than 8, in specks
  of 1 to 4 pixels (max 150), where a tone byte rounds the other way right on
  a ring's edge for one frame.
- every other layer, GPU against CPU over the same data (spotlight, tiles and
  their reflection, props and their shadows, echoes, the feet close-up, push,
  freeze, flip, a field change, the outro, poster and cover looks, the ground
  marker, a lagging shadow, 16:9): within 1.
- `FILM_GPU=0` is bit for bit the old code (figure's streams, compose's frames).

**The encoder.** Against the lossless render: libx264 crf 18 (medium) left a
mean error of 0.74 grey and 0.18% of pixels off by more than 8, max 81, in
2.0 MB; `h264_videotoolbox -q:v 65`: 0.81, 0.22%, 2.0 MB; `-q:v 75`: 0.73,
0.057%, max 49, 3.2 MB; `-q:v 85`: 0.71, 0.002%, 5.4 MB. `-q:v 75` is at
least as faithful as crf 18 on every measure (`take.VT_QUALITY`). With the
second encode gone, the delivered cut is closer to its own lossless render
than before (0.057% of pixels off by more than 8, against 0.27%), at
2.1 Mbit/s instead of 1.2. New against old delivered: mean 0.13 grey, the
two encoders' difference.

Considered: splitting each stage's frames across processes (step 4 of the
brief, for a stage the GPU could not take): not needed, both stages are
GPU-bound now; a GPU distance transform (exact Euclidean or jump flooding):
not the chamfer distance the look was tuned on, and the CPU does it in about
a millisecond in its box; colour conversion to YUV on the GPU: the encoder's
own swscale conversion is kept so the colours match the old renders.

Not proven here: `npm run film:golden` needs the June take
(`~/Downloads/IMG_0129.MOV`), which is not on this Mac. `--plate` (the
phone's own picture through the camera) still warps on the CPU.

Knobs: `FILM_GPU=0` draws with numpy, `FILM_FUSE=0` runs the fused steps one
by one, `FILM_VT=0` decodes and encodes on the CPU (libx264). Files:
`scripts/loop/film/gpu.py`, `figure.py` (GlossBatch), `compose.py`,
`shadow.py`, `take.py`, `cut.py`; tests: `tests/test_gpu.py`.

## Painted strokes: what passes in front of him (2026-10-21)

The arm lines followed bare skin only, so in a hoodie a hand got a small ring
and an arm across his chest vanished. Drawing his limbs from the pose (tried
the same day, arms and legs, per-take widths, depth-ordered) read as a line
drawing and guessed at arms inside his clothes; he turned it down: "if I'm
wearing a hoodie, I'm wearing a hoodie... let's paint on what's already going
on in the picture... it doesn't have to be crisp". Edges of the picture itself
(a difference of Gaussians) caught every crease of his jeans.

**`film:paint`** (`paint.py`) runs Depth Anything V2 Small (Hugging Face
`transformers`, weights in `FILM_MODELS/depth-anything-v2-small`, fetched with
curl) on a fixed crop round him, batched on the GPU: how near the camera each
point of him is, against his torso. Where that nearness changes sharply inside
him (an arm before his chest, a hand before his hip) a soft stroke in the
ground's colour is painted; a blurred hand gives a blurred depth, so its
stroke blurs with it. Each stroke is measured against his sharpest change in
the frame (eased frame to frame), so the gentle slope of legs nearer a low
camera paints nothing. Never on his outline (the nearness off him is his own,
so the outline makes no edge) or his head. Output: `paint.mkv`.

**figure** lets the light step back near a stroke (`calm`; a pool beside a
stroke "fought" it); **compose** lays the strokes over him (`paint(strokes=)`,
and the third field on the GPU). Strokes take over from the skin lines.
`film:run` runs paint after segment.

Settings found the hard way: half precision on MPS made the model read
trouser folds as depth (blobs over his legs); full precision at a 392x700
crop matches the prototype at 10 fps (504x896: the same picture at 5 fps).
Tests: `tests/test_paint.py`.

## The floor, made as a floor (2026-10-24)

The owner, of the cast shadow on the plain floor: "It looks like my silhouette
was flipped onto the ground and faded. It doesn't pop, and it reads as a
shortcut... It's jittery. It looks like a shape being mapped onto me, not
something the floor is actually doing." He asked for a real virtual floor with
its own texture, a true reflection that blurs and fades with distance from his
feet, a contact shadow darkest and tightest where his feet touch, and
smoothness first.

Why it jittered, measured on the Prayer in C take: the cast shadow stood on the
line through his two feet's floor points, and when the feet crossed in x that
line flipped its tilt in one frame (its slope changed by up to 9 a frame),
swinging the whole shadow; it was cast from the matte as it is, so every
boiling edge was thrown across the floor by the shear.

**`plane.py`**, show floors `boards | dots | lacquer` (`plain` and `tiles`
unchanged, so every delivered piece renders as before):
- the plane: the phone never moved, so every take row below the horizon is one
  depth; the horizon sits at HORIZON (0.72) of his height above where he
  usually stands, the vanishing point at the take's centre, the focal length a
  26 mm equivalent. The texture is laid in the floor's coordinates (his
  heights), so it lies still as the virtual camera moves, is filtered by each
  pixel's footprint (it fades before it can shimmer), and dissolves into the
  field by depth 3.6: the world stays a flat colour.
- the reflection: a level camera sees a mirror floor as a flip about the floor
  point under each part of him, so him (the painted figure) is mirrored per
  column about a floor line that is each foot's own floor point under that
  foot, the nearer foot winning where both share columns, and where he stands
  (their mean) between and beyond. Every step is smooth in where the feet are:
  crossing feet no longer flip it (tests/test_plane.py). A lifted foot's
  reflection leaves a gap as wide as the lift. The blur grows with the
  distance below the floor line (a lacquered floor's roughness, blended from
  five blurs), the strength fades to 1/e over 22% of his height, the boards
  shift it a few px each and their seams dull it.
- the contact shadow: per column, how much of him lies in a short band above
  the floor line, laid on the floor as a tight core (3% of his height,
  darkening toward ink) and a wide skirt (14%, toward the palette's shadow).
  A foot that lifts leaves the band and its shadow fades and spreads. It is
  laid after the reflection, so where he touches is always darkest.
- the gap under an arch closes: a sole within 1.6% of his height of the floor
  line reflects (and shades) as its dark underside, easing open by twice that,
  so a lifting foot comes away smoothly.
- smoothness: both are drawn from his matte and fields averaged 0.034 s each
  side (compose reads that far ahead; the take is recorded, so the average is
  centred and never lags him). He himself is drawn from the frame as it is.

GPU only (it raises with FILM_GPU=0). The cast shadow is not drawn on these
floors; `shadowMode: none` turns the reflection and contact off too. Not yet:
`lag` (The Game pulling) for the reflection, and the props' shadows on these
floors are still cast.

Tested 2026-10-24 on Prayer in C (400-410 s) and the Planet Rock ground moves
(346.6-356.6 s), and through his feet leaving the phone's frame (385-393 s).
Review pack: `projects/Loop Soul Dance/Work files/shadow-test-2026-10-24/`.

**His pick (2026-10-24): lacquer.** "Lacquer floor is best. No need to rerender
everything. Just the new videos." Every new show file takes
`"floor": "lacquer"`; the delivered posts stay as they are. The filter and the
world keep being refined as new pieces are made.
