import sys, unittest
from pathlib import Path
import numpy as np
import cv2
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from figure import GLOSS_CUTS, GlossStyler  # noqa: E402
from compose import cut, melt  # noqa: E402

FW, FH = 640, 360


def figure_frame(light_at=(320, 150)):
    """A dark ellipse of a body on a white wall, one lit spot on it."""
    mask = np.zeros((FH, FW), np.uint8)
    cv2.ellipse(mask, (320, 180), (70, 150), 0, 0, 360, 255, -1)
    rgb = np.full((FH, FW, 3), 235, np.uint8)
    body = np.full((FH, FW), 40, np.float32)
    yy, xx = np.mgrid[0:FH, 0:FW]
    body += 120 * np.exp(-((xx - light_at[0]) ** 2 + (yy - light_at[1]) ** 2) / (2 * 18 ** 2))
    rgb[mask > 0] = np.clip(body[mask > 0], 0, 255)[:, None].astype(np.uint8)
    return rgb, mask


class Gloss(unittest.TestCase):
    def setUp(self):
        self.rgb, self.mask = figure_frame()
        self.style = GlossStyler(FW * 2, FH * 2, FW, FH)
        self.labels, self.alpha, field, tone = self.style(self.rgb, self.mask)
        self.field, self.tone = field / 255, tone / 255

    def test_the_outline_follows_the_mask(self):
        inside = self.mask > 0
        agree = ((self.field >= 0.5) == inside).mean()
        self.assertGreater(agree, 0.995)

    def test_the_light_is_where_the_light_was(self):
        y, x = np.unravel_index(np.argmax(self.tone), self.tone.shape)
        self.assertLess(abs(x - 320), 12)
        self.assertLess(abs(y - 150), 12)

    def test_the_core_sits_inside_its_ring(self):
        ring = self.tone > GLOSS_CUTS[0]
        core = self.tone > GLOSS_CUTS[1]
        self.assertTrue(core.any())
        self.assertTrue((ring | ~core).all())
        self.assertGreater(ring.sum(), core.sum())

    def test_an_ink_rim_holds_the_outline(self):
        solid = (self.field >= 0.5).astype(np.uint8)
        edge = solid & ~cv2.erode(solid, np.ones((3, 3), np.uint8)).astype(bool)
        self.assertLess(self.tone[edge.astype(bool)].max(), GLOSS_CUTS[0])

    def test_labels_agree_with_the_fields(self):
        self.assertEqual(self.labels.shape, (FH * 2, FW * 2))
        self.assertTrue((self.labels == 3).any())


class Cut(unittest.TestCase):
    def test_a_cut_is_crisp_and_anti_aliased(self):
        ramp = np.tile(np.linspace(0, 1, 101, dtype=np.float32), (4, 1))
        a = cut(ramp, 0.5)
        soft = ((a > 0.02) & (a < 0.98)).sum(1)
        self.assertTrue((soft <= 2).all())
        self.assertAlmostEqual(float(a[0, 50]), 0.5, delta=0.01)

    def test_melt_is_soft_on_both_sides(self):
        self.assertAlmostEqual(float(melt(np.float32(0.75), 0.75, 0.08)), 0.5, delta=1e-6)
        self.assertEqual(float(melt(np.float32(0.6), 0.75, 0.08)), 0.0)
        self.assertEqual(float(melt(np.float32(0.9), 0.75, 0.08)), 1.0)


if __name__ == "__main__":
    unittest.main()
