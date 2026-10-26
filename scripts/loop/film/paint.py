"""
Paint what is in front of him: soft strokes where one part of him passes before another.

    npm run film:paint -- <take>

The figure is one ink shape, so an arm across his chest disappears into it.
The owner (2026-10-21): "let's paint on what's already going on in the
picture... it doesn't have to be crisp... we have to be able to tell
something's going on up front". Drawn outlines of his limbs read as a line
drawing, and a hoodie must keep its own outline, so nothing here guesses at
his body: a depth model (Depth Anything V2 Small) says how near each point of
him is, and where that nearness changes inside him (an arm before his chest,
a hand before his hip) a soft stroke in the ground's colour is painted. A
blurred hand gives a blurred depth, so its stroke blurs with it.

Runs after segment (the matte and the pose). Writes paint.mkv (0..255, the
stroke's strength, the mask's size). figure.py lets the light step back
where a stroke is (they fought), compose.py lays the stroke over him. A take
without it is drawn as before.
"""
import json, sys, time
from collections import deque
from pathlib import Path
import numpy as np
import cv2
from film_common import MODELS
from take import Reader, Writer, load_take, read_pose, take_dir

DEPTH_MODEL = "depth-anything-v2-small"   # the Hugging Face Depth-Anything-V2-Small-hf files, in FILM_MODELS
EDGE = 0.005          # his outline's smoothing (figure.GLOSS_EDGE), so "him" here is the shape figure cuts
NEAR_FROM = 0.15      # nearer than his torso by this share of his own depth range before it counts as in front
NEAR_SPAN = 0.6
STROKE_SOFT = 3 / 1920   # the brush: the nearness is smoothed this much (fraction of the height) before its edge is found
STROKE_TOP = 99          # a change of nearness is measured against his sharpest (this percentile over him)...
STROKE_EASE = 0.15       # ...eased from frame to frame, as his light's scale is, so the strokes don't flicker
STROKE_FROM, STROKE_SPAN = 0.2, 0.6   # under 0.2 of the sharpest paints nothing; full strength by 0.8
STROKE_MAX = 0.9         # never quite the ground itself: he stays one shape
INSET = (6 / 1920, 10 / 1920)   # no stroke on his outline (it already is an edge): from this far in, fully in over this
WINDOW = 3            # frames in the centred mean of his nearness (the model reads each frame alone)
PAD = 40 / 1920       # the crop round him the model sees
MODEL_WH = (392, 700) # the model's input: a fixed portrait crop (multiples of its 14 px patches), so frames batch
WORK = 2              # strokes are found at half the mask's size (they are soft), then scaled up
BATCH = 8             # crops the model reads at once


class Depth:
    """
    Depth Anything V2 Small on the GPU (torch MPS): fixed-size crops, a batch at
    a time, in half precision; disparity, larger is nearer. The image goes in
    as the model's own processor would give it (resized, scaled, normalised),
    done on the GPU: on the CPU that alone held the pass to a frame a second.
    """

    MEAN, STD = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)

    def __init__(self):
        import torch
        from transformers import AutoModelForDepthEstimation
        path = MODELS / DEPTH_MODEL
        if not (path / "model.safetensors").exists():
            raise SystemExit(f"missing {path}: fetch config.json, preprocessor_config.json and model.safetensors from "
                             "huggingface.co/depth-anything/Depth-Anything-V2-Small-hf with curl")
        self.torch = torch
        self.dev = "mps" if torch.backends.mps.is_available() else "cpu"
        self.half = False  # half precision on MPS read trouser folds as depth (blobs on his legs, 2026-10-21)
        self.net = AutoModelForDepthEstimation.from_pretrained(path).to(self.dev).eval()
        if self.half:
            self.net = self.net.half()
        dtype = torch.float16 if self.half else torch.float32
        self.mean = torch.tensor(self.MEAN, device=self.dev, dtype=dtype).view(1, 3, 1, 1)
        self.std = torch.tensor(self.STD, device=self.dev, dtype=dtype).view(1, 3, 1, 1)

    def __call__(self, crops: list) -> list:
        """[(h, w, 3) uint8, already MODEL_WH] -> [(h, w) float32 disparity]"""
        torch = self.torch
        with torch.no_grad():
            x = torch.from_numpy(np.stack(crops)).to(self.dev).permute(0, 3, 1, 2)
            x = x.half() if self.half else x.float()
            x = (x / 255 - self.mean) / self.std
            d = self.net(pixel_values=x).predicted_depth.float()
        return list(d.cpu().numpy())


def crop_box(solid: np.ndarray, pad: int) -> tuple:
    """His box, padded, grown to the model's aspect (x0, y0, x1, y1): may run off the frame."""
    ys, xs = np.nonzero(solid)
    x0, x1, y0, y1 = xs.min() - pad, xs.max() + pad, ys.min() - pad, ys.max() + pad
    want = MODEL_WH[0] / MODEL_WH[1]
    w, h = x1 - x0, y1 - y0
    if w / h < want:
        grow = h * want - w
        x0, x1 = x0 - grow / 2, x1 + grow / 2
    else:
        grow = w / want - h
        y0, y1 = y0 - grow / 2, y1 + grow / 2
    return int(np.floor(x0)), int(np.floor(y0)), int(np.ceil(x1)), int(np.ceil(y1))


def take_crop(rgb: np.ndarray, box: tuple) -> np.ndarray:
    """The box out of the frame (black off its edge), at the model's size."""
    h, w = rgb.shape[:2]
    x0, y0, x1, y1 = box
    out = np.zeros((y1 - y0, x1 - x0, 3), np.uint8)
    sx0, sy0, sx1, sy1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
    out[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = rgb[sy0:sy1, sx0:sx1]
    return cv2.resize(out, MODEL_WH, interpolation=cv2.INTER_AREA)


def place(disp: np.ndarray, box: tuple, w: int, h: int) -> np.ndarray:
    """The model's disparity for a box, back where the box lies in a (h, w) frame."""
    x0, y0, x1, y1 = box
    big = cv2.resize(disp, (x1 - x0, y1 - y0), interpolation=cv2.INTER_LINEAR)
    out = np.zeros((h, w), np.float32)
    sx0, sy0, sx1, sy1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
    out[sy0:sy1, sx0:sx1] = big[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0]
    return out


def nearness(disp: np.ndarray, solid: np.ndarray, lm: np.ndarray | None) -> np.ndarray:
    """0..1 over him: how much nearer the camera than his torso each point is, on his own depth range."""
    h, w = solid.shape
    torso = solid
    if lm is not None:
        pts = lm[:, :2] * np.array([w, h], np.float32)
        hull = np.zeros((h, w), np.uint8)
        cv2.fillConvexPoly(hull, cv2.convexHull(pts[[11, 12, 24, 23]].astype(np.int32)), 1)
        if (hull.astype(bool) & solid).sum() > 100:
            torso = hull.astype(bool) & solid
    ref = float(np.median(disp[torso]))
    top = float(np.percentile(disp[solid], 99))
    return np.clip((disp - ref) / max(1e-3, top - ref), 0, 1) * solid


def edges(near: np.ndarray, solid: np.ndarray) -> np.ndarray:
    """
    How sharply his nearness changes at each point. Off him every point takes
    the nearness of the nearest point of him first, so his outline makes no
    edge of its own.
    """
    h, w = solid.shape
    n = np.clip((near - NEAR_FROM) / NEAR_SPAN, 0, 1)
    if not solid.any():
        return np.zeros((h, w), np.float32)
    _, lab = cv2.distanceTransformWithLabels((~solid).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    src = np.argwhere(solid)  # the pixels cv2 labels, in its order (row by row)
    n = n[src[:, 0], src[:, 1]][np.clip(lab - 1, 0, len(src) - 1)].astype(np.float32)
    n = cv2.GaussianBlur(n, (0, 0), max(1.0, STROKE_SOFT * h))
    gy, gx = np.gradient(n)
    return np.sqrt(gx * gx + gy * gy).astype(np.float32)


def strokes(near: np.ndarray, solid: np.ndarray, quiet: np.ndarray | float = 1.0, sharpest: float | None = None):
    """
    0..1: the stroke where his nearness changes inside him, against his
    sharpest change (this frame's own, or `sharpest`, eased by the caller):
    the strongest edges paint, the gentle slope of a near leg does not. Never
    on his outline (it already is an edge), never on his head (quiet:
    head_quiet, 0 over it). Returns (strokes, this frame's sharpest).
    """
    h, w = solid.shape
    e = edges(near, solid)
    own = float(np.percentile(e[solid], STROKE_TOP)) if solid.sum() > 50 else 0.0
    top = sharpest if sharpest else own
    p = np.clip((e / max(top, 1e-6) - STROKE_FROM) / STROKE_SPAN, 0, 1) * STROKE_MAX
    dist = cv2.distanceTransform(solid.astype(np.uint8), cv2.DIST_L2, 5)
    inside = np.clip((dist - INSET[0] * h) / (INSET[1] * h), 0, 1)
    return (p * inside * quiet).astype(np.float32), own


def main(argv):
    if not argv:
        raise SystemExit("usage: npm run film:paint -- <take>")
    from figure import head_quiet  # the head stays ink, as everywhere
    name = argv[0]
    take, d = load_take(name), take_dir(name)
    meta = json.loads((d / "mask.json").read_text())
    W, H = meta["w"], meta["h"]
    w, h = W // WORK, H // WORK
    start, end = take["window"]["start"], take["window"]["end"]
    frames = Reader(take["path"], w, h, start=start, dur=end - start, fps=take["fps"])  # at the work size
    masks = Reader(d / "mask.mkv", W, H, gray=True)
    poses = read_pose(d / "pose.jsonl")
    model = Depth()
    writer = Writer(d / "paint.mkv", W, H, take["fps"])
    edge_s = max(0.8, h * EDGE)
    buf: deque = deque(maxlen=WINDOW)
    half, written = WINDOW // 2, 0
    eased = [None]  # his sharpest change of nearness, eased frame to frame

    def emit(upto: int):
        nonlocal written
        while written <= upto:
            near = [n for j, n, _, _ in buf if abs(j - written) <= half]
            _, _, solid, lm = next(x for x in buf if x[0] == written)
            quiet = head_quiet(lm, w, h) if lm is not None else 1.0
            mean = np.mean(near, 0)
            own = float(np.percentile(edges(mean, solid)[solid], STROKE_TOP)) if solid.sum() > 50 else 0.0
            if own > 0:
                eased[0] = own if eased[0] is None else eased[0] + STROKE_EASE * (own - eased[0])
            p, _ = strokes(mean, solid, quiet, eased[0])
            writer.write((cv2.resize(p, (W, H), interpolation=cv2.INTER_LINEAR) * 255).astype(np.uint8))
            written += 1

    def run(pending):
        """The model over a batch of frames, then each frame's nearness into the window."""
        crops = [take_crop(rgb, box) for _, rgb, _, _, box in pending if box is not None]
        disps = iter(model(crops)) if crops else iter(())
        for i, rgb, solid, lm, box in pending:
            near = np.zeros((h, w), np.float32)
            if box is not None:
                disp = place(next(disps), box, w, h)
                near = nearness(disp, solid, lm)
            buf.append((i, near, solid, lm))
            emit(i - half)

    t0, i, pending = time.time(), 0, []
    for rgb, mask in zip(frames, masks):
        small = cv2.resize(mask, (w, h), interpolation=cv2.INTER_AREA)
        solid = cv2.GaussianBlur(small.astype(np.float32) / 255, (0, 0), edge_s) >= 0.5
        lm = poses.get(i)
        box = None
        if solid.sum() > 25:
            box = crop_box(solid, int(PAD * h))  # frames, his outline and the box all at the work size
        pending.append((i, rgb, solid, lm, box))
        if len(pending) == BATCH:
            run(pending)
            pending = []
        i += 1
        if i % 300 == 0:
            print(f"  {i} frames, {i / (time.time() - t0):.0f} fps", flush=True)
    if pending:
        run(pending)
    emit(i - 1)
    writer.close()
    frames.close()
    masks.close()
    print(f"{name}: {i} frames painted at {W}x{H} in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main(sys.argv[1:])
