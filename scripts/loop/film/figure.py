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
  the arms      where a bare arm crosses him, a line round it in the ring's
                colour (gloss only, from skin.mkv: run film:skin first)

Colour is NOT decided here. The output is a label map (0 field, 1 ink, 2 mid,
3 highlight) and a soft alpha, so every colourway, downbeat flip and the
Warhol grid is a lookup at compose time, never a re-render of this stage.

The gloss look is drawn on the GPU when the Mac has one (GlossBatch: the same
fields, a few frames at a time; gpu.py), else by GlossStyler, the reference.
"""
import json, sys, time
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import cv2
import gpu
from take import Reader, Writer, even, load_take, read_pose, take_dir

DETAIL = 0.55          # the first cut, as a fraction of his tone range
RIM = 0.004            # the ink rim's width, as a fraction of the height
MIN_REGION = 0.00008   # smaller cut regions dissolve back into the ink
TONE_EASE = 0.15       # how fast the tone range follows the frame (0..1)
BATCH = 4              # frames drawn together on the GPU


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
ARM_LINE = 0.004       # the line around an arm where it crosses him: its width, as a fraction of the height
ARM_LINE_TONE = 0.68   # its tone: past the ring's cut, short of the core's, so it is drawn in the ground's colour
ARM_MIN = 0.0004       # bare skin smaller than this (a fraction of the height squared) is noise, not a hand
CALM = 0.015           # the light steps back within this much (fraction of the height) of a painted stroke (paint.py)
ARM_REACH = (0.28, 0.30, 0.45, 0.30)  # how far an arm reaches round its bones: upper arm, forearm, wrist, hand (shoulder widths)


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

    def __call__(self, rgb: np.ndarray, mask_small: np.ndarray, lm: np.ndarray | None = None,
                 skin: np.ndarray | None = None, paint: np.ndarray | None = None):
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
        if paint is not None:
            tone *= 1 - calm(paint.astype(np.float32) / 255, self.fh)
        if skin is not None and lm is not None and paint is None:
            # After the rim and the quiet head: the line runs right out to his
            # outline, and round a hand held up by his face.
            tone = np.maximum(tone, arm_lines(skin.astype(np.float32) / 255, solid, lm, self.edge_s))
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


class GlossBatch(GlossStyler):
    """
    GlossStyler on the GPU, a few frames at a time: the same fields from the
    same maths (gpu.py samples as cv2 does), and the same easing of his tone
    scale from frame to frame.

    What is one pass over the picture (the blurs, the light, its quantiles,
    the cuts) runs on the GPU. What walks the picture (the distance in from his
    outline, the pieces of an arm) stays with cv2 on the CPU, worked only in
    the box around what it measures and several frames at once.
    """

    def __init__(self, w: int, h: int, fw: int, fh: int, dev, workers: int = 4):
        super().__init__(w, h, fw, fh)
        self.dev = dev
        self.pool = ThreadPoolExecutor(workers)

    def batch(self, frames: list) -> list:
        """[(rgb, mask, lm, skin[, paint])] -> [(labels, alpha, field, tone)], in order, as __call__ gives them."""
        return self.finish(self.begin(frames))

    def begin(self, frames: list) -> dict:
        """
        The first half of a batch: the GPU's outline and light, the tone scale
        eased on, and the CPU's walks started. finish() completes it, so the
        walks of one batch run while the GPU starts the next.
        """
        torch = gpu.torch
        B = len(frames)
        paints = [f[4] if len(f) > 4 else None for f in frames]
        calmed = None
        if any(v is not None for v in paints):
            # calm(), on the GPU: the light steps back near a painted stroke
            P = gpu.send(np.stack([np.zeros_like(frames[0][1]) if v is None else v for v in paints])).float() / 255
            calmed = (gpu.blur(P, CALM * self.fh) * 3).clamp_(0, 1)
        skins = [f[3] if (len(f) < 5 or f[4] is None) else None for f in frames]  # painted strokes take over from skin lines
        has_skin = any(v is not None for v in skins)
        # The outline and the bare skin are smoothed alike: one pass for both.
        soft = [f[1] for f in frames] + ([np.zeros_like(frames[0][1]) if v is None else v for v in skins] if has_skin else [])
        smooth = gpu.blur(gpu.send(np.stack(soft)).float() / 255, self.edge_s)
        field = smooth[:B].clamp_(0, 1)
        solid = field >= 0.5
        if (self.w, self.h) != (self.fw, self.fh):
            small = [cv2.resize(f[0], (self.fw, self.fh), interpolation=cv2.INTER_AREA) for f in frames]
        else:
            small = [f[0] for f in frames]
        lum, s = _lum(gpu.send(np.stack(small)), solid)
        # over_him, both scales, his light and his shape together
        both = torch.cat((lum * s, s))
        light = _light(gpu.wide_blur(both, self.pool_s), gpu.wide_blur(both, self.shape_s))
        # His own quantiles: the light where he is, sorted (off him sorts last), in the box he fills.
        counts = torch.cat((solid.sum((1, 2)), solid.any(2).any(0), solid.any(1).any(0))).to(torch.int64).cpu().numpy()
        n, rows, cols = counts[:B], np.flatnonzero(counts[B:B + self.fh]), np.flatnonzero(counts[B + self.fh:])
        box = (slice(rows[0], rows[-1] + 1), slice(cols[0], cols[-1] + 1)) if len(rows) else (slice(0, 1), slice(0, 1))
        ranked = torch.sort(torch.where(solid, light, torch.inf)[:, box[0], box[1]].reshape(B, -1), dim=1).values
        at = np.array([GLOSS_QUANTILES * (max(k, 1) - 1) for k in n])
        lo = np.floor(at).astype(np.int64)
        hi = np.minimum(lo + 1, np.maximum(n, 1)[:, None] - 1)
        got = ranked.gather(1, gpu.send(np.concatenate((lo, hi), 1))).cpu().numpy()
        masks = (torch.cat((solid, (smooth[B:] >= 0.5) & solid)) if has_skin else solid).to(torch.uint8).cpu().numpy()
        solid_np, arm_np = masks[:B], masks[B:] if has_skin else [None] * B
        # The tone scale, eased frame to frame in order, as the reference does (np.percentile's own lerp).
        anchors, live = np.zeros((B, 5), np.float32), n >= 50
        for b in range(B):
            if live[b]:
                g = at[b] - lo[b]
                a_, b_ = got[b, :5], got[b, 5:]
                step = b_ - a_  # in the values' own float32, then the lerp in double
                q = np.where(g >= 0.5, b_ - step * (1 - g), a_ + step * g)
                self.anchors = q if self.anchors is None else self.anchors + TONE_EASE * (q - self.anchors)
                anchors[b] = np.maximum.accumulate(self.anchors + np.arange(5) * 1e-5)
        walks = [self.pool.submit(self.walk, solid_np[b], arm_np[b], frames[b][2], int(n[b])) if live[b] else None
                 for b in range(B)]
        return {"field": field, "solid": solid, "light": light, "anchors": anchors, "walks": walks, "calm": calmed}

    def finish(self, p: dict) -> list:
        torch = gpu.torch
        light = p["light"]
        rim, lift = torch.zeros_like(light), torch.zeros_like(light)
        # Every patch of the batch goes up in one piece (under 50 pixels of him: no light at all, rim stays 0).
        places, parts = [], []
        for b, w in enumerate(p["walks"]):
            if w is not None:
                for kind, patch in zip(("rim", "quiet", "line"), w.result()):
                    if patch is not None:
                        places.append((b, kind, patch[0], patch[1], patch[2].shape))
                        parts.append(patch[2].ravel())
        flat = gpu.send(np.concatenate(parts)) if parts else None
        at = 0
        for b, kind, x0, y0, (h, w) in places:
            v, at = flat[at:at + h * w].view(h, w), at + h * w
            region = (b, slice(y0, y0 + h), slice(x0, x0 + w))
            if kind == "rim":
                rim[region] = v
            elif kind == "quiet":
                rim[region] *= v
            else:
                lift[region] = v
        if p.get("calm") is not None:
            rim = rim * (1 - p["calm"])
        tone = _tone(light, gpu.send(p["anchors"]), rim, lift, p["solid"])
        field = p["field"]
        up, t_up = gpu.cubic(field, self.w, self.h), gpu.cubic(tone, self.w, self.h)
        figs, fields = _decide(up, t_up), _bytes(field, tone)
        figs, fields = figs.cpu().numpy(), fields.cpu().numpy()
        gpu.settle()
        return [(figs[b, 0], figs[b, 1], fields[b, 0], fields[b, 1]) for b in range(len(figs))]

    def walk(self, solid: np.ndarray, arm: np.ndarray | None, lm: np.ndarray | None, count: int):
        """
        One frame's CPU part: the rim (the light fading in from his outline),
        the quiet head and the arm lines, each as a patch (x0, y0, values) at the
        fields' size, from the GPU's outline and bare skin.
        """
        rows, cols = np.flatnonzero(solid.any(1)), np.flatnonzero(solid.any(0))
        # One pixel of field round him: the distance in is the same as over the whole frame.
        y0, y1 = max(0, rows[0] - 1), min(self.fh, rows[-1] + 2)
        x0, x1 = max(0, cols[0] - 1), min(self.fw, cols[-1] + 2)
        dist = cv2.distanceTransform(solid[y0:y1, x0:x1], cv2.DIST_L2, 5)
        u = np.clip((dist - 0.5 * self.rim_px) / self.rim_px, 0, 1)
        rim = (x0, y0, u * u * (3 - 2 * u))
        quiet = line = None
        if lm is not None:
            quiet = head_quiet_patch(lm, self.fw, self.fh)
            if arm is not None:
                line = arm_lines_patch(arm.astype(bool) & arm_zone(lm, self.fw, self.fh), solid.astype(bool), count)
        return rim, quiet, line


GLOSS_QUANTILES = np.array([5, 50, GLOSS_LIT[0] * 100, GLOSS_LIT[1] * 100, 99.5]) / 100
GLOSS_SCALE = (0.0, 0.3, GLOSS_CUTS[0], GLOSS_CUTS[1], 1.0)  # where the five anchors land on the tone scale


def interp(x, xp, fp):
    """np.interp(x, xp, fp) per frame: x (B, H, W), xp (B, 5) rising, fp five values; held past each end."""
    xp = xp[:, :, None, None]
    out = gpu.torch.where(x < xp[:, 0], fp[0], fp[-1])
    for j in range(len(fp) - 1):
        slope = (fp[j + 1] - fp[j]) / (xp[:, j + 1] - xp[:, j])
        out = gpu.torch.where((x >= xp[:, j]) & (x < xp[:, j + 1]), slope * (x - xp[:, j]) + fp[j], out)
    return out


# GlossBatch's elementwise steps, each fused into one pass over the frames (gpu.fused).

@gpu.fused
def _lum(rgb, solid):
    """His brightness (the reference's Rec. 709 weights) and where he is, as floats."""
    rgb = rgb.float()
    return (rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722) / 255, solid.float()


@gpu.fused
def _light(pool, shape):
    """over_him at the pool's scale less over_him at his shape's: the light on his shape."""
    a, s = pool.chunk(2)
    a2, s2 = shape.chunk(2)
    return a / s.clamp_min(1e-3) - a2 / s2.clamp_min(1e-3)


@gpu.fused
def _tone(light, anchors, rim, lift, solid):
    """The tone: his light on the anchored scale, faded in from the rim and off the head, the arm lines over it."""
    return gpu.torch.where(solid, gpu.torch.maximum(interp(light, anchors, GLOSS_SCALE) * rim, lift), 0.0)


@gpu.fused
def _decide(up, t_up):
    """GlossStyler.decide's label map and alpha, as bytes: (B, 2, H, W)."""
    inside = up >= 0.5
    labels = inside.to(gpu.torch.uint8) + (inside & (t_up > GLOSS_CUTS[0])) + (inside & (t_up > GLOSS_CUTS[1]))
    alpha = (((up - 0.5) * 6 + 0.5).clamp(0, 1) * 255).to(gpu.torch.uint8)
    return gpu.torch.stack((labels.to(gpu.torch.uint8), alpha), 1)


@gpu.fused
def _bytes(field, tone):
    """The two fields as stored: (B, 2, h, w) bytes."""
    return (gpu.torch.stack((field.clamp(0, 1), tone.clamp(0, 1)), 1) * 255).to(gpu.torch.uint8)


def calm(paint: np.ndarray, h: int) -> np.ndarray:
    """
    0..1: how far his light steps back near a painted stroke (paint.py). A pool
    of light beside a stroke fought it (the owner, 2026-10-21: "that light
    splotch and the stroke are kind of fighting each other"), so where he is
    painted the light gives way.
    """
    return np.clip(cv2.GaussianBlur(paint, (0, 0), CALM * h) * 3, 0, 1)


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
    patch = head_quiet_patch(lm, w, h)
    if patch is not None:
        x0, y0, v = patch
        quiet[y0:y0 + v.shape[0], x0:x0 + v.shape[1]] = v
    return quiet


def head_quiet_patch(lm: np.ndarray, w: int, h: int):
    """head_quiet where it is under 1: (x0, y0, values), or None."""
    pts, vis = lm[:, :2] * np.array([w, h], np.float32), lm[:, 2]
    if min(vis[11], vis[12]) < 0.3:
        return None
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
        return None
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    ab = b - a
    t = np.clip(((xx - a[0]) * ab[0] + (yy - a[1]) * ab[1]) / max(1e-3, float(ab @ ab)), 0, 1)
    dist = np.hypot(xx - (a[0] + t * ab[0]), yy - (a[1] + t * ab[1]))
    u = np.clip((dist - reach) / max(1e-3, soft), 0, 1)
    return int(x0), int(y0), u * u * (3 - 2 * u)


def arm_zone(lm: np.ndarray, w: int, h: int) -> np.ndarray:
    """
    Where his arms can be, from the pose: round each upper arm, forearm, wrist
    and hand. Bare skin outside it (his neck, a bare knee) is not an arm.
    """
    zone = np.zeros((h, w), np.uint8)
    pts, vis = lm[:, :2] * np.array([w, h], np.float32), lm[:, 2]
    torso = float(np.linalg.norm((pts[11] + pts[12]) / 2 - (pts[23] + pts[24]) / 2))
    scale = max(float(np.linalg.norm(pts[11] - pts[12])), 0.5 * torso, 1.0)
    upper, fore, wrist, hand = (r * scale for r in ARM_REACH)

    def bone(a, b, r):
        if min(vis[a], vis[b]) >= 0.3:
            cv2.line(zone, tuple(int(v) for v in pts[a]), tuple(int(v) for v in pts[b]), 1, max(1, int(2 * r)))

    for shoulder, elbow, wr, fingers in ((11, 13, 15, (17, 19, 21)), (12, 14, 16, (18, 20, 22))):
        bone(shoulder, elbow, upper)
        bone(elbow, wr, fore)
        if vis[wr] >= 0.3:
            cv2.circle(zone, tuple(int(v) for v in pts[wr]), max(1, int(wrist)), 1, -1)
            for f in fingers:
                bone(wr, f, hand)
    return zone.astype(bool)


def arm_lines(skin: np.ndarray, solid: np.ndarray, lm: np.ndarray, edge_s: float) -> np.ndarray:
    """
    The tone of a line round each bare arm where it lies over the rest of him,
    so an arm across his chest reads instead of melting into the ink. Drawn at
    the ring's level, it is the ground's colour, like the rings of his light.

    `skin` is bare skin 0..1 (skin.py) at the fields' size. It is smoothed as
    the outline is, so the line is the same kind of curve, and only skin round
    his arms counts (arm_zone). The line follows the arm's edge only where the
    other side is him: where the arm meets the field, his outline already
    draws it.
    """
    h, w = solid.shape
    arm = (cv2.GaussianBlur(skin, (0, 0), edge_s) >= 0.5) & solid & arm_zone(lm, w, h)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(arm.astype(np.uint8), connectivity=8)
    small = np.where(stats[1:, cv2.CC_STAT_AREA] < ARM_MIN * h * h)[0] + 1
    if len(small):
        arm[np.isin(lab, small)] = False
    body = solid & ~arm
    if arm.sum() < 50 or body.sum() < 50:
        return np.zeros((h, w), np.float32)
    # Distance from the arm's edge, outside the arm and in (the edge lies half a pixel from each side's centres).
    edge = np.where(arm, cv2.distanceTransform(arm.astype(np.uint8), cv2.DIST_L2, 5),
                    cv2.distanceTransform((~arm).astype(np.uint8), cv2.DIST_L2, 5)) - 0.5
    half = max(1.0, h * ARM_LINE / 2)
    # Highest on the edge, crossing the ring's cut half a line out: compose
    # cuts it there into a crisp line of an even width.
    line = np.clip(ARM_LINE_TONE - edge / half * (ARM_LINE_TONE - GLOSS_CUTS[0]), 0, ARM_LINE_TONE)
    against_him = cv2.distanceTransform((~body).astype(np.uint8), cv2.DIST_L2, 5) <= 2 * half
    line[~(solid & against_him)] = 0
    return line.astype(np.float32)


def arm_lines_patch(arm: np.ndarray, solid: np.ndarray, count: int):
    """
    arm_lines for GlossBatch, worked in the box round the arm: `arm` is the bare
    skin over him inside his arm zone, already cut, `count` how much of him is
    solid. (x0, y0, line) or None. The values are arm_lines' own: the line has
    faded out a few line widths from the arm, and everything it is measured
    against lies inside the box.
    """
    h, w = solid.shape
    rows, cols = np.flatnonzero(arm.any(1)), np.flatnonzero(arm.any(0))
    if not len(rows):
        return None
    half = max(1.0, h * ARM_LINE / 2)
    reach = ARM_LINE_TONE / (ARM_LINE_TONE - GLOSS_CUTS[0]) * half + 0.5 + 2 * half  # the line's end, and what it looks for
    pad = int(np.ceil(reach / 0.98)) + 2  # cv2's distance runs up to 2% under the straight line
    y0, y1, x0, x1 = max(0, rows[0] - pad), min(h, rows[-1] + 1 + pad), max(0, cols[0] - pad), min(w, cols[-1] + 1 + pad)
    arm, solid = arm[y0:y1, x0:x1].copy(), solid[y0:y1, x0:x1]
    n, lab, stats, _ = cv2.connectedComponentsWithStats(arm.astype(np.uint8), connectivity=8)
    small = np.where(stats[1:, cv2.CC_STAT_AREA] < ARM_MIN * h * h)[0] + 1
    if len(small):
        arm[np.isin(lab, small)] = False
    on = int(arm.sum())
    if on < 50 or count - on < 50:  # the arm is part of him: the rest of him is what is left
        return None
    body = solid & ~arm
    edge = np.where(arm, cv2.distanceTransform(arm.astype(np.uint8), cv2.DIST_L2, 5),
                    cv2.distanceTransform((~arm).astype(np.uint8), cv2.DIST_L2, 5)) - 0.5
    line = np.clip(ARM_LINE_TONE - edge / half * (ARM_LINE_TONE - GLOSS_CUTS[0]), 0, ARM_LINE_TONE)
    against_him = cv2.distanceTransform((~body).astype(np.uint8), cv2.DIST_L2, 5) <= 2 * half
    line[~(solid & against_him)] = 0
    return int(x0), int(y0), line.astype(np.float32)


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
    frames = Reader(take["path"], W, H, start=start, dur=end - start, fps=take["fps"])
    masks = Reader(d / "mask.mkv", meta["w"], meta["h"], gray=True)
    lab_out = Writer(d / "labels.mkv", W, H, take["fps"])
    alpha_out = Writer(d / "alpha.mkv", W, H, take["fps"])
    fw, fh = meta["w"], meta["h"]
    fields = (Writer(d / "field.mkv", fw, fh, take["fps"]), Writer(d / "tone.mkv", fw, fh, take["fps"])) if look == "gloss" else None
    dev = gpu.device() if look == "gloss" else None
    style = Styler(W, H) if look != "gloss" else GlossBatch(W, H, fw, fh, dev) if dev else GlossStyler(W, H, fw, fh)
    poses = read_pose(d / "pose.jsonl") if look == "gloss" else {}
    # His bare skin (skin.py), so an arm across him is drawn; a take without it is drawn as before.
    # The painted strokes (paint.py): the light gives way where they are, and they take over from the skin lines.
    paints = Reader(d / "paint.mkv", fw, fh, gray=True) if look == "gloss" and (d / "paint.mkv").exists() else None
    if paints:
        print("  painted strokes (paint.mkv): the light steps back where they are", flush=True)
    skins = Reader(d / "skin.mkv", fw, fh, gray=True) if look == "gloss" and not paints and (d / "skin.mkv").exists() else None
    if look == "gloss" and skins is None and not paints:
        print("  no skin.mkv: arms across him will not be drawn (npm run film:skin first)", flush=True)
    print(f"  drawing on the {'GPU' if dev else 'CPU'}", flush=True)

    def put(out):
        lab_out.write(out[0])
        alpha_out.write(out[1])
        if fields:
            fields[0].write(out[2])
            fields[1].write(out[3])

    t0, i, batch, started = time.time(), 0, [], None
    for rgb, mask in zip(frames, masks):
        skin = next(skins, None) if skins else None
        stroke = next(paints, None) if paints else None
        if dev:
            # A batch is begun before the one before it is finished: its CPU walks overlap the GPU.
            batch.append((rgb, mask, poses.get(i), skin, stroke))
            if len(batch) == BATCH:
                begun, batch = style.begin(batch), []
                for out in style.finish(started) if started else ():
                    put(out)
                started = begun
        elif look == "gloss":
            put(style(rgb, mask, poses.get(i), skin, stroke))
        else:
            put(style(rgb, mask))
        i += 1
        if i % 300 == 0:
            print(f"  {i} frames, {i / (time.time() - t0):.0f} fps", flush=True)
    for p in (started, style.begin(batch) if batch else None):
        for out in style.finish(p) if p else ():
            put(out)
    lab_out.close()
    alpha_out.close()
    for f in fields or ():
        f.close()
    for r in (frames, masks, skins, paints):
        if r:
            r.close()
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
