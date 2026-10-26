# 2026-10-21: the Oct 21 take, the painted strokes, every post rebuilt

## Asked

- A new training take, `~/Downloads/IMG_0356.MOV` (12:47, hoodie and jeans):
  Around the World (Daft Punk), Prayer in C (Lilly Wood & The Prick, Robin
  Schulz's version), Lady (Hear Me Tonight) (Modjo).
- "the gpu speed-up should be the standard": the GPU branch merged.
- The arm lines: only bare skin got one, so in a hoodie an arm across him
  vanished. Several rounds (below) to: "let's paint on what's already going on
  in the picture... it doesn't have to be crisp... we have to be able to tell
  something's going on up front".
- Then: "let's rebuild everything" since Billie Jean, and "arrange them
  properly so that I can see all the full videos, all the reels, all the
  short form videos". The idea: pop art with posts, as Warhol did with posters.

## Done

- `claude/frosty-pascal-865d3c` (figure and compose on Metal, VideoToolbox)
  merged; the one conflict (the plate reader in compose) kept the GPU shape
  with the frame rate pinned. 133 tests pass.
- IMG_0356 placed: Around the World 3.0-329.5 s (120 bpm), Prayer in C
  333.0-529.0 (123), Lady 530.0-761.0 (126). Colours past the world's eight:
  cornflower `#7b9df3`, grass `#86d27c`, orchid `#e47fd1`. Show files in
  `data/loop/film/shows/training/`.
- The strokes, in order tried:
  1. limbs drawn from the pose at measured widths, depth-ordered (pose z kept,
     `film:pose`): arms read in a hoodie, legs read as a line drawing; he:
     "I don't want you to draw the arms... let them see the outline of my
     hoodie". Reverted; the patch is in the session scratchpad only.
  2. the picture's own edges (difference of Gaussians): every jeans crease.
  3. a depth model's nearness against his torso, painted where it changes
     sharply inside him: "this is so much better". Built as `film:paint`.
- `film:paint` (`paint.py`): Depth Anything V2 Small, full precision, a
  392x700 crop batched on the GPU, 10 fps; strokes against the frame's
  sharpest change, eased; figure calms the light near a stroke; compose lays
  the strokes in the ground's colour. Decision record: "Painted strokes".
- The rebuild: every take since Billie Jean through paint, figure and its
  cuts (two workers), then `catalog.py` cuts every Reel and short from the
  new renders into `social-2026-10/posts/{reels,shorts,full}` with
  `index.html`, `CATALOG.txt` and a contact sheet per kind. Oct 21 gets three
  Reels for Around the World, two each for the others, three shorts each.
- "i want those too": the four Oct 13/14 songs whole (Molowo Noni and Raise
  Da Roof from IMG_0330, Give Life Back to Music and Hold the Line from
  IMG_0337, the Oct 14 pair with silent twins), each its own windowed take
  `train-03xx-full-<song>`. Molowo Noni had no clips before: two Reels of 28
  bars (bars 57 and 89, about 58 s) and three shorts of 6 bars (59, 83, 105),
  picked by how much he moves, as Oct 21's were. Show file
  `shows/training/molowo-noni.json` (Samklef).

## Struggles

- Half precision on MPS made the depth model read trouser folds as depth:
  blobs over his legs. Full precision fixed it.
- A fixed stroke gain painted the slope of legs nearer a low camera; strokes
  are measured against the frame's own sharpest change instead.
- A variable named `step` in GlossBatch.begin was already the tone lerp's.
- MediaPipe's pose depth cannot tell an arm hanging at his side from one in
  front (it often rates both as in front).
- With four renders at once, VideoToolbox refused packets while decoding the
  phone's HEVC ("Error submitting packet to decoder", hundreds a take). The
  readers now decode in software (`FILM_HWDEC=1` opts back in); encoding stays
  on VideoToolbox. Every take that logged errors was redrawn (eleven, the
  Stromae take included); the redraws logged none.
- Force-quitting the Claude app killed the renders it had started. The last
  stretch ran in its own session (`setsid`), at `nice 20` + `taskpolicy -b` so
  he could use the Mac meanwhile.
- The Oct 14 full songs were first cut with the faint room loudness-raised (it
  lifts the noise); they ship silent like the rest of Oct 14.

## Delivered (2026-10-22, 06:00)

`social-2026-10/posts/`: 69 pieces, 24 Reels (50 s to 1:02), 34 shorts
(8-15 s), 11 full songs; `index.html`, `CATALOG.txt` (length, caption,
credit), a contact sheet per kind. The 24 Reels went to his phone. The old
`to-post/` moved to `_before-paint/to-post/`.

## Next

- **The shadow** (2026-10-22, him: "the shadow work is shotty... we wont re
  render these but we need to work on the shadow for future ones"). The posts
  stand as they are; the next filter work is the ground shadow
  (`shadow.cast_on_floor`, last reworked 2026-10-03, decision record "The
  shadow, on the floor the tiles imply"). Ask him what reads wrong before
  changing it.
- Every piece ships as a pair (his ask, so he can line up the music): `<name>.mp4`
  with the room's sound, `<name>-silent.mp4` the same video over silence.
- He reviews `posts/`. He posts by hand; never offer to post.
- Refine the silhouette further ("until we get something that is pristine").
