import sys, unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from anchor import SIZE, HeartPath, Path as Track, head_top, heart  # noqa: E402
from shadow import cast, cast_on_floor  # noqa: E402

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
    # The head: eyes at y 210, nose below them, ears either side.
    side = 1 if facing else -1
    lm[0, :2] = (cx / W, 225 / H)
    lm[2, :2] = ((cx + side * 15) / W, 210 / H)
    lm[5, :2] = ((cx - side * 15) / W, 210 / H)
    lm[7, :2] = ((cx + side * 30) / W, 215 / H)
    lm[8, :2] = ((cx - side * 30) / W, 215 / H)
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


class Marker(unittest.TestCase):
    def track(self, frames, where):
        return Track({i: lm for i, lm in enumerate(frames)}, 0, len(frames), W, H, 30, where)

    def test_the_crown_floats_over_his_head(self):
        x, y, size, angle, opacity = self.track([pose()] * 30, "crown").at(15)
        self.assertAlmostEqual(x, 500, delta=2)
        self.assertLess(y, 210)            # above his eyes: the top of his head
        self.assertGreater(y, 120)
        self.assertEqual(angle, 0.0)       # upright, whatever his shoulders do

    def test_the_crown_stays_over_his_head_when_he_leans_in(self):
        # Leaning toward the camera his head drops to his shoulders: eyes 75 px
        # lower, the neck in the picture 15 px. The head is no smaller.
        lean = pose()
        lean[[0, 2, 5, 7, 8], 1] += 75 / H
        t = self.track([pose()] * 60 + [lean] * 15 + [pose()] * 60, "crown")
        standing, leaning = t.at(30)[1], t.at(67)[1]
        self.assertAlmostEqual(leaning - standing, 75, delta=3)  # it moves with his head
        self.assertLess(leaning, 285 - 40)                        # and still clears it

    def head(self, top, hand=None):
        """A matte: his head from `top` down past his eyes (y 210), and maybe a hand over it."""
        a = np.zeros((H, W), np.uint8)
        a[top:400, 460:540] = 255
        if hand is not None:
            a[hand:hand + 40, 480:520] = 255
        return a

    def test_the_matte_finds_the_top_of_his_head(self):
        self.assertEqual(head_top(self.head(150), 500, 20, 210, 40), 150)

    def test_a_hand_held_over_his_head_is_not_his_head(self):
        self.assertEqual(head_top(self.head(150, hand=60), 500, 20, 210, 40), 150)

    def test_a_hand_resting_on_his_head_is_cleared_too(self):
        self.assertEqual(head_top(self.head(150, hand=115), 500, 20, 210, 40), 115)

    def test_eyes_a_little_off_the_matte_still_find_his_head(self):
        self.assertEqual(head_top(self.head(150), 500, 20, 410, 40), 150)  # eyes read 10 px under him
        self.assertTrue(np.isnan(head_top(self.head(150), 500, 20, 600, 40)))

    def test_the_crown_rises_to_clear_the_matte_and_never_sinks_for_it(self):
        frames = [pose()] * 90
        guess = self.track(frames, "crown").at(45)[1]
        tops = np.full(90, np.nan, np.float32)
        tops[30:60] = guess - 60  # looking down: the head's top is higher than the face says
        risen = Track({i: lm for i, lm in enumerate(frames)}, 0, 90, W, H, 30, "crown", tops=tops)
        self.assertAlmostEqual(risen.at(45)[1], guess - 60, delta=1)
        self.assertLessEqual(risen.at(29)[1], guess + 0.5)  # it rises ahead of the head, never behind it
        tops[:] = guess + 80  # a matte top under the guess changes nothing
        same = Track({i: lm for i, lm in enumerate(frames)}, 0, 90, W, H, 30, "crown", tops=tops)
        self.assertAlmostEqual(same.at(45)[1], guess, delta=0.5)

    def test_the_players_marker_stays_when_he_turns_away(self):
        t = self.track([pose()] * 30 + [pose(facing=False)] * 30, "crown")
        self.assertAlmostEqual(t.at(50)[4], 1.0)

    def test_the_marker_keeps_its_size_side_on(self):
        t = self.track([pose(shoulder=120)] * 60 + [pose(shoulder=40)] * 30, "crown")
        self.assertAlmostEqual(t.at(80)[2], t.at(30)[2], delta=0.5)

    def test_the_floor_marker_lies_under_his_lowest_foot(self):
        x, y, size, angle, opacity = self.track([pose()] * 30, "feet").at(15)
        self.assertAlmostEqual(x, 500, delta=2)
        self.assertAlmostEqual(y, 900, delta=1)
        self.assertGreater(size, 100)      # a ring about as wide as he stands


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


class OnTheFloor(unittest.TestCase):
    def figure(self, feet):
        a = np.zeros((H, W), np.float32)
        a[feet - 600:feet, 450:550] = 1
        return a

    def test_lies_on_the_floor_under_him(self):
        cov, y0 = cast_on_floor(self.figure(870), 870.0, 300.0, 500.0, 600.0, H)
        self.assertEqual(y0, 870)
        self.assertGreater(cov.max(), 0.5)

    def test_a_foot_on_the_frames_last_row_casts_nothing_and_never_fails(self):
        # Santé, take 325 s: he stepped up to the camera, the floor line on the last row.
        for contact in (H - 1.0, H - 0.5, H - 1.6):
            cov, y0 = cast_on_floor(self.figure(H - 1), contact, 300.0, 500.0, 600.0, H)
            self.assertEqual(cov.shape[1], W)
            self.assertLessEqual(y0 + cov.shape[0], H)


if __name__ == "__main__":
    unittest.main()
