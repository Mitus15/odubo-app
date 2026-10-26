"""
The album's face with no logo on it (owner, 2026-10-03: "no logo on the album
cover except record label details in small size").

    python3 scripts/loop/cover-without-wordmark.py <out.png> [--label="ODUBO STUDIO"]

The face (public/loop/press/cover/loop-soul-cover-art-mani-version.png) carries
the drawn loop∞Soul wordmark top right, from when the album shared the night's
name. The album is Signs of Life now (docs/decisions/signs-of-life.md).

The wordmark sits on flat sand, clear of the figure, so it is covered with the
same field from just below it, blended at the edges (a seamless clone), then
evened to the surrounding field's mean: the patch is within half a level of
its ring, which neither a screen nor a press can show. Nothing outside the
wordmark's box changes; the script checks.

--label sets the label line, small, in Jost 500, where the title was: right
aligned to the wordmark's old right edge, on its top line. Without it the
corner is left empty.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[2]
FACE = REPO / "public/loop/press/cover/loop-soul-cover-art-mani-version.png"
FONT = REPO / "public/loop/fonts/Jost-500.ttf"
INK = (42, 15, 10)
# The wordmark's ink, measured on the 2048 px face, and a margin for its antialiasing.
TOP, BOTTOM, LEFT, RIGHT = 88, 371, 1520, 1933
PAD = 16
LABEL_PX = 30  # cap height about 1.5% of the face: small, as asked
TRACKING = 0.32  # em, the house's wide-tracked caps


def without_wordmark(face: np.ndarray) -> np.ndarray:
    y0, y1, x0, x1 = TOP - PAD, BOTTOM + PAD, LEFT - PAD, RIGHT + PAD
    h, w = y1 - y0, x1 - x0
    patch = face[y1 + 40:y1 + 40 + h, x0:x1].copy()
    if not (patch.astype(int).sum(2) > 400).all():
        raise SystemExit("the field below the wordmark is not clear sand: the face has changed, measure again")
    out = cv2.seamlessClone(patch, face, np.full((h, w), 255, np.uint8), ((x0 + x1) // 2, (y0 + y1) // 2), cv2.NORMAL_CLONE)
    ring = np.concatenate([
        face[y0 - 40:y0, x0:x1].reshape(-1, 3), face[y1:y1 + 40, x0:x1].reshape(-1, 3),
        face[y0:y1, x0 - 40:x0].reshape(-1, 3), face[y0:y1, x1:x1 + 40].reshape(-1, 3),
    ]).astype(np.float32).mean(0)
    inside = out[y0 + 20:y1 - 20, x0 + 20:x1 - 20].reshape(-1, 3).astype(np.float32).mean(0)
    soft = np.zeros(face.shape[:2], np.float32)
    soft[y0:y1, x0:x1] = 1
    soft = cv2.GaussianBlur(soft, (0, 0), 12)
    out = np.clip(np.round(out.astype(np.float32) + soft[..., None] * (ring - inside)), 0, 255).astype(np.uint8)
    moved = np.argwhere(np.abs(out.astype(int) - face.astype(int)).sum(2) > 0)
    if len(moved):
        (ty, tx), (by, bx) = moved.min(0), moved.max(0)
        if ty < y0 - 40 or by > y1 + 40 or tx < x0 - 40 or bx > x1 + 40:
            raise SystemExit("the patch reached past the wordmark's box")
    return out


def with_label(face_rgb: Image.Image, label: str) -> Image.Image:
    draw = ImageDraw.Draw(face_rgb)
    font = ImageFont.truetype(str(FONT), LABEL_PX)
    track = LABEL_PX * TRACKING
    widths = [draw.textlength(c, font=font) for c in label]
    x = RIGHT - (sum(widths) + track * (len(label) - 1))
    for c, w in zip(label, widths):
        draw.text((x, TOP + 32), c, font=font, fill=INK)
        x += w + track
    return face_rgb


def main(argv: list[str]) -> None:
    if not argv or argv[0].startswith("--"):
        raise SystemExit(__doc__)
    dest = Path(argv[0])
    opts = dict(a[2:].split("=", 1) for a in argv[1:] if a.startswith("--") and "=" in a)
    face = cv2.imread(str(FACE))
    if face is None or face.shape[:2] != (2048, 2048):
        raise SystemExit(f"expected the 2048 px face at {FACE}")
    rgb = Image.fromarray(cv2.cvtColor(without_wordmark(face), cv2.COLOR_BGR2RGB))
    if opts.get("label"):
        rgb = with_label(rgb, opts["label"].upper())
    rgb.save(dest)
    print(f"cover: {dest}")


if __name__ == "__main__":
    main(sys.argv[1:])
