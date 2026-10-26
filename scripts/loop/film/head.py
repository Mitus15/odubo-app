"""
The top of his head in every frame, read from the matte: where the crown
marker must clear.

The pose model's head is a guess from the face: when he looks down at his
feet his eyes drop far under the top of his head, and when he springs out of
a crouch it runs a little late (Santé, take 398-402 s: the marker sat inside
his head for four seconds). The matte is him. In a column narrower than his
head, the matte from his eyes up without a break is his head; a hand held up
over it with air between is not.

Read once per take, at half size, and kept beside the matte (head_top.v*.npy).
"""
import numpy as np
from anchor import L_SHOULDER, R_SHOULDER, eyes_and_neck, head_top, head_x
from take import Reader, load_take, read_pose, take_dir

READ_SCALE = 0.5
COLUMN = 0.15  # half the column's width, as a share of his usual shoulder width
REACH = 0.5    # how far from his eyes the climb may start, as a share of his usual neck
VERSION = 2    # bump when the reading changes: the cache is rebuilt


def usual(poses: dict, w: int, h: int) -> tuple[float, float]:
    """His shoulder width and neck facing us, over the take (px)."""
    widths = [abs(lm[L_SHOULDER, 0] - lm[R_SHOULDER, 0]) * w for lm in poses.values()]
    necks = [eyes_and_neck(lm, w, h)[1] for lm in poses.values()]
    if not widths:
        return 0.2 * w, 0.06 * h
    return float(np.percentile(widths, 90)), float(np.percentile(necks, 90))


def tops(name: str) -> np.ndarray:
    """head_top for every frame of the take's window (px, nan where he is not found)."""
    take, d = load_take(name), take_dir(name)
    cache, alpha_path = d / f"head_top.v{VERSION}.npy", d / "alpha.mkv"
    if cache.exists() and cache.stat().st_mtime >= alpha_path.stat().st_mtime:
        return np.load(cache)
    poses = read_pose(d / "pose.jsonl")
    fig_w, fig_h = take["w"], take["h"]
    shoulders, neck = usual(poses, fig_w, fig_h)
    half, reach = COLUMN * shoulders, REACH * neck
    out = []
    r = Reader(alpha_path, int(fig_w * READ_SCALE), int(fig_h * READ_SCALE), gray=True)
    for k, a in enumerate(r):
        lm = poses.get(k)
        if lm is None:
            out.append(np.nan)
            continue
        eyes = eyes_and_neck(lm, fig_w, fig_h)[0]
        out.append(head_top(a, head_x(lm, fig_w), half, eyes, reach, READ_SCALE))
    r.close()
    arr = np.array(out, np.float32)
    np.save(cache, arr)
    return arr
