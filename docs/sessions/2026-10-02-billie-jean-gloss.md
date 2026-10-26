# 2026-10-02/03: Billie Jean in the gloss look

The owner liked the gloss look ("it looks so clean") and asked to redo the
Billie Jean video for social in it, the iPod ad style. Then: "lets do the
whole thing and just do a quick low stakes share".

Branch `claude/billie-jean-gloss`, cut from `claude/album-performance-social-plan-4084d5`
(the unmerged gloss and crown work), worktree `.claude/worktrees/billie-jean-gloss`.

## What was made

From the original unfiltered plate,
`digital-hub/loopsoulca/video-converter/IMG_0191.MOV`, as take `billie-jean`
in `film-work/billie-jean/`:

- `out/dance-full-full.mp4`: the whole song from its first kick (take 15.84 s)
  to the end of the take, 9:16, with the Danceman outro
- `out/dance-reel-60s-full.mp4`: 28 bars from take 147.45 s, the stretch where
  he moves most (measured per bar from the pose)
- `out/dance-cut-30s-full.mp4`: 14 bars from take 155.68 s
- silent copies of each, for adding the song from a platform's own library

Rose field (`#f593a6`: his Billie Jean shirt, the iPod pink, not the album's
sand), crown marker, shadow in step, no card, no wordmark, no Scott's logo
(the old edit carried both).

## Code (all in `scripts/loop/film/`)

- `dance.py` (`npm run film:dance`): setup and cut for a song from outside the album
- `beats.chapter_grid`: a chapter can carry its own song file and tempo
- `ingest.probe`: reads a phone's rotation (portrait stored as landscape)
- `seg.Pose`: smaller frames and a fresh landmarker every 500, against the GPU leak
- `figure.head_quiet`: the head, neck and top of the back stay ink
- `compose`: the camera stays inside what the phone saw, so its frame edge
  never cuts through him (the owner saw a straight edge at take 158.7 s, where
  his arm reached past the phone's left edge)
- tests: `tests/test_ingest.py`, `tests/test_gloss.py` (Head)

Reasons, measurements and what was tried: `docs/decisions/loop-film.md`,
"A dance to someone else's song: Billie Jean".

## Struggles

- RVM plus pose ran the GPU out of memory at frame 1240. RVM alone was flat;
  `footprint` showed the pose landmarker growing 8 MB a frame and freeing it on close.
- No music in the room audio (headphones). The first attempt to read the old
  edit against the plate by centroid failed (0.14); silhouette IoU against
  the green render (same 9,063 frames as the plate) gave a clean, constant 15.90 s.
- The first look test read as headless: the shirt's back print lit up under his head.

## Pending

- The owner posts. A draft can be staged in /admin/social
  (`scripts/loop/stage-reel.mjs`); publishing stays a person pressing publish.
- The album's June take was styled before `head_quiet` and the camera clamp:
  re-run `film:figure` before its next render.
- `beats.grid` picks the loudest beat as the downbeat (a snare beat on Billie
  Jean); harmless for the bob, wrong for the freeze on songs like it.
- Nothing merged: the base branch is still unmerged by the owner's word.

## Later: four effects, a look book (2026-10-03)

The owner asked what visual effects we can achieve and picked all four
proposed, as film options for the album too. Plan:
`~/.claude/plans/ok-now-in-terms-floofy-lampson.md`; reasons and numbers in the
decision record, "Four effects that dance with him".

- `floor.py` (sidewalk: footfalls, lit tiles, reflection), `effects.py` (echo
  gate, close-up bars, snare state), `hits.py` (Demucs drums, kick and snare on
  the beat grid), `beats.pulse` (tempo refined, onset delay, kick downbeat)
- Look book in `film-work/billie-jean/out/dance-lookbook-*-full.mp4`, take
  155.68 to 172.13 s. Render speed, five at once: 90 s (hits) to 143 s (all)
  for 568 frames.
- Struggles: peak picking heard five kicks a second (both bands fire on every
  hit); the first echoes went brown (ink mixed into rose) and showed on every
  small move (the gate sat under his median limb speed); a close-up chose a
  bar in a still phrase; a 116.75 bpm grid drifted 60 ms by mid-song.

Pending: his pick of effects for the Reel and the full cut.

## Later: the shadow, and the series (2026-10-03)

- The shadow now lies on the tiles' perspective floor, crisp at his soles,
  darkening the floor instead of painting it; on the glossy floor a low side
  light keeps it clear of the reflection (decision record, "The shadow").
  Full song, Reel and 30 s re-rendered; finals refreshed in
  `social-2026-10/billie-jean-gloss/` (with `shadow-before-after.jpg`). The
  staged draft #7 still holds the earlier Reel.
- Series numbering: the owner did not want "level 100". Proposed world-level
  numbering (1-1 .. 1-17 for January to April; the album could be world 2);
  sketch `hud-sketch-1-1.png`. He will run the feed from /admin/social on his
  phone; one of his own songs this season, News Peak, maybe with a short film.

## Later: the virtual stage, the HUD, the engine, the cusp (2026-10-03)

- Show files, props, spotlight, HUD (decision record, "The virtual stage").
  The street show was "not it" for Billie Jean; the owner chose tiles, subtle
  shadow, subtle effects and the HUD (`data/loop/film/shows/billie-jean.json`).
- `stage-reel.mjs --product=` writes a hidden clip that opens the product.
- The trail cusps on the jump clap (decision record).
- Staged #8 "1-1 · Billie Jean" with clip #553 (Infinity Hoodie); #7 archived.
  The owner posts; the clip goes live with the post (PostForMe) or by hand in
  /admin/videos.
