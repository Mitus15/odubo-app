# Scratch scripts from the 2026-09-23 first cut (reference, not a pipeline)

These ran from `/tmp/claude-501/dance/` with hardcoded paths and produced the
first "Loop Soul - Heard Once" set. Kept so the next agent can lift the parts
that worked instead of rediscovering them. Read `docs/loop/campaign/HANDOFF.md`
first.

| file | what it does | keep? |
|---|---|---|
| `align.py` | onset-envelope helper (`env()`), spectral flux in 16 bands @ 11025 Hz / hop 256 | yes, now in `../common.py` |
| `track.py` | rolling-background person tracker at 192×108, 5 fps; picks 8 s windows with the whole body in frame | superseded by MediaPipe masks |
| `tvclean.py` | inside the TV rectangle, keeps only warm/green (body) pixels, paints the screen flat black; feeds the converter | the colour rule is still needed with the ML mask |
| `inkall2.py`, `inkdays.py` | the render loops: 97 s context clip → `video-convert.mjs --height=1920 --bgFloor=2 --maskMinRegion=0.004` | pattern only |
| `songfeat.py`, `dancefeat.py`, `match.py` | song tempo/energy, dance pulse/energy, Hungarian match | superseded once real timestamps exist |
| `sync1984.py` | 12 s dance window × 1984 onset cross-correlation (found 9:02 ↔ 1:57, 0.38 vs 0.23 chance) | the method for refining starts |
| `assemble.py` | cards, tpad freeze, concat, silent/with-audio join | pattern only |
| `covers.py` | the sand cover cards (PIL, Jost) and the grid preview | yes |
