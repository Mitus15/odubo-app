"""
Where the seal sits on him, followed through the take.

The seal is the player's marker: the sign a game puts on the character you
control (owner, 2026-09-29: "as if someone was using a controller"). Three
places, one tracker:

  crown   floating over his head, as the Sims mark the one being played
  feet    flat on the floor under him, as sports games ring the player you hold
  heart   on his chest, a badge on the clothes (the first design; the owner
          set it aside: it did not read as embroidery)

The heart: a third of the way down the torso, a fifth toward his left
shoulder; it hides when he faces away or turns side-on. The crown and the
feet never hide for that: the player's marker stays on the player.

Each is small, the mustard seed (compose.py grows it into the Danceman at
the end of every clip). Sizes are a share of his shoulder width.
"""
import numpy as np
from scipy.ndimage import gaussian_filter1d, median_filter, percentile_filter, uniform_filter1d

L_SHOULDER, R_SHOULDER, L_HIP, R_HIP = 11, 12, 23, 24
NOSE, L_EYE, R_EYE, L_EAR, R_EAR = 0, 2, 5, 7, 8
FEET = slice(27, 33)  # ankles, heels, toes
DOWN, TOWARD_LEFT = 0.30, 0.22
CROWN = 0.55          # the top of his head, above the eyes, as a share of eyes-to-shoulders
SIZE = 0.11           # badge width as a fraction of the shoulder width: the seed
SIZES = {"heart": SIZE, "crown": 0.20, "feet": 1.5}  # the marker's width, by place (the floor one rings his stance)
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


def crown(lm: np.ndarray, w: int, h: int):
    """Over his head: (x, y of the top of his head, shoulder width, 0, seen, True)."""
    p = lm[:, :2] * np.array([w, h], np.float32)
    eyes = (p[L_EYE] + p[R_EYE]) / 2
    shoulders = (p[L_SHOULDER] + p[R_SHOULDER]) / 2
    neck = max(1.0, float(shoulders[1] - eyes[1]))
    x = float(p[[NOSE, L_EYE, R_EYE, L_EAR, R_EAR], 0].mean())
    width = float(np.linalg.norm(p[L_SHOULDER] - p[R_SHOULDER]))
    seen = bool(min(lm[L_SHOULDER, 2], lm[R_SHOULDER, 2]) >= MIN_VIS or lm[[NOSE, L_EYE, R_EYE], 2].mean() >= MIN_VIS)
    return x, float(eyes[1] - CROWN * neck), width, 0.0, seen, True


def feet(lm: np.ndarray, w: int, h: int):
    """Under him: (x between his feet, y of the lowest foot, shoulder width, 0, seen, True)."""
    p = lm[:, :2] * np.array([w, h], np.float32)
    width = float(np.linalg.norm(p[L_SHOULDER] - p[R_SHOULDER]))
    seen = bool(lm[FEET, 2].mean() >= 0.3 or min(lm[L_HIP, 2], lm[R_HIP, 2]) >= MIN_VIS)
    return float(p[FEET, 0].mean()), float(p[FEET, 1].max()), width, 0.0, seen, True


ANCHORS = {"heart": heart, "crown": crown, "feet": feet}


def odd(n: float) -> int:
    return max(1, int(round(n)) | 1)


class Path:
    """
    A place on him (heart, crown or feet) over a stretch of the take, smoothed
    both ways in time.

    The take is recorded, so the smoothing looks ahead as well as back: the
    seal stays with him without trailing behind when he moves. A centred
    median throws out the pose model's one-frame glitches, then a Gaussian
    takes the tremble out. Frames where he is not found are filled from the
    frames around them, and the seal fades there instead.

    On the heart the size follows his shoulders (a badge turns with him); over
    his head or under his feet it is his facing width, so a marker does not
    shrink when he turns.
    """

    def __init__(self, poses: dict, k0: int, k1: int, w: int, h: int, fps: float, where: str = "heart"):
        anchor = ANCHORS[where]
        self.k0 = k0
        n = max(0, k1 - k0)
        raw = np.full((n, 4), np.nan)
        seen = np.zeros(n, bool)
        for i in range(n):
            lm = poses.get(k0 + i)
            if lm is not None:
                x, y, width, angle, ok, facing = anchor(lm, w, h)
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
        if where == "heart":
            seen &= filled[:, 2] >= SIDE_ON * usual
        else:
            filled[:, 2] = usual
        med = median_filter(filled, size=(5, 1), mode="nearest")
        x = gaussian_filter1d(med[:, 0], POS_S * fps, mode="nearest")
        y = gaussian_filter1d(med[:, 1], POS_S * fps, mode="nearest")
        size = gaussian_filter1d(med[:, 2], SIZE_S * fps, mode="nearest") * SIZES[where]
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


def HeartPath(poses: dict, k0: int, k1: int, w: int, h: int, fps: float) -> Path:
    return Path(poses, k0, k1, w, h, fps, "heart")
