# 2026-10-20: the dance film's drawing moves to the GPU

The owner: "all this type of video work is gpu stuff. we should know better."
Only the learned steps used the GPU; figure and compose drew on one CPU core
and libx264 encoded every picture twice. The full write-up, with the numbers,
is the decision record's "The drawing moves to the GPU (2026-10-20)".

## Done

- `scripts/loop/film/gpu.py` (new): the Metal device, cv2-matched blur,
  resizes, warps and remap, the edge cut, `fused` (torch.compile), `send`
  (uploads that do not wait), `Canvas` (the GPU frame) and `lay` (a stroke on
  either kind of frame).
- `figure.py`: `GlossBatch`, four frames at a time on the GPU; the distance
  transforms, arm pieces and quiet head stay on the CPU in their boxes
  (`arm_lines_patch`, `head_quiet_patch`), on threads.
- `compose.py`, `shadow.py`: every layer on the GPU at one size per frame,
  one frame drawn ahead of its download; HUD, tiles, props and the seal draw
  through `gpu.lay`.
- `take.py`: readers and writers on threads; VideoToolbox decode for the
  phone's video, `h264_videotoolbox -q:v 75` for pictures. `cut.mux` copies
  the picture when nothing is laid over it.
- `tests/test_gpu.py`: 17 tests holding the GPU to the numpy reference.

## Numbers (arms-0344-a, 366 frames, back to back, twice)

figure 40 s to 9 s (4.3x); compose 31 s to 5 s (about 6x); the whole dance
cut 35.5 s to 9.3 s. Lossless, new chain against old: mean 0.000021 grey,
152 of 759 million pixels off by more than 8 (specks of 1 to 4 pixels).
`FILM_GPU=0` is bit for bit the old code.

## Not done / open

- `npm run film:golden` not run: `~/Downloads/IMG_0129.MOV` is not on this Mac.
- `--plate` still warps the phone's picture on the CPU.
- Measured with the owner's own apps on the GPU (70 to 84% busy); an idle
  Mac should be faster still.
- Nothing merged or pushed; the owner's delivery folders were not touched
  (all test renders in a scratch FILM_WORK).
