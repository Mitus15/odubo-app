"""
The floor under him: where each foot stands on it.

The phone never moved, so the floor is one fixed plane for the whole take, lit
by one light, and he stands on it. Nothing about it needs chasing frame by
frame (owner, 2026-10-12, of the tracked shadow: "jumpcutting like crazy...
can we not simulate the actual ground so that the shadow is cast naturally").

Each foot has a floor point, where that foot stands:

  its sole    the matte's lowest row under the foot (the pose's heel and toe
              say which columns), or the pose's sole set to the matte's by
              one offset for the take, when the matte disagrees or the foot
              has left the phone's frame
  planted     a foot is on the floor when it is as low as it gets around
              then (a lifted foot is higher in the picture); while it is up
              its floor point travels straight from where it left the floor
              to where it lands, so a lifted foot, a kick or a jump leaves
              its shadow on the floor
  smoothed    one-frame glitches out (a median), then a light blur both ways,
              and tucked a few px up: a shadow starting behind the shoe is
              hidden by it, one starting under it shows a gap

The shadow is cast from the two points (shadow.cast_on_floor), so each sole
meets its own shadow. The camera holds the floor between them (camera.py).

Read once per take at half size, kept beside the matte (feet.v1.npy).
"""
import numpy as np
from scipy.ndimage import gaussian_filter1d, maximum_filter1d, median_filter
from anchor import L_SHOULDER, R_SHOULDER
from take import Reader, load_take, read_pose, take_dir

FEET = ((27, 29, 31), (28, 30, 32))  # left, right: ankle, heel, toe
READ_SCALE = 0.5
FOOT = 0.3      # half the column under a foot, a share of his usual shoulder width
AGREE = 0.06    # the matte's sole counts within this share of the frame height of the pose's
EDGE = 3        # px (at read size): a matte reaching the frame's last rows has lost the sole
GLITCH = 5      # frames: the median that throws out one-frame glitches
STEP_S = 0.5    # a foot is planted when it is within LIFT of the lowest it gets over this long
LIFT = 0.012    # share of the frame height
SMOOTH_S = 0.08
TUCK = 0.004    # the floor point sits this share of the frame height above the sole: the
                # shadow's start hides behind the shoe, never a gap under it
VERSION = 1


def _usual_shoulders(poses: dict, w: int) -> float:
    widths = [abs(lm[L_SHOULDER, 0] - lm[R_SHOULDER, 0]) * w for lm in poses.values()]
    return float(np.percentile(widths, 90)) if widths else 0.2 * w


def matte_sole(alpha: np.ndarray, x: float, half: float, scale: float) -> float:
    """The lowest row of the matte in the column under a foot (take px), nan if none or at the frame's edge."""
    a = int(max(0, np.floor((x - half) * scale)))
    b = int(min(alpha.shape[1], np.ceil((x + half) * scale)))
    if b <= a:
        return float("nan")
    rows = np.where((alpha[:, a:b] > 127).any(1))[0]
    if not len(rows) or rows[-1] >= alpha.shape[0] - EDGE:
        return float("nan")
    return float((rows[-1] + 1) / scale)


def pose_foot(lm: np.ndarray, idx, w: int, h: int):
    """(x, sole y) of one foot from the pose (take px), or None if it is not seen."""
    seen = [j for j in idx if lm[j, 2] >= 0.3]
    if not seen:
        return None
    return float(lm[seen, 0].mean() * w), float(lm[seen, 1].max() * h)


def soles(name: str) -> np.ndarray:
    """(frames, 2 feet, x / y) of the take's window, take px, nan where a foot is not found."""
    take, d = load_take(name), take_dir(name)
    cache, alpha_path = d / f"feet.v{VERSION}.npy", d / "alpha.mkv"
    if cache.exists() and cache.stat().st_mtime >= alpha_path.stat().st_mtime:
        return np.load(cache)
    poses = read_pose(d / "pose.jsonl")
    w, h = take["w"], take["h"]
    half = FOOT * _usual_shoulders(poses, w)
    pose_y, matte_y, xs = [], [], []
    r = Reader(alpha_path, int(w * READ_SCALE), int(h * READ_SCALE), gray=True)
    for k, a in enumerate(r):
        lm = poses.get(k)
        row_p, row_m, row_x = [np.nan, np.nan], [np.nan, np.nan], [np.nan, np.nan]
        for f, idx in enumerate(FEET):
            got = pose_foot(lm, idx, w, h) if lm is not None else None
            if got is None:
                continue
            row_x[f], row_p[f] = got
            row_m[f] = matte_sole(a, got[0], half, READ_SCALE)
        xs.append(row_x), pose_y.append(row_p), matte_y.append(row_m)
    r.close()
    xs, pose_y, matte_y = (np.array(v, np.float32) for v in (xs, pose_y, matte_y))
    agree = np.abs(matte_y - pose_y) < AGREE * h
    offset = float(np.nanmedian((matte_y - pose_y)[agree])) if agree.any() else 0.0
    y = np.where(agree, matte_y, pose_y + offset)
    out = np.stack([xs, y], axis=-1)
    np.save(cache, out)
    return out


def odd(n: float) -> int:
    return max(1, int(round(n)) | 1)


def planted(raw: np.ndarray, k0: int, k1: int, h: int, fps: float) -> np.ndarray:
    """
    (k1 - k0, 2 feet, x / y): each foot's point on the floor for frames k0..k1
    of the take (raw from soles()), smoothed both ways in time.
    """
    n = k1 - k0
    out = np.full((n, 2, 2), np.nan, np.float32)
    ks = np.arange(k0, k1)
    inside = (ks >= 0) & (ks < len(raw))
    for f in range(2):
        pts = np.full((n, 2), np.nan, np.float32)
        pts[inside] = raw[ks[inside], f]
        ok = ~np.isnan(pts[:, 1])
        if ok.sum() < 2:
            continue
        idx = np.arange(n)
        for c in range(2):
            pts[:, c] = np.interp(idx, idx[ok], pts[ok, c])
        pts = median_filter(pts, size=(GLITCH, 1), mode="nearest")
        lowest = maximum_filter1d(pts[:, 1], odd(STEP_S * fps), mode="nearest")
        down = pts[:, 1] >= lowest - LIFT * h
        if down.sum() >= 2:
            for c in range(2):
                pts[:, c] = np.interp(idx, idx[down], pts[down, c])
        out[:, f] = gaussian_filter1d(pts, SMOOTH_S * fps, axis=0, mode="nearest")
        out[:, f, 1] -= TUCK * h
    # A foot never found takes the other's floor point.
    for f in range(2):
        if np.isnan(out[:, f, 1]).all() and not np.isnan(out[:, 1 - f, 1]).all():
            out[:, f] = out[:, 1 - f]
    return out


def floor_points(name: str, k0: int, k1: int, fps: float) -> np.ndarray:
    take = load_take(name)
    return planted(soles(name), k0, k1, take["h"], fps)
