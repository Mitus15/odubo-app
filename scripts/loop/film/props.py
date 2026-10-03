"""
The set: props that stand on the stage with him (show files place them).

A prop is drawn the way he is: a flat ink shape with a crisp edge, standing on
the floor the tiles imply, at its own depth (so the floor's perspective sizes
it), lit by the same light (compose casts its shadow with his). A prop with a
lamp in it also lights the floor under it.

Shapes are polygons in prop units: x to the right, y up, one unit is his
height, the origin where the prop meets the floor.
"""
import numpy as np
import cv2
from floor import SQUASH


def _bar(x0, y0, x1, y1, w):
    """A straight member from (x0, y0) to (x1, y1), w wide, as a quad."""
    d = np.array([x1 - x0, y1 - y0], np.float32)
    n = np.array([-d[1], d[0]]) / max(1e-6, float(np.linalg.norm(d))) * w / 2
    return [(x0 + n[0], y0 + n[1]), (x1 + n[0], y1 + n[1]), (x1 - n[0], y1 - n[1]), (x0 - n[0], y0 - n[1])]


def _arc(cx, cy, r, a0, a1, w, steps=14):
    """A curved member: a ring segment around (cx, cy), radius r, from angle a0 to a1 (degrees)."""
    a = np.radians(np.linspace(a0, a1, steps))
    outer = [(cx + (r + w / 2) * np.cos(t), cy + (r + w / 2) * np.sin(t)) for t in a]
    inner = [(cx + (r - w / 2) * np.cos(t), cy + (r - w / 2) * np.sin(t)) for t in a[::-1]]
    return outer + inner


def _disc(cx, cy, rx, ry, steps=20):
    a = np.linspace(0, 2 * np.pi, steps, endpoint=False)
    return [(cx + rx * np.cos(t), cy + ry * np.sin(t)) for t in a]


def lamp():
    """A street lamp: a base, a pole, an arm curving over, a shade, and its light on the floor."""
    pole_top = 1.38
    shapes = [
        [(-0.07, 0.0), (0.07, 0.0), (0.035, 0.06), (-0.035, 0.06)],
        _bar(0.0, 0.05, 0.0, pole_top, 0.026),
        _arc(0.11, pole_top, 0.11, 180, 0, 0.022),
        [(0.15, pole_top + 0.01), (0.29, pole_top + 0.01), (0.255, pole_top + 0.065), (0.185, pole_top + 0.065)],
    ]
    bulb = (0.22, pole_top + 0.002)
    return {"shapes": shapes, "light": {"at": bulb, "floor_x": bulb[0], "reach": 0.36}}


def mic():
    """A microphone stand: three feet, a pole, the microphone at the top."""
    top = 0.86
    shapes = [
        _bar(0.0, 0.09, -0.14, 0.0, 0.016), _bar(0.0, 0.09, 0.14, 0.0, 0.016), _bar(0.0, 0.09, 0.02, 0.0, 0.016),
        _bar(0.0, 0.08, 0.0, top, 0.014),
        _bar(0.0, top, 0.035, top + 0.055, 0.03),
        _disc(0.045, top + 0.075, 0.024, 0.03),
    ]
    return {"shapes": shapes}


PROPS = {"lamp": lamp, "mic": mic}


def place(name: str, foot_x: float, foot_y: float, unit: float, shape=None):
    """A prop in the output frame: polygons in output pixels, its foot at (foot_x, foot_y), one unit = `unit` px."""
    spec = shape or PROPS[name]()
    polys = [np.array([(foot_x + u * unit, foot_y - v * unit) for u, v in poly], np.float32) for poly in spec["shapes"]]
    return polys, spec.get("light")


def height(polys, foot_y: float) -> float:
    """How tall a placed prop stands, in output pixels (its shadow reaches by this)."""
    return float(max(1.0, foot_y - np.concatenate(polys)[:, 1].min()))


def stand(canvas: np.ndarray, placed, ink, behind: bool):
    """Draw the placed props behind him (depth zero or more) or in front of him, in ink like him."""
    H, W = canvas.shape[:2]
    for pz, _, polys, _ in placed:
        if (pz >= 0) == behind:
            cov, (x0, y0) = coverage(polys, W, H)
            if cov.size:
                view = canvas[y0:y0 + cov.shape[0], x0:x0 + cov.shape[1]]
                view += (ink - view) * cov[..., None]


def coverage(polys, width: int, height: int) -> tuple[np.ndarray, tuple]:
    """Anti-aliased coverage (0..1) of polygons, in the box around them: (mask, (x0, y0))."""
    pts = np.concatenate(polys)
    x0, y0 = np.floor(pts.min(0) - 2).astype(int)
    x1, y1 = np.ceil(pts.max(0) + 2).astype(int)
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(width, x1), min(height, y1)
    if x1 <= x0 or y1 <= y0:
        return np.zeros((0, 0), np.float32), (0, 0)
    # One shape at a time: fillPoly given several fills them even-odd, so
    # where a pole meets its base the overlap would come out as a hole.
    mask = np.zeros((y1 - y0, x1 - x0), np.uint8)
    one = np.zeros_like(mask)
    for p in polys:
        one[:] = 0
        cv2.fillPoly(one, [np.round((p - [x0, y0]) * 16).astype(np.int32)], 255, cv2.LINE_AA, shift=4)
        np.maximum(mask, one, out=mask)
    return mask.astype(np.float32) / 255, (x0, y0)


def light_pool(canvas: np.ndarray, x: float, y: float, reach: float, pal: dict, strength: float = 0.4):
    """A lamp's light on the floor: a soft pool around (x, y), `reach` px wide each side, foreshortened by the floor."""
    H, W = canvas.shape[:2]
    rx, ry = reach, reach * SQUASH * 1.4
    x0, x1 = int(max(0, x - rx * 1.3)), int(min(W, x + rx * 1.3))
    y0, y1 = int(max(0, y - ry * 1.3)), int(min(H, y + ry * 1.3))
    if x1 <= x0 or y1 <= y0:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    d = np.sqrt(((xx - x) / rx) ** 2 + ((yy - y) / ry) ** 2)
    m = np.clip(1 - d, 0, 1)
    m = m * m * (3 - 2 * m) * strength
    view = canvas[y0:y1, x0:x1]
    view += (pal["highlight"] - view) * m[..., None]
