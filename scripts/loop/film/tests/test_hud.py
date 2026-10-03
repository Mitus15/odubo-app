import sys, unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hud import Hud  # noqa: E402

W, H = 1080, 1920
FIELD, INK = np.array([245, 147, 166], np.float32), np.array([42, 15, 10], np.float32)
FALLS = [(110, 0, 0, "left"), (130, 0, 0, "right"), (150, 0, 0, "left"), (90, 0, 0, "left")]


def frame():
    c = np.empty((H, W, 3), np.float32)
    c[:] = FIELD
    return c


class HudLayer(unittest.TestCase):
    def setUp(self):
        self.hud = Hud(W, H, "1-1", "Billie Jean", FALLS, k_start=100)

    def drawn(self, k=140, progress=0.5, opacity=1.0):
        c = frame()
        self.hud.draw(c, k, progress, INK, opacity)
        return np.abs(c - FIELD).sum(2) > 1

    def test_it_keeps_out_of_the_platforms_furniture(self):
        ys, xs = np.where(self.drawn())
        self.assertGreater(ys.min(), 200)           # under a Reel's top bar
        self.assertLess(ys.max(), 0.25 * H)         # nowhere near the caption or the side buttons
        self.assertGreaterEqual(xs.min(), 60)
        self.assertLessEqual(xs.max(), W - 60)

    def test_steps_are_his_footfalls_since_the_piece_began(self):
        self.assertEqual(self.hud.steps, [110, 130, 150])  # the one before the piece is not his to count
        self.assertEqual(int(np.searchsorted(self.hud.steps, 140, side="right")), 2)

    def test_it_fades_with_him(self):
        self.assertFalse(self.drawn(opacity=0.0).any())

    def test_the_line_runs_with_the_piece(self):
        early, late = self.drawn(progress=0.1), self.drawn(progress=0.9)
        y = int(round(self.hud.top + 104))
        dark = lambda m: m[y].sum()  # noqa: E731
        c1, c2 = frame(), frame()
        self.hud.draw(c1, 140, 0.1, INK)
        self.hud.draw(c2, 140, 0.9, INK)
        self.assertLess(c2[y, W // 2].sum(), c1[y, W // 2].sum())  # the middle of the line is run at 90%, not at 10%
        self.assertEqual(dark(early), dark(late))  # the faint line is the same length either way


if __name__ == "__main__":
    unittest.main()
