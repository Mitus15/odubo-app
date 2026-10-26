"""
Find his bare arms and hands, so the figure can draw an arm where it crosses him.

    npm run film:skin -- <take>

The ink figure is one shape: an arm in front of his chest is ink on ink and
disappears (the owner, 2026-10-19: "you cant see what my arms are doing when
they are in front of me"). The camera does see it: his forearms and hands are
skin against cloth. MediaPipe's multiclass selfie model tells the two apart,
and figure.py draws the arm's edge where it lies over the rest of him.

The model works at 256 px, so it gets square crops tiled down his outline (two
for a standing figure) rather than the whole frame. A centred mean over three
frames steadies the edge. Runs after segment (it reads the mask and the pose).

Writes skin.mkv (soft, the mask's size) into the take's folder. Optional: a
take without it is drawn as before.
"""
import json, sys, time
from collections import deque
import numpy as np
import cv2
from take import Reader, Writer, load_take, read_pose, take_dir
import seg

TILE_REACH = 2.2   # a crop is at least this many torso lengths across: arms out, he still fits
TILE_PAD = 0.1     # and this much wider than him
WINDOW = 3         # frames in the centred mean
MODEL_SIZE = 256   # the model's own input: a crop goes in at this size, not larger (larger only costs time)


def tiles(box: tuple, torso: float) -> list[tuple[int, int, int]]:
    """Square crops (x0, y0, side) down his outline's box (x0, y0, x1, y1), overlapping, covering it."""
    x0, y0, x1, y1 = box
    side = int(max(x1 - x0, TILE_REACH * torso) * (1 + TILE_PAD))
    top, bottom = y0 - 0.5 * TILE_PAD * side, y1 + 0.5 * TILE_PAD * side
    n = max(1, int(np.ceil((bottom - top) / side)))
    cx = (x0 + x1) / 2
    return [(int(cx - side / 2), int(top + (bottom - top - side) * (k / (n - 1) if n > 1 else 0.5)), side)
            for k in range(n)]


def square(rgb: np.ndarray, x0: int, y0: int, side: int) -> np.ndarray:
    """The crop, black where it runs off the frame."""
    h, w = rgb.shape[:2]
    out = np.zeros((side, side, 3), np.uint8)
    sx0, sy0, sx1, sy1 = max(0, x0), max(0, y0), min(w, x0 + side), min(h, y0 + side)
    if sx1 > sx0 and sy1 > sy0:
        out[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = rgb[sy0:sy1, sx0:sx1]
    return out


def skin_of(model, rgb: np.ndarray, mask: np.ndarray, lm: np.ndarray | None) -> np.ndarray:
    """Bare skin 0..1 at the frame's size: the model run on each crop, the crops merged by their maximum."""
    h, w = mask.shape
    out = np.zeros((h, w), np.float32)
    ys, xs = np.nonzero(mask > 127)
    if len(ys) < 50:
        return out
    box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
    if lm is not None and min(lm[11, 2], lm[12, 2], lm[23, 2], lm[24, 2]) >= 0.3:
        torso = abs(float(lm[23, 1] + lm[24, 1] - lm[11, 1] - lm[12, 1])) / 2 * h
    else:
        torso = (box[3] - box[1]) / 3
    for x0, y0, side in tiles(box, torso):
        small = cv2.resize(square(rgb, x0, y0, side), (MODEL_SIZE, MODEL_SIZE), interpolation=cv2.INTER_AREA)
        c = cv2.resize(model(small), (side, side), interpolation=cv2.INTER_LINEAR)
        sx0, sy0, sx1, sy1 = max(0, x0), max(0, y0), min(w, x0 + side), min(h, y0 + side)
        if sx1 > sx0 and sy1 > sy0:
            np.maximum(out[sy0:sy1, sx0:sx1], c[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0], out=out[sy0:sy1, sx0:sx1])
    return out


def main(argv):
    if not argv:
        raise SystemExit("usage: npm run film:skin -- <take>")
    name = argv[0]
    take, d = load_take(name), take_dir(name)
    meta = json.loads((d / "mask.json").read_text())
    W, H = meta["w"], meta["h"]
    start, end = take["window"]["start"], take["window"]["end"]
    frames = Reader(take["path"], W, H, start=start, dur=end - start, fps=take["fps"])
    masks = Reader(d / "mask.mkv", W, H, gray=True)
    poses = read_pose(d / "pose.jsonl")
    model = seg.Skin()
    writer = Writer(d / "skin.mkv", W, H, take["fps"])
    buf: deque = deque(maxlen=WINDOW)
    half, written = WINDOW // 2, 0

    def emit(upto: int):
        nonlocal written
        while written <= upto:
            near = [s for j, s in buf if abs(j - written) <= half]
            writer.write((np.mean(near, 0) * 255).astype(np.uint8))
            written += 1

    t0, i = time.time(), 0
    for rgb, mask in zip(frames, masks):
        buf.append((i, skin_of(model, rgb, mask, poses.get(i))))
        emit(i - half)
        i += 1
        if i % 300 == 0:
            print(f"  {i} frames, {i / (time.time() - t0):.0f} fps", flush=True)
    emit(i - 1)
    writer.close()
    model.close()
    print(f"{name}: {i} frames of skin at {W}x{H} in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main(sys.argv[1:])
