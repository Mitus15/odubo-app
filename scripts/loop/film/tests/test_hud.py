import sys, unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hud import LINE_GAP, Hud, credit  # noqa: E402

W, H = 1080, 1920
FIELD, INK = np.array([245, 147, 166], np.float32), np.array([42, 15, 10], np.float32)
FALLS = [(110, 0, 0, "left"), (130, 0, 0, "right"), (150, 0, 0, "left"), (90, 0, 0, "left")]


def frame():
    c = np.empty((H, W, 3), np.float32)
    c[:] = FIELD
    return c


class Credit(unittest.TestCase):
    def test_the_song_carries_its_artist(self):
        self.assertEqual(credit("Fils de joie", "Stromae"), "FILS DE JOIE · STROMAE")
        self.assertEqual(credit("Santé", " Stromae "), "SANTÉ · STROMAE")

    def test_our_own_song_needs_none(self):
        self.assertEqual(credit("News Peak"), "NEWS PEAK")

    def test_the_credit_widens_the_line_not_the_hud(self):
        bare, credited = frame(), frame()
        Hud(W, H, "1-2", "Fils de joie", FALLS, k_start=100).draw(bare, 120, 0.5, INK)
        Hud(W, H, "1-2", "Fils de joie", FALLS, k_start=100, artist="Stromae").draw(credited, 120, 0.5, INK)
        rows = lambda c: np.where(np.abs(c - FIELD).sum(2) > 1)[0]  # noqa: E731
        cols = lambda c: np.where(np.abs(c[SMALL_ROW, W // 2:] - FIELD).sum(2) > 1)[1]  # noqa: E731
        self.assertEqual(rows(bare).max(), rows(credited).max())
        self.assertLess(cols(credited).min(), cols(bare).min())  # right-aligned: it grows to the left


BIG_ROW, SMALL_ROW = slice(230, 268), slice(272, 300)  # the big caps' band and the small caps' band
PLAYER, LEVEL = slice(150, W // 2), slice(W // 2, W)    # each side's text (the player's past the seal)


def ink_cols(c, rows):
    return np.where(np.abs(c[rows] - FIELD).sum(2) > 1)[1]


def ink_rows(c, rows, cols):
    return np.where(np.abs(c[rows, cols] - FIELD).sum(2) > 1)[0]


class Player(unittest.TestCase):
    def test_his_name_sits_under_his_steps_and_clears_the_longest_credit(self):
        bare, named = frame(), frame()
        args = (W, H, "1-1", "Billie Jean", FALLS)
        Hud(*args, k_start=100, artist="Michael Jackson").draw(bare, 120, 0.5, INK)
        Hud(*args, k_start=100, artist="Michael Jackson", player="Mitus Young History").draw(named, 120, 0.5, INK)
        song = ink_cols(bare[:, LEVEL], SMALL_ROW) + LEVEL.start
        name = ink_cols(named[:, PLAYER], SMALL_ROW) + PLAYER.start
        self.assertEqual(len(ink_cols(bare[:, PLAYER], SMALL_ROW)), 0)
        self.assertGreater(len(name), 0)                 # the name is there, on the small line, his side
        self.assertGreater(song.min() - name.max(), 80)  # with air before the song's credit

    def test_no_player_no_name(self):
        bare, named = frame(), frame()
        Hud(W, H, "1-2", "Santé", FALLS, k_start=100).draw(bare, 120, 0.5, INK)
        Hud(W, H, "1-2", "Santé", FALLS, k_start=100, player="Mitus Young History").draw(named, 120, 0.5, INK)
        self.assertEqual(len(ink_cols(bare[:, PLAYER], SMALL_ROW)), 0)
        self.assertGreater(len(ink_cols(named[:, PLAYER], SMALL_ROW)), 0)

    def test_the_big_lines_share_a_baseline_and_the_small_ones_another(self):
        c = frame()
        Hud(W, H, "1-1", "Billie Jean", FALLS, k_start=100, artist="Michael Jackson",
            player="Mitus Young History").draw(c, 120, 0.5, INK)
        # Round letters (0, 6) dip a pixel under the line, as type does; the J of
        # JACKSON hangs below it, so the small line is read by its tops.
        self.assertLessEqual(abs(ink_rows(c, BIG_ROW, PLAYER).max() - ink_rows(c, BIG_ROW, LEVEL).max()), 1)
        self.assertLessEqual(abs(ink_rows(c, SMALL_ROW, PLAYER).min() - ink_rows(c, SMALL_ROW, LEVEL).min()), 1)


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
        y = int(round(self.hud.top + LINE_GAP))
        dark = lambda m: m[y].sum()  # noqa: E731
        c1, c2 = frame(), frame()
        self.hud.draw(c1, 140, 0.1, INK)
        self.hud.draw(c2, 140, 0.9, INK)
        self.assertLess(c2[y, W // 2].sum(), c1[y, W // 2].sum())  # the middle of the line is run at 90%, not at 10%
        self.assertEqual(dark(early), dark(late))  # the faint line is the same length either way


class TrainingGround(unittest.TestCase):
    """The training ground: the same HUD, TRAINING in the level's slot, no finish line."""

    def test_practice_has_no_progress_line(self):
        level, training = frame(), frame()
        Hud(W, H, "1-1", "Hold the Line", FALLS, k_start=100, artist="Toto").draw(level, 140, 0.5, INK)
        Hud(W, H, "TRAINING", "Hold the Line", FALLS, k_start=100, artist="Toto",
            progress=False).draw(training, 140, 0.5, INK)
        y = int(round(Hud(W, H, "1-1", "", FALLS, k_start=100).top + LINE_GAP))
        line = lambda c: (np.abs(c[y] - FIELD).sum(1) > 1).sum()  # noqa: E731
        self.assertGreater(line(level), 0.8 * (W - 144))
        self.assertEqual(line(training), 0)

    def test_the_longest_credit_still_clears_his_name(self):
        c = frame()
        Hud(W, H, "TRAINING", "Give Life Back to Music", FALLS, k_start=100, artist="Daft Punk",
            player="Mitus Young History", progress=False).draw(c, 120, 0.5, INK)
        cols = ink_cols(c, SMALL_ROW)
        gaps = np.diff(np.unique(cols[cols > 150]))
        self.assertGreater(gaps.max(), 60)  # the widest gap on the small line is the air between the two sides


if __name__ == "__main__":
    unittest.main()
