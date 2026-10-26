"""
His shadow on the ground.

The canon: Adam was taken from the ground, so his shadow is his earthly self,
one with the ground, and The Game pulls through it. In the film it is a cast
shadow lying on the floor from where he stands: his own shape, reflected
about the ground line, squashed flat, leaning with the light.

The ground is where the floor is, not where his feet are this instant: the
phone never moved, so the floor is one plane, and each foot's floor point is
where that foot stands on it (feet.py). So when he lifts a foot or jumps, the
shadow stays on the floor and he leaves it (the take-off reads by itself).

Mode per chapter: 'sync' (in step with him), 'lag' (his shape from N frames
ago: The Game pulling), 'none'.
"""
import numpy as np
import cv2
import gpu
from edge import cut

SQUASH, SHEAR, SOFT = 0.28, 0.55, 0.006
PENUMBRA = 0.02   # cast_on_floor: the shadow's softness where it ends, a share of his height (crisp at his soles)
FAR_LIGHT = 0.3   # cast_on_floor: how much fainter it is where it ends than at his soles


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


MAX_SLOPE = 0.5  # the floor line between his feet climbs at most this steeply across the picture


def floor_line(xs: np.ndarray, contact) -> np.ndarray:
    """
    The floor's line under him at each column `xs`: one line (a number), or
    the line through his two feet's floor points ((x, y), (x, y)), level
    beyond them. When one foot is right in front of the other the line between
    them would stand on end: it is eased over a wider span instead.
    """
    if np.ndim(contact) == 0:
        return np.full(np.shape(xs), float(contact), np.float32)
    (xa, ya), (xb, yb) = sorted((tuple(map(float, p)) for p in contact), key=lambda p: p[0])
    rise = abs(yb - ya)
    if rise > MAX_SLOPE * (xb - xa):
        mid, half = (xa + xb) / 2, rise / (2 * MAX_SLOPE)
        xa, xb = mid - half, mid + half
    return np.interp(xs, [xa, xb], [ya, yb]).astype(np.float32)


def cast_on_floor(figure: np.ndarray, contact, horizon: float, vx: float, body: float, height: int,
                  squash: float = SQUASH, shear: float = SHEAR) -> tuple[np.ndarray, int]:
    """
    His shadow on the floor, in the output frame: (coverage of rows y0
    onward, y0). `figure` is his coverage in the output frame down to the
    floor, `contact` the floor under him: a line, or his two feet's floor
    points (feet.py), so each sole meets its own shadow. `horizon` and `vx`
    are the floor's vanishing point (the tiles use the same one), `body` his
    height on screen.

    The light is the cast shadow's as ever: a point h above the floor lands
    squash * h toward the camera and shear * squash * h to the side. Then the
    floor's perspective widens it the nearer it comes, so it lies on the same
    floor as the tiles instead of on the screen. It is cut crisp at his soles
    and softens (and fades a little) toward its far end, as a real shadow's
    edge does with distance from what casts it.
    """
    H, W = figure.shape
    cols = np.arange(W, dtype=np.float32)
    line = floor_line(cols, contact)
    reach = squash * body * 1.15
    y0, y1 = int(max(0, np.floor(line.min()))), int(min(height, np.ceil(line.max() + reach) + 2))
    # A foot stepped right up to the camera puts the floor line on the frame's
    # last row: under two rows there is no shadow to see, and no edge to cut.
    if y1 - y0 < 2 or line.max() - horizon < 1:
        return np.zeros((0, W), np.float32), y0
    yy, xx = np.mgrid[y0:y1, 0:W].astype(np.float32)
    # Each output point's floor is the floor under the point of him that casts
    # it, which depends on where that point is: a few steps settle it (the
    # line is gentle, so they close in fast).
    c = floor_line(xx, contact)
    for _ in range(3):
        k = (yy - horizon) / np.maximum(c - horizon, 1.0)
        src_x = vx + (xx - vx) / k - shear * (yy - c)
        c = floor_line(src_x, contact)
    k = (yy - horizon) / np.maximum(c - horizon, 1.0)
    src_x = vx + (xx - vx) / k - shear * (yy - c)
    src_y = c - (yy - c) / squash
    projected = cv2.remap(figure.astype(np.float32), src_x.astype(np.float32), src_y.astype(np.float32),
                          cv2.INTER_LINEAR, borderValue=0)
    projected[(yy - c) < 0] = 0  # never above the floor
    sharp = cut(projected, 0.5)
    soft = cv2.GaussianBlur(sharp, (0, 0), max(0.5, PENUMBRA * body))
    t = np.clip((yy - c) / max(1.0, reach), 0, 1)
    t = t * t * (3 - 2 * t)
    return (sharp * (1 - t) + soft * t) * (1 - FAR_LIGHT * t), y0


BAND = 64  # px: the GPU's shadow works in a band of rows rounded up to this, so it meets few sizes


def cast_on_floor_gpu(figure, contact, horizon: float, vx: float, body: float, height: int,
                      squash: float = SQUASH, shear: float = SHEAR):
    """
    cast_on_floor on the GPU: `figure` is his coverage (height, W) as a tensor,
    zero below the floor. Returns (coverage, y0) as cast_on_floor does, but in
    a band of rows rounded up to BAND that holds the strip (zero outside it),
    or None. The strip's own ends are kept: its blur mirrors at them, as cv2's.
    """
    H, W = figure.shape
    line = floor_line(np.arange(W, dtype=np.float32), contact)
    reach = squash * body * 1.15
    y0, y1 = int(max(0, np.floor(line.min()))), int(min(height, np.ceil(line.max() + reach) + 2))
    if y1 - y0 < 2 or line.max() - horizon < 1:
        return None
    hb = min(height, -(-(y1 - y0) // BAND) * BAND)
    yb = min(y0, height - hb)
    if np.ndim(contact) == 0:
        xa, ya, xb, yb_ = 0.0, float(contact), 1.0, float(contact)
    else:
        (xa, ya), (xb, yb_) = sorted((tuple(map(float, p)) for p in contact), key=lambda p: p[0])
        rise = abs(yb_ - ya)
        if rise > MAX_SLOPE * (xb - xa):
            mid, half = (xa + xb) / 2, rise / (2 * MAX_SLOPE)
            xa, xb = mid - half, mid + half
        if xb <= xa:
            xa, xb, yb_ = 0.0, 1.0, ya
    knobs = gpu.send(np.array([xa, ya, xb, (yb_ - ya) / (xb - xa), horizon, vx, shear, squash, y0, y1,
                               max(1.0, reach), yb], np.float32))
    rows, xx = _grid(hb, W, figure.device)
    yy, src_x, src_y, c = _cast(rows, xx, knobs)
    sharp = _sharp(gpu.remap(figure, src_x, src_y), yy, c, knobs)
    # The blur sees only the strip, mirrored at its ends.
    soft = gpu.blur_within(sharp, max(0.5, PENUMBRA * body), y0 - yb, y1 - yb)
    return _cover(sharp, soft, yy, c, knobs), yb


def _grid(H: int, W: int, dev):
    return gpu._const(("grid", H, W), lambda: (gpu.torch.arange(H, dtype=gpu.torch.float32, device=dev)[:, None],
                                               gpu.torch.arange(W, dtype=gpu.torch.float32, device=dev)[None, :]), dev)


def _floor(x, k):
    """floor_line at x: the line through his feet (k: xa, ya, xb, slope), level beyond them."""
    return k[1] + (x.clamp(k[0], k[2]) - k[0]) * k[3]


@gpu.fused
def _cast(rows, xx, k):
    """The band's rows, where each point of the floor takes its shadow from (cast_on_floor's steps), the floor there."""
    horizon, vx, shear, squash = k[4], k[5], k[6], k[7]
    yy = rows + k[11]
    c = _floor(xx.expand(yy.shape[0], -1), k)
    for _ in range(3):
        kk = (yy - horizon) / (c - horizon).clamp_min(1.0)
        c = _floor(vx + (xx - vx) / kk - shear * (yy - c), k)
    kk = (yy - horizon) / (c - horizon).clamp_min(1.0)
    return yy, vx + (xx - vx) / kk - shear * (yy - c), c - (yy - c) / squash, c


@gpu.fused
def _sharp(projected, yy, c, k):
    """
    His shape on the floor, never above it, inside the strip only, cut crisp
    (edge.cut), its slope taken one-sided at the strip's ends as np.gradient
    takes it at the ends of the strip cast_on_floor cuts out.
    """
    torch = gpu.torch
    inside = (yy >= k[8]) & (yy < k[9])
    f = torch.where((yy - c >= 0) & inside, projected, 0.0)
    below, above = torch.cat((f[1:], f[-1:])), torch.cat((f[:1], f[:-1]))
    gy = torch.where(yy == k[8], below - f, torch.where(yy == k[9] - 1, f - above, (below - above) / 2))
    gx = gpu.gradient(f)[1]
    return ((f - 0.5) / (torch.sqrt(gx * gx + gy * gy) + 1e-4) + 0.5).clamp(0, 1) * inside


@gpu.fused
def _cover(sharp, soft, yy, c, k):
    t = ((yy - c) / k[10]).clamp(0, 1)
    t = t * t * (3 - 2 * t)
    return (sharp * (1 - t) + soft * t) * (1 - FAR_LIGHT * t) * ((yy >= k[8]) & (yy < k[9]))
