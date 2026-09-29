"""
Line the album up to the take by listening.

The playlist puts a 1 kHz tone at the head and the masters after it, played
aloud in the room, so the take's own audio carries the music. Each master is
found in the room audio by cross-correlating onset envelopes (the pulse of the
music, which survives a phone microphone and a room) near where the playlist
says it should be. The peak is refined between samples, so a lock lands within
a video frame.
"""
import subprocess
import numpy as np


def load_mono(path, rate: int, seconds: float | None = None, start: float = 0.0) -> np.ndarray:
    args = ["ffmpeg", "-v", "error"]
    if start:
        args += ["-ss", f"{start:.3f}"]
    args += ["-i", str(path)]
    if seconds is not None:
        args += ["-t", f"{seconds:.3f}"]
    args += ["-vn", "-ac", "1", "-ar", str(rate), "-f", "s16le", "-"]
    raw = subprocess.run(args, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def find_tone(x: np.ndarray, rate: int, hz: float = 1000, frame: float = 0.02, need: float = 0.5):
    """Seconds to the first run of `need` s where the tone's band carries most of the energy."""
    n = int(rate * frame)
    f = np.fft.rfftfreq(n, 1 / rate)
    band = (f > hz - 60) & (f < hz + 60)
    win = np.hanning(n)
    run_len, start = 0, None
    for i in range(len(x) // n):
        spec = np.abs(np.fft.rfft(x[i * n:(i + 1) * n] * win)) ** 2
        total = spec.sum()
        if total > 1e-4 and spec[band].sum() / total > 0.5:
            if run_len == 0:
                start = i * frame
            run_len += 1
            if run_len * frame >= need:
                return start
        else:
            run_len = 0
    return None


def onset_envelope(x: np.ndarray, rate: int, hop: int = 256):
    """Spectral flux summed over 16 log bands, each standardised. Returns (env, env_rate)."""
    from scipy.signal import stft
    f, t, Z = stft(x, fs=rate, nperseg=1024, noverlap=1024 - hop, boundary=None)
    S = np.log1p(1000 * np.abs(Z))
    edges = np.geomspace(60, min(5000, rate / 2 - 1), 17)
    o = np.zeros(S.shape[1], np.float32)
    for a, b in zip(edges[:-1], edges[1:]):
        m = (f >= a) & (f < b)
        if not m.any():
            continue
        e = S[m].mean(0)
        d = np.maximum(0, np.diff(e, prepend=e[0]))
        o += (d - d.mean()) / (d.std() + 1e-9)
    return o, rate / hop


LOCKED = 0.25


def lock(room: np.ndarray, piece: np.ndarray, env_rate: float, expected: float, window: float):
    """
    Where `piece` (an onset envelope) sits inside `room`, searching `expected`
    plus or minus `window` seconds. Returns (seconds, correlation, z).

    Trust the correlation, not z: music repeats every beat, so near-peaks one
    beat apart keep z modest even for a perfect lock. Measured on the real
    1984 master in synthetic room noise, a present song correlates 0.3 to 0.7
    and an absent one under 0.1. LOCKED is the line between them.
    """
    lo = max(0, int((expected - window) * env_rate))
    hi = min(len(room) - len(piece), int((expected + window) * env_rate))
    if hi <= lo:
        return None, 0.0, 0.0
    p = (piece - piece.mean()) / (np.linalg.norm(piece - piece.mean()) + 1e-9)
    seg = room[lo:hi + len(piece)]
    # Normalised cross-correlation for every lag at once.
    raw = np.correlate(seg, p, "valid")
    csum = np.cumsum(np.r_[0, seg])
    csum2 = np.cumsum(np.r_[0, seg ** 2])
    n = len(piece)
    mean = (csum[n:] - csum[:-n]) / n
    var = (csum2[n:] - csum2[:-n]) - n * mean ** 2
    ncc = raw / (np.sqrt(np.maximum(var, 1e-12)))
    k = int(np.argmax(ncc))
    # Parabolic refinement between samples.
    frac = 0.0
    if 0 < k < len(ncc) - 1:
        a, b, c = ncc[k - 1], ncc[k], ncc[k + 1]
        denom = a - 2 * b + c
        if abs(denom) > 1e-12:
            frac = 0.5 * (a - c) / denom
    z = float((ncc[k] - ncc.mean()) / (ncc.std() + 1e-9))
    return (lo + k + frac) / env_rate, float(ncc[k]), z
