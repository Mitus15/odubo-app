# 2026-10-12: the gloss look on a new dance (Stromae)

## Asked

"new dance vid i wanna test the filter on. billie jean came out well." The
take: `~/Downloads/IMG_0327.MOV`, Fils de joie then Santé, played aloud.

## Done

- Take `img-0327` in `film-work/`: ingest, segment (RVM, 27 min), figure
  (gloss, 16 min). Songs copied into the take's `songs/`.
- Sync from the room's own music (Demucs, then the master against it): Fils
  de joie at take 8.158 s, 128 bpm; Santé at 222.449 s, 92 bpm. Within 2 ms
  through both songs.
- Colour sheet of eight fields (`out/colour-sheet.png`); rendered with
  vermilion (Fils de joie) and champagne (Santé), pending his pick.
- 60 s Reels: `out/dance-fils-de-joie-reel-full.mp4` (bars 1-32),
  `out/dance-sante-reel-full.mp4` (bars 49-71). Whole songs:
  `out/dance-fils-de-joie-full-full.mp4`, `out/dance-sante-full-full.mp4`.

## Code (branch `claude/dance-video-filter-test-f5fefd`, on `claude/billie-jean-gloss`)

- `dance.py`: more than one song per take (`--slug`); `tests/test_dance.py`
- `anchor.Path`: the crown uses his usual neck, so it clears his head when he
  leans in; `tests/test_body.py`
- `shadow.cast_on_floor`: no shadow, and no crash, when his foot is on the
  frame's last row; `tests/test_body.py`
- show files for both songs, Reel and whole song

## Struggles

- The crown fell inside his head on Santé's crouch (the neck in the picture
  went from 160 px to 7). Fixed as above; reasons in the decision record.
- A forward step reads as a long leg on the contact sheet. Real perspective,
  left alone.
- Santé's whole song crashed at take ~325 s: his foot on the frame's last row
  made a one-row shadow. `shadow.cast_on_floor` skips a shadow under two rows.
- The masters end in a few seconds of silence, in which he walks to the phone:
  the whole-song cuts end on the last sound (`--to=200.46`, `--to=411.10`).

## Open, his

- The colours, the Reel stretches, and the HUD levels (1-2, 1-3 are
  placeholders).
- Whether these join the levels series and when; nothing staged in
  /admin/social.

## Later the same day: base versions and the credit

- His direction: plain filter of each song first, effects designed per song
  after (Billie Jean's are Billie Jean's); the game theme stays; the artist
  is credited on screen ("credit is important"), Billie Jean not re-rendered.
- The crown now reads the matte (`head.py`, `anchor.head_top`, `Path(tops=)`):
  touching frames 185 to 8 and 626 to 7. The four seconds inside his bowed
  head (Santé 398-402 s) were in the first Santé Reel I sent.
- HUD credit line (`hud.credit`), `--artist` required at setup.
- Base shows `data/loop/film/shows/{fils-de-joie,sante}.json` (the
  tiles/echo/close-up shows removed). Base renders, one at a time (the Mac
  went down with two at once): `out/dance-fils-de-joie-base-full.mp4`,
  `out/dance-sante-base-full.mp4`, each ending on the music's last sound.
- Reels and moments to be cut from the base renders once his effects are in.

## Later: the floor is the room's, the camera is planned

- His notes on the base versions: the shadow jump-cuts and "struggles to be a
  shadow"; the camera is jarring. His idea: simulate the actual ground.
- Measured first (decision record, "The floor is the room's"): shadow floor
  jumps to 290 px in a frame, camera height to 66 px, camera side never still.
- `feet.py`: each foot's floor point on the one fixed floor (the phone never
  moved); the shadow is cast from both (`shadow.floor_line`).
- `camera.py`: the path planned for the whole piece (L1 speed, acceleration,
  jerk; HiGHS, 2 s a song): Fils de joie never moves, Santé still 80% / 98%.
  Bounded so it never looks below the phone's frame (shoes leaving the frame
  now leave the picture at its bottom edge, no straight cut).
- `shadow.Ground` and the per-frame follow removed. 96 film tests pass
  (`tests/test_ground.py` new).
- Renders: `out/dance-fils-de-joie-v2-full.mp4`, `out/dance-sante-v2-full.mp4`.

## Later: the player, and Billie Jean again

- He plays as Mitus Young History; other characters may come. The HUD's right
  side is the player now: steps over his name (Super Mario Bros' layout).
- Billie Jean re-rendered with the credit (Michael Jackson), the player, and
  the new floor and camera: `billie-jean/out/dance-1-1-reel-v2-full.mp4`,
  `dance-1-1-full-v2-full.mp4`. Stromae: `img-0327/out/dance-*-v3-full.mp4`.
- Billie Jean's three moments cut again from the v2 full render on the same
  frames (open 4-251, feet 4260-4506, clap 4815-5061; 247/246/246 frames, as
  the originals): `billie-jean/out/1-1-moment-{open,feet,clap}-v2.mp4`. Raw vs
  gloss (draft #11, in review) was not redone: it needs its own plate render.
- Open, his: swap the staged Billie Jean drafts' files (Social Studio,
  "1-1 · Billie Jean") for the v2 ones, or keep the originals.

## Later: the HUD redrawn

- His note: the spacing was off once the player's name came in. Two layouts
  drawn at real size; he chose D: the player left (seal, steps over his name),
  the level right (level over song and artist), two type sizes.
- Rendered again, one at a time: Stromae `-v4`, Billie Jean `-v3` (Reel, full
  song) and its three moments `1-1-moment-*-v3.mp4`.

## Later: Fils de joie effect samples

- The song mapped by its repeats: verse 1-16, build 17-24, chorus 25-36,
  verse 37-52, build 53-60, chorus 61-76, breakdown 77-88 (4 dB down),
  final 89-100 (where he moves most), his arms-up finish in bar 101.
- Proposed, he asked for samples of four: the chorus spotlight (built), the
  breakdown push-in (new: camera "push"), the final-stretch flip (built), the
  held last pose (new: a show's "hold"). Sample shows in
  `film-work/img-0327/shows/`, renders `out/dance-fils-sample-*-full.mp4`.
- The fifth idea (frozen copies of him at the stage's edges in the verses,
  the people the verses answer) was not sampled.
- Waiting on his picks.
