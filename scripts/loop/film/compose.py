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
  4. the badge       the seal on his heart, from the moment it lands
  5. the outro       (--outro) the badge leaves his heart for the centre,
                     turning from warm white to ink as he fades, then becomes
                     the Danceman, and holds

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
from anchor import HeartTrack
from shadow import Ground, cast
from outro import build as build_marks

ASPECTS = {
    # figure height and ground line as fractions of the output height;
    # follow = how quickly the camera follows him sideways (0..1 per frame)
    "9x16": {"w": 9, "h": 16, "figure": 0.54, "ground": 0.87, "follow": 0.10},
    "16x9": {"w": 16, "h": 9, "figure": 0.6, "ground": 0.82, "follow": 0.04},
    "1x1": {"w": 1, "h": 1, "figure": 0.62, "ground": 0.88, "follow": 0.08},
}
FLY_S, FADE_S, HOLD_S = 1.5, 0.6, 1.0
POP_S = 0.35
SHADOW_OPACITY = 0.9
CREDIT_SIZE = 0.30  # the Danceman's height as a fraction of the shorter side


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


def mark(cover_src: np.ndarray, width: float, angle: float = 0.0) -> np.ndarray:
    """The mark scaled to `width` px across and turned by `angle` degrees."""
    s = max(2, int(round(width)))
    m = cv2.resize(cover_src, (s, s), interpolation=cv2.INTER_AREA)
    if abs(angle) > 0.5:
        R = cv2.getRotationMatrix2D((s / 2, s / 2), -angle, 1.0)
        m = cv2.warpAffine(m, R, (s, s), flags=cv2.INTER_LINEAR, borderValue=0)
    return m


def keyline(cover: np.ndarray, px: int) -> np.ndarray:
    """The mark grown by `px`: an ink edge so a warm white badge reads on any cut."""
    pad = px + 1
    c = np.pad(cover, pad)
    k = 2 * px + 1
    return cv2.dilate(c, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))), pad


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
    marks = build_marks()
    seal = cv2.imread(str(marks / "seal.png"), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
    morph = [cv2.imread(str(p), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
             for p in sorted((marks / "morph").glob("*.png"))]

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
    track = HeartTrack()
    ground = Ground(fps)
    past = deque(maxlen=max_lag + 1)
    cam_x = None
    t0 = time.time()
    written = 0
    last_badge = None
    fade_frames = int(FADE_S * fps)
    fly_frames = int(FLY_S * fps)

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
            heart_ = track.update(lm_, Wf, Hf)
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
        fly = 0.0
        if outro:
            left = count - i
            fade = min(1.0, left / max(1, fade_frames))
            fly = ease(1 - left / max(1, fly_frames)) if left <= fly_frames else 0.0

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

        # 4. the badge on his heart (from the moment it lands)
        badge_from = ch.get("badgeFrom")
        landed = badge_from is None or ch["chapterTime"] >= badge_from
        if heart is not None and landed:
            hx, hy, hw, hang, hop = heart
            pop = 1.0
            if badge_from is not None and ch["chapterTime"] < badge_from + POP_S:
                pop = ease((ch["chapterTime"] - badge_from) / POP_S)
            px = A[0, 0] * hx + A[0, 2]
            py = A[1, 1] * hy + A[1, 2]
            width = hw * scale * pop
            colour = pal["badge"]
            opacity = hop
            if fly > 0:
                cx, cy = Wout / 2, Hout / 2
                target = CREDIT_SIZE * min(Wout, Hout)
                px, py = px + (cx - px) * fly, py + (cy - py) * fly
                width = width + (target - width) * fly
                colour = pal["badge"] + (pal["ink"] - pal["badge"]) * fly
                opacity = hop + (1.0 - hop) * fly
                hang = hang * (1 - fly)
            if width >= 3 and opacity > 0.01:
                cover = mark(seal, width, hang)
                if fly < 0.5:
                    edge, pad = keyline(cover, max(1, int(round(width * 0.05))))
                    paste(canvas, edge, pal["ink"], px, py, opacity * (1 - 2 * fly))
                paste(canvas, cover, colour, px, py, opacity)
                last_badge = (px, py, width)

        writer.write(np.clip(canvas, 0, 255).astype(np.uint8))
        written += 1
        if written % 150 == 0:
            print(f"  {written}/{count} frames, {written / (time.time() - t0):.1f} fps", flush=True)

    # 5. the credit: the seal becomes the Danceman at the centre, and holds.
    if outro:
        ch = timeline.at(t_to - 1 / fps)
        pal = {key: rgb(v) for key, v in ch["palette"].items()}
        size = CREDIT_SIZE * min(Wout, Hout)
        for m in morph + [morph[-1]] * int(HOLD_S * fps):
            canvas = np.empty((Hout, Wout, 3), np.float32)
            canvas[:] = pal["field"]
            paste(canvas, cv2.resize(m, (int(size), int(size)), interpolation=cv2.INTER_AREA), pal["ink"], Wout / 2, Hout / 2)
            writer.write(np.clip(canvas, 0, 255).astype(np.uint8))
            written += 1
    writer.close()
    for r in streams:
        r.close()
    print(f"{out_path}: {written} frames at {Wout}x{Hout} in {time.time() - t0:.0f}s")
    return out_path


if __name__ == "__main__":
    main(sys.argv[1:])
