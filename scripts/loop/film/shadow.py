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
from edge import cut

FEET = (27, 28, 29, 30, 31, 32)  # ankles, heels, toes
SQUASH, SHEAR, SOFT = 0.28, 0.55, 0.006
PENUMBRA = 0.02   # cast_on_floor: the shadow's softness where it ends, a share of his height (crisp at his soles)
FAR_LIGHT = 0.3   # cast_on_floor: how much fainter it is where it ends than at his soles


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


def cast_on_floor(figure: np.ndarray, contact: float, horizon: float, vx: float, body: float, height: int,
             squash: float = SQUASH, shear: float = SHEAR) -> tuple[np.ndarray, int]:
    """
    His shadow on the floor the tiles imply, in the output frame: (coverage
    of rows y0 onward, y0). `figure` is his coverage in the output frame down
    to the floor line, `contact` the floor line under him, `horizon` and `vx`
    the floor's vanishing point (the tiles use the same one), `body` his
    height on screen.

    The light is the cast shadow's as ever: a point h above the floor lands
    squash * h toward the camera and shear * squash * h to the side. Then the
    floor's perspective widens it the nearer it comes, so it lies on the same
    floor as the tiles instead of on the screen. It is cut crisp at his soles
    and softens (and fades a little) toward its far end, as a real shadow's
    edge does with distance from what casts it.
    """
    H, W = figure.shape
    c = float(contact)
    reach = squash * body * 1.15
    y0, y1 = int(max(0, np.floor(c))), int(min(height, np.ceil(c + reach) + 2))
    if y1 <= y0 or c - horizon < 1:
        return np.zeros((0, W), np.float32), y0
    yy, xx = np.mgrid[y0:y1, 0:W].astype(np.float32)
    k = (yy - horizon) / (c - horizon)
    src_y = c - (yy - c) / squash
    src_x = vx + (xx - vx) / k - shear * (yy - c)
    projected = cv2.remap(figure.astype(np.float32), src_x, src_y, cv2.INTER_LINEAR, borderValue=0)
    projected[(yy - c) < 0] = 0  # never above the floor line
    sharp = cut(projected, 0.5)
    soft = cv2.GaussianBlur(sharp, (0, 0), max(0.5, PENUMBRA * body))
    t = np.clip((yy[:, :1] - c) / max(1.0, reach), 0, 1)
    t = t * t * (3 - 2 * t)
    return (sharp * (1 - t) + soft * t) * (1 - FAR_LIGHT * t), y0
