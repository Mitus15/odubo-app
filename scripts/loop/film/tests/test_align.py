import sys, unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from film_common import master  # noqa: E402
from sync_audio import LOCKED, find_tone, load_mono, lock, onset_envelope  # noqa: E402

RATE = 11025


class Align(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # 40 s of 1984, the real master.
        cls.song = load_mono(master(2), RATE, seconds=40, start=60)

    def room_with(self, offset_s, noise=0.05, gain=0.4, seed=1):
        rng = np.random.default_rng(seed)
        room = rng.standard_normal(int(RATE * 120)).astype(np.float32) * noise
        i = int(offset_s * RATE)
        # A room colours the sound: a little echo, lower level.
        played = gain * self.song
        played[int(0.03 * RATE):] += 0.3 * played[: -int(0.03 * RATE)]
        room[i:i + len(played)] += played
        return room

    def test_recovers_an_offset_within_a_frame(self):
        for offset in (13.37, 47.912):
            room, env_rate = onset_envelope(self.room_with(offset), RATE)
            piece, _ = onset_envelope(self.song[: RATE * 30], RATE)
            at, corr, z = lock(room, piece, env_rate, expected=offset + 3.0, window=8.0)
            self.assertLess(abs(at - offset), 1 / 30, f"locked at {at}, wanted {offset}")
            self.assertGreaterEqual(corr, LOCKED)

    def test_a_room_without_the_song_does_not_lock(self):
        room, env_rate = onset_envelope(self.room_with(0, gain=0.0), RATE)
        piece, _ = onset_envelope(self.song[: RATE * 30], RATE)
        _, corr, _ = lock(room, piece, env_rate, expected=40.0, window=8.0)
        self.assertLess(corr, LOCKED)

    def test_hears_the_tone(self):
        t = np.arange(int(16000 * 1.0)) / 16000
        x = np.concatenate([np.random.default_rng(0).standard_normal(16000 * 3) * 0.01,
                            0.2 * np.sin(2 * np.pi * 1000 * t), np.zeros(16000)]).astype(np.float32)
        self.assertAlmostEqual(find_tone(x, 16000), 3.0, delta=0.03)


if __name__ == "__main__":
    unittest.main()


class Freeze(unittest.TestCase):
    def test_holds_at_the_downbeat_and_lands_back_on_time(self):
        from beats import freeze_map
        bar = 2.0
        # Crawling right after the downbeat.
        self.assertLess(freeze_map(0.1, 0.0, bar) - 0.0, 0.1 * 0.2)
        # Back in sync at every bar line: the length never changes.
        for k in range(1, 5):
            self.assertAlmostEqual(freeze_map(k * bar - 1e-9, 0.0, bar), k * bar, delta=1e-6)
        # Never goes backwards.
        ts = [freeze_map(x / 100, 0.0, bar) for x in range(0, 800)]
        self.assertTrue(all(b >= a for a, b in zip(ts, ts[1:])))
