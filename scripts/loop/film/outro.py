"""
The badge and the brand credit.

    npm run film:outro        # builds the cache once; compose reads it

Two marks, from their vector files:
  the seal      public/brand-logos/odubo-icon.svg: the quatrefoil, the badge on
                his heart
  the Danceman  public/brand-logos/odubo-brand/odubo-mark.svg: the house mark

The badge is a mustard seed on his heart, "the least of all seeds". At the
end of every clip it grows, "the greatest", into the Danceman: the brand
that made this, and the door into the world. The growth is one continuous
motion (compose.py), and the shape change is built from signed distance
fields (each mark as a map of distance to its outline, blended, cut at
zero), which melts one shape into the other without either mark needing
matching points or parts.

`Marks` keeps both fields in a pyramid of sizes, so a mark of any width is
cut from a level at most twice its size: sharp at 20 px and at 600 px,
never aliased, and the ink keyline is the same field pushed outward.

Writes $FILM_WORK/cache/marks/: seal.png, danceman.png, morph/000..044.png
(grey = coverage), and a manifest so it rebuilds only when a mark changes.
"""
import subprocess, sys
import numpy as np
import cv2
from scipy.ndimage import distance_transform_edt
from film_common import REPO, done, fingerprint, fresh, work

SEAL = REPO / "public/brand-logos/odubo-icon.svg"
DANCEMAN = REPO / "public/brand-logos/odubo-brand/odubo-mark.svg"
SIZE, FILL, FRAMES = 1024, 0.82, 45
KEYLINE = 0.05  # the ink edge around the seed, as a share of its width (at least a pixel)


def raster(svg, size: int) -> np.ndarray:
    """Coverage (0..1) of a mark, fitted inside a size x size square, centred."""
    png = subprocess.run(["rsvg-convert", "-h", str(size), str(svg)], capture_output=True, check=True).stdout
    img = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_UNCHANGED)
    if img.ndim == 3 and img.shape[2] == 4:
        cov = img[..., 3].astype(np.float32) / 255
    else:
        g = img if img.ndim == 2 else cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        cov = 1 - g.astype(np.float32) / 255
    ys, xs = np.where(cov > 0.5)
    cov = cov[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = cov.shape
    k = FILL * size / max(h, w)
    cov = cv2.resize(cov, (max(1, round(w * k)), max(1, round(h * k))), interpolation=cv2.INTER_AREA)
    out = np.zeros((size, size), np.float32)
    y0, x0 = (size - cov.shape[0]) // 2, (size - cov.shape[1]) // 2
    out[y0:y0 + cov.shape[0], x0:x0 + cov.shape[1]] = cov
    return out


def sdf(cov: np.ndarray) -> np.ndarray:
    inside = cov > 0.5
    return distance_transform_edt(~inside) - distance_transform_edt(inside)


def ease(t: float) -> float:
    return t * t * (3 - 2 * t)


def morph_frames(a: np.ndarray, b: np.ndarray, n: int = FRAMES):
    da, db = sdf(a), sdf(b)
    for i in range(n):
        e = ease(i / (n - 1))
        d = (1 - e) * da + e * db
        yield np.clip(0.5 - d, 0, 1)


class Marks:
    """The seal growing into the Danceman, at any size and any stage."""

    def __init__(self, marks_dir=None):
        d = marks_dir or build()
        seal = cv2.imread(str(d / "seal.png"), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
        man = cv2.imread(str(d / "danceman.png"), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
        ds, dm = sdf(seal).astype(np.float32), sdf(man).astype(np.float32)
        self.levels = []
        size = SIZE
        while size >= 16:
            k = SIZE / size
            if k == 1:
                self.levels.append((size, ds, dm))
            else:
                self.levels.append((size, cv2.resize(ds, (size, size), interpolation=cv2.INTER_AREA) / k,
                                    cv2.resize(dm, (size, size), interpolation=cv2.INTER_AREA) / k))
            size //= 2

    def cover(self, width: float, grown: float = 0.0, out_px: float = 0.0):
        """
        Coverage (0..1) of the mark `grown` of the way from the seal (0) to
        the Danceman (1), for drawing `width` px across; `out_px` pushes its
        outline out by that many of those pixels (the keyline). Returns the
        coverage and its size (a square).
        """
        size, ds, dm = next((lv for lv in reversed(self.levels) if lv[0] >= width), self.levels[0])
        d = ds if grown <= 0 else dm if grown >= 1 else (1 - grown) * ds + grown * dm
        if out_px:
            d = d - out_px * size / max(width, 1e-3)
        return np.clip(0.5 - d, 0, 1), size


def build(force: bool = False):
    out = work("cache", "marks")
    key = fingerprint(SEAL, DANCEMAN, SIZE, FILL, FRAMES)
    manifest = out / "manifest.json"
    if not force and fresh(manifest, key):
        return out
    seal, man = raster(SEAL, SIZE), raster(DANCEMAN, SIZE)
    cv2.imwrite(str(out / "seal.png"), (seal * 255).astype(np.uint8))
    cv2.imwrite(str(out / "danceman.png"), (man * 255).astype(np.uint8))
    (out / "morph").mkdir(exist_ok=True)
    for i, f in enumerate(morph_frames(seal, man)):
        cv2.imwrite(str(out / "morph" / f"{i:03d}.png"), (f * 255).astype(np.uint8))
    done(manifest, key, frames=FRAMES, size=SIZE)
    return out


if __name__ == "__main__":
    d = build(force="--force" in sys.argv)
    print(f"marks and morph: {d}")
