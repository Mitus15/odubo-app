"""
His shadow on the ground.

The canon: Adam was taken from the ground, so his shadow is his earthly self,
one with the ground, and The Game pulls through it. In the film it is a cast
shadow lying on the floor from where he stands: his own shape, reflected
about the ground line, squashed flat, leaning with the light.

The ground is where the floor is, not where his feet are this instant: it is
the low line his feet keep returning to. So when he jumps, the shadow stays
on the ground and he leaves it (the take-off reads by itself).

Mode per chapter: 'sync' (in step with him), 'lag' (his shape from N frames
ago: The Game pulling), 'none'.
"""
from collections import deque
import numpy as np
import cv2

FEET = (27, 28, 29, 30, 31, 32)  # ankles, heels, toes
SQUASH, SHEAR, SOFT = 0.28, 0.55, 0.006


class Ground:
    """
    Two grounds, for two jobs.

      stable   the floor line the CAMERA holds: the median of where his lowest
               point has been over the last few seconds, so the frame does not
               bob with every step.
      contact  where the SHADOW meets him: his lowest point this frame (a foot
               stepped toward the camera sits lower in the picture, and the
               shadow must still touch it), except when he is clearly off the
               ground, when it stays where he left it. That is the take-off.

    His lowest point is the silhouette's bottom row (the sole of the shoe);
    the pose's ankle and toe points are the fallback.
    """

    def __init__(self, fps: float, seconds: float = 3.0, jump: float = 0.025):
        self.ys = deque(maxlen=int(fps * seconds))
        self.jump = jump
        self.stable = None
        self.contact = None

    def update(self, lm, h: int, alpha: np.ndarray | None = None):
        low = None
        if alpha is not None:
            rows = np.where(alpha.max(1) > 0.5)[0]
            if len(rows):
                low = float(rows.max())
        if low is None and lm is not None:
            feet = lm[list(FEET)]
            seen = feet[feet[:, 2] > 0.3]
            if len(seen):
                low = float(seen[:, 1].max() * h)
        if low is not None:
            self.ys.append(low)
        if self.ys:
            self.stable = float(np.median(self.ys))
        airborne = low is not None and self.stable is not None and low < self.stable - self.jump * h
        if low is None or airborne:
            self.contact = self.contact if self.contact is not None else self.stable
            if airborne and self.contact is not None:
                # In the air: the shadow holds the floor he left.
                self.contact = max(self.contact, self.stable)
        else:
            self.contact = low
        return self.stable, self.contact


def cast(alpha: np.ndarray, ground_y: float, squash: float = SQUASH, shear: float = SHEAR) -> np.ndarray:
    """
    The shadow of `alpha` (float 0..1, H x W) on the ground at `ground_y`.
    Every point above the ground maps below it, closer the lower it was:
      y' = g + squash * (g - y),  x' = x + shear * squash * (g - y)
    Nothing of him below the ground line casts (that is the floor already).
    """
    h, w = alpha.shape
    g = float(ground_y)
    src = alpha.copy()
    src[int(min(h, max(0, np.ceil(g)))):, :] = 0
    M = np.float32([[1, -shear * squash, shear * squash * g],
                    [0, -squash, (1 + squash) * g]])
    out = cv2.warpAffine(src, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=0)
    k = max(1, int(round(SOFT * h))) * 2 + 1
    out = cv2.GaussianBlur(out, (k, k), 0)
    out[: int(g), :] = 0  # never above the ground
    return out
