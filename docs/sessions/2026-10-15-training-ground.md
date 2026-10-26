# 2026-10-15: the training ground

## Asked

Two days of rehearsal (Oct 13, Oct 14) cut into nine moments by a cowork
session (`film-work/img-0330/picks/`, `film-work/img-0337/picks/`). Besides
the weekly levels, he wants clips from his training each week. First ask: cut
them to feed length and grade them so they look less raw. Then, after seeing a
film grade: "nah silhoutte is best. lets keep the pop art nature of the world
with its colors. the hud and other layouts can tell us if its an actual level
or the training ground but we remain in the pop art world."

## Done

- Seven feed cuts (8 to 15 s), each starting and ending on a beat of the
  room's own music. Each cut is its own windowed take
  (`film-work/train-0337d` etc., ingest `--from/--to` with 1.5 s either side),
  run through segment (RVM) and figure (gloss): about a minute each.
- The room's sound stands in for the song (`setup --song=songs/room.wav
  --at=0`), so the sync is exact without a master.
- A colour per song, from the world's palette, none a level has used yet:
  Hold the Line (Toto) sky `#6cc5ec`, Give Life Back to Music (Daft Punk)
  lilac `#b9a6ef`, Raise Da Roof (Jazzman Olofin) tangerine `#f39a3d`.
- Delivered to `social-2026-10/training-ground-oct-13-14/`: 01 to 07, each
  with the room sound at -14 LUFS and a silent twin, an overview sheet,
  `Captions.txt`.

## Code

- `hud.py`: `progress=False` drops the progress line. A training piece's HUD
  reads TRAINING in the level's slot and has no finish line;
  `tests/test_hud.py` (TrainingGround).
- `dance.py cut --outro=no`: no Danceman outro, the sound eases 40 ms at each
  end, so a short piece loops cleanly in a feed.
- `data/loop/film/shows/training/<song>.json`: the plain stage plus the
  training HUD.

## Struggles

- The cowork notes named Oct 13's song "Molowo Nodi (Wizkid)". The real title
  is "Molowo Noni" (Samklef ft. Wizkid, D'Prince, Ice Prince), and the session
  held two songs (gaps at 4:29 to 4:34). He confirmed the second, where both
  Oct 13 cuts sit, is Raise Da Roof.
- IMG_0330 is 30 fps (17,789 frames over 9:54), not 120 as the cowork notes
  said; its 120 is the timebase.
- iPhone HLG: a plain zscale to BT.709 blows the highlights out. Mobius
  tonemapping kept them (the film-grade route, since dropped).
- Oct 14's room music is about 10 dB over his footsteps (-41 LUFS overall):
  use the silent copies plus the platform's library song. Oct 13's is 25 dB
  clear. Song positions for Oct 14 could not be placed from the room sound.
- A `while read` loop fed by a pipe lost all but its first take: ffmpeg in
  ingest read the loop's stdin. The driver passes `stdin=DEVNULL`.

## Next

- His verdict on the training HUD and the three colours.
- The Oct 13 cuts not made (0330-a in the first song, 0330-c) and the jump
  in 0337-d (about 12 to 24 s of that pick) remain.
