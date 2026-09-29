"""
Where the badge sits: on his heart.

The canon puts the badge over the heart (a circumcision of the heart). The
heart is on the LEFT of the chest, his left: facing the camera that is the
right of the screen. From the pose landmarks:

  centre    a third of the way down the torso (shoulders to hips), moved a
            fifth of the way toward his left shoulder
  size      a fraction of the shoulder width, so it grows and shrinks with him
  angle     the line of his shoulders

It hides when the heart is not ours to see: facing away (his left shoulder is
on the screen's left), turned side-on (shoulders narrower than a third of
their usual width), or the shoulders not seen. It fades rather than blinks.
"""
from collections import deque
import numpy as np

L_SHOULDER, R_SHOULDER, L_HIP, R_HIP = 11, 12, 23, 24
DOWN, TOWARD_LEFT = 0.30, 0.22
SIZE = 0.26           # badge width as a fraction of the shoulder width
MIN_VIS = 0.5
SIDE_ON = 0.35        # shoulder width under this share of its running median


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


class HeartTrack:
    """Smooths the heart over time and decides how visible the badge is (0..1)."""

    def __init__(self, fade_frames: int = 6, ema: float = 0.35, median: int = 5):
        self.hist = deque(maxlen=median)
        self.widths = deque(maxlen=90)
        self.ema = ema
        self.state = None
        self.opacity = 0.0
        self.step = 1.0 / max(1, fade_frames)

    def update(self, lm, w: int, h: int):
        """Returns (x, y, size, angle, opacity) or None before he is first found."""
        want = 0.0
        if lm is not None:
            x, y, width, angle, seen, facing = heart(lm, w, h)
            self.widths.append(width)
            usual = float(np.median(self.widths))
            side_on = width < SIDE_ON * usual
            self.hist.append((x, y, width, angle))
            med = np.median(np.array(self.hist), 0)
            if self.state is None:
                self.state = med.copy()
            else:
                # Angles wrap: ease through the short way round.
                d = med - self.state
                d[3] = (d[3] + 180) % 360 - 180
                self.state = self.state + self.ema * d
            want = 1.0 if (seen and facing and not side_on) else 0.0
        self.opacity += np.clip(want - self.opacity, -self.step, self.step)
        if self.state is None:
            return None
        x, y, width, angle = self.state
        return float(x), float(y), float(width * SIZE), float(angle), float(self.opacity)
