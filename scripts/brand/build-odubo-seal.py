"""Build the house seal, the quatrefoil, as a vector from the one correct drawing.

    python3 scripts/brand/build-odubo-seal.py

The seal is closed: indented at the top and the bottom (and at the sides),
with the four-pointed star in the middle. The only file that draws it that
way is public/brand-logos/odubo-logo.png (612 x 601). Every vector version
found (the old odubo-icon.svg, and the "BAAD Icon" SVGs on the owner's drive)
has a point on top, which is the old drawing (owner, 2026-09-29).

So this traces the PNG. The drawing is mirror-symmetric left to right and top
to bottom to 99.4% (the rest is raster noise), so it is averaged with its
mirrors first: the seal comes out exactly symmetric. Then it is upsampled,
smoothed a little, cut at the edge and traced to polygons fine enough to hold
the star's points and the leaves' tips at any size.

Writes public/brand-logos/odubo-brand/odubo-seal.svg, normalised to 1200 on
the long side with the fill on the root <svg> (like odubo-mark.svg), so it
recolours. Referenced through src/lib/brand/marks.ts (ODUBO_SEAL).
"""
import os
import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(ROOT, "public/brand-logos/odubo-logo.png")
OUT = os.path.join(ROOT, "public/brand-logos/odubo-brand/odubo-seal.svg")
UP = 4            # trace at four times the drawing's size
SMOOTH = 1.2      # the raster's stair-steps, smoothed away (sigma, px at trace size)
TOLERANCE = 0.6   # the polygon may leave the edge by this much (px at trace size)
FILL = "#843c2d"  # the house oxblood
LONG = 1200


def coverage(path: str) -> np.ndarray:
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im.ndim == 3 and im.shape[2] == 4:
        a = im[..., 3].astype(np.float32) / 255
    else:
        g = im if im.ndim == 2 else cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        a = 1 - g.astype(np.float32) / 255
    ys, xs = np.where(a > 0.5)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def main():
    a = coverage(SOURCE)
    a = (a + a[:, ::-1] + a[::-1, :] + a[::-1, ::-1]) / 4  # exactly symmetric
    h, w = a.shape
    pad = 4
    big = cv2.resize(np.pad(a, pad), ((w + 2 * pad) * UP, (h + 2 * pad) * UP), interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), SMOOTH)
    solid = (big >= 0.5).astype(np.uint8)
    contours, _ = cv2.findContours(solid, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    k = LONG / (max(w, h) * UP)
    W, H = round(w * UP * k, 2), round(h * UP * k, 2)
    parts = []
    for c in contours:
        if cv2.contourArea(c) < 50:
            continue
        poly = cv2.approxPolyDP(c, TOLERANCE, True)[:, 0, :].astype(np.float64)
        # Pixel centres to edges, the padding off, into the 1200 space.
        pts = (poly + 0.5 - pad * UP) * k
        parts.append("M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in pts) + " Z")
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:g} {H:g}" fill="{FILL}">\n'
           f'  <title>Odubo Studio seal</title>\n'
           f'  <!-- The house seal: closed, indented top and bottom, the star in the middle. Traced from '
           f'odubo-logo.png and made exactly symmetric by scripts/brand/build-odubo-seal.py; rebuild, never edit. -->\n'
           f'  <path fill-rule="evenodd" d="{" ".join(parts)}"/>\n'
           f'</svg>\n')
    with open(OUT, "w") as f:
        f.write(svg)
    print(f"{OUT}: {len(parts)} outlines, {sum(p.count('L') + 1 for p in parts)} points, viewBox {W:g} x {H:g}")


if __name__ == "__main__":
    main()
