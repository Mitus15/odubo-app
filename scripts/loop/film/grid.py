"""
The Warhol grid: one moment of the take, fourteen times, one per chapter.

    npm run film:grid -- <take> --at=<take seconds> [--size=1080]

The album post. The same pose repeated in every chapter's colourway (the
pop-art repeat the whole look is sampled from), the badge on his heart in each,
his shadow under each; the last two squares are the Danceman and the Loop Soul
wordmark. Colours come from story.json (film:pull), so the grid is the album's
own wheel, or whatever the owner has chosen per chapter.
"""
import json, subprocess, sys
import numpy as np
import cv2
from film_common import REPO
from take import Reader, load_take, read_pose, take_dir
from anchor import heart as heart_of
from shadow import cast
from outro import build as build_marks
from compose import keyline, mark, paste, rgb

WORDMARK = REPO / "public/loop/branding/loop-soul.svg"
COLS, ROWS = 4, 4


def tile(lab, alpha, lm, pal, size, Wf, Hf):
    """One square: the figure fitted, grounded, coloured, badged."""
    ys, xs = np.where(alpha > 0.5)
    canvas = np.empty((size, size, 3), np.float32)
    canvas[:] = rgb(pal["field"])
    if not len(ys):
        return canvas
    body = ys.max() - ys.min()
    scale = 0.7 * size / max(1, body)
    ground = 0.8 * size
    cx = (xs.min() + xs.max()) / 2
    A = np.float32([[scale, 0, size / 2 - scale * cx], [0, scale, ground - scale * ys.max()]])
    a = cv2.warpAffine(alpha, A, (size, size), flags=cv2.INTER_LINEAR)
    sh = cast(a, ground) * 0.9
    canvas += (rgb(pal["shadow"]) - canvas) * sh[..., None]
    hot = cv2.warpAffine(np.dstack([(lab == 1), (lab == 2), (lab == 3)]).astype(np.float32), A, (size, size))
    w = hot.sum(2, keepdims=True)
    body_rgb = (hot[..., 0:1] * rgb(pal["ink"]) + hot[..., 1:2] * rgb(pal["mid"]) + hot[..., 2:3] * rgb(pal["highlight"])) / np.maximum(w, 1e-6)
    body_rgb = np.where(w > 1e-6, body_rgb, rgb(pal["ink"]))
    canvas += (body_rgb - canvas) * a[..., None]
    if lm is not None:
        hx, hy, hw, hang, seen, facing = heart_of(lm, Wf, Hf)
        if seen and facing:
            px, py = A[0, 0] * hx + A[0, 2], A[1, 1] * hy + A[1, 2]
            cover = mark(SEAL, hw * 0.26 * scale, hang)
            edge, _ = keyline(cover, max(1, int(round(cover.shape[0] * 0.05))))
            paste(canvas, edge, rgb(pal["ink"]), px, py)
            paste(canvas, cover, rgb(pal["badge"]), px, py)
    return canvas


def main(argv):
    global SEAL
    name = argv[0]
    opts = dict(a[2:].split("=", 1) for a in argv[1:] if a.startswith("--") and "=" in a)
    take, d = load_take(name), take_dir(name)
    fig = json.loads((d / "figure.json").read_text())
    story = json.loads((d / "story.json").read_text())
    size = int(opts.get("size", 1080))
    t = float(opts.get("at", (take["window"]["start"] + take["window"]["end"]) / 2))
    k = int(round((t - take["window"]["start"]) * take["fps"]))
    Wf, Hf = fig["w"], fig["h"]
    def one(path):
        r = Reader(path, Wf, Hf, gray=True, start=k / take["fps"], dur=0.05)
        frame = next(iter(r))
        r.close()
        return frame
    lab = one(d / "labels.mkv")
    alpha = one(d / "alpha.mkv").astype(np.float32) / 255
    lm = read_pose(d / "pose.jsonl").get(k)
    marks = build_marks()
    SEAL = cv2.imread(str(marks / "seal.png"), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
    dancer = cv2.imread(str(marks / "danceman.png"), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255

    ts = size // COLS
    sheet = np.zeros((ts * ROWS, ts * COLS, 3), np.float32)
    chapters = sorted(story["chapters"], key=lambda c: c["number"])
    sand = chapters[0]["palette"]
    for i, ch in enumerate(chapters):
        r, c = divmod(i, COLS)
        pal = ch["palette"]
        if fig.get("look") == "gloss":
            pal = {**pal, "mid": pal["field"]}  # the cover's ring is the ground's own colour (compose.py)
        sheet[r * ts:(r + 1) * ts, c * ts:(c + 1) * ts] = tile(lab, alpha, lm, pal, ts, Wf, Hf)
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
