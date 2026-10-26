"""
The virtual camera's path: held like a tripod, moved like a dolly.

The take is recorded, so the camera's path is planned for the whole piece at
once instead of chasing him frame by frame (owner, 2026-10-12: "the camera
movements too are sometimes very jarring and not graceful"). The plan is the
one a camera operator makes, and the one auto-directed stabilisation solves
(Grundmann, Kwatra, Essa 2011): the path is still for as long as it can be,
moves at a steady speed when it must, and eases in and out of every move. As
a sum of the path's speed, acceleration and jerk, each counted by its size
(L1), the best path has most of them exactly zero: still stretches, straight
glides, gentle turns. It must keep him inside a zone around the centre of the
picture, and may leave it only at a high price (when the zone cannot be met).

  across   his torso (shoulders and hips) stays within ZONE_X of the centre
  up/down  the floor between his feet stays within ZONE_Y of the floor line,
           and the camera never looks below the bottom of what the phone saw:
           when he steps close enough that his shoes leave the phone's frame,
           they leave the picture at its bottom edge, as with a real camera,
           instead of ending in a straight cut above an empty floor

He moves within a still frame, as on a tripod; when he travels, the camera
glides after him. Solved as a linear programme (scipy's HiGHS), in output
pixels, in about six seconds for three minutes of take; longer pieces are
solved in overlapping windows and blended.
"""
import numpy as np
from scipy.ndimage import gaussian_filter1d, median_filter
from scipy.optimize import linprog
from scipy.sparse import csr_matrix, eye, hstack, vstack

L_SHOULDER, R_SHOULDER, L_HIP, R_HIP = 11, 12, 23, 24
WEIGHTS = (10.0, 1.0, 100.0)   # speed, acceleration, jerk: still first, then no jerk
OVER = 1000.0                  # the price of a pixel outside the zone
ZONE_X, ZONE_Y = 0.18, 0.04    # shares of the output width and height
WINDOW, OVERLAP = 4500, 900    # frames: longer pieces are planned in overlapping windows
TORSO_GLITCH = 7               # frames: the median that throws out the pose's one-frame glitches


def _diff(n: int, order: int):
    d = eye(n, format="csr")
    for _ in range(order):
        d = d[1:] - d[:-1]
    return d


def l1_path(target: np.ndarray, zone: float, bounds=None, weights=WEIGHTS, over: float = OVER) -> np.ndarray:
    """
    The path p minimising the weighted L1 sizes of its speed, acceleration and
    jerk, with |p - target| <= zone wherever the target is known (nan: free).
    `bounds` (lo, hi) keeps p itself inside a range.
    """
    n = len(target)
    if n < 4:
        return np.where(np.isnan(target), np.nanmean(target) if (~np.isnan(target)).any() else 0.0, target)
    known = ~np.isnan(target)
    ds = [_diff(n, order) for order in (1, 2, 3)]
    sizes = [d.shape[0] for d in ds]
    nv = n + sum(sizes) + n  # the path, |each difference|, the overshoot
    cost = np.concatenate([np.zeros(n)] + [np.full(m, w) for m, w in zip(sizes, weights)] + [np.where(known, over, 0.0)])
    rows, rhs = [], []
    col = n
    for d, m in zip(ds, sizes):
        e = csr_matrix((np.ones(m), (np.arange(m), col + np.arange(m))), shape=(m, nv))
        p = hstack([d, csr_matrix((m, nv - n))]).tocsr()
        rows += [p - e, -p - e]
        rhs += [np.zeros(m), np.zeros(m)]
        col += m
    slack = csr_matrix((np.ones(n), (np.arange(n), col + np.arange(n))), shape=(n, nv))
    p = hstack([eye(n), csr_matrix((n, nv - n))]).tocsr()
    t = np.nan_to_num(target)
    z = np.where(known, zone, 1e7)
    rows += [p - slack, -p - slack]
    rhs += [t + z, -t + z]
    lo, hi = bounds if bounds is not None else (None, None)
    res = linprog(cost, A_ub=vstack(rows).tocsr(), b_ub=np.concatenate(rhs),
                  bounds=[(lo, hi)] * n + [(0, None)] * (nv - n), method="highs")
    if res.status != 0:
        # No plan: the target, held where unknown and smoothed hard. Never a crash.
        idx = np.arange(n)
        filled = np.interp(idx, idx[known], target[known]) if known.any() else np.zeros(n)
        out = gaussian_filter1d(filled, 15, mode="nearest")
        return np.clip(out, lo, hi) if bounds is not None else out
    return res.x[:n]


def planned(target: np.ndarray, zone: float, bounds=None) -> np.ndarray:
    """l1_path, in overlapping windows for long pieces, blended across each overlap."""
    n = len(target)
    if n <= WINDOW:
        return l1_path(target, zone, bounds)
    out = np.zeros(n)
    weight = np.zeros(n)
    step = WINDOW - OVERLAP
    for a in range(0, n, step):
        b = min(n, a + WINDOW)
        part = l1_path(target[a:b], zone, bounds)
        w = np.ones(b - a)
        ramp = np.linspace(0, 1, OVERLAP + 2)[1:-1]
        if a > 0:
            w[:min(OVERLAP, b - a)] = ramp[:min(OVERLAP, b - a)]
        if b < n:
            w[-OVERLAP:] = np.minimum(w[-OVERLAP:], ramp[::-1])
        out[a:b] += part * w
        weight[a:b] += w
        if b == n:
            break
    return out / np.maximum(weight, 1e-9)


def torso_x(poses: dict, k0: int, k1: int, w: int) -> np.ndarray:
    """The middle of his torso across the frame (take px), nan where the pose has lost him."""
    x = np.full(k1 - k0, np.nan)
    for i in range(k1 - k0):
        lm = poses.get(k0 + i)
        if lm is not None:
            pts = lm[[L_SHOULDER, R_SHOULDER, L_HIP, R_HIP]]
            seen = pts[pts[:, 2] >= 0.3]
            if len(seen) >= 2:
                x[i] = float(seen[:, 0].mean() * w)
    known = ~np.isnan(x)
    if known.sum() >= TORSO_GLITCH:
        idx = np.arange(len(x))
        filled = median_filter(np.interp(idx, idx[known], x[known]), TORSO_GLITCH, mode="nearest")
        x = np.where(known, filled, np.nan)
    return x


def camera_path(poses: dict, floor: np.ndarray, k0: int, k1: int, w: int, h: int, scale: float,
                out_w: int, out_h: int, ground: float, cam_range=None) -> tuple[np.ndarray, np.ndarray]:
    """
    (x, floor y) the camera holds at each frame k0..k1 of the take, take px:
    x is put at the middle of the picture, floor y on the picture's floor
    line (`ground`, a share of the output height). `floor` is
    feet.floor_points over the same frames.
    """
    tx = torso_x(poses, k0, k1, w) * scale
    ty = np.nanmean(floor[:, :, 1], axis=1) * scale
    lo_hi = (cam_range[0] * scale, cam_range[1] * scale) if cam_range else None
    x = planned(tx, ZONE_X * out_w, lo_hi) / scale
    lowest = (h - (1 - ground) * out_h / scale) * scale  # furthest down: the phone's last row on the picture's
    y = planned(ty, ZONE_Y * out_h, (None, lowest)) / scale
    return x, y


PUSH_ZOOM = 1.45      # how far in the camera leans, against the wide shot
PUSH_OUT_BARS = 2.0   # it eases back out over this many bars after the push
PUSH_CHEST = 0.62     # it leans in toward his chest: this share of his height above the floor


def _smooth(u: float) -> float:
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def push_zoom(t: float, spans, bar: float) -> float:
    """
    How far in the camera has leaned at take second t (1 is the wide shot):
    over each push span it eases in, slowly at both ends; after it, it eases
    back out over PUSH_OUT_BARS bars.
    """
    z = 1.0
    for a, b in spans:
        if a <= t < b:
            u = _smooth((t - a) / max(1e-6, b - a))
        elif b <= t < b + PUSH_OUT_BARS * bar:
            u = 1.0 - _smooth((t - b) / (PUSH_OUT_BARS * bar))
        else:
            continue
        z = max(z, 1.0 + (PUSH_ZOOM - 1.0) * u)
    return z
