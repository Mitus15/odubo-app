import sys, unittest
from pathlib import Path
import numpy as np
import cv2
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from figure import GLOSS_CUTS, GlossStyler, arm_zone, head_quiet  # noqa: E402
from skin import tiles  # noqa: E402
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


def pose_for(neck=(320, 80), shoulder=60, hips=(320, 260)):
    """A standing pose in normalised coordinates: face over the neck, shoulders level."""
    lm = np.zeros((33, 3), np.float32)
    pts = {0: (neck[0], neck[1] - 45), 11: (neck[0] + shoulder / 2, neck[1]), 12: (neck[0] - shoulder / 2, neck[1]),
           23: (hips[0] + 25, hips[1]), 24: (hips[0] - 25, hips[1])}
    for k, (x, y) in pts.items():
        lm[k] = (x / FW, y / FH, 0.9)
    return lm


class Head(unittest.TestCase):
    def test_light_under_his_head_is_kept_ink(self):
        # A bright print across the top of his back, just under the head: it
        # read as a hole and he looked headless (the Billie Jean take).
        rgb, mask = figure_frame(light_at=(320, 95))
        lit = GlossStyler(FW, FH, FW, FH)(rgb, mask)[3] / 255
        quiet = GlossStyler(FW, FH, FW, FH)(rgb, mask, pose_for())[3] / 255
        self.assertGreater(lit[95, 320], GLOSS_CUTS[1])
        self.assertLess(quiet[95, 320], 0.05)

    def test_light_lower_on_him_still_shows(self):
        rgb, mask = figure_frame(light_at=(320, 230))
        quiet = GlossStyler(FW, FH, FW, FH)(rgb, mask, pose_for())[3] / 255
        self.assertGreater(quiet[230, 320], GLOSS_CUTS[1])

    def test_no_shoulders_no_change(self):
        lm = pose_for()
        lm[11, 2] = lm[12, 2] = 0.1
        self.assertTrue((head_quiet(lm, FW, FH) == 1).all())


def arms_pose():
    """A pose with a man's proportions (shoulders 110 across, torso 180 long), the right forearm held across
    his chest at y=200 and the left arm hanging outside him."""
    lm = pose_for(shoulder=110)
    for k, (x, y) in {13: (360, 200), 15: (290, 200), 17: (276, 196), 19: (274, 200), 21: (278, 206),
                      14: (240, 160), 16: (230, 240), 18: (228, 252), 20: (230, 254), 22: (234, 250)}.items():
        lm[k] = (x / FW, y / FH, 0.9)
    return lm


def forearm_skin(x0=280, x1=365, y=200, half=9):
    """Bare skin of a forearm and hand across his chest, 0..255."""
    sk = np.zeros((FH, FW), np.uint8)
    sk[y - half:y + half, x0:x1] = 255
    return sk


class Arms(unittest.TestCase):
    """An arm across him is ink on ink: the figure draws its edge (the owner, 2026-10-19)."""

    def setUp(self):
        self.rgb, self.mask = figure_frame(light_at=(600, 20))  # no light on him: only the line can show

    def tone(self, skin, lm=None):
        return GlossStyler(FW, FH, FW, FH)(self.rgb, self.mask, arms_pose() if lm is None else lm, skin)[3] / 255

    def test_an_arm_across_him_gets_a_line_in_the_rings_colour(self):
        t = self.tone(forearm_skin())
        edge = t[189:194, 300:350].max(0)  # the forearm's top edge, all along it
        self.assertTrue((edge > GLOSS_CUTS[0]).all())
        self.assertTrue((t < GLOSS_CUTS[1]).all())  # the line is the ring, never a core of light

    def test_the_arm_itself_stays_ink(self):
        t = self.tone(forearm_skin())
        self.assertLess(t[200, 320], GLOSS_CUTS[0])
        self.assertLess(t[240, 320], GLOSS_CUTS[0])

    def test_no_skin_draws_no_line(self):
        t = self.tone(np.zeros((FH, FW), np.uint8))
        self.assertLess(t.max(), GLOSS_CUTS[0])

    def test_skin_away_from_his_arms_is_not_an_arm(self):
        neck = np.zeros((FH, FW), np.uint8)
        cv2.circle(neck, (320, 120), 14, 255, -1)
        self.assertLess(self.tone(neck).max(), GLOSS_CUTS[0])

    def test_without_a_pose_nothing_is_drawn(self):
        lit = GlossStyler(FW, FH, FW, FH)(self.rgb, self.mask, None, forearm_skin())[3] / 255
        self.assertLess(lit.max(), GLOSS_CUTS[0])

    def test_where_the_arm_meets_the_field_his_outline_draws_it(self):
        # A hand reaching past his side: the line runs over him, then his outline takes over.
        t = self.tone(forearm_skin(x0=330, x1=420))
        self.assertGreater(t[189:194, 350].max(), GLOSS_CUTS[0])
        self.assertLess(t[180:220, 395:420].max(), 0.01)

    def test_the_zone_follows_the_bones(self):
        z = arm_zone(arms_pose(), FW, FH)
        self.assertTrue(z[200, 320])     # on the forearm
        self.assertFalse(z[120, 320])    # the neck
        self.assertFalse(z[330, 320])    # between his knees

    def test_crops_cover_him(self):
        box = (100, 50, 300, 900)
        squares = tiles(box, torso=200)
        self.assertEqual(len(squares), 2)
        for x0, y0, side in squares:
            self.assertLessEqual(x0, box[0])
            self.assertGreaterEqual(x0 + side, box[2])
        self.assertLessEqual(min(y for _, y, _ in squares), box[1])
        self.assertGreaterEqual(max(y + s for _, y, s in squares), box[3])


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
