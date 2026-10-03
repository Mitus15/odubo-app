"""
The floor he dances on: the Billie Jean pavement (compose --effects=sidewalk).

Three parts:

  footfalls   where and when each foot comes down, from the pose: a foot that
              was moving stops, near the ground. The take is recorded, so the
              whole stretch is read first and smoothed both ways in time; a
              foot that stays planted is one footfall, not thirty.
  tiles       square tiles on the floor, anchored to the floor (they stay put
              when the camera moves), seen in perspective from a camera at his
              chest. A footfall lights the tile under it in the palette's
              highlight, holds a moment, and eases back to the field within
              half a bar. Only lit
              tiles show: the floor reads as tiles only where he steps.
  reflection  the floor is glossy: his outline, mirrored at the line where he
              meets it, a step darker than the field, gone a short way down
              (his shoes and a little of his legs, as on a lacquered stage).
"""
import numpy as np
import cv2
from scipy.ndimage import gaussian_filter1d, median_filter

FEET = {"left": (27, 29, 31), "right": (28, 30, 32)}  # ankle, heel, toe
MOVING, STOPPED = 0.006, 0.0025  # foot speed, share of the frame height per frame: moving above, stopped below
NEAR_GROUND = 0.06               # a footfall is within this share of the height of the floor line
MIN_TRAVEL = 0.012               # the foot must have gone somewhere since its last footfall
TILE = 0.3                       # a tile's width, as a share of his height
GAP = 0.06                       # the grout: a share of the tile, kept dark between lit tiles
LIT_BARS = 0.5                   # a lit tile is gone after this many bars
LIT_HOLD = 0.4                   # and holds full for this share of it before it fades
HORIZON = 0.72                   # the camera's eye level, as a share of his height above the floor
SQUASH = 0.3                     # the floor's foreshortening at his feet (shadow.py's, compose.GROUND_SQUASH)
REFLECT_DEPTH = 0.22             # the reflection fades out over this share of his height below the floor
REFLECT_MIX = 0.3                # the reflection: this far from the field toward ink
GLOSS_LIGHT = (0.16, 1.6)        # on the glossy floor the light is low and from the side (squash, shear for
                                 # shadow.cast_on_floor): his shadow lies along the floor, clear of the
                                 # reflection beneath him, where the usual light laid one over the other


def footfalls(poses: dict, k0: int, k1: int, w: int, h: int, fps: float) -> list:
    """
    [(frame, x, y, foot)] for frames k0..k1 of the take, x and y in the take's
    pixels (w x h): where the sole came to rest.
    """
    n = k1 - k0
    if n <= 2:
        return []
    out = []
    for foot, idx in FEET.items():
        pts = np.full((n, 2), np.nan, np.float32)
        for i in range(n):
            lm = poses.get(k0 + i)
            if lm is None:
                continue
            seen = [j for j in idx if lm[j, 2] >= 0.3]
            if seen:
                pts[i, 0] = lm[seen, 0].mean() * w
                pts[i, 1] = lm[seen, 1].max() * h  # the lowest of ankle, heel, toe: the sole
        ok = ~np.isnan(pts[:, 0])
        if ok.sum() < 3:
            continue
        for c in range(2):
            pts[~ok, c] = np.interp(np.where(~ok)[0], np.where(ok)[0], pts[ok, c])
        pts = gaussian_filter1d(pts, 1.2, axis=0)
        speed = np.r_[0.0, np.linalg.norm(np.diff(pts, axis=0), axis=1)] / h
        speed = gaussian_filter1d(speed, 1.0)
        out += _landings(pts, speed, k0, h, fps, foot)
    return sorted(out)


def _landings(pts, speed, k0, h, fps, foot):
    """A foot that was moving and stops, near the floor line (where its sole keeps returning, over three seconds)."""
    floor = median_filter(pts[:, 1], size=int(fps * 3) | 1, mode="nearest")
    out, moving, last = [], False, None
    for i in range(len(pts)):
        if speed[i] > MOVING:
            moving = True
        elif moving and speed[i] < STOPPED:
            moving = False
            near = pts[i, 1] > floor[i] - NEAR_GROUND * h
            went = last is None or np.linalg.norm(pts[i] - last) > MIN_TRAVEL * h
            if near and went:
                out.append((k0 + i, float(pts[i, 0]), float(pts[i, 1]), foot))
                last = pts[i].copy()
    return out


class Tiles:
    """The pavement: which tiles are lit, and drawing them."""

    def __init__(self, falls: list, body: float, ground: float, fps: float, bar: float):
        self.falls = falls
        self.size = TILE * body              # take pixels
        self.ground = ground                 # the take's floor line, for the rows
        self.fade = max(1, int(round(LIT_BARS * bar * fps)))

    def lit(self, k: int) -> dict:
        """{(column, row): brightness 0..1} at take frame k: the latest footfall on each tile wins."""
        out = {}
        for f, x, y, _ in self.falls:
            if f > k:
                break
            age = k - f
            if age >= self.fade:
                continue
            col = int(np.floor(x / self.size))
            row = int(np.round((y - self.ground) / (self.size * SQUASH)))
            u = max(0.0, (age / self.fade - LIT_HOLD) / (1 - LIT_HOLD))
            out[(col, row)] = max(out.get((col, row), 0.0), (1 - u) ** 2)
        return out

    def draw(self, canvas: np.ndarray, A: np.ndarray, ground_out: float, horizon: float, k: int, pal: dict):
        """Lay the lit tiles on the floor of `canvas` (float RGB, the output frame); `horizon` is
        the vanishing point's height (compose: HORIZON of his height above the floor line)."""
        H, W = canvas.shape[:2]
        vx, vy = W / 2, horizon
        side = self.size * A[0, 0]                       # a tile's width on screen, at the floor line
        depth = side * SQUASH                            # and its depth there

        def at(x_take: float, row_edge: float):
            # A point on the floor: its column edge in take pixels, its row edge
            # in tile depths from the floor line (positive is toward the camera).
            y = ground_out + row_edge * depth
            k_ = (y - vy) / (ground_out - vy)
            x = vx + (A[0, 0] * x_take + A[0, 2] - vx) * k_
            return x, y

        for (col, row), b in self.lit(k).items():
            g = GAP / 2
            x0, x1 = (col + g) * self.size, (col + 1 - g) * self.size
            r0, r1 = row - 0.5 + g, row + 0.5 - g
            quad = np.array([at(x0, r0), at(x1, r0), at(x1, r1), at(x0, r1)], np.float32)
            bx0, by0 = np.floor(quad.min(0)).astype(int)
            bx1, by1 = np.ceil(quad.max(0)).astype(int) + 1
            bx0, by0, bx1, by1 = max(0, bx0), max(0, by0), min(W, bx1), min(H, by1)
            if bx1 <= bx0 or by1 <= by0:
                continue
            mask = np.zeros((by1 - by0, bx1 - bx0), np.uint8)
            cv2.fillConvexPoly(mask, np.round((quad - [bx0, by0]) * 16).astype(np.int32), 255, cv2.LINE_AA, shift=4)
            a = mask.astype(np.float32)[..., None] / 255 * b
            view = canvas[by0:by1, bx0:bx1]
            view += (pal["highlight"] - view) * a


def reflect_matrix(Af: np.ndarray, contact_out: float, squash: float = 1.0) -> np.ndarray:
    """The affine that mirrors a field (mapped to the output by Af) at the floor line; squash under 1 flattens it."""
    M = Af.copy()
    M[1] = [0.0, -squash * Af[1, 1], contact_out * (1 + squash) - squash * Af[1, 2]]
    return M


def reflection_fade(height: int, contact_rel: float, body_out: float) -> np.ndarray:
    """Per row of a region: 1 at the floor line, 0 by REFLECT_DEPTH of his height below it, 0 above."""
    y = np.arange(height, dtype=np.float32) - contact_rel
    u = np.clip(y / max(1.0, REFLECT_DEPTH * body_out), 0, 1)
    f = (1 - u) ** 2
    f[y < 0] = 0
    return f
