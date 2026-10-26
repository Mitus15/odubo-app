"""
Raw vs gloss: the phone's own picture and the gloss, cut down the middle of him.

    python3 split.py <plate.mp4> <gloss.mp4> --out=file.mp4 [--gloss-from=<frame>]

The plate is compose --plate: the phone's picture through the same camera as the
gloss, so the two register to the pixel (render the stretch with the whole
song's --body, then cut the gloss from the whole song's file with --gloss-from,
so the HUD's steps and progress are the whole level's).

The cut follows him: the middle of his ink, smoothed both ways in time, so he
is always half the room and half the level. The phone on the left, read first.
The HUD lies across both halves (it is the level's, not the picture's), and
the sound is the gloss file's.
"""
import subprocess, sys
from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter1d
from take import Reader, Writer
from hud import LINE_GAP, LINE_PX, TOP_PORTRAIT
from cut import mux, sheet

FOLLOW_SIGMA = 5      # frames: the cut keeps with him without trembling at every step
INK_SUM = 180         # r+g+b under this is ink (the palette's ink sits near 70, its mids above 300)
SMALL = 4             # the follow pass reads at a quarter size


def probe(path: str) -> tuple:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-count_frames", "-show_entries",
                          "stream=width,height,r_frame_rate,nb_read_frames", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout.strip().split(",")
    w, h, rate, n = out
    num, den = rate.split("/")
    return int(w), int(h), float(num) / float(den), int(n)


def hud_rows(w: int, h: int) -> int:
    """How far down the HUD reaches (hud.Hud's own geometry, plus a little air)."""
    s = min(w, h) / 1080
    return int(round((TOP_PORTRAIT + LINE_GAP + LINE_PX + 8) * s))


def follow(gloss: str, start: float, n: int, w: int, h: int, fps: float) -> np.ndarray:
    """The middle of his ink in each frame, smoothed both ways: where the cut runs."""
    sw, sh = w // SMALL, h // SMALL
    top = hud_rows(w, h) // SMALL
    xs = np.full(n, np.nan)
    for i, f in enumerate(Reader(gloss, sw, sh, start=start, dur=n / fps)):
        if i >= n:
            break
        ink = f[top:].astype(int).sum(2) < INK_SUM
        cols = np.where(ink.any(0))[0]
        if len(cols):
            xs[i] = float(np.average(np.arange(sw), weights=ink.sum(0))) * SMALL
    seen = ~np.isnan(xs)
    if not seen.any():
        return np.full(n, w / 2)
    xs = np.interp(np.arange(n), np.where(seen)[0], xs[seen])  # where he is not seen, he stays where he was
    return gaussian_filter1d(xs, FOLLOW_SIGMA, mode="nearest")


def main(argv):
    plate, gloss = argv[0], argv[1]
    opts = dict(a[2:].split("=", 1) for a in argv[2:] if a.startswith("--") and "=" in a)
    out = Path(opts["out"])
    w, h, fps, n = probe(plate)
    start = int(opts.get("gloss-from", 0)) / fps
    cx = follow(gloss, start, n, w, h, fps)

    rows = hud_rows(w, h)
    field = ink = None
    silent = out.with_name(f"_{out.stem}.mp4")
    writer = Writer(silent, w, h, fps, kind="h264", crf=17)
    for i, (p, g) in enumerate(zip(Reader(plate, w, h), Reader(gloss, w, h, start=start, dur=n / fps))):
        if i >= n:
            break
        if field is None:
            # the HUD is ink laid on the field: its coverage is how far a pixel went from one toward the other
            band = g[:rows].reshape(-1, 3).astype(np.float32)
            lum = band.sum(1)
            field = np.median(band[lum > np.percentile(lum, 50)], 0)
            ink = np.median(band[lum <= np.percentile(lum, 0.5)], 0)
        x = int(round(cx[i]))
        frame = g.copy()
        frame[:, :x] = p[:, :x]
        top = g[:rows, :x].astype(np.float32)
        a = np.clip(((field - top) / np.maximum(field - ink, 1)).mean(2, keepdims=True), 0, 1)
        frame[:rows, :x] = np.clip(p[:rows, :x] + (ink - p[:rows, :x]) * a, 0, 255).astype(np.uint8)
        writer.write(frame)
    writer.close()

    duration = n / fps
    afilter = (f"[1:a]atrim=start={start:.4f}:duration={duration:.4f},asetpts=PTS-STARTPTS,"
               f"afade=t=in:d=0.012,afade=t=out:st={duration - 0.012:.4f}:d=0.012[aout]")
    mux(silent, [], [], afilter, [["-i", gloss]], out, duration)
    silent.unlink(missing_ok=True)
    print(f"split: {out}\nsheet: {sheet(out)}")


if __name__ == "__main__":
    main(sys.argv[1:])
