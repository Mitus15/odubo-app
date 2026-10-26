"""Painted strokes (paint.py): soft, where one part of him passes before another, never along his outline or his head."""
import sys, unittest
from pathlib import Path
import numpy as np
import cv2
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from paint import MODEL_WH, crop_box, nearness, strokes  # noqa: E402
from figure import GLOSS_CUTS, GlossStyler, calm  # noqa: E402
from compose import paint as paint_him  # noqa: E402
from test_gloss import FH, FW, figure_frame, pose_for  # noqa: E402

H, W = 480, 270  # paint.py works at a quarter of a portrait frame


def him():
    solid = np.zeros((H, W), bool)
    cv2.ellipse(solid.view(np.uint8), (135, 240), (90, 200), 0, 0, 360, 1, -1)
    return solid


class Strokes(unittest.TestCase):
    def test_nothing_in_front_paints_nothing(self):
        solid = him()
        self.assertLess(strokes(np.full((H, W), 0.1, np.float32) * solid, solid)[0].max(), 0.05)

    def test_an_arm_in_front_is_painted_round_its_edge(self):
        solid = him()
        near = np.zeros((H, W), np.float32)
        near[200:240, 90:200] = 1.0  # a forearm across his chest, nearer the camera
        p = strokes(near * solid, solid)[0]
        self.assertGreater(p[198:203, 120:170].max(0).min(), 0.5)   # along the arm's top edge
        self.assertLess(p[220, 140], 0.2)                            # not over the arm itself
        self.assertLess(p[100, 135], 0.05)                           # not on the rest of him

    def test_his_outline_is_never_painted(self):
        solid = him()
        near = np.full((H, W), 0.9, np.float32) * solid  # all of him equally near: the jump is only at his outline
        p = strokes(near, solid)[0]
        self.assertLess(p.max(), 0.05)

    def test_his_head_stays_ink(self):
        solid = him()
        near = np.zeros((H, W), np.float32)
        near[60:100, 100:170] = 1.0
        quiet = np.ones((H, W), np.float32)
        quiet[:130] = 0
        self.assertLess(strokes(near * solid, solid, quiet)[0][:130].max(), 1e-6)

    def test_nearness_is_against_his_torso(self):
        solid = him()
        disp = np.full((H, W), 1.0, np.float32)
        disp[200:240, 90:200] = 3.0
        lm = np.zeros((33, 3), np.float32)
        for k, (x, y) in {11: (175, 120), 12: (95, 120), 23: (165, 330), 24: (105, 330)}.items():
            lm[k] = (x / W, y / H, 0.9)
        n = nearness(disp, solid, lm)
        self.assertAlmostEqual(float(n[300, 135]), 0.0, delta=1e-6)  # his torso is the zero
        self.assertGreater(float(n[220, 140]), 0.9)                    # the arm is the near end

    def test_a_gentle_slope_paints_nothing_beside_a_sharp_edge(self):
        # His legs nearer the camera by degrees (a low camera) do not paint; an arm before him does.
        solid = him()
        near = np.tile(np.linspace(0.2, 1.0, H, dtype=np.float32)[:, None], (1, W))
        near[200:240, 90:200] = 1.0
        p = strokes(near * solid, solid)[0]
        self.assertLess(p[380:420, 100:170].max(), 0.1)
        self.assertGreater(p[198:203, 120:170].max(), 0.5)

    def test_the_crop_has_the_models_shape(self):
        solid = him()
        x0, y0, x1, y1 = crop_box(solid, 10)
        self.assertAlmostEqual((x1 - x0) / (y1 - y0), MODEL_WH[0] / MODEL_WH[1], delta=0.02)


class Drawn(unittest.TestCase):
    def test_the_light_steps_back_near_a_stroke(self):
        rgb, mask = figure_frame(light_at=(320, 230))  # low on him: the quiet head leaves this light alone
        stroke = np.zeros((FH, FW), np.uint8)
        stroke[220:240, 300:340] = 230
        plain = GlossStyler(FW, FH, FW, FH)(rgb, mask, pose_for(), None)[3] / 255
        calmed = GlossStyler(FW, FH, FW, FH)(rgb, mask, pose_for(), None, stroke)[3] / 255
        self.assertGreater(plain[230, 320], GLOSS_CUTS[1])
        self.assertLess(calmed[230, 320], plain[230, 320] * 0.5)
        self.assertEqual(float(calm(np.zeros((FH, FW), np.float32), FH).max()), 0.0)

    def test_a_stroke_is_the_grounds_colour(self):
        pal = {"ink": np.float32([42, 15, 10]), "field": np.float32([201, 224, 92]), "highlight": np.float32([240, 250, 200])}
        fld = np.ones((4, 4), np.float32)
        tn = np.zeros((4, 4), np.float32)
        strokes_ = np.zeros((4, 4), np.float32)
        strokes_[0, 0], strokes_[1, 1] = 1.0, 0.5
        colour, _ = paint_him(fld, tn, pal, strokes=strokes_)
        np.testing.assert_allclose(colour[0, 0], pal["field"], atol=1e-4)
        np.testing.assert_allclose(colour[1, 1], (pal["ink"] + pal["field"]) / 2, atol=1e-4)
        np.testing.assert_allclose(colour[2, 2], pal["ink"], atol=1e-4)


if __name__ == "__main__":
    unittest.main()
