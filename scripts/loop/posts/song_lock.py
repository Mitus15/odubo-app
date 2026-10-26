"""
Where a full video sits in its song, from the room's sound and the official track.
Usage: python3 song_lock.py <full video> <song file> [--map]

Prints the song's time at the video's first frame (negative: the song begins that many seconds
into the video), how many 20 s parts of the video agree on it, and the next-best places, for
song-starts.json. --map also prints each part's own best place in the song.

Rhythm alone fails on loop-built tracks (Around the World, Raise Da Roof, Lady): every bar sounds
like the last. So this compares the arrangement (each band's loudness: when the bass drops out,
when the vocal comes in) and the harmony (which notes sound: a riff over two bars tells odd bars
from even), each 20 s part on its own terms. Measured 2026-10-25 on 12 songs: the right place wins
every part, scoring 0.4 to 0.8 against under 0.35 a bar or two away.

When the parts disagree, the track is usually a different edit from the one played: Planet Rock's
parts sat at four places in the 6:24 12", stepping later through the video, and all at one in the
5:20 single he played. Find the other versions and try each.
"""
import sys
from pathlib import Path
import numpy as np
from scipy.signal import stft

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "film"))
from sync_audio import load_mono  # noqa: E402

RATE, HOP = 11025, 256
PART, STEP = 20.0, 10.0  # seconds a part covers, and between parts
AGREE = 0.8              # share of parts that must pick the same place


def smooth(M: np.ndarray, seconds: float) -> np.ndarray:
    k = max(1, int(seconds * RATE / HOP))
    return np.stack([np.convolve(m, np.ones(k) / k, "same") for m in M])


def arrangement(x: np.ndarray) -> np.ndarray:
    """Log loudness in 24 bands, 50 Hz to 5 kHz, over half-second spans: which parts play."""
    f, _, Z = stft(x, fs=RATE, nperseg=2048, noverlap=2048 - HOP, boundary=None)
    P = np.abs(Z) ** 2
    edges = np.geomspace(50, 5000, 25)
    return smooth(np.log(np.stack([P[(f >= a) & (f < b)].mean(0) for a, b in zip(edges[:-1], edges[1:])]) + 1e-9), 0.5)


def harmony(x: np.ndarray) -> np.ndarray:
    """Energy in each of the 12 pitch classes, 55 Hz to 2 kHz, over quarter-second spans: which notes sound."""
    f, _, Z = stft(x, fs=RATE, nperseg=4096, noverlap=4096 - HOP, boundary=None)
    P = np.abs(Z) ** 2
    m = (f > 55) & (f < 2000)
    pc = np.round(12 * np.log2(f[m] / 440.0)).astype(int) % 12
    C = np.stack([P[m][pc == k].sum(0) for k in range(12)])
    return smooth(np.log1p(C / (C.mean() + 1e-12)), 0.25)


def r(a: np.ndarray, b: np.ndarray) -> float:
    """Mean over rows of Pearson r."""
    a = a - a.mean(1, keepdims=True)
    b = b - b.mean(1, keepdims=True)
    return float(((a * b).sum(1) / (np.sqrt((a * a).sum(1) * (b * b).sum(1)) + 1e-9)).mean())


class Pair:
    def __init__(self, video: str, song: str):
        v, s = load_mono(video, RATE), load_mono(song, RATE)
        self.v = [arrangement(v), harmony(v)]
        self.s = [arrangement(s), harmony(s)]
        self.rate = RATE / HOP
        n = min(x.shape[1] for x in self.v)
        self.parts = list(range(0, n - int(PART * self.rate), int(STEP * self.rate)))
        self.video_length, self.song_length = len(v) / RATE, len(s) / RATE

    def part_fit(self, i0: int, j0: int) -> float | None:
        """Both features, video part at frame i0 against the song from frame j0."""
        w = int(PART * self.rate)
        if j0 < 0 or j0 + w > min(x.shape[1] for x in self.s):
            return None
        return 0.5 * sum(r(a[:, i0:i0 + w], b[:, j0:j0 + w]) for a, b in zip(self.v, self.s))

    def fits(self, start: float):
        """Each part's fit with the song placed `start` seconds ahead of the video (None: outside the song)."""
        lag = int(round(start * self.rate))
        out = []
        for i0 in self.parts:
            near = [self.part_fit(i0, i0 + lag + d) for d in range(-2, 3)]
            near = [x for x in near if x is not None]
            out.append(max(near) if near else None)
        return out

    def score(self, start: float) -> float:
        f = [x for x in self.fits(start) if x is not None]
        return float(np.mean(f)) if len(f) >= 0.6 * len(self.parts) else -1.0

    def place(self):
        xs = np.arange(-self.video_length / 2, self.song_length - PART, 0.25)
        scores = np.array([self.score(x) for x in xs])
        peaks = []
        for i in np.argsort(scores)[::-1]:
            if all(abs(xs[i] - p) > 0.75 for p, _ in peaks):
                peaks.append((float(xs[i]), float(scores[i])))
            if len(peaks) == 4:
                break
        fine = np.arange(peaks[0][0] - 0.25, peaks[0][0] + 0.26, 0.02)
        best = float(max(fine, key=self.score))
        rivals = [p for p, _ in peaks[1:]]
        won = 0
        counted = 0
        for k, mine in enumerate(self.fits(best)):
            theirs = [self.fits(p)[k] for p in rivals]
            theirs = [t for t in theirs if t is not None]
            if mine is None or not theirs:
                continue
            counted += 1
            won += mine > max(theirs)
        return {"song_at_video_start": round(best, 2), "fit": round(self.score(best), 3),
                "parts_agree": f"{won}/{counted}", "next": [(round(p, 1), round(q, 3)) for p, q in peaks[1:]],
                "video_length": round(self.video_length, 1), "song_length": round(self.song_length, 1),
                "sure": counted > 0 and won >= AGREE * counted}

    def map(self):
        """Each part's own best place in the song: steps between parts mean an edit or a skip."""
        w = int(PART * self.rate)
        n_s = min(x.shape[1] for x in self.s)
        for i0 in self.parts:
            j = max(range(0, n_s - w, 2), key=lambda j0: self.part_fit(i0, j0))
            print(f"  video {i0 / self.rate:5.0f}s  at song {j / self.rate:6.1f}s  "
                  f"(start {(j - i0) / self.rate:6.1f})  fit {self.part_fit(i0, j):.2f}", flush=True)


if __name__ == "__main__":
    pair = Pair(sys.argv[1], sys.argv[2])
    result = pair.place()
    print(result)
    if not result["sure"]:
        print("the parts disagree: probably a different edit of the song, or a skip; see --map")
    if "--map" in sys.argv:
        pair.map()
