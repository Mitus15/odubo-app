"""
Where the badge sits: on his heart, the size of a seed.

The canon puts the badge over the heart (a circumcision of the heart). The
heart is on the LEFT of the chest, his left: facing the camera that is the
right of the screen. From the pose landmarks:

  centre    a third of the way down the torso (shoulders to hips), moved a
            fifth of the way toward his left shoulder
  size      a mustard seed, "the least of all seeds": a small share of the
            shoulder width. It grows into the Danceman at the end of every
            clip (compose.py), the greatest.
  angle     the line of his shoulders

It hides when the heart is not ours to see: facing away (his left shoulder is
on the screen's left), turned side-on (shoulders narrower than a third of
their usual width), or the shoulders not seen. It fades rather than blinks.
"""
import numpy as np
from scipy.ndimage import gaussian_filter1d, median_filter, percentile_filter, uniform_filter1d

L_SHOULDER, R_SHOULDER, L_HIP, R_HIP = 11, 12, 23, 24
DOWN, TOWARD_LEFT = 0.30, 0.22
SIZE = 0.11           # badge width as a fraction of the shoulder width: the seed
MIN_VIS = 0.5
SIDE_ON = 0.35        # shoulder width under this share of his facing width (the widest, over 10 s)
# Smoothing, in seconds of the take. Position a little (the tremble of the
# pose model), size and angle a lot: the seed does not breathe or wobble.
POS_S, SIZE_S, ANGLE_S = 0.07, 0.5, 0.2
BLINK_S = 0.2         # a lost heart shorter than this is not a disappearance
FADE_S = 0.2


def heart(lm: np.ndarray, w: int, h: int):
    """(x, y, width, angle_deg, seen, facing) for one frame of landmarks (normalised)."""
    p = lm[:, :2] * np.array([w, h], np.float32)
    ls, rs, lh, rh = p[L_SHOULDER], p[R_SHOULDER], p[L_HIP], p[R_HIP]
    s_mid, h_mid = (ls + rs) / 2, (lh + rh) / 2
    centre = s_mid + DOWN * (h_mid - s_mid) + TOWARD_LEFT * (ls - s_mid)
    width = float(np.linalg.norm(ls - rs))
    angle = float(np.degrees(np.arctan2(ls[1] - rs[1], ls[0] - rs[0])))
    seen = bool(min(lm[L_SHOULDER, 2], lm[R_SHOULDER, 2]) >= MIN_VIS)
    facing = bool(ls[0] > rs[0])  # his left on the screen's right: he faces us
    return float(centre[0]), float(centre[1]), width, angle, seen, facing


def odd(n: float) -> int:
    return max(1, int(round(n)) | 1)


class HeartPath:
    """
    The heart over a stretch of the take, smoothed both ways in time.

    The take is recorded, so the smoothing looks ahead as well as back: the
    seed sits still on his chest without trailing behind him when he moves.
    A centred median throws out the pose model's one-frame glitches, then a
    Gaussian takes the tremble out. Frames where he is not found are filled
    from the frames around them, and the badge fades there instead.
    """

    def __init__(self, poses: dict, k0: int, k1: int, w: int, h: int, fps: float):
        self.k0 = k0
        n = max(0, k1 - k0)
        raw = np.full((n, 4), np.nan)
        seen = np.zeros(n, bool)
        for i in range(n):
            lm = poses.get(k0 + i)
            if lm is not None:
                x, y, width, angle, ok, facing = heart(lm, w, h)
                raw[i] = (x, y, width, angle)
                seen[i] = ok and facing
        have = ~np.isnan(raw[:, 0])
        self.track = None
        if not have.any():
            return
        idx = np.arange(n)
        filled = np.column_stack([np.interp(idx, idx[have], raw[have, j]) for j in range(4)])
        filled[:, 3] = np.degrees(np.unwrap(np.radians(filled[:, 3])))
        # Facing us his shoulders are at their widest: the usual width is near
        # the top of the last and next few seconds, so a long turn stays a turn.
        usual = percentile_filter(filled[:, 2], 90, size=odd(10 * fps), mode="nearest")
        seen &= filled[:, 2] >= SIDE_ON * usual
        med = median_filter(filled, size=(5, 1), mode="nearest")
        x = gaussian_filter1d(med[:, 0], POS_S * fps, mode="nearest")
        y = gaussian_filter1d(med[:, 1], POS_S * fps, mode="nearest")
        size = gaussian_filter1d(med[:, 2], SIZE_S * fps, mode="nearest") * SIZE
        angle = gaussian_filter1d(med[:, 3], ANGLE_S * fps, mode="nearest")
        vis = median_filter(seen.astype(np.float64), size=odd(BLINK_S * fps), mode="nearest")
        opacity = uniform_filter1d(vis, size=odd(FADE_S * fps), mode="nearest")
        self.track = np.column_stack([x, y, size, angle, opacity])

    def at(self, k: int):
        """(x, y, size, angle, opacity) at frame k of the take, or None if he is never found."""
        if self.track is None:
            return None
        x, y, size, angle, opacity = self.track[min(max(k - self.k0, 0), len(self.track) - 1)]
        return float(x), float(y), float(size), float(angle), float(opacity)
