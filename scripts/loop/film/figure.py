"""
Draw him: the person mask and the frame become the Loop Soul figure.

    npm run film:figure -- <take> [--height=2160] [--look=gloss|poster]

--look=gloss (the default, approved by the owner 2026-09-29) is the cover's
look (GlossStyler, below): it also writes smooth fields that compose cuts at
the output size. poster is the converter's.

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
from take import Reader, Writer, even, load_take, read_pose, take_dir

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


GLOSS_EDGE = 0.005     # the outline's smoothing (sigma, fraction of the height): the segmenter's wobble becomes curves
GLOSS_POOL = 0.016     # the light's smoothing: how large the pools of light are
GLOSS_SHAPE = 0.06     # the scale of his clothes' own brightness, taken away so only light on his shape is left
GLOSS_RIM = 0.008      # ink kept inside the outline before any light shows
GLOSS_LIT = (0.80, 0.93)   # the share of him darker than the ring, and than the core: the cover's proportion
GLOSS_CUTS = (0.55, 0.75)  # where those shares land on the tone scale (compose cuts here by default)
GLOSS_HEAD = (0.45, 0.3)   # the head and neck stay ink: the quiet zone's reach and its soft edge, in shoulder widths


class GlossStyler:
    """
    The cover's look: an ink body with pools of light, each a ring of the ground
    colour around a pale core, every edge a smooth curve.

    Writes FIELDS, not decisions. `field` is the outline (0.5 is the edge) and
    `tone` is the light on his body (0 ink .. 1 brightest), both smooth. They
    are cut into shapes only at the output size (compose), so an edge is a
    clean curve at any scale instead of an upscaled staircase. The pools nest
    by themselves: the core is a higher level of the same smooth field, so it
    always sits inside its ring, as on the cover.

    Also writes the label map and alpha from the same fields, for every reader
    that wants decisions (the Warhol grid, the old look).

    The fields are smooth by design, so they are worked and stored at the
    mask's size (fw x fh) and scaled up only where they are cut: the look
    costs the same for a 4K take as for a phone clip.
    """

    def __init__(self, w: int, h: int, fw: int, fh: int):
        self.w, self.h, self.fw, self.fh = w, h, fw, fh
        self.edge_s = max(0.8, fh * GLOSS_EDGE)
        self.pool_s = max(1.5, fh * GLOSS_POOL)
        self.shape_s = max(4.0, fh * GLOSS_SHAPE)
        self.rim_px = max(1.0, fh * GLOSS_RIM)
        self.anchors = None

    def __call__(self, rgb: np.ndarray, mask_small: np.ndarray, lm: np.ndarray | None = None):
        m = mask_small.astype(np.float32) / 255
        field = np.clip(cv2.GaussianBlur(m, (0, 0), self.edge_s), 0, 1)
        solid = field >= 0.5
        tone = np.zeros((self.fh, self.fw), np.float32)
        if solid.sum() < 50:
            return self.decide(field, tone)
        small = cv2.resize(rgb, (self.fw, self.fh), interpolation=cv2.INTER_AREA)
        lum = (small.astype(np.float32) @ np.array([0.2126, 0.7152, 0.0722], np.float32)) / 255
        # Averages over his body only, so the wall never bleeds in.
        s = solid.astype(np.float32)

        def over_him(sigma):
            return wide_blur(lum * s, sigma) / np.maximum(wide_blur(s, sigma), 1e-3)

        # Gloss is light catching his shape, not pale cloth: light jeans are
        # not a highlight, the crease of a sleeve is. So the light is measured
        # against its own neighbourhood.
        light = over_him(self.pool_s) - over_him(self.shape_s)
        # A fixed share of him is lit, whatever he wears or wherever he turns:
        # the tone scale is anchored on his own quantiles, eased over time.
        q = np.percentile(light[solid], [5, 50, GLOSS_LIT[0] * 100, GLOSS_LIT[1] * 100, 99.5])
        self.anchors = q if self.anchors is None else self.anchors + TONE_EASE * (q - self.anchors)
        a = np.maximum.accumulate(self.anchors + np.arange(5) * 1e-5)
        tone = np.interp(light, a, [0.0, 0.3, GLOSS_CUTS[0], GLOSS_CUTS[1], 1.0]).astype(np.float32)
        # The rim: light fades out just inside the outline, so he reads as one
        # shape first and the pools sit inside him.
        dist = cv2.distanceTransform(solid.astype(np.uint8), cv2.DIST_L2, 5)
        u = np.clip((dist - 0.5 * self.rim_px) / self.rim_px, 0, 1)
        tone *= u * u * (3 - 2 * u)
        if lm is not None:
            tone *= head_quiet(lm, self.fw, self.fh)
        tone[~solid] = 0
        return self.decide(field, tone)

    def decide(self, field: np.ndarray, tone: np.ndarray):
        """The fields, and the label map and alpha cut from them at the figure's size."""
        up = cv2.resize(field, (self.w, self.h), interpolation=cv2.INTER_CUBIC)
        t_up = cv2.resize(tone, (self.w, self.h), interpolation=cv2.INTER_CUBIC)
        labels = np.zeros((self.h, self.w), np.uint8)
        labels[up >= 0.5] = 1
        labels[(up >= 0.5) & (t_up > GLOSS_CUTS[0])] = 2
        labels[(up >= 0.5) & (t_up > GLOSS_CUTS[1])] = 3
        alpha = np.clip((up - 0.5) * 6 + 0.5, 0, 1)
        return (labels, (alpha * 255).astype(np.uint8),
                (np.clip(field, 0, 1) * 255).astype(np.uint8), (np.clip(tone, 0, 1) * 255).astype(np.uint8))


def head_quiet(lm: np.ndarray, w: int, h: int) -> np.ndarray:
    """
    1 where the light may show, easing to 0 over his head, his neck and the top
    of his back: those always stay ink.

    A pool of light just under the head (a pale collar, a print across the back
    of a shirt, his face turned to the light) reads as an opening, and he looks
    headless: seen on the Billie Jean take (2026-10-02), where the white print
    on the back of his shirt opened a hole under his head. In the iPod ads the
    head is always solid. `lm` is the pose (normalised x, y, visibility).
    """
    quiet = np.ones((h, w), np.float32)
    pts, vis = lm[:, :2] * np.array([w, h], np.float32), lm[:, 2]
    if min(vis[11], vis[12]) < 0.3:
        return quiet
    neck = (pts[11] + pts[12]) / 2
    scale = float(np.linalg.norm(pts[11] - pts[12]))
    up = np.array([0.0, -1.0], np.float32)
    if min(vis[23], vis[24]) >= 0.3:
        spine = neck - (pts[23] + pts[24]) / 2
        # Side-on, the shoulders close up; the torso keeps the scale honest.
        scale = max(scale, 0.5 * float(np.linalg.norm(spine)))
        up = spine / max(1e-3, float(np.linalg.norm(spine)))
    face = vis[:11] >= 0.3
    head = pts[:11][face].mean(0) if face.any() else neck + up * 0.6 * scale
    down = neck - head
    down = down / max(1e-3, float(np.linalg.norm(down)))
    a, b = head - down * 0.5 * scale, neck + down * 0.35 * scale  # over the crown, to the top of the back
    reach, soft = GLOSS_HEAD[0] * scale, GLOSS_HEAD[1] * scale
    pad = reach + soft
    x0, y0 = (np.floor(np.minimum(a, b) - pad)).astype(int).clip(0)
    x1, y1 = np.ceil(np.maximum(a, b) + pad).astype(int)
    x1, y1 = min(w, x1 + 1), min(h, y1 + 1)
    if x1 <= x0 or y1 <= y0:
        return quiet
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    ab = b - a
    t = np.clip(((xx - a[0]) * ab[0] + (yy - a[1]) * ab[1]) / max(1e-3, float(ab @ ab)), 0, 1)
    dist = np.hypot(xx - (a[0] + t * ab[0]), yy - (a[1] + t * ab[1]))
    u = np.clip((dist - reach) / max(1e-3, soft), 0, 1)
    quiet[y0:y1, x0:x1] = u * u * (3 - 2 * u)
    return quiet


def wide_blur(x: np.ndarray, sigma: float) -> np.ndarray:
    """A wide Gaussian, worked at a quarter or half of the size when sigma allows (it is smooth anyway)."""
    k = 4 if sigma >= 12 else 2 if sigma >= 6 else 1
    if k == 1:
        return cv2.GaussianBlur(x, (0, 0), sigma)
    h, w = x.shape
    small = cv2.GaussianBlur(cv2.resize(x, (w // k, h // k), interpolation=cv2.INTER_AREA), (0, 0), sigma / k)
    return cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)


def main(argv):
    name = argv[0]
    opts = dict(a[2:].split("=", 1) for a in argv[1:] if a.startswith("--") and "=" in a)
    look = opts.get("look", "gloss")
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
    fw, fh = meta["w"], meta["h"]
    fields = (Writer(d / "field.mkv", fw, fh, take["fps"]), Writer(d / "tone.mkv", fw, fh, take["fps"])) if look == "gloss" else None
    style = GlossStyler(W, H, fw, fh) if look == "gloss" else Styler(W, H)
    poses = read_pose(d / "pose.jsonl") if look == "gloss" else {}
    t0, i = time.time(), 0
    for rgb, mask in zip(frames, masks):
        out = style(rgb, mask, poses.get(i)) if look == "gloss" else style(rgb, mask)
        lab_out.write(out[0])
        alpha_out.write(out[1])
        if fields:
            fields[0].write(out[2])
            fields[1].write(out[3])
        i += 1
        if i % 300 == 0:
            print(f"  {i} frames, {i / (time.time() - t0):.0f} fps", flush=True)
    lab_out.close()
    alpha_out.close()
    for f in fields or ():
        f.close()
    if not fields:
        for stale in ("field.mkv", "tone.mkv"):
            (d / stale).unlink(missing_ok=True)
    info = {"w": W, "h": H, "frames": i, "fps": take["fps"], "look": look}
    if fields:
        info.update(fieldW=fw, fieldH=fh)
    (d / "figure.json").write_text(json.dumps(info))
    print(f"{name}: {i} frames styled ({look}) at {W}x{H} in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main(sys.argv[1:])
