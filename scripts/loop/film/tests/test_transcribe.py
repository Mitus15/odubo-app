import sys, unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from transcribe import rms_db, voiced_segments  # noqa: E402

RATE = 16000


def tone(seconds, amp=0.3, hz=220):
    t = np.arange(int(RATE * seconds)) / RATE
    return (amp * np.sin(2 * np.pi * hz * t)).astype(np.float32)


def hiss(seconds, amp=0.001, seed=0):
    return (np.random.default_rng(seed).standard_normal(int(RATE * seconds)) * amp).astype(np.float32)


class VoicedSegments(unittest.TestCase):
    def test_an_instrumental_stem_has_no_voice(self):
        # A separated vocal stem of an instrumental is near silence: bleed and hiss.
        self.assertEqual(voiced_segments(rms_db(hiss(20), RATE)), [])

    def test_finds_the_sung_lines(self):
        x = np.concatenate([hiss(2), tone(3), hiss(2), tone(1.5), hiss(3)])
        segs = voiced_segments(rms_db(x, RATE))
        self.assertEqual(len(segs), 2)
        self.assertAlmostEqual(segs[0][0], 2.0, delta=0.1)
        self.assertAlmostEqual(segs[0][1], 5.0, delta=0.1)
        self.assertAlmostEqual(segs[1][0], 7.0, delta=0.1)

    def test_a_breath_does_not_split_a_line(self):
        x = np.concatenate([hiss(1), tone(2), hiss(0.3), tone(2), hiss(1)])
        self.assertEqual(len(voiced_segments(rms_db(x, RATE))), 1)

    def test_a_click_is_not_a_line(self):
        x = np.concatenate([hiss(2), tone(0.15), hiss(2)])
        self.assertEqual(voiced_segments(rms_db(x, RATE)), [])


class Doubtful(unittest.TestCase):
    def test_drops_whispers_stock_inventions(self):
        from transcribe import doubtful
        self.assertTrue(doubtful({}, "Thanks for watching!"))
        self.assertTrue(doubtful({"no_speech_prob": 0.9}, "and the dust"))
        self.assertTrue(doubtful({}, "As a non-generalこんな"))
        self.assertFalse(doubtful({"avg_logprob": -0.4, "no_speech_prob": 0.1}, "a living soul in the ground"))


if __name__ == "__main__":
    unittest.main()
