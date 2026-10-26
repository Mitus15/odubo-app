---
name: loop-film
description: Turn a one-take dance film of the album Signs of Life (once called Loop Soul) into the moving-poster film, per-song cuts and social clips (silhouette on a flat colour, ground shadow, the badge on the heart, scripture cards, the Danceman outro). Use when the owner has a new take to convert, wants clips cut or re-cut, wants to check a test take, or asks how the film pipeline works.
---

# The Signs of Life film, from a take

Read first: `docs/decisions/loop-film.md` (why it is built this way),
`docs/loop/film/STORY-BIBLE.md` (the story every piece carries),
`docs/loop/film/SHOOT-SPEC.md` (what a take must be).

## The rules every piece obeys

- He is never named. Everyone knows who we mean. Enforced by
  `src/lib/loop/film/naming.ts` at approval and at publish.
- No em dash anywhere. One link in a caption, none on a card.
- Nothing reaches a guest until the owner approves it (/loop/admin/film) and
  reveals the chapter. Faith content is his to approve.
- Before a song is out, its clips carry 4 s of it (`--audio=tease`).
- Posting is a person pressing publish in /admin/social. Never automate it.

## Before anything: disk

A full take needs about 60 GB of work space. Point `FILM_WORK` at an external
drive: `export FILM_WORK=/Volumes/<drive>/film-work`. Check `df -h ~` first.

## A new take

```bash
npm run film:check -- "<the 5 minute test take>"   # fix what it says first
npm run film:run -- "<the take>"                    # everything, resumable
```

`film:run` chains: ingest, align (listens for the playlist's tone, locks each
master, `--push` saves each chapter's range), segment, paint, figure, pull the story
from D1, cards, the outro marks, a clip per approved card, a 16:9 cut per
song, the film. Each stage skips itself when its output exists; delete an
output to redo that stage.

Then, after the owner reviews `$FILM_WORK/<take>/out/` (each file has a
`.sheet.jpg` contact sheet):

```bash
npm run film:publish -- <take> clips              # dry run: what would go up
npm run film:publish -- <take> clips --apply --when=2026-10-23
npm run film:publish -- <take> film --apply        # hidden until set live
```

## One piece at a time

```bash
npm run film:paint -- <take>                       # soft strokes where something passes in front of him (before figure)
npm run film:pull -- <take> [--drafts]             # story.json from D1 (drafts: a private review render)
npm run film:cards -- <take>
npm run film:cut -- <take> clip <card-id> --audio=tease|full|silent
npm run film:cut -- <take> song <slug>
npm run film:cut -- <take> film
npm run film:compose -- <take> --from=<s> --to=<s> --aspect=9x16 --shadow=lag --lag=22   # just the picture
npm run film:grid -- <take> --at=<take seconds>    # the Warhol grid: one moment in all 14 colourways
npm run film:grid -- <take> --at=<s> --volume=1 --size=vinyl             # Vol. 1's vinyl cover: its 9 songs, 3 x 3
npm run film:grid -- <take> --at=<s> --volume=2 --size=vinyl             # Vol. 2's: its 5 songs as a plus (the owner's pick)
```

## A dance to a song from outside the album

The Billie Jean take is the first. Ingest, segment and figure as for any take,
then:

```bash
npm run film:dance -- <take> setup --song="<audio>" --at=<take s where the song's first sample falls> --bpm=<tempo> --field=#rrggbb --title="..." --artist="..."
npm run film:dance -- <take> cut --from=<s> --to=<s> --name=reel --audio=full|silent
```

`--at` comes from listening when the music is in the room audio
(`sync_audio.lock`); a take danced in headphones needs his own edit or his
movement against the beat (see the decision record, "Billie Jean"). Music
played aloud but faint (the Stromae take): separate the room audio with
Demucs first and correlate the master against its music stems; Whisper on
the vocals stem names the songs (decision record, "Two songs in one take").

Several songs in one take: give each its own `--slug=` at setup, and the
same `--slug=` to every cut of that song.

The owner's order for a new song: **the plain filter first** (gloss, shadow,
HUD, crown, Danceman; show file `{"stage": {"floor": "plain", "light": "key",
"effects": []}}`), then effects designed for that song. Billie Jean's tiles,
echo and close-ups are Billie Jean's. **The artist is always credited**: the
HUD's song line reads "SONG · ARTIST" (`"hud": {"artist": ...}`). End a whole
song on its music's last sound (`--to=`), not the file's end. Render one piece
at a time: two full songs at once took the Mac down. Check the crown by
measuring its clearance over the matte, not by eye on a contact sheet. The shadow stands on
one fixed floor (`feet.py`: each foot's planted point) and the camera's path
is planned for the whole piece (`camera.py`); measure their per-frame motion,
never judge it from a contact sheet.

## A show: the virtual stage

A performance is a show file (`data/loop/film/shows/<name>.json`, format in
`scripts/loop/film/show.py`): cues in bars (floor, light, colour, effects,
camera, props) and the HUD (`"hud": {"level": "1-1", "title": "..."}`).

```bash
npm run film:dance -- <take> cut --show=data/loop/film/shows/billie-jean.json --name=1-1-reel
node --env-file=.env.local scripts/loop/stage-reel.mjs --file=<the cut> --title="..." --product=<shopify handle> --dry
```

Staging writes the social draft and a hidden clip that opens the product; the
clip goes live when the post does (PostForMe), or by hand in /admin/videos.

### Releasing a level: the whole song is home, the feed gets moments

The full render is the canon (YouTube and the site). The feed gets 8-bar-or-less
moments cut from that same file, so the HUD's steps and progress bar sit at
their real point in the level, plus a raw vs gloss split:

```bash
# a moment: frames of the full render on bar lines, sound and all (ffmpeg trim, see the 2026-10-08 session log)
# raw vs gloss: the phone's picture through the same camera, pinned to the whole song's scale
python3 scripts/loop/film/compose.py <take> --from=<s> --to=<s> --show=<the full show> --body=<the full cut's body> \
    --out=gloss.mp4 --plate=plate.mp4
python3 scripts/loop/film/split.py plate.mp4 <the full render> --gloss-from=<frame> --out=raw-vs-gloss.mp4
```

Check the full render's real start (its sound against the master) before
timing bars: Billie Jean's runs from 1.12 s into the song. A stretch rendered
without `--body` is framed differently from the whole song and will not line
up. Stage the week into one /admin/social folder per level, dated, with the
platforms and the three captions filled, so the owner posts from his phone.

## The look

Two things decide how clean he looks.

**The cutout** (`film:segment`). Robust Video Matting (`matte.py`) is used when
it is installed: a video model for whole bodies that remembers earlier frames,
so the outline holds still, and it keeps his head, hands and feet. It lives in
the torch hub cache, not the repo (GPL-3.0, a tool we run, never ship); the
install line is in `matte.py`. Without it, the selfie segmenter
(`--matte=selfie`) is the fallback and needs `--screen=` on the June take.

**The style** (`film:figure --look=`):
- `gloss` (the default, approved): the album cover. An ink body with pools of light, each a ring of
  the ground colour around a pale core. Gloss is measured as light on his
  shape (brightness against its neighbourhood), not pale cloth, and a fixed
  share of him is lit (`GLOSS_LIT`). It writes smooth fields (`field.mkv`,
  `tone.mkv`) that compose cuts at the output size, so every edge is a clean
  curve.
- `poster`: the converter's label map, three hard tones from his brightness.

**The marker** (`--marker=` on compose, cut, grid): `crown`, the default and
the owner's choice (2026-09-30), is the seal floating over his head, the sign
a game puts on the character you play. `ground` and `heart` remain for
comparison only. The seal is `public/brand-logos/odubo-brand/odubo-seal.svg`
(the closed, indented drawing; rebuild with `scripts/brand/build-odubo-seal.py`).

With `gloss` fields, compose draws `--look=gloss` (default: the cores melt into
their rings, `--soft=0.08`) or `--look=cover` (every edge hard, the cover
exactly). `--cuts=0.55,0.75` moves the ring and the core. A look is a figure
choice: delete `labels.mkv` to restyle a take.

Effects that dance with him (the 2026-10-03 look book; any mix):
`sidewalk` (tiles light under each step, a glossy floor's reflection),
`close` (a footwork close-up for the busiest bar of each phrase,
`--close-bars=<take s>,..` to choose), `hits` (the sister colour on the snare,
back on the kick; Demucs splits the drums once, `python3 hits.py <song> <bpm>`),
`echo` (his echoes trail on big moves).

Effects (add to `film:cut ... clip|song` or `film:compose`): `--effects=freeze`
(a crawl on every downbeat that catches up within the bar, so the length and
the sync never change), `--effects=flip` (the field alternates with its
sibling colour each bar), or both. The bar grid is measured from the master
(`scripts/loop/film/beats.py`).

## The story side

```bash
npm run film:listen        # each song's loudness shape and tempo -> data/loop/film/shape.json
npm run film:transcribe    # machine lyrics beside each chapter in admin (needs ~2 GB: Demucs + Whisper turbo)
npm run film:seed          # first-run chapters and world entries (never overwrites)
npm run film:playlist      # the file played aloud at the shoot
```

## Proving a change

```bash
npm run film:golden        # the whole chain on 20 s of the June take, then check-sync
(cd scripts/loop/film && python3 -m unittest discover -s tests)
npm test -- loopFilm loopPosterWrap loopSingles
```

## Known quirks

- figure and compose draw on the Mac's GPU (torch on Metal, `scripts/loop/film/gpu.py`);
  video is decoded and encoded by VideoToolbox. `FILM_GPU=0` draws with numpy
  (the reference, same picture), `FILM_VT=0` uses libx264. The first run on a
  Mac compiles GPU kernels for a few seconds. On Metal, a tensor of a new size
  costs a compile and a plain `.to("mps")` waits for the whole queue: keep
  sizes fixed and upload with `gpu.send` (decision record, "The drawing moves
  to the GPU").

- MediaPipe 1.0.1 pose on macOS: GPU delegate with RGBA frames only; the CPU
  delegate aborts the process (`scripts/loop/film/seg.py`). The GPU delegate
  keeps every frame's Metal copy until it closes, so `seg.Pose` shrinks frames
  and rebuilds it every 500 (a full-size five minute take ran out at frame 1240).
- A phone stores portrait as landscape plus a rotation; `ingest` reads it.
- Light on his head reads as a hole: `figure.head_quiet` keeps the head, neck
  and top of the back ink. Restyle (`film:figure`) any take styled before 2026-10-02.
- The skin model (`selfie_multiclass_256x256.tflite`) runs on the GPU with
  RGBA frames, like the pose.
- Python cannot fetch model weights here (its certificate store fails); fetch
  them with curl into `~/.cache/whisper/` or `FILM_MODELS`.
- The June take has a TV behind him: `--screen=741,91,1345,435` on segment,
  for the selfie segmenter only. The matte does not need it. A take shot to
  the spec needs no such flag.
