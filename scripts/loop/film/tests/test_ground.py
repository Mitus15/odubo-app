import sys, unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from camera import l1_path  # noqa: E402
from feet import TUCK, matte_sole, planted  # noqa: E402
from shadow import cast_on_floor, floor_line  # noqa: E402

H, FPS = 1920, 30


def feet(left_y, right_y, left_x=500.0, right_x=600.0):
    """Raw soles for n frames: (n, 2 feet, x / y)."""
    n = len(left_y)
    raw = np.zeros((n, 2, 2), np.float32)
    raw[:, 0, 0], raw[:, 1, 0] = left_x, right_x
    raw[:, 0, 1], raw[:, 1, 1] = left_y, right_y
    return raw


class TheFloor(unittest.TestCase):
    def test_a_lifted_foot_keeps_its_floor_point(self):
        # The left foot lifts 120 px for 8 frames (a kick) and comes back down.
        left = np.full(90, 1700.0)
        left[40:48] = 1580.0
        out = planted(feet(left, np.full(90, 1700.0)), 0, 90, H, FPS)
        self.assertLess(np.abs(out[:, 0, 1] - (1700 - TUCK * H)).max(), 1.0)

    def test_a_jump_leaves_both_on_the_floor(self):
        both = np.full(90, 1700.0)
        both[40:50] = 1600.0
        out = planted(feet(both, both), 0, 90, H, FPS)
        self.assertLess(np.abs(out[:, :, 1] - (1700 - TUCK * H)).max(), 1.0)

    def test_a_step_forward_glides_never_jumps(self):
        # The right foot lifts, travels 150 px toward the camera, lands and stays.
        right = np.r_[np.full(40, 1700.0), np.linspace(1660, 1640, 6), np.full(44, 1850.0)]
        out = planted(feet(np.full(90, 1700.0), right), 0, 90, H, FPS)
        steps = np.abs(np.diff(out[:, 1, 1]))
        self.assertLess(steps.max(), 40.0)                       # no cut: it travels with the foot
        self.assertAlmostEqual(out[80, 1, 1], 1850 - TUCK * H, delta=1.0)

    def test_a_one_frame_glitch_is_thrown_out(self):
        left = np.full(60, 1700.0)
        left[30] = 1400.0
        out = planted(feet(left, np.full(60, 1700.0)), 0, 60, H, FPS)
        self.assertLess(np.abs(out[:, 0, 1] - (1700 - TUCK * H)).max(), 1.0)

    def test_the_matte_sole_is_the_lowest_row_under_the_foot(self):
        a = np.zeros((960, 540), np.uint8)
        a[100:850, 240:260] = 255   # his leg, to 1700 in the take
        a[100:900, 400:420] = 255   # something else, out of the column
        self.assertAlmostEqual(matte_sole(a, 500.0, 30.0, 0.5), 1700.0)
        a[100:960, 240:260] = 255   # the foot has left the phone's frame: no sole
        self.assertTrue(np.isnan(matte_sole(a, 500.0, 30.0, 0.5)))


class TheShadowOnIt(unittest.TestCase):
    def test_the_line_runs_through_both_feet_and_levels_beyond(self):
        xs = np.array([0, 400, 500, 600, 1000], np.float32)
        line = floor_line(xs, ((400, 1700), (600, 1740)))
        self.assertEqual(list(line), [1700, 1700, 1720, 1740, 1740])

    def test_one_foot_right_in_front_of_the_other_never_stands_the_line_on_end(self):
        xs = np.arange(0, 1000, dtype=np.float32)
        line = floor_line(xs, ((500, 1650), (510, 1750)))
        self.assertLessEqual(np.abs(np.diff(line)).max(), 0.5 + 1e-4)

    def test_each_sole_meets_its_own_shadow(self):
        # Two legs at different depths: the left sole at 1700, the right at 1760.
        fig = np.zeros((1800, 1080), np.float32)
        fig[1100:1700, 380:420] = 1
        fig[1160:1760, 640:680] = 1
        cov, y0 = cast_on_floor(fig, ((400, 1700), (660, 1760)), 600.0, 540.0, 600.0, 1920)
        for x, sole in ((400, 1700), (660, 1760)):
            col = cov[:, x - 25:x + 26].max(1)
            first = y0 + int(np.argmax(col > 0.5))
            self.assertLessEqual(abs(first - sole), 4)


class TheCamera(unittest.TestCase):
    def test_it_holds_still_while_he_stays_in_the_zone(self):
        rng = np.random.default_rng(3)
        target = 540 + rng.normal(0, 40, 600)  # he sways and bounces in place
        p = l1_path(target, 150.0)
        self.assertLess(np.abs(np.diff(p)).max(), 0.05)

    def test_it_glides_after_him_and_eases_in_and_out(self):
        target = np.r_[np.full(270, 300.0), np.linspace(300, 800, 60), np.full(270, 800.0)]  # he crosses in 2 s
        p = l1_path(target, 150.0)
        self.assertLess(np.abs(p - target).max(), 150.5)          # he never leaves the zone
        self.assertLess(np.abs(np.diff(p, 2)).max(), 1.0)         # no lurch: it eases
        self.assertLess(np.abs(np.diff(p[:150])).max(), 0.05)     # still before the move

    def test_it_stays_inside_its_bounds(self):
        p = l1_path(np.full(200, 900.0), 50.0, bounds=(None, 700.0))
        self.assertLessEqual(p.max(), 700.0 + 1e-6)


if __name__ == "__main__":
    unittest.main()
