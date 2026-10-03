---
name: loop-film
description: Turn a one-take dance film of the Loop Soul album into the moving-poster film, per-song cuts and social clips (silhouette on a flat colour, ground shadow, the badge on the heart, scripture cards, the Danceman outro). Use when the owner has a new take to convert, wants clips cut or re-cut, wants to check a test take, or asks how the film pipeline works.
---

# The Loop Soul film, from a take

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
master, `--push` saves each chapter's range), segment, figure, pull the story
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
npm run film:dance -- <take> setup --song="<audio>" --at=<take s where the song's first sample falls> --bpm=<tempo> --field=#rrggbb --title="..."
npm run film:dance -- <take> cut --from=<s> --to=<s> --name=reel --audio=full|silent
```

`--at` comes from listening when the music is in the room audio
(`sync_audio.lock`); a take danced in headphones needs his own edit or his
movement against the beat (see the decision record, "Billie Jean").

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

- MediaPipe 1.0.1 pose on macOS: GPU delegate with RGBA frames only; the CPU
  delegate aborts the process (`scripts/loop/film/seg.py`). The GPU delegate
  keeps every frame's Metal copy until it closes, so `seg.Pose` shrinks frames
  and rebuilds it every 500 (a full-size five minute take ran out at frame 1240).
- A phone stores portrait as landscape plus a rotation; `ingest` reads it.
- Light on his head reads as a hole: `figure.head_quiet` keeps the head, neck
  and top of the back ink. Restyle (`film:figure`) any take styled before 2026-10-02.
- Python cannot fetch model weights here (its certificate store fails); fetch
  them with curl into `~/.cache/whisper/` or `FILM_MODELS`.
- The June take has a TV behind him: `--screen=741,91,1345,435` on segment,
  for the selfie segmenter only. The matte does not need it. A take shot to
  the spec needs no such flag.
