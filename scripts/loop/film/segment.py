"""
Find him in every frame: the person mask and the pose.

    npm run film:segment -- <take>
    npm run film:segment -- <take> --matte=selfie --screen=741,91,1345,435   # the fallback, a dark screen behind him

The person comes from Robust Video Matting (matte.py) when it is installed,
else from MediaPipe's selfie segmenter (--matte=selfie). The pose landmarker
gives 33 points either way (the heart and the feet come from these).

Both are cleaned to the largest body (with any piece of him large enough to
be a limb) and small holes filled. The selfie segmenter needs more, the way
docs/loop/campaign/HANDOFF.md 4.1 found works: the empty room trims where it
is unsure, a screen rule, and a median over five frames so edges do not
shimmer. The matte remembers earlier frames itself and needs none of that.

Writes mask.mkv (soft, analysis size) and pose.jsonl into the take's folder.
"""
import json, sys, time
from collections import deque
import numpy as np
import cv2
from scipy.ndimage import binary_fill_holes
from take import Reader, Writer, even, load_take, take_dir
import seg
import matte as rvm

MEDIAN = 5  # frames, for the selfie segmenter


def build_plate(take: dict, W: int, H: int, samples: int = 120) -> np.ndarray:
    """
    The empty room: the per-pixel median of frames sampled across the WHOLE
    take. He moves, the room does not, so the median forgets him. A locked
    camera is what makes this possible (the shoot spec insists on one).
    """
    times = np.linspace(2, max(3, take["duration"] - 2), samples)
    frames = []
    for t in times:
        r = Reader(take["path"], W, H, start=float(t), dur=0.05)
        f = next(iter(r), None)
        r.close()
        if f is not None:
            frames.append(f)
    return np.median(np.stack(frames), 0).astype(np.uint8)


def like_room(frame: np.ndarray, plate: np.ndarray) -> np.ndarray:
    """Pixels that match the empty room, or are only its shadow (darker, same colour).
    Measured at half size (a room is smooth), returned at full size."""
    H, W = frame.shape[:2]
    f = cv2.resize(frame, (W // 2, H // 2), interpolation=cv2.INTER_AREA).astype(np.float32)
    p = cv2.resize(plate, (W // 2, H // 2), interpolation=cv2.INTER_AREA).astype(np.float32)
    d = np.abs(f - p).max(2) / 255
    lf, lp = f.mean(2), p.mean(2) + 1e-3
    ratio = lf / lp
    chroma = np.abs((f / (lf[..., None] + 1e-3)) - (p / lp[..., None])).max(2)
    shadow = (ratio > 0.35) & (ratio < 0.985) & (chroma < 0.06)
    small = cv2.blur(((d < 0.07) | shadow).astype(np.float32), (3, 3))
    return cv2.resize(small, (W, H), interpolation=cv2.INTER_LINEAR) > 0.5


def screen_rule(frame: np.ndarray) -> np.ndarray:
    """Inside a dark screen, only skin- and cloth-coloured pixels can be him
    (the rule from scripts/loop/reel/scratch-2026-09-23/tvclean.py)."""
    f = frame.astype(np.int16)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    lum = (r + g + b) / 3
    sat = f.max(2) - f.min(2)
    return ((g > b) | (r > b + 8)) & (lum > 30) & ~((lum > 170) & (sat < 45))


def clean(conf: np.ndarray, frame: np.ndarray | None = None, plate: np.ndarray | None = None,
          screen: tuple | None = None) -> np.ndarray:
    """Soft mask (0..1) with only him in it."""
    decided = conf > 0.5
    if plate is not None and frame is not None:
        # The segmenter swells onto the wall where it is unsure. Where it is
        # unsure AND the pixel is just the room, it is the room.
        decided &= ~(like_room(frame, plate) & (conf < 0.98))
    if screen is not None and frame is not None:
        x0, y0, x1, y1 = screen
        inside = np.zeros_like(decided)
        inside[y0:y1, x0:x1] = True
        # A confident segmenter wins (his dark hair over a dark screen fails
        # the colour rule); only its doubtful pixels must pass the rule.
        decided &= ~inside | screen_rule(frame) | (conf > 0.9)
        decided = cv2.morphologyEx(decided.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    b = decided.astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(b, connectivity=8)
    if n <= 1:
        return np.zeros_like(conf)
    areas = stats[1:, cv2.CC_STAT_AREA]
    big = areas.max()
    keep = np.isin(lab, 1 + np.where(areas >= 0.05 * big)[0])
    # Fill only small holes (noise inside him). A large enclosed hole is real
    # air: the gap between an arm on the hip and the body, or between the legs
    # when the feet meet. Filling those paints the wall into him.
    holes = binary_fill_holes(keep) & ~keep
    if holes.any():
        hn, hlab, hstats, _ = cv2.connectedComponentsWithStats(holes.astype(np.uint8), connectivity=4)
        small = 1 + np.where(hstats[1:, cv2.CC_STAT_AREA] < 0.01 * big)[0]
        keep |= np.isin(hlab, small)
    # Soft where it is uncertain, but the decision is kept exactly: above 0.5
    # inside, below it outside, so the drawn outline follows the decision.
    soft = conf.astype(np.float32).copy()
    soft[keep] = np.maximum(soft[keep], 0.5)
    soft[~keep] = np.minimum(soft[~keep], 0.49)
    far = cv2.dilate(keep.astype(np.uint8), np.ones((5, 5), np.uint8)) == 0
    soft[far] = 0.0
    return soft


def main(argv):
    name = argv[0]
    opts = dict(a[2:].split("=", 1) for a in argv[1:] if a.startswith("--") and "=" in a)
    take = load_take(name)
    d = take_dir(name)
    width = min(int(opts.get("width", 1280)), take["w"])
    W, H = even(width), even(width * take["h"] / take["w"])
    start, end = take["window"]["start"], take["window"]["end"]
    fps = take["fps"]
    matte = opts.get("matte", "rvm" if rvm.available() else "selfie")
    if matte == "rvm" and "screen" in opts:
        print("  --screen is for the selfie segmenter; the matte needs no screen rule", flush=True)
    plate = None
    if matte == "selfie":
        plate_path = d / f"plate-{W}.png"
        if plate_path.exists():
            plate = cv2.cvtColor(cv2.imread(str(plate_path)), cv2.COLOR_BGR2RGB)
        else:
            print("  building the empty room from the whole take", flush=True)
            plate = build_plate(take, W, H)
            cv2.imwrite(str(plate_path), cv2.cvtColor(plate, cv2.COLOR_RGB2BGR))
    screen = None
    if "screen" in opts and matte == "selfie":
        # Given in the take's own pixels (x0,y0,x1,y1), scaled to analysis size.
        x0, y0, x1, y1 = (float(v) for v in opts["screen"].split(","))
        k = W / take["w"]
        screen = (int(x0 * k), int(y0 * k), int(x1 * k), int(y1 * k))
    reader = Reader(take["path"], W, H, start=start, dur=end - start)
    writer = Writer(d / "mask.mkv", W, H, fps)
    poser = seg.poser(video=True)
    if matte == "rvm":
        person = rvm.Matte(H)
        window = 1
    else:
        segmenter = seg.segmenter(video=True)
        person = lambda frame, ts: clean(seg.person(segmenter, frame, ts), frame, plate, screen)  # noqa: E731
        window = MEDIAN
    # A centred median: frame n's mask is written once its later neighbours
    # exist, from the frames around it (fewer at the ends).
    buf: deque = deque(maxlen=window)
    half = window // 2
    written = 0

    def emit(upto: int):
        nonlocal written
        while written <= upto:
            near = [m for j, m in buf if abs(j - written) <= half]
            writer.write((np.median(np.stack(near), 0) * 255).astype(np.uint8))
            written += 1

    t0 = time.time()
    with open(d / "pose.jsonl", "w") as pose_out:
        i = 0
        for frame in reader:
            ts = int(i * 1000 / fps)
            buf.append((i, clean(person(frame)) if matte == "rvm" else person(frame, ts)))
            lm = seg.landmarks(poser, frame, ts)
            rec = {"f": i}
            if lm is not None:
                rec["lm"] = [[round(float(x) / W, 5), round(float(y) / H, 5), round(float(v), 3)] for x, y, v in lm]
            pose_out.write(json.dumps(rec) + "\n")
            emit(i - half)
            i += 1
            if i % 300 == 0:
                print(f"  {i} frames, {i / (time.time() - t0):.0f} fps", flush=True)
    emit(i - 1)
    writer.close()
    meta = {"w": W, "h": H, "frames": i, "fps": fps, "matte": matte}
    (d / "mask.json").write_text(json.dumps(meta))
    print(f"{name}: {i} frames segmented ({matte}) at {W}x{H} in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main(sys.argv[1:])
