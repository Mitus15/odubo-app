"""
Put it together: the moving poster, frame by frame.

    npm run film:compose -- <take> --from=<s> --to=<s> --aspect=9x16 [--outro] [--out=file.mp4]
        [--shadow=sync|lag|none --lag=<frames>]   override the chapter's shadow
        [--effects=freeze,flip]                  hold on each downbeat; flip to the sibling colour each bar
        [--look=poster|cover|gloss --cuts=0.55,0.75 --soft=0.08]
            poster  the label map, as the converter drew it
            cover   (needs figure --look=gloss) the album cover: ink, pools of
                    light as a ring of the ground colour around a pale core,
                    cut from smooth fields at the output size so every edge is
                    a clean curve
            gloss   the cover, its pale cores melting into their rings (by
                    --soft): light on lacquer. The outline and the rings stay
                    hard, so he is still one clean shape

For every frame, in this order:
  1. the field       the chapter's flat colour, edge to edge (no room, ever)
  2. his shadow      on the ground: in step, lagging (The Game), or none
  3. him             the label map coloured with the chapter's palette
  4. the badge       the seal on his heart, a mustard seed, from the moment
                     it lands
  5. the outro       (--outro) the seed grows into the Danceman, "the
                     greatest": one continuous motion while he fades, from
                     his heart to the centre, warm white to ink, seal to
                     Danceman, then it holds

Because the field is flat, the virtual camera is free: it can pull back past
the edges of what the phone saw, so every aspect gets the framing it needs
(9:16 leaves the top third for the scripture card). The same data renders
both aspects, so the film and the clips match one to one.

Video only; film:cut adds the card and the sound.
"""
import json, sys, time
from collections import deque
import numpy as np
import cv2
from film_common import SONGS, WORK
from take import Reader, Writer, even, load_take, read_pose, take_dir
from anchor import HeartPath
from shadow import Ground, cast
from outro import FRAMES as GROW_FRAMES, KEYLINE, Marks

ASPECTS = {
    # figure height and ground line as fractions of the output height;
    # follow = how quickly the camera follows him sideways (0..1 per frame)
    "9x16": {"w": 9, "h": 16, "figure": 0.54, "ground": 0.87, "follow": 0.10},
    "16x9": {"w": 16, "h": 9, "figure": 0.6, "ground": 0.82, "follow": 0.04},
    "1x1": {"w": 1, "h": 1, "figure": 0.62, "ground": 0.88, "follow": 0.08},
}
FLY_S, FADE_S, HOLD_S = 1.5, 1.0, 1.0  # the growth starts FLY_S before the dance ends; he fades over FADE_S
POP_S = 0.35
SHADOW_OPACITY = 0.9
CREDIT_SIZE = 0.30  # the Danceman's height as a fraction of the shorter side
WHITE_INSET = 0.25  # how far in the white shrinks (share of the width) as the seed turns to ink


def rgb(c) -> np.ndarray:
    return np.array(c, np.float32)


def ease(u: float) -> float:
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


class Timeline:
    """Which chapter a moment of the take belongs to, and its look."""

    def __init__(self, story: dict, align: dict):
        self.chapters = {c["slug"]: c for c in story["chapters"]}
        self.ranges = sorted((s["filmStart"], s["filmEnd"], s["slug"]) for s in align["songs"])

    def at(self, t: float) -> dict:
        best = None
        for a, b, slug in self.ranges:
            if a <= t < b:
                return {**self.chapters[slug], "chapterTime": t - a}
            if best is None or abs(t - a) < abs(t - best[0]):
                best = (a, slug)
        slug = best[1] if best else next(iter(self.chapters))
        return {**self.chapters[slug], "chapterTime": t - (best[0] if best else 0)}


def paste(canvas: np.ndarray, cover: np.ndarray, colour: np.ndarray, cx: float, cy: float, opacity: float = 1.0):
    """Lay `cover` (0..1) centred at (cx, cy) in `colour` over `canvas` (float RGB), clipped to the frame."""
    h, w = cover.shape
    H, W = canvas.shape[:2]
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    ax0, ay0, ax1, ay1 = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if ax1 <= ax0 or ay1 <= ay0:
        return
    a = cover[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0][..., None] * opacity
    region = canvas[ay0:ay1, ax0:ax1]
    canvas[ay0:ay1, ax0:ax1] = region * (1 - a) + colour * a


def stamp(canvas: np.ndarray, cover: np.ndarray, size: int, colour: np.ndarray, cx: float, cy: float,
          width: float, angle: float = 0.0, opacity: float = 1.0):
    """
    Lay a square mark (coverage `cover`, `size` px across) centred at (cx, cy),
    `width` px across and turned `angle` degrees, in `colour`. Placed at
    sub-pixel precision: it glides rather than stepping pixel to pixel.
    """
    if width < 0.5 or opacity <= 0.005:
        return
    H, W = canvas.shape[:2]
    half = 0.72 * width + 2  # the turned square's reach
    x0, y0 = max(0, int(np.floor(cx - half))), max(0, int(np.floor(cy - half)))
    x1, y1 = min(W, int(np.ceil(cx + half)) + 1), min(H, int(np.ceil(cy + half)) + 1)
    if x1 <= x0 or y1 <= y0:
        return
    k = width / size
    c, s_ = np.cos(np.radians(angle)) * k, np.sin(np.radians(angle)) * k
    m = (size - 1) / 2
    M = np.float32([[c, -s_, cx - x0 - (c - s_) * m], [s_, c, cy - y0 - (s_ + c) * m]])
    a = cv2.warpAffine(cover, M, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderValue=0)[..., None] * opacity
    region = canvas[y0:y1, x0:x1]
    canvas[y0:y1, x0:x1] = region + (colour - region) * a


def seed(canvas: np.ndarray, marks: Marks, pal: dict, x: float, y: float, width: float, angle: float,
         opacity: float, grown: float = 0.0, white: float = 1.0):
    """
    The badge: warm white on an ink keyline, so it reads on any cut of him.

    `white` under 1 turns it to ink from the edge in: the keyline draws in to
    the outline while the white shrinks away inside it. The mark keeps a hard
    edge the whole way; a colour fade would pass through a dull brown that
    sinks into some fields.
    """
    cov, size = marks.cover(width, grown, out_px=max(1.0, KEYLINE * width) * white)
    stamp(canvas, cov, size, pal["ink"], x, y, width, angle, opacity)
    if white > 0.001:
        cov, size = marks.cover(width, grown, out_px=-(1 - white) * WHITE_INSET * width)
        stamp(canvas, cov, size, pal["badge"], x, y, width, angle, opacity)


def grow(canvas: np.ndarray, marks: Marks, pal: dict, u: float, start: tuple):
    """
    The seed becomes the Danceman; u runs 0..1 across the whole outro, from
    the seed on his heart (`start`: x, y, width, angle, opacity) to the credit
    at the centre. Every part eases in and out and they overlap, so it is one
    motion, never a move, a stop and a change.
    """
    H, W = canvas.shape[:2]
    hx, hy, hw, hang, hop = start
    to_centre = ease(u / 0.6)
    x, y = hx + (W / 2 - hx) * to_centre, hy + (H / 2 - hy) * to_centre
    # Growth steady in proportion (it doubles, and doubles again), not in
    # pixels, which would read as a balloon inflating at the end.
    target = CREDIT_SIZE * min(W, H)
    width = float(np.exp(np.log(max(hw, 1.0)) + (np.log(target) - np.log(max(hw, 1.0))) * ease(u)))
    seed(canvas, marks, pal, x, y, width, hang * (1 - ease(u / 0.5)),
         opacity=hop + (1 - hop) * ease(u / 0.3), grown=ease((u - 0.3) / 0.6),
         white=1 - ease((u - 0.15) / 0.45))


def cut(f: np.ndarray, level: float) -> np.ndarray:
    """Where a smooth field crosses `level`, as coverage 0..1 with a one pixel
    ramp: a crisp, anti-aliased edge at whatever scale it is drawn."""
    gy, gx = np.gradient(f)
    return np.clip((f - level) / (np.sqrt(gx * gx + gy * gy) + 1e-4) + 0.5, 0, 1)


def melt(f: np.ndarray, level: float, soft: float) -> np.ndarray:
    u = np.clip((f - level + soft) / (2 * soft), 0, 1)
    return u * u * (3 - 2 * u)


def main(argv):
    name = argv[0]
    opts = dict(a[2:].split("=", 1) for a in argv[1:] if a.startswith("--") and "=" in a)
    flags = {a[2:] for a in argv[1:] if a.startswith("--") and "=" not in a}
    take = load_take(name)
    d = take_dir(name)
    fig = json.loads((d / "figure.json").read_text())
    story = json.loads((d / "story.json").read_text())
    align = json.loads((d / "align.json").read_text())
    fps = take["fps"]
    win0 = take["window"]["start"]
    t_from = float(opts.get("from", win0))
    t_to = float(opts.get("to", take["window"]["end"]))
    aspect = ASPECTS[opts.get("aspect", "9x16")]
    Hout = even(float(opts.get("height", 1920 if aspect["h"] > aspect["w"] else 1080)))
    Wout = even(Hout * aspect["w"] / aspect["h"])
    out_path = opts.get("out") or str(d / f"compose-{opts.get('aspect', '9x16')}-{t_from:.1f}-{t_to:.1f}.mp4")
    crf = int(opts.get("crf", 18))
    outro = "outro" in flags
    look = opts.get("look", "gloss" if fig.get("look") == "gloss" else "poster")
    if look != "poster" and fig.get("look") != "gloss":
        raise SystemExit(f"--look={look} needs the fields: run film:figure with --look=gloss first")
    cuts = tuple(float(v) for v in opts.get("cuts", "0.55,0.75").split(","))
    soft = float(opts.get("soft", 0.08))

    timeline = Timeline(story, align)
    poses = read_pose(d / "pose.jsonl")
    marks = Marks()

    Wf, Hf = fig["w"], fig["h"]
    first = int(round((t_from - win0) * fps))
    count = int(round((t_to - t_from) * fps))
    max_lag = max([c.get("shadowLag") or 0 for c in story["chapters"]] + [0])

    # Pre-roll the lagging shadow and the trackers from before the range.
    pre = min(first, max(max_lag, int(fps * 3)))
    labels = Reader(d / "labels.mkv", Wf, Hf, gray=True, start=(first - pre) / fps, dur=(count + pre) / fps)
    alphas = Reader(d / "alpha.mkv", Wf, Hf, gray=True, start=(first - pre) / fps, dur=(count + pre) / fps)
    streams = [labels, alphas]
    if look != "poster":
        fw, fh = fig["fieldW"], fig["fieldH"]
        streams += [Reader(d / f"{n}.mkv", fw, fh, gray=True, start=(first - pre) / fps, dur=(count + pre) / fps)
                    for n in ("field", "tone")]

    # One scale per clip, from his median height in it, so he never breathes.
    heights = []
    for k in range(first, first + count, max(1, count // 40)):
        lm = poses.get(k)
        if lm is not None:
            ys = lm[:, 1][lm[:, 2] > 0.3] * Hf
            if len(ys):
                heights.append(ys.max() - ys.min())
    body = float(np.median(heights)) * 1.12 if heights else Hf * 0.7  # landmarks miss the crown of the head
    scale = aspect["figure"] * Hout / body

    writer = Writer(out_path, Wout, Hout, fps, kind="h264", crf=crf)
    # The heart over the whole stretch (and a second either side), smoothed
    # both ways in time: the take is recorded, so it never needs to lag.
    path = HeartPath(poses, first - pre - int(fps), first + count + int(fps), Wf, Hf, fps)
    ground = Ground(fps)
    past = deque(maxlen=max_lag + 1)
    cam_x = None
    t0 = time.time()
    written = 0
    fade_frames = int(FADE_S * fps)
    fly_frames = min(count, int(FLY_S * fps))
    grow_total = fly_frames + GROW_FRAMES  # the outro: the last of the dance, then the field alone
    start = None

    # Effects that dance with him, on the song's own bar grid.
    effects = set(filter(None, opts.get("effects", "").split(",")))
    bars = None
    if effects & {"freeze", "flip"}:
        from beats import grid, freeze_map
        mid = timeline.at(t_from + (t_to - t_from) / 2)
        number = next(s_["number"] for s_ in SONGS if s_["slug"] == mid["slug"])
        g_ = grid(number)
        film_start = next(s_["filmStart"] for s_ in align["songs"] if s_["slug"] == mid["slug"])
        bars = (film_start + g_["first"], g_["bar"])
        print(f"  effects {','.join(sorted(effects))} on a {g_['bar']:.3f}s bar", flush=True)

    # The source is read forward only. An output frame asks for a source frame
    # at or after the last one read: the same one to hold, later ones to catch
    # up. Everything that follows him (heart, ground, shadow, camera) advances
    # with the source, never with the output.
    source = iter(zip(*streams))
    st = {"k": -1}

    def advance(target: int):
        while st["k"] < target:
            lab_, alp_, *fields_ = next(source)
            k_ = st["k"] + 1
            lm_ = poses.get(first - pre + k_)
            heart_ = path.at(first - pre + k_)
            alpha_ = alp_.astype(np.float32) / 255
            g_s, g_c = ground.update(lm_, Hf, alpha_)
            past.append(alpha_)
            if lm_ is not None and min(lm_[23, 2], lm_[24, 2]) > 0.3:
                x_now = float((lm_[23, 0] + lm_[24, 0]) / 2 * Wf)
            else:
                cols = np.where(alpha_.max(0) > 0.5)[0]
                x_now = float(cols.mean()) if len(cols) else Wf / 2
            cx = st.get("cam_x")
            st.update(k=k_, lab=lab_, alpha=alpha_, fields=fields_, heart=heart_, g=g_s, g_contact=g_c,
                      cam_x=x_now if cx is None else cx + aspect["follow"] * (x_now - cx))
        return st

    if pre > 0:
        advance(pre - 1)

    for i in range(count):
        t = t_from + i / fps
        target = pre + i
        if "freeze" in effects and bars:
            target = pre + int(round((freeze_map(t, bars[0], bars[1]) - t_from) * fps))
        try:
            s_now = advance(max(target, st["k"], 0))
        except StopIteration:
            break
        lab, alpha, heart = s_now["lab"], s_now["alpha"], s_now["heart"]
        g, g_contact, cam_x = s_now["g"], s_now["g_contact"], s_now["cam_x"]
        ch = timeline.at(t)
        key = "palette"
        if "flip" in effects and bars and ch.get("paletteFlip"):
            if int(np.floor((t - bars[0]) / bars[1])) % 2 == 1:
                key = "paletteFlip"
        pal = {k2: rgb(v) for k2, v in ch[key].items()}
        g_src = g if g is not None else Hf * 0.9
        ground_out = aspect["ground"] * Hout
        A = np.float32([[scale, 0, Wout / 2 - scale * cam_x], [0, scale, ground_out - scale * g_src]])
        contact_out = A[1, 1] * (g_contact if g_contact is not None else g_src) + A[1, 2]

        canvas = np.empty((Hout, Wout, 3), np.float32)
        canvas[:] = pal["field"]

        # The end of the clip: he fades, the badge flies.
        fade = 1.0
        u = None
        if outro:
            left = count - i
            fade = ease(left / max(1, fade_frames))
            if left <= fly_frames:
                u = (fly_frames - left) / (grow_total - 1)

        # Most of the frame is flat field: draw him and his shadow only in the
        # region around them (his box, and the ground below it).
        mode = opts.get("shadow", ch.get("shadowMode", "sync"))
        lag = int(opts.get("lag", ch.get("shadowLag") or 0)) if mode == "lag" else 0
        src_shadow = past[max(0, len(past) - 1 - lag)] if mode != "none" else None
        live = alpha > 0.01
        if src_shadow is not None:
            live = live | (src_shadow > 0.01)
        ys, xs = np.where(live)
        if len(ys):
            pad = 8
            bx0, by0, bx1, by1 = xs.min() - pad, ys.min() - pad, xs.max() + pad, ys.max() + pad
            ox0, oy0 = A[0, 0] * bx0 + A[0, 2], A[1, 1] * by0 + A[1, 2]
            ox1, oy1 = A[0, 0] * bx1 + A[0, 2], A[1, 1] * by1 + A[1, 2]
            tall = max(0.0, contact_out - oy0)
            reach = 0.3 * tall + 0.02 * Hout
            rx0 = int(max(0, np.floor(ox0 - 4)))
            rx1 = int(min(Wout, np.ceil(ox1 + 0.6 * reach + 4)))
            ry0 = int(max(0, np.floor(oy0 - 4)))
            ry1 = int(min(Hout, np.ceil(max(oy1, contact_out) + reach + 4)))
        else:
            rx0 = rx1 = ry0 = ry1 = 0
        if rx1 > rx0 and ry1 > ry0:
            rw, rh = rx1 - rx0, ry1 - ry0
            Ar = A.copy()
            Ar[0, 2] -= rx0
            Ar[1, 2] -= ry0
            view = canvas[ry0:ry1, rx0:rx1]
            # 2. his shadow
            if src_shadow is not None:
                warped = cv2.warpAffine(src_shadow, Ar, (rw, rh), flags=cv2.INTER_LINEAR, borderValue=0)
                sh = cast(warped, contact_out - ry0) * SHADOW_OPACITY * fade
                view += (pal["shadow"] - view) * sh[..., None]
            # 3. him
            if look == "poster":
                onehot = np.dstack([(lab == 1), (lab == 2), (lab == 3)]).astype(np.float32)
                hot = cv2.warpAffine(onehot, Ar, (rw, rh), flags=cv2.INTER_LINEAR, borderValue=0)
                a = cv2.warpAffine(alpha, Ar, (rw, rh), flags=cv2.INTER_LINEAR, borderValue=0) * fade
                wsum = hot.sum(2, keepdims=True)
                body_rgb = (hot[..., 0:1] * pal["ink"] + hot[..., 1:2] * pal["mid"] + hot[..., 2:3] * pal["highlight"]) / np.maximum(wsum, 1e-6)
                body_rgb = np.where(wsum > 1e-6, body_rgb, pal["ink"])
            else:
                # Cut the smooth fields here, at the output size: clean curves.
                # They are stored at the mask's size, so scale them to the figure's first.
                Af = Ar.copy()
                Af[:, 0] *= Wf / fw
                Af[:, 1] *= Hf / fh
                fld, tn = (cv2.warpAffine(x.astype(np.float32) / 255, Af, (rw, rh), flags=cv2.INTER_CUBIC, borderValue=0)
                           for x in s_now["fields"])
                a = cut(fld, 0.5) * fade
                ring = cut(tn, cuts[0])
                core = cut(tn, cuts[1]) if look == "cover" else melt(tn, cuts[1], soft)
                # The ring is the ground's own colour, as on the cover: the
                # light opens him to the field he stands on.
                ring, core = ring[..., None], core[..., None]
                body_rgb = (pal["ink"] * (1 - ring) + pal["field"] * ring) * (1 - core) + pal["highlight"] * core
            view += (body_rgb - view) * a[..., None]

        # 4. the badge: a seed on his heart (from the moment it lands)
        badge_from = ch.get("badgeFrom")
        landed = badge_from is None or ch["chapterTime"] >= badge_from
        if heart is not None and landed:
            hx, hy, hw, hang, hop = heart
            pop = 1.0
            if badge_from is not None and ch["chapterTime"] < badge_from + POP_S:
                pop = ease((ch["chapterTime"] - badge_from) / POP_S)
            here = (A[0, 0] * hx + A[0, 2], A[1, 1] * hy + A[1, 2], hw * scale * pop, hang, hop)
        else:
            here = (Wout / 2, Hout / 2, 0.02 * min(Wout, Hout), 0.0, 0.0)  # no heart: it grows from nothing
        if u is None:
            if here[4] > 0:
                seed(canvas, marks, pal, *here)
        else:
            # 5. the outro: it leaves the heart as it grows (the heart it
            #    leaves still moves with him until he is gone)
            start = here
            grow(canvas, marks, pal, u, start)

        writer.write(np.clip(canvas, 0, 255).astype(np.uint8))
        written += 1
        if written % 150 == 0:
            print(f"  {written}/{count} frames, {written / (time.time() - t0):.1f} fps", flush=True)

    # 5. the rest of the growth on the field alone, then the Danceman holds.
    if outro:
        ch = timeline.at(t_to - 1 / fps)
        pal = {key: rgb(v) for key, v in ch["palette"].items()}
        start = start or (Wout / 2, Hout / 2, 0.02 * min(Wout, Hout), 0.0, 0.0)
        for j in range(GROW_FRAMES + int(HOLD_S * fps)):
            canvas = np.empty((Hout, Wout, 3), np.float32)
            canvas[:] = pal["field"]
            grow(canvas, marks, pal, min(1.0, (fly_frames + j) / (grow_total - 1)), start)
            writer.write(np.clip(canvas, 0, 255).astype(np.uint8))
            written += 1
    writer.close()
    for r in streams:
        r.close()
    print(f"{out_path}: {written} frames at {Wout}x{Hout} in {time.time() - t0:.0f}s")
    return out_path


if __name__ == "__main__":
    main(sys.argv[1:])
