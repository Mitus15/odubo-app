import sys, unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from outro import Marks  # noqa: E402
from compose import grow, stamp  # noqa: E402

MARKS = Marks()
PAL = {k: np.array(v, np.float32) for k, v in
       {"field": (205, 178, 93), "ink": (42, 15, 10), "badge": (240, 211, 173)}.items()}


def centroid(img):
    ys, xs = np.mgrid[0:img.shape[0], 0:img.shape[1]]
    w = img.sum()
    return (xs * img).sum() / w, (ys * img).sum() / w


class Stamp(unittest.TestCase):
    def test_moves_by_less_than_a_pixel(self):
        cov, size = MARKS.cover(24)
        a = np.zeros((80, 80, 1), np.float32)
        b = np.zeros((80, 80, 1), np.float32)
        stamp(a, cov, size, np.float32([1]), 40.0, 40.0, 24)
        stamp(b, cov, size, np.float32([1]), 40.3, 40.0, 24)
        (ax, ay), (bx, by) = centroid(a[..., 0]), centroid(b[..., 0])
        self.assertAlmostEqual(bx - ax, 0.3, delta=0.05)
        self.assertAlmostEqual(by - ay, 0.0, delta=0.05)

    def test_is_as_wide_as_asked_at_any_size(self):
        for width in (18, 40, 300):
            cov, size = MARKS.cover(width)
            self.assertLessEqual(width, size)
            self.assertLess(size, 2 * width + 1)


class Growth(unittest.TestCase):
    def frame(self, u, start=(300.0, 700.0, 20.0, 10.0, 1.0)):
        c = np.empty((1920, 1080, 3), np.float32)
        c[:] = PAL["field"]
        grow(c, MARKS, PAL, u, start)
        return np.abs(c - PAL["field"]).sum(2) > 40

    def test_starts_as_the_seed_on_his_heart_and_ends_as_the_credit(self):
        first, last = self.frame(0.0), self.frame(1.0)
        ys, xs = np.where(first)
        self.assertLess(abs(xs.mean() - 300), 3)
        self.assertLess(xs.max() - xs.min(), 30)
        ys, xs = np.where(last)
        self.assertLess(abs(xs.mean() - 540), 40)
        self.assertGreater(xs.max() - xs.min(), 150)

    def test_never_fades_into_the_field(self):
        # Every stage of the growth keeps a hard, dark edge: the darkest
        # painted pixel stays ink, never a dull middle tone.
        for u in np.linspace(0, 1, 13):
            c = np.empty((1920, 1080, 3), np.float32)
            c[:] = PAL["field"]
            grow(c, MARKS, PAL, float(u), (300.0, 700.0, 20.0, 10.0, 1.0))
            self.assertLess(c.sum(2).min(), PAL["ink"].sum() + 10, u)

    def test_grows_steadily_never_all_at_once(self):
        areas = [self.frame(u).sum() for u in np.linspace(0, 1, 25)]
        ratios = [b / a for a, b in zip(areas, areas[1:])]
        self.assertTrue(all(r > 0.95 for r in ratios))   # never shrinks back
        self.assertLess(max(ratios), 1.6)                 # never jumps


if __name__ == "__main__":
    unittest.main()
