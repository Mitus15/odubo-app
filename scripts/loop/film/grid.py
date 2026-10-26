"""
The Warhol grid: one moment of the take, fourteen times, one per chapter.

    npm run film:grid -- <take> --at=<take seconds> [--size=1080|vinyl] [--marker=crown|ground|heart]
    npm run film:grid -- <take> --at=<s> --volume=1|2 [--layout=grid|plus|x] [--size=vinyl]

Loop Soul is two albums on two records (docs/decisions/loop-vinyl.md):
--volume renders one record's cover, only its songs, on a 3 x 3 grid. Vol. 1's
nine songs fill it. Vol. 2's five sit as a plus, the centre and its four sides
(the owner's choice, 2026-09-30); --layout=x (the corners and the centre) is
the alternative. The other squares are sand.

THE VINYL'S COVER (owner, 2026-09-30): the grid is the front of the record;
the face (public/loop/press/cover/) stays the streaming cover, since the
grid's sixteen squares turn to specks at thumbnail size. --size=vinyl renders
the 12 inch jacket at print size (12.375 in plus 1/8 in bleed a side, 300
dpi); check the pressing plant's template before sending.

The album post. The same pose repeated in every chapter's colourway (the
pop-art repeat the whole look is sampled from), the player's marker on each,
his shadow under each; the last two squares are the Danceman and the Loop Soul
wordmark. Colours come from story.json (film:pull), so the grid is the album's
own wheel, or whatever the owner has chosen per chapter.
"""
import json, subprocess, sys
import numpy as np
import cv2
from film_common import REPO, SONGS
from take import Reader, load_take, read_pose, take_dir
from anchor import ANCHORS, SIZES
from shadow import cast
from outro import Marks, build as build_marks
from compose import CROWN_GAP, GROUND_SQUASH, MARKERS, paint, paste, rgb, seed

WORDMARK = REPO / "public/loop/branding/loop-soul.svg"
COLS, ROWS = 4, 4
VINYL = 3788  # px: a 12.375 in jacket and 1/8 in bleed each side, at 300 dpi
VOLUMES = {v: {s["number"] for s in SONGS if s["volume"] == v} for v in (1, 2)}  # each record's songs (songs.json)
LAYOUTS = {  # a record's squares on its 3 x 3 cover, in song order
    9: {"grid": [(r, c) for r in range(3) for c in range(3)]},
    5: {"plus": [(0, 1), (1, 0), (1, 1), (1, 2), (2, 1)], "x": [(0, 0), (0, 2), (1, 1), (2, 0), (2, 2)]},
}


def tile(lab, alpha, lm, pal, size, Wf, Hf, marker="crown", fields=None):
    """One square: the figure fitted, grounded, coloured, badged."""
    ys, xs = np.where(alpha > 0.5)
    canvas = np.empty((size, size, 3), np.float32)
    canvas[:] = rgb(pal["field"])
    if not len(ys):
        return canvas
    body = ys.max() - ys.min()
    scale = 0.6 * size / max(1, body)  # headroom for the marker over his head
    ground = 0.84 * size
    cx = (xs.min() + xs.max()) / 2
    A = np.float32([[scale, 0, size / 2 - scale * cx], [0, scale, ground - scale * ys.max()]])
    a = cv2.warpAffine(alpha, A, (size, size), flags=cv2.INTER_LINEAR)
    sh = cast(a, ground) * 0.9
    canvas += (rgb(pal["shadow"]) - canvas) * sh[..., None]
    colours = {k: rgb(v) for k, v in pal.items()}
    place = ANCHORS[MARKERS[marker]](lm, Wf, Hf) if lm is not None else None
    if place is not None and marker == "ground":
        seed(canvas, MARKS, colours, A[0, 0] * place[0] + A[0, 2], ground, place[2] * SIZES["feet"] * scale, 0.0, 1.0, GROUND_SQUASH)
    if fields is not None:
        # The gloss look, cut at the square's own size (compose.paint): print sharp.
        fld, tn = fields
        Af = A.copy()
        Af[:, 0] *= Wf / fld.shape[1]
        Af[:, 1] *= Hf / fld.shape[0]
        fld, tn = (cv2.warpAffine(x.astype(np.float32) / 255, Af, (size, size), flags=cv2.INTER_CUBIC) for x in (fld, tn))
        body_rgb, cover = paint(fld, tn, colours)
        canvas += (body_rgb - canvas) * cover[..., None]
    else:
        hot = cv2.warpAffine(np.dstack([(lab == 1), (lab == 2), (lab == 3)]).astype(np.float32), A, (size, size))
        w = hot.sum(2, keepdims=True)
        body_rgb = (hot[..., 0:1] * rgb(pal["ink"]) + hot[..., 1:2] * rgb(pal["mid"]) + hot[..., 2:3] * rgb(pal["highlight"])) / np.maximum(w, 1e-6)
        body_rgb = np.where(w > 1e-6, body_rgb, rgb(pal["ink"]))
        canvas += (body_rgb - canvas) * a[..., None]
    if place is not None and marker != "ground":
        hx, hy, hw, hang, seen, facing = place
        if seen and facing:
            width = hw * SIZES[MARKERS[marker]] * scale
            px, py = A[0, 0] * hx + A[0, 2], A[1, 1] * hy + A[1, 2]
            if marker == "crown":
                py -= CROWN_GAP * width + width / 2
            seed(canvas, MARKS, colours, px, py, width, hang if marker == "heart" else 0.0, 1.0)
    return canvas


def main(argv):
    global MARKS
    name = argv[0]
    opts = dict(a[2:].split("=", 1) for a in argv[1:] if a.startswith("--") and "=" in a)
    take, d = load_take(name), take_dir(name)
    fig = json.loads((d / "figure.json").read_text())
    story = json.loads((d / "story.json").read_text())
    size = VINYL if opts.get("size") == "vinyl" else int(opts.get("size", 1080))
    t = float(opts.get("at", (take["window"]["start"] + take["window"]["end"]) / 2))
    k = int(round((t - take["window"]["start"]) * take["fps"]))
    Wf, Hf = fig["w"], fig["h"]
    def one(path):
        r = Reader(path, Wf, Hf, gray=True, start=k / take["fps"], dur=0.05)
        frame = next(iter(r))
        r.close()
        return frame
    lab = one(d / "labels.mkv")
    fields = None
    if fig.get("look") == "gloss":
        def field(name_):
            r = Reader(d / f"{name_}.mkv", fig["fieldW"], fig["fieldH"], gray=True, start=k / take["fps"], dur=0.05)
            f_ = next(iter(r))
            r.close()
            return f_
        fields = (field("field"), field("tone"))
    alpha = one(d / "alpha.mkv").astype(np.float32) / 255
    lm = read_pose(d / "pose.jsonl").get(k)
    marks = build_marks()
    MARKS = Marks(marks)
    dancer = cv2.imread(str(marks / "danceman.png"), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255

    chapters = sorted(story["chapters"], key=lambda c: c["number"])
    sand = chapters[0]["palette"]
    marker = opts.get("marker", "crown")
    if "volume" in opts:
        vol = int(opts["volume"])
        songs = [c for c in chapters if c["number"] in VOLUMES[vol]]
        layouts = LAYOUTS[len(songs)]
        layout = opts.get("layout", next(iter(layouts)))
        ts = size // 3
        sheet = np.empty((ts * 3, ts * 3, 3), np.float32)
        sheet[:] = rgb(sand["field"])
        for ch, (r, c) in zip(songs, layouts[layout]):
            sheet[r * ts:(r + 1) * ts, c * ts:(c + 1) * ts] = tile(lab, alpha, lm, ch["palette"], ts, Wf, Hf, marker, fields)
        out = d / "out"
        out.mkdir(exist_ok=True)
        dest = out / f"cover-vol{vol}-{layout}-{t:.1f}.png"
        cv2.imwrite(str(dest), cv2.cvtColor(np.clip(sheet, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR))
        print(f"cover: {dest}")
        return dest

    ts = size // COLS
    sheet = np.zeros((ts * ROWS, ts * COLS, 3), np.float32)
    for i, ch in enumerate(chapters):
        r, c = divmod(i, COLS)
        sheet[r * ts:(r + 1) * ts, c * ts:(c + 1) * ts] = tile(lab, alpha, lm, ch["palette"], ts, Wf, Hf, marker, fields)
    # The credit squares: the Danceman, and the name.
    r, c = divmod(len(chapters), COLS)
    sq = np.empty((ts, ts, 3), np.float32)
    sq[:] = rgb(sand["field"])
    paste(sq, cv2.resize(dancer, (int(ts * 0.6), int(ts * 0.6)), interpolation=cv2.INTER_AREA), rgb(sand["ink"]), ts / 2, ts / 2)
    sheet[r * ts:(r + 1) * ts, c * ts:(c + 1) * ts] = sq
    png = subprocess.run(["rsvg-convert", "-w", str(int(ts * 0.7)), str(WORDMARK)], capture_output=True, check=True).stdout
    wm = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_UNCHANGED)
    cover = wm[..., 3].astype(np.float32) / 255 if wm.ndim == 3 and wm.shape[2] == 4 else 1 - cv2.cvtColor(wm, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    r, c = divmod(len(chapters) + 1, COLS)
    sq = np.empty((ts, ts, 3), np.float32)
    sq[:] = rgb(sand["field"])
    ph, pw = cover.shape
    canvas_cover = np.zeros((ts, ts), np.float32)
    y0, x0 = (ts - ph) // 2, (ts - pw) // 2
    canvas_cover[y0:y0 + ph, x0:x0 + pw] = cover
    paste(sq, canvas_cover, rgb(sand["ink"]), ts / 2, ts / 2)
    sheet[r * ts:(r + 1) * ts, c * ts:(c + 1) * ts] = sq
    out = d / "out"
    out.mkdir(exist_ok=True)
    dest = out / f"grid-{t:.1f}.png"
    cv2.imwrite(str(dest), cv2.cvtColor(np.clip(sheet, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR))
    print(f"grid: {dest}")
    return dest


if __name__ == "__main__":
    main(sys.argv[1:])
