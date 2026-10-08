import sys, tempfile, unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hud import Hud  # noqa: E402
from split import follow, hud_rows  # noqa: E402
from take import Writer  # noqa: E402

W, H, FPS = 216, 384, 30.0
FIELD, INK = np.array([245, 147, 166], np.float32), np.array([42, 15, 10], np.float32)


class RawVsGloss(unittest.TestCase):
    def test_the_hud_band_holds_the_whole_hud(self):
        c = np.empty((1920, 1080, 3), np.float32)
        c[:] = FIELD
        Hud(1080, 1920, "1-1", "Billie Jean", [(10, 0, 0, "left")], k_start=0).draw(c, 20, 1.0, INK)
        ys = np.where(np.abs(c - FIELD).sum(2) > 1)[0]
        self.assertLess(ys.max(), hud_rows(1080, 1920))
        self.assertLess(hud_rows(1080, 1920), 0.2 * 1920)  # and stops above his head

    def test_the_cut_follows_him_without_trembling(self):
        # him: an ink bar walking right with a one-frame jitter on every step
        n = 40
        xs = [60 + 2 * i + (6 if i % 2 else -6) for i in range(n)]
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "gloss.mp4"
            w = Writer(path, W, H, FPS, kind="h264", crf=10)
            for x in xs:
                f = np.empty((H, W, 3), np.uint8)
                f[:] = FIELD
                f[150:330, x - 10:x + 10] = INK
                w.write(f)
            w.close()
            cut = follow(str(path), 0.0, n, W, H, FPS)
        walk = np.array([60 + 2 * i for i in range(n)], float)
        inner = slice(8, n - 8)  # away from the ends, where the smoothing has both sides
        self.assertLess(np.abs(cut[inner] - walk[inner]).max(), 4)   # on him
        self.assertLess(np.abs(np.diff(cut[inner])).max(), 3.5)       # the jitter is gone


if __name__ == "__main__":
    unittest.main()
