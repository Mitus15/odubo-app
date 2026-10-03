import sys, unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from floor import Tiles, footfalls  # noqa: E402
from effects import close_bars, motion_gate, on_snare  # noqa: E402
from hits import on_grid  # noqa: E402

W, H, FPS = 1080, 1920, 30.0


def standing(n: int) -> dict:
    """n frames of a man standing still, feet on the floor at y 0.9."""
    lm = np.zeros((33, 3), np.float32)
    lm[:, 2] = 0.9
    lm[:, 0], lm[:, 1] = 0.5, 0.5
    for j in (27, 29, 31):
        lm[j, :2] = (0.45, 0.9)
    for j in (28, 30, 32):
        lm[j, :2] = (0.55, 0.9)
    return {k: lm.copy() for k in range(n)}


def stepping(n: int, steps) -> dict:
    """Standing, but the left foot lifts and comes down 0.1 to the side at each frame in `steps`."""
    poses = standing(n)
    x = 0.45
    for s in steps:
        for k in range(s - 8, s):
            u = (k - (s - 8)) / 8
            for j in (27, 29, 31):
                poses[k][j, 0] = x + 0.1 * u
                poses[k][j, 1] = 0.9 - 0.05 * np.sin(np.pi * u)
        x += 0.1
        for k in range(s, n):
            for j in (27, 29, 31):
                poses[k][j, 0] = x
                poses[k][j, 1] = 0.9
    return poses


class Floor(unittest.TestCase):
    def test_one_footfall_per_step(self):
        steps = (30, 70, 110)
        falls = footfalls(stepping(150, steps), 0, 150, W, H, FPS)
        left = [f for f in falls if f[3] == "left"]
        self.assertEqual(len(left), 3)
        for (f, *_), s in zip(left, steps):
            self.assertLess(abs(f - s), 4)

    def test_a_planted_foot_lights_nothing(self):
        self.assertEqual(footfalls(standing(120), 0, 120, W, H, FPS), [])

    def test_a_tile_holds_then_fades_then_is_gone(self):
        tiles = Tiles([(10, 500.0, 1700.0, "left")], body=1000, ground=1700, fps=FPS, bar=2.0)
        self.assertEqual(tiles.lit(9), {})
        (b0,) = tiles.lit(10).values()
        (b1,) = tiles.lit(14).values()
        (b2,) = tiles.lit(35).values()
        self.assertEqual((b0, b1), (1.0, 1.0))
        self.assertLess(b2, 0.5)
        self.assertEqual(tiles.lit(10 + 30), {})


class Echo(unittest.TestCase):
    def test_no_echo_when_he_stands_still(self):
        self.assertEqual(float(motion_gate(standing(90), 0, 90, W, H, 1000, FPS).max()), 0.0)

    def test_a_thrown_arm_trails(self):
        poses = standing(90)
        for k in range(40, 50):
            poses[k][15, 0] = 0.5 + 0.06 * (k - 40)  # 0.06 of the frame width a frame
        g = motion_gate(poses, 0, 90, W, H, 1000, FPS)
        self.assertGreater(g[44], 0.5)
        self.assertLess(g[5], 0.01)


class Close(unittest.TestCase):
    def test_the_busiest_bar_of_each_phrase_cut_on_its_bar_lines(self):
        bar = 2.0
        n = int(40 * FPS)
        poses = standing(n)
        busy = (3, 12)  # bar 3 in the first phrase, bar 12 in the second
        for b in busy:
            for k in range(int(b * bar * FPS), int((b + 1) * bar * FPS)):
                for j in (27, 28):
                    poses[k][j, 0] = 0.5 + 0.05 * np.sin(k)
        picks = close_bars(poses, 0, W, H, FPS, 1000, downbeat=0.0, bar=bar, t_from=0.0, t_to=40.0, win0=0.0)
        self.assertEqual([round(s / bar) for s, _, _ in picks], list(busy))
        for s, e, _ in picks:
            self.assertAlmostEqual(e - s, bar)

    def test_bars_chosen_by_hand(self):
        picks = close_bars(standing(int(20 * FPS)), 0, W, H, FPS, 1000, 0.0, 2.0, 0.0, 20.0, 0.0, picks=[7.3])
        self.assertEqual([(s, e) for s, e, _ in picks], [(6.0, 8.0)])


class Hits(unittest.TestCase):
    def stem(self, beat=0.5, phase=0.25, seconds=20.0, rate=11025):
        """A drum stem: a 60 Hz kick on beats 0 and 2 of each bar, a noise snare on 1 and 3."""
        rng = np.random.default_rng(3)
        x = np.zeros(int(seconds * rate), np.float32)
        t = np.arange(int(0.08 * rate)) / rate
        kick = np.sin(2 * np.pi * 60 * t) * np.exp(-t * 40)
        snare = rng.standard_normal(len(t)) * np.exp(-t * 60) * 0.6
        times = phase + np.arange(int((seconds - phase - 0.2) / beat)) * beat
        for k, s in enumerate(times):
            i = int(s * rate)
            x[i:i + len(t)] += kick if k % 2 == 0 else snare
        return x + rng.standard_normal(len(x)).astype(np.float32) * 1e-3, times

    def test_kick_and_snare_are_told_apart_on_the_grid(self):
        x, times = self.stem()
        h = on_grid(x, 11025, 0.5, 0.25)
        kicks, snares = np.array(h["kick"]), np.array(h["snare"])
        self.assertLess(np.abs(kicks - times[0::2][: len(kicks)]).max(), 0.015)
        self.assertLess(np.abs(snares - times[1::2][: len(snares)]).max(), 0.015)
        self.assertAlmostEqual(h["downbeat"], 0.25, delta=0.015)

    def test_the_field_is_on_its_sister_colour_from_snare_to_kick(self):
        kicks, snares = np.array([1.0, 2.0]), np.array([1.5, 2.5])
        self.assertFalse(on_snare(0.5, kicks, snares))
        self.assertFalse(on_snare(1.2, kicks, snares))
        self.assertTrue(on_snare(1.7, kicks, snares))
        self.assertFalse(on_snare(2.1, kicks, snares))
        self.assertTrue(on_snare(3.0, kicks, snares))


if __name__ == "__main__":
    unittest.main()
