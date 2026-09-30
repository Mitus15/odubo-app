import sys, unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from anchor import SIZE, HeartPath, heart  # noqa: E402
from shadow import Ground, cast  # noqa: E402

W, H = 1000, 1000


def pose(facing=True, vis=0.9, shoulder=120.0, cx=500.0):
    """A standing figure: shoulders at y 300, hips at y 520, feet at y 900."""
    lm = np.zeros((33, 3), np.float32)
    lm[:, 2] = vis
    left, right = (cx + shoulder / 2, cx - shoulder / 2) if facing else (cx - shoulder / 2, cx + shoulder / 2)
    lm[11, :2] = (left / W, 300 / H)
    lm[12, :2] = (right / W, 300 / H)
    lm[23, :2] = ((cx + 40) / W, 520 / H) if facing else ((cx - 40) / W, 520 / H)
    lm[24, :2] = ((cx - 40) / W, 520 / H) if facing else ((cx + 40) / W, 520 / H)
    for i in (27, 29, 31):
        lm[i, :2] = ((cx + 30) / W, 900 / H)
    for i in (28, 30, 32):
        lm[i, :2] = ((cx - 30) / W, 900 / H)
    return lm


class Heart(unittest.TestCase):
    def test_sits_on_his_left_high_on_the_chest(self):
        x, y, width, angle, seen, facing = heart(pose(), W, H)
        self.assertTrue(facing and seen)
        self.assertGreater(x, 500)       # his left is the screen's right
        self.assertTrue(300 < y < 410)   # upper chest, not the belly
        self.assertAlmostEqual(width, 120, delta=1)
        self.assertAlmostEqual(angle, 0, delta=1)

    def path(self, frames):
        return HeartPath({i: lm for i, lm in enumerate(frames)}, 0, len(frames), W, H, 30)

    def test_the_badge_is_a_seed(self):
        x, y, size, angle, opacity = self.path([pose(shoulder=120)] * 30).at(15)
        self.assertAlmostEqual(size, 120 * SIZE, delta=0.5)
        self.assertLess(size, 20)

    def test_holds_still_through_the_pose_models_tremble(self):
        rng = np.random.default_rng(1)
        frames = []
        for _ in range(90):
            lm = pose()
            lm[:, :2] += rng.normal(0, 3, (33, 2)).astype(np.float32) / W
            frames.append(lm)
        path = self.path(frames)
        smooth = [path.at(k)[0] for k in range(10, 80)]
        raw = [heart(f, W, H)[0] for f in frames[10:80]]
        self.assertLess(np.std(smooth), 0.4 * np.std(raw))

    def test_keeps_up_with_him_without_lagging(self):
        frames = [pose(cx=300 + 4 * i) for i in range(90)]
        path = self.path(frames)
        for k in (30, 45, 60):
            self.assertAlmostEqual(path.at(k)[0], heart(frames[k], W, H)[0], delta=0.5)

    def test_hides_when_he_turns_away_and_fades_rather_than_blinks(self):
        path = self.path([pose()] * 30 + [pose(facing=False)] * 30)
        o = [path.at(k)[4] for k in range(60)]
        self.assertAlmostEqual(o[10], 1.0)
        self.assertAlmostEqual(o[50], 0.0)
        self.assertTrue(any(0 < v < 1 for v in o[25:35]))

    def test_hides_side_on(self):
        path = self.path([pose(shoulder=120)] * 60 + [pose(shoulder=30)] * 30)
        self.assertEqual(path.at(85)[4], 0.0)

    def test_a_one_frame_glitch_is_not_a_disappearance(self):
        frames = [pose()] * 60
        frames[30] = pose(vis=0.1)
        self.assertEqual(self.path(frames).at(30)[4], 1.0)

    def test_hides_when_the_shoulders_are_not_seen(self):
        self.assertEqual(self.path([pose()] * 30 + [pose(vis=0.1)] * 30).at(50)[4], 0.0)


class Shadow(unittest.TestCase):
    def body(self, lift=0):
        a = np.zeros((H, W), np.float32)
        a[200 - lift:900 - lift, 450:550] = 1.0
        return a

    def test_lies_below_the_ground_never_above(self):
        s = cast(self.body(), 900.0)
        rows = np.where(s.max(1) > 0.05)[0]
        self.assertGreaterEqual(rows.min(), 900)
        self.assertLess(rows.max(), 900 + 0.35 * 700 + 20)

    def test_leans_with_the_light(self):
        s = cast(self.body(), 900.0)
        low = s[960]
        cols = np.where(low > 0.2)[0]
        self.assertGreater(cols.mean(), 500)

    def test_stays_on_the_ground_when_he_jumps(self):
        ground = Ground(fps=30)
        for _ in range(60):
            ground.update(np.tile([[0.5, 0.9, 0.9]], (33, 1)).astype(np.float32), H)
        # He leaves the ground: feet 150 px up for half a second.
        for _ in range(15):
            stable, g = ground.update(np.tile([[0.5, 0.75, 0.9]], (33, 1)).astype(np.float32), H)
        self.assertAlmostEqual(g, 900, delta=2)
        self.assertAlmostEqual(stable, 900, delta=2)
        s = cast(self.body(lift=150), g)
        top = np.where(s.max(1) > 0.05)[0].min()
        # A gap between the ground and the shadow of the lifted feet.
        self.assertGreater(top, 900 + 0.28 * 150 - 12)


class Contact(unittest.TestCase):
    def test_the_shadow_touches_a_foot_stepped_forward(self):
        ground = Ground(fps=30)
        a = np.zeros((H, W), np.float32)
        a[200:900, 450:550] = 1
        for _ in range(60):
            ground.update(None, H, a)
        forward = np.zeros((H, W), np.float32)
        forward[200:930, 450:550] = 1  # a foot 30 px lower: nearer the camera
        stable, contact = ground.update(None, H, forward)
        self.assertAlmostEqual(stable, 899, delta=2)
        self.assertAlmostEqual(contact, 929, delta=1)


if __name__ == "__main__":
    unittest.main()
