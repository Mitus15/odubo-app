import sys, unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from plane import floor_line, mean_of, weights  # noqa: E402
from shadow import floor_line as old_floor_line  # noqa: E402

W, BODY = 1080, 1000.0


class TheFloorLine(unittest.TestCase):
    def test_under_each_foot_it_is_that_foots_floor_point(self):
        feet = [(400.0, 1650.0), (700.0, 1700.0)]
        line = floor_line(feet, W, 1675.0, BODY)
        self.assertAlmostEqual(float(line[400]), 1650.0, delta=0.5)
        self.assertAlmostEqual(float(line[700]), 1700.0, delta=0.5)
        self.assertAlmostEqual(float(line[50]), 1675.0, delta=0.5)   # beyond his feet: where he stands

    def test_the_nearer_foot_wins_where_both_share_columns(self):
        feet = [(500.0, 1640.0), (515.0, 1700.0)]                   # one right in front of the other
        line = floor_line(feet, W, 1670.0, BODY)
        self.assertGreater(float(line[505]), 1690.0)

    def test_feet_crossing_never_flip_it(self):
        # The left foot slides across the right one, 4 px a frame; the right foot is nearer.
        worst_new = worst_old = 0.0
        prev_new = prev_old = None
        for x in np.arange(380.0, 620.0, 4.0):
            feet = [(float(x), 1650.0), (500.0, 1700.0)]
            new = floor_line(feet, W, 1675.0, BODY)
            old = old_floor_line(np.arange(W, dtype=np.float32), feet)
            if prev_new is not None:
                worst_new = max(worst_new, float(np.abs(new - prev_new).max()))
                worst_old = max(worst_old, float(np.abs(old - prev_old).max()))
            prev_new, prev_old = new, old
        self.assertLess(worst_new, 12.0)        # it moves with the foot, a few px a frame
        self.assertGreater(worst_old, 40.0)     # the old line through both feet jumped as they crossed


class TheAverage(unittest.TestCase):
    def test_centred_and_renormalised_at_the_ends(self):
        w = weights(30.0)
        self.assertEqual(len(w), 3)
        self.assertAlmostEqual(float(w.sum()), 1.0, places=5)
        frames = [np.full(2, v, np.float32) for v in (1.0, 2.0, 3.0)]
        self.assertAlmostEqual(float(mean_of(frames[:2], frames[2:], w)[0]), 2.0, places=5)  # symmetric: no lag
        self.assertAlmostEqual(float(mean_of(frames[:2], [], w)[0]),
                               float((w[0] * 1 + w[1] * 2) / (w[0] + w[1])), places=5)      # the take's last frame

    def test_a_faster_take_averages_over_the_same_time(self):
        self.assertEqual(len(weights(120.0)), 2 * 4 + 1)


if __name__ == "__main__":
    unittest.main()
