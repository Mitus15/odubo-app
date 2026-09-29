"""
Draw him: the person mask and the frame become the Loop Soul figure.

    npm run film:figure -- <take> [--height=2160]

A port of the video converter's figure styling (scripts/loop/video-convert.mjs
918-952) with one change: the tone cuts are smoothed over time, so the
highlights hold still instead of flickering frame to frame.

  the outline   the soft mask, smoothed and read at 0.5: a drawn line
  the rim       a band of ink kept just inside the outline, so he reads as
                one shape before any detail
  the cuts      inside the rim, the brightness of his body in three bands:
                ink, mid (above 55% of his own range), highlight (above 80%)

Colour is NOT decided here. The output is a label map (0 field, 1 ink, 2 mid,
3 highlight) and a soft alpha, so every colourway, downbeat flip and the
Warhol grid is a lookup at compose time, never a re-render of this stage.
"""
import json, sys, time
import numpy as np
import cv2
from take import Reader, Writer, even, load_take, take_dir

DETAIL = 0.55          # the first cut, as a fraction of his tone range
RIM = 0.004            # the ink rim's width, as a fraction of the height
MIN_REGION = 0.00008   # smaller cut regions dissolve back into the ink
TONE_EASE = 0.15       # how fast the tone range follows the frame (0..1)


def box(img: np.ndarray, r: int) -> np.ndarray:
    return cv2.blur(img, (2 * r + 1, 2 * r + 1), borderType=cv2.BORDER_REPLICATE) if r > 0 else img


def despeckle(labels: np.ndarray, level: int, min_px: int) -> None:
    """Regions at `level` or above smaller than min_px drop one level, in place."""
    m = (labels >= level).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    small = np.where(stats[1:, cv2.CC_STAT_AREA] < min_px)[0] + 1
    if len(small):
        labels[np.isin(lab, small)] = level - 1


class Styler:
    def __init__(self, w: int, h: int):
        self.w, self.h = w, h
        self.rim_r = max(2, round(h * RIM))
        self.lum_r = max(1, round(h / 720))
        self.min_px = max(12, round(w * h * MIN_REGION))
        self.lo = self.hi = None

    def __call__(self, rgb: np.ndarray, mask_small: np.ndarray):
        m = mask_small.astype(np.float32) / 255
        # The converter smooths at a 720 line work size with radius 3, twice.
        r = max(1, round(3 * mask_small.shape[0] / 720))
        m = box(box(m, r), r)
        up = cv2.resize(m, (self.w, self.h), interpolation=cv2.INTER_LINEAR)
        solid = up >= 0.5
        labels = np.zeros((self.h, self.w), np.uint8)
        alpha = np.clip((up - 0.5) * 6 + 0.5, 0, 1)
        if solid.sum() < 50:
            return labels, (alpha * 255).astype(np.uint8)
        interior = box(solid.astype(np.float32), self.rim_r) >= 0.72
        lum = box((rgb.astype(np.float32) @ np.array([0.2126, 0.7152, 0.0722], np.float32)) / 255, self.lum_r)
        inside = lum[solid]
        lo, hi = np.percentile(inside, 1), np.percentile(inside, 99)
        if self.lo is None:
            self.lo, self.hi = lo, hi
        else:
            self.lo += TONE_EASE * (lo - self.lo)
            self.hi += TONE_EASE * (hi - self.hi)
        span = max(0.1, self.hi - self.lo)
        cut1 = self.lo + span * DETAIL
        cut2 = self.lo + span * (DETAIL + (1 - DETAIL) * 0.55)
        labels[solid] = 1
        labels[interior & (lum > cut1)] = 2
        labels[interior & (lum > cut2)] = 3
        despeckle(labels, 3, self.min_px)
        despeckle(labels, 2, self.min_px)
        return labels, (alpha * 255).astype(np.uint8)


def main(argv):
    name = argv[0]
    opts = dict(a[2:].split("=", 1) for a in argv[1:] if a.startswith("--") and "=" in a)
    take = load_take(name)
    d = take_dir(name)
    meta = json.loads((d / "mask.json").read_text())
    H = min(int(opts.get("height", 2160)), take["h"])
    W = even(H * take["w"] / take["h"])
    start, end = take["window"]["start"], take["window"]["end"]
    frames = Reader(take["path"], W, H, start=start, dur=end - start)
    masks = Reader(d / "mask.mkv", meta["w"], meta["h"], gray=True)
    lab_out = Writer(d / "labels.mkv", W, H, take["fps"])
    alpha_out = Writer(d / "alpha.mkv", W, H, take["fps"])
    style = Styler(W, H)
    t0, i = time.time(), 0
    for rgb, mask in zip(frames, masks):
        labels, alpha = style(rgb, mask)
        lab_out.write(labels)
        alpha_out.write(alpha)
        i += 1
        if i % 300 == 0:
            print(f"  {i} frames, {i / (time.time() - t0):.0f} fps", flush=True)
    lab_out.close()
    alpha_out.close()
    (d / "figure.json").write_text(json.dumps({"w": W, "h": H, "frames": i, "fps": take["fps"]}))
    print(f"{name}: {i} frames styled at {W}x{H} in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main(sys.argv[1:])
