"""
Put it together: the moving poster, frame by frame.

    npm run film:compose -- <take> --from=<s> --to=<s> --aspect=9x16 [--outro] [--out=file.mp4]
        [--shadow=sync|lag|none --lag=<frames>]   override the chapter's shadow
        [--effects=freeze,flip,sidewalk,close,hits,echo]
            freeze    hold on each downbeat          flip  the sibling colour each bar
            sidewalk  tiles light under each step, and a reflection on a glossy floor (floor.py)
            close     a footwork close-up for the busiest bar of each phrase [--close-bars=s,s]
            hits      the sibling colour on the snare, back on the kick (hits.py)
            echo      on big moves, his echoes trail behind him (effects.py)
        [--marker=crown|ground|heart]             where the seal, the player's marker, sits (anchor.py)
        [--plate=file.mp4]   also write the phone's own picture through the same camera (raw vs gloss)
        [--body=<px>]        his height in the take, pinned: a stretch framed exactly as the whole song was
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
  4. the marker      the seal, the sign a game puts on the character you
                     play: floating over his head (crown), flat on the floor
                     under him (ground, drawn before him), or on his chest
                     (heart). Small, a mustard seed, from the moment it lands
  5. the outro       (--outro) the seed grows into the Danceman, "the
                     greatest": one continuous motion while he fades, from
                     where it sat on him to the centre, warm white to ink,
                     seal to Danceman, then it holds

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
from film_common import WORK
from take import Reader, Writer, even, load_take, read_pose, take_dir
from anchor import Path as Track
from shadow import Ground, cast_on_floor
from edge import cut, melt  # noqa: F401 (melt: the look's soft core, used by paint and the tests)
from outro import FRAMES as GROW_FRAMES, KEYLINE, Marks
from floor import (GLOSS_LIGHT, HORIZON, REFLECT_MIX, SPOT_LIGHT, SQUASH as FLOOR_SQUASH, TILE, Tiles, footfalls,
                   reflect_matrix, reflection_fade, spotlight)
from effects import (CLOSE_GROUND, CLOSE_ZOOM, ECHO_LAGS, ECHO_MIX, close_bars, close_spans, echo_lags, jump_claps, motion_gate,
                     on_snare)
from show import Show, resolve_palettes
from hud import Hud
import props as set_props

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
MARKERS = {"crown": "crown", "ground": "feet", "heart": "heart"}  # each marker, and the place on him it follows
CROWN_GAP = 0.6       # the crown marker's gap over his head, as a share of its width
BOB = 0.12            # how far it floats up and down once a bar, as a share of its width
GROUND_SQUASH = 0.3   # the floor at the camera's angle: the shadow's own squash
GROUND_TURN_BARS = 8  # the floor marker turns once every this many bars


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
          width: float, angle: float = 0.0, opacity: float = 1.0, squash: float = 1.0):
    """
    Lay a square mark (coverage `cover`, `size` px across) centred at (cx, cy),
    `width` px across and turned `angle` degrees, in `colour`. `squash` under 1
    lays it flat on the floor: turned first, then foreshortened. Placed at
    sub-pixel precision: it glides rather than stepping pixel to pixel.
    """
    if width < 0.5 or opacity <= 0.005:
        return
    H, W = canvas.shape[:2]
    hx_, hy_ = 0.72 * width + 2, 0.72 * width * squash + 2  # the turned square's reach
    x0, y0 = max(0, int(np.floor(cx - hx_))), max(0, int(np.floor(cy - hy_)))
    x1, y1 = min(W, int(np.ceil(cx + hx_)) + 1), min(H, int(np.ceil(cy + hy_)) + 1)
    if x1 <= x0 or y1 <= y0:
        return
    k = width / size
    c, s_ = np.cos(np.radians(angle)) * k, np.sin(np.radians(angle)) * k
    m = (size - 1) / 2
    lin = np.array([[c, -s_], [squash * s_, squash * c]])
    tx, ty = np.array([cx - x0, cy - y0]) - lin @ np.array([m, m])
    M = np.float32([[lin[0, 0], lin[0, 1], tx], [lin[1, 0], lin[1, 1], ty]])
    a = cv2.warpAffine(cover, M, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderValue=0)[..., None] * opacity
    region = canvas[y0:y1, x0:x1]
    canvas[y0:y1, x0:x1] = region + (colour - region) * a


def seed(canvas: np.ndarray, marks: Marks, pal: dict, x: float, y: float, width: float, angle: float,
         opacity: float, squash: float = 1.0, grown: float = 0.0, white: float = 1.0):
    """
    The badge: warm white on an ink keyline, so it reads on any cut of him.

    `white` under 1 turns it to ink from the edge in: the keyline draws in to
    the outline while the white shrinks away inside it. The mark keeps a hard
    edge the whole way; a colour fade would pass through a dull brown that
    sinks into some fields.
    """
    cov, size = marks.cover(width, grown, out_px=max(1.0, KEYLINE * width) * white)
    stamp(canvas, cov, size, pal["ink"], x, y, width, angle, opacity, squash)
    if white > 0.001:
        cov, size = marks.cover(width, grown, out_px=-(1 - white) * WHITE_INSET * width)
        stamp(canvas, cov, size, pal["badge"], x, y, width, angle, opacity, squash)


def grow(canvas: np.ndarray, marks: Marks, pal: dict, u: float, start: tuple):
    """
    The seed becomes the Danceman; u runs 0..1 across the whole outro, from
    the marker on him (`start`: x, y, width, angle, opacity[, squash]) to the credit
    at the centre. Every part eases in and out and they overlap, so it is one
    motion, never a move, a stop and a change. The seal becomes the Danceman
    early, while it is still small (the in-between of two marks is never
    pretty), and it is the Danceman that grows.
    """
    H, W = canvas.shape[:2]
    hx, hy, hw, hang, hop, *flat = start
    lie = flat[0] if flat else 1.0
    to_centre = ease(u / 0.6)
    x, y = hx + (W / 2 - hx) * to_centre, hy + (H / 2 - hy) * to_centre
    # Growth steady in proportion (it doubles, and doubles again), not in
    # pixels, which would read as a balloon inflating at the end.
    target = CREDIT_SIZE * min(W, H)
    width = float(np.exp(np.log(max(hw, 1.0)) + (np.log(target) - np.log(max(hw, 1.0))) * ease(u)))
    seed(canvas, marks, pal, x, y, width, hang * (1 - ease(u / 0.5)),
         opacity=hop + (1 - hop) * ease(u / 0.3), squash=lie + (1 - lie) * ease(u / 0.5),
         grown=ease((u - 0.15) / 0.4), white=1 - ease((u - 0.15) / 0.45))


def paint(fld: np.ndarray, tn: np.ndarray, pal: dict, look: str = "gloss", cuts=(0.55, 0.75), soft: float = 0.08):
    """
    Him in the cover's look, cut from the smooth fields (already scaled to the
    size they are drawn at): (colour, coverage). The ring is the ground's own
    colour, as on the cover: the light opens him to the field he stands on.
    One drawing for the clips, the film and the vinyl's grid.
    """
    ring = cut(tn, cuts[0])[..., None]
    core = (cut(tn, cuts[1]) if look == "cover" else melt(tn, cuts[1], soft))[..., None]
    colour = (pal["ink"] * (1 - ring) + pal["field"] * ring) * (1 - core) + pal["highlight"] * core
    return colour, cut(fld, 0.5)


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
    marker = opts.get("marker", "crown")
    if marker not in MARKERS:
        raise SystemExit(f"--marker={marker}: one of {', '.join(MARKERS)}")
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
    plate = opts.get("plate")
    if plate:
        # The phone's picture at the mask's size, read in step with the masks.
        streams.append(Reader(take["path"], Wf, Hf, start=(first - pre) / fps, dur=(count + pre) / fps))

    # One scale per clip, from his median height in it, so he never breathes.
    heights = []
    for k in range(first, first + count, max(1, count // 40)):
        lm = poses.get(k)
        if lm is not None:
            ys = lm[:, 1][lm[:, 2] > 0.3] * Hf
            if len(ys):
                heights.append(ys.max() - ys.min())
    body = float(np.median(heights)) * 1.12 if heights else Hf * 0.7  # landmarks miss the crown of the head
    if opts.get("body"):
        body = float(opts["body"])
    scale = aspect["figure"] * Hout / body

    # The phone's frame edge must never show inside ours: where he reaches out
    # of what the phone saw, a straight cut runs through him. So whenever the
    # phone saw wider than the picture, the camera stays inside what it saw,
    # and a limb that leaves the phone's view leaves ours at the same edge.
    half = Wout / (2 * scale)
    cam_range = (half, Wf - half) if Wf >= 2 * half else None

    writer = Writer(out_path, Wout, Hout, fps, kind="h264", crf=crf)
    plate_writer = Writer(plate, Wout, Hout, fps, kind="h264", crf=crf) if plate else None
    # The marker's place on him over the whole stretch (and a second either
    # side), smoothed both ways in time: the take is recorded, so it never lags.
    track = Track(poses, first - pre - int(fps), first + count + int(fps), Wf, Hf, fps, MARKERS[marker])
    ground = Ground(fps)
    past = deque(maxlen=max(max_lag, ECHO_LAGS[0]) + 1)
    cam_x = None
    t0 = time.time()
    written = 0
    fade_frames = int(FADE_S * fps)
    fly_frames = min(count, int(FLY_S * fps))
    grow_total = fly_frames + GROW_FRAMES  # the outro: the last of the dance, then the field alone
    start = None

    # The song's own bar grid: the effects dance on it, and the marker floats
    # once a bar, rising from each downbeat.
    effects = set(filter(None, opts.get("effects", "").split(",")))
    from beats import chapter_grid, freeze_map
    mid = timeline.at(t_from + (t_to - t_from) / 2)
    g_ = chapter_grid(mid, drums=bool(opts.get("show")) or bool(effects & {"hits", "close"}))
    film_start = next(s_["filmStart"] for s_ in align["songs"] if s_["slug"] == mid["slug"])
    bars = (film_start + g_["first"], g_["bar"])
    # The stage at every moment: a show file's cues, or the flags as a show with none.
    one = film_start + g_.get("one", g_["first"])
    show = Show.load(opts["show"], one, g_["bar"]) if opts.get("show") else Show.from_flags(effects, one, g_["bar"])
    show_pals = {h: {k: {k2: rgb(v) for k2, v in p_.items()} for k, p_ in v.items()}
                 for h, v in resolve_palettes(show.fields()).items()}
    if effects or opts.get("show"):
        print(f"  {'show ' + show.name if opts.get('show') else 'effects ' + ','.join(sorted(effects))}"
              f" on a {g_['bar']:.3f}s bar", flush=True)

    # What the effects need, read over the whole stretch before a frame is drawn.
    k0 = first - pre
    tiles = gate = hud = None
    hud_spec = show.hud or (dict(zip(("level", "title"), opts["hud"].split("|", 1))) if opts.get("hud") else None)
    falls = footfalls(poses, k0, first + count, Wf, Hf, fps) if show.uses(floor="tiles") or hud_spec else []
    if show.uses(floor="tiles"):
        floor_y = float(np.median([f[2] for f in falls])) if falls else Hf * 0.9
        tiles = Tiles(falls, body, floor_y, fps, bars[1])
    if hud_spec:
        hud = Hud(Wout, Hout, hud_spec.get("level", ""), hud_spec.get("title") or mid.get("title", ""), falls, first)
    claps = np.array([], int)
    if show.uses(effect="echo"):
        gate = motion_gate(poses, k0, first + count, Wf, Hf, body, fps)
        # The trail cusps on a jump clap, placed on the song's snare when the drums can be heard.
        try:
            from beats import song_of
            from hits import hits_of
            snares_ = np.array(hits_of(*song_of(mid))["snare"]) + film_start
        except SystemExit:
            snares_ = None
        claps = jump_claps(poses, k0, first + count, Wf, Hf, body, fps, win0, snares_)
    closes = []
    if "close" in effects:
        picks = [float(v) for v in opts["close-bars"].split(",")] if opts.get("close-bars") else None
        closes = close_bars(poses, k0, Wf, Hf, fps, body, bars[0], bars[1], t_from, t_to - FLY_S, win0, picks)
    closes += close_spans(poses, k0, Wf, Hf, fps, [(a, b) for a, b, cam in show.camera_spans() if cam == "feet"], win0)
    # Where the set stands: props are placed from where he stands over the piece.
    hips = [float((poses[k][23, 0] + poses[k][24, 0]) / 2 * Wf) for k in range(first, first + count) if k in poses]
    stage_x = float(np.median(hips)) if hips else Wf / 2
    kicks = snares = None
    if show.uses(effect="hits"):
        from beats import song_of
        from hits import hits_of
        h_ = hits_of(*song_of(mid))
        kicks, snares = np.array(h_["kick"]) + film_start, np.array(h_["snare"]) + film_start

    # The source is read forward only. An output frame asks for a source frame
    # at or after the last one read: the same one to hold, later ones to catch
    # up. Everything that follows him (heart, ground, shadow, camera) advances
    # with the source, never with the output.
    source = iter(zip(*streams))
    st = {"k": -1}

    def advance(target: int):
        while st["k"] < target:
            lab_, alp_, *fields_ = next(source)
            raw_ = fields_.pop() if plate else None
            k_ = st["k"] + 1
            lm_ = poses.get(first - pre + k_)
            place_ = track.at(first - pre + k_)
            alpha_ = alp_.astype(np.float32) / 255
            g_s, g_c = ground.update(lm_, Hf, alpha_)
            past.append(alpha_)
            if lm_ is not None and min(lm_[23, 2], lm_[24, 2]) > 0.3:
                x_now = float((lm_[23, 0] + lm_[24, 0]) / 2 * Wf)
            else:
                cols = np.where(alpha_.max(0) > 0.5)[0]
                x_now = float(cols.mean()) if len(cols) else Wf / 2
            cx, sx = st.get("cam_x"), st.get("spot_x")
            st.update(k=k_, lab=lab_, alpha=alpha_, fields=fields_, raw=raw_, place=place_, g=g_s, g_contact=g_c,
                      cam_x=x_now if cx is None else cx + aspect["follow"] * (x_now - cx),
                      spot_x=x_now if sx is None else sx + 0.25 * (x_now - sx))
        return st

    if pre > 0:
        advance(pre - 1)

    for i in range(count):
        t = t_from + i / fps
        stage = show.at(t)
        target = pre + i
        if "freeze" in stage.effects:
            target = pre + int(round((freeze_map(t, bars[0], bars[1]) - t_from) * fps))
        try:
            s_now = advance(max(target, st["k"], 0))
        except StopIteration:
            break
        lab, alpha, place = s_now["lab"], s_now["alpha"], s_now["place"]
        g, g_contact, cam_x = s_now["g"], s_now["g_contact"], s_now["cam_x"]
        if cam_range:
            cam_x = min(max(cam_x, cam_range[0]), cam_range[1])
        ch = timeline.at(t)
        colours = show_pals[stage.field] if stage.field else {k_: {k2: rgb(v) for k2, v in ch[k_].items()}
                                                                for k_ in ("palette", "paletteFlip") if ch.get(k_)}
        key = "palette"
        if "flip" in stage.effects and "paletteFlip" in colours:
            if int(np.floor((t - bars[0]) / bars[1])) % 2 == 1:
                key = "paletteFlip"
        if kicks is not None and "hits" in stage.effects and "paletteFlip" in colours and on_snare(t, kicks, snares):
            key = "paletteFlip"
        pal = colours[key]
        g_src = g if g is not None else Hf * 0.9
        ground_out = aspect["ground"] * Hout
        sc, focus = scale, cam_x
        close = next((c for c in closes if c[0] <= t < c[1]), None)
        if close is not None:
            # The close-up: his feet, the floor low in the frame. The fields are
            # cut at this size, so the edges stay as clean as the wide shot's.
            sc, ground_out = scale * CLOSE_ZOOM, CLOSE_GROUND * Hout
            h2 = Wout / (2 * sc)
            focus = min(max(close[2], h2), Wf - h2) if Wf >= 2 * h2 else close[2]
        A = np.float32([[sc, 0, Wout / 2 - sc * focus], [0, sc, ground_out - sc * g_src]])
        contact_out = A[1, 1] * (g_contact if g_contact is not None else g_src) + A[1, 2]

        # The floor's perspective: a camera at his chest, its vanishing point at
        # the frame's centre on the horizon. The tiles and his shadow share it.
        horizon = ground_out - HORIZON * body * sc

        canvas = np.empty((Hout, Wout, 3), np.float32)
        canvas[:] = pal["field"]
        glossy = tiles is not None and stage.floor == "tiles"
        if stage.light == "spot":
            spotlight(canvas, A[0, 0] * s_now["spot_x"] + A[0, 2], contact_out, body * sc, pal)
        if glossy:
            tiles.draw(canvas, A, A[1, 1] * floor_y + A[1, 2], horizon, k0 + s_now["k"], pal)

        # The set: each prop stands on the floor at its own depth, sized by the
        # floor's perspective; a lamp lights the floor under it.
        placed = []
        for name, px, pz in stage.props:
            depth = TILE * body * sc * FLOOR_SQUASH
            foot_y = ground_out - pz * depth
            kp = (foot_y - horizon) / max(1.0, ground_out - horizon)
            foot_x = Wout / 2 + (A[0, 0] * (stage_x + px * body) + A[0, 2] - Wout / 2) * kp
            polys, light_ = set_props.place(name, foot_x, foot_y, body * sc * kp)
            placed.append((pz, foot_y, polys, set_props.height(polys, foot_y)))
            if light_:
                set_props.light_pool(canvas, foot_x + light_["floor_x"] * body * sc * kp, foot_y,
                                     light_["reach"] * body * sc * kp, pal)

        # The end of the clip: he fades, the badge flies.
        fade = 1.0
        u = None
        if outro:
            left = count - i
            fade = ease(left / max(1, fade_frames))
            if left <= fly_frames:
                u = (fly_frames - left) / (grow_total - 1)

        # 2. his shadow, on the floor the tiles imply: projected through the same
        # perspective, crisp at his soles and softer as it goes. It darkens what
        # is on the floor (a lit tile stays a tile inside it) instead of painting
        # over it.
        mode = opts.get("shadow", ch.get("shadowMode", "sync"))
        lag = int(opts.get("lag", ch.get("shadowLag") or 0)) if mode == "lag" else 0
        src_shadow = past[max(0, len(past) - 1 - lag)] if mode != "none" else None
        # The light decides where shadows fall: a spot from overhead pools them
        # underfoot; on the glossy floor the key comes low from the side.
        lit_by = SPOT_LIGHT if stage.light == "spot" else GLOSS_LIGHT if glossy else None
        light = dict(zip(("squash", "shear"), lit_by)) if lit_by else {}
        dark = 1 - np.clip(pal["shadow"] / np.maximum(pal["field"], 1), 0, 1)
        if src_shadow is not None:
            rows = int(min(Hout, np.ceil(contact_out) + 1))
            figure = cv2.warpAffine(src_shadow, A, (Wout, rows), flags=cv2.INTER_LINEAR, borderValue=0) if rows > 0 else None
            if figure is not None:
                cov, y0 = cast_on_floor(figure, contact_out, horizon, Wout / 2, body * sc, Hout, **light)
                if len(cov):
                    strip = canvas[y0:y0 + len(cov)]
                    strip *= 1 - (cov * SHADOW_OPACITY * fade)[..., None] * dark
        # The props cast theirs in the same light.
        for _, foot_y, polys, tall_ in placed:
            rows_p = int(min(Hout, np.ceil(foot_y) + 1))
            cov_p, (px0, py0) = set_props.coverage(polys, Wout, rows_p)
            if cov_p.size:
                fig_p = np.zeros((rows_p, Wout), np.float32)
                fig_p[py0:py0 + cov_p.shape[0], px0:px0 + cov_p.shape[1]] = cov_p
                cov, y0 = cast_on_floor(fig_p, foot_y, horizon, Wout / 2, tall_, Hout, **light)
                if len(cov):
                    strip = canvas[y0:y0 + len(cov)]
                    strip *= 1 - (cov * SHADOW_OPACITY)[..., None] * dark
        set_props.stand(canvas, placed, pal["ink"], behind=True)

        # 4. the marker, from the moment it lands (placed now, drawn in order)
        badge_from = ch.get("badgeFrom")
        landed = badge_from is None or ch["chapterTime"] >= badge_from
        here = (Wout / 2, Hout / 2, 0.02 * min(Wout, Hout), 0.0, 0.0, 1.0)  # no place yet: it grows from nothing
        if place is not None and landed:
            px_, py_, pw_, pang, pop_ = place
            if badge_from is not None and ch["chapterTime"] < badge_from + POP_S:
                pw_ *= ease((ch["chapterTime"] - badge_from) / POP_S)
            width = pw_ * sc
            x_out, y_out = A[0, 0] * px_ + A[0, 2], A[1, 1] * py_ + A[1, 2]
            if marker == "crown":
                float_ = -BOB * width * np.sin(2 * np.pi * (t - bars[0]) / bars[1])  # up is minus
                here = (x_out, y_out - CROWN_GAP * width - width / 2 + float_, width, 0.0, pop_, 1.0)
            elif marker == "ground":
                here = (x_out, contact_out, width, 360.0 * (t - bars[0]) / (GROUND_TURN_BARS * bars[1]), pop_, GROUND_SQUASH)
            else:
                here = (x_out, y_out, width, pang, pop_, 1.0)
        on_floor = marker == "ground" and u is None and here[4] > 0
        floor_drawn = False

        # Most of the frame is flat field: draw him, his echoes and his
        # reflection only in the region around them (his box, and the floor below it).
        live = alpha > 0.01
        trail = gate is not None and "echo" in stage.effects and gate[s_now["k"]] > 0.02
        lags = echo_lags(float(gate[s_now["k"]]), k0 + s_now["k"], claps, fps) if trail else []
        for lag in lags:
            if 0 < lag < len(past):
                live = live | (past[-1 - lag] > 0.01)
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
            # the glossy floor: his reflection darkens whatever it lies on (the
            # field, a lit tile, his shadow), as a dark figure on lacquer does
            if glossy:
                rel = contact_out - ry0
                ref = cv2.warpAffine(alpha, reflect_matrix(Ar, rel), (rw, rh), flags=cv2.INTER_LINEAR, borderValue=0)
                cov = cut(ref, 0.5) * reflection_fade(rh, rel, body * sc)[:, None] * fade
                view += (pal["ink"] - view) * (cov * REFLECT_MIX)[..., None]
            # his echoes, the oldest first: flat shapes in the palette's own darker tones
            # (ink mixed into the field turns to mud)
            if trail:
                for lag, mix in zip(lags, ECHO_MIX):
                    if 0 < lag < len(past):
                        e_ = cv2.warpAffine(past[-1 - lag], Ar, (rw, rh), flags=cv2.INTER_LINEAR, borderValue=0)
                        cov = cut(e_, 0.5) * fade
                        view += (pal["mid"] + (pal["shadow"] - pal["mid"]) * mix - view) * cov[..., None]
            # the floor marker lies under him
            if on_floor:
                seed(canvas, marks, pal, *here)
                floor_drawn = True
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
                body_rgb, a = paint(fld, tn, pal, look, cuts, soft)
                a = a * fade
            view += (body_rgb - view) * a[..., None]

        set_props.stand(canvas, placed, pal["ink"], behind=False)

        # the game's layer, over the stage and under the growing seal; it fades with him
        if hud is not None:
            hud.draw(canvas, k0 + s_now["k"], i / max(1, count - 1), pal["ink"], fade)

        # 4. (drawn) over him: the crown and the heart; the floor marker if he was not drawn
        if u is None:
            if here[4] > 0 and (not on_floor or not floor_drawn):
                seed(canvas, marks, pal, *here)
        else:
            # 5. the outro: it leaves him as it grows (the place it leaves
            #    still moves with him until he is gone)
            start = here
            grow(canvas, marks, pal, u, start)

        writer.write(np.clip(canvas, 0, 255).astype(np.uint8))
        if plate_writer:
            # the room as the phone saw it, framed by the same camera; past its top edge the wall carries on
            plate_writer.write(cv2.warpAffine(s_now["raw"], A, (Wout, Hout), flags=cv2.INTER_CUBIC,
                                              borderMode=cv2.BORDER_REPLICATE))
        written += 1
        if written % 150 == 0:
            print(f"  {written}/{count} frames, {written / (time.time() - t0):.1f} fps", flush=True)

    # 5. the rest of the growth on the field alone, then the Danceman holds.
    if outro:
        ch = timeline.at(t_to - 1 / fps)
        pal = {key: rgb(v) for key, v in ch["palette"].items()}
        start = start or (Wout / 2, Hout / 2, 0.02 * min(Wout, Hout), 0.0, 0.0, 1.0)
        for j in range(GROW_FRAMES + int(HOLD_S * fps)):
            canvas = np.empty((Hout, Wout, 3), np.float32)
            canvas[:] = pal["field"]
            grow(canvas, marks, pal, min(1.0, (fly_frames + j) / (grow_total - 1)), start)
            writer.write(np.clip(canvas, 0, 255).astype(np.uint8))
            written += 1
    writer.close()
    if plate_writer:
        plate_writer.close()
    for r in streams:
        r.close()
    print(f"{out_path}: {written} frames at {Wout}x{Hout} in {time.time() - t0:.0f}s")
    return out_path


if __name__ == "__main__":
    main(sys.argv[1:])
