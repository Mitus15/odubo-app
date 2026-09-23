"""
Shared pieces of the reel toolkit: paths, the palette, ffmpeg helpers, and the
cached low-resolution reads of the source video that every stage leans on.

The source is a locked-off 1920x1080 phone recording of Mani dancing to the
album in headphones (so the audio carries no music). Everything here runs on
that assumption: a still camera, one person, a room that never moves.
"""
import json, os, subprocess, sys
from pathlib import Path
import numpy as np

REPO = Path(__file__).resolve().parents[3]
FONTS = REPO / "public/loop/fonts"
WORDMARK_SVG = REPO / "public/loop/branding/loop-soul.svg"

# The house palette, the same five values the video converter uses.
INK = (42, 15, 10)
INK_SOFT = (61, 26, 18)
SAND_DEEP = (156, 95, 60)
SAND = (217, 170, 122)
SAND_BRIGHT = (240, 211, 173)

TZ = "America/Vancouver"


def sh(args, **kw):
    return subprocess.run(args, check=True, **kw)


def ffprobe_duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def read_frames(src, start, dur, w, h, fps=30, pix="rgb24"):
    """Decode a range of the source as a numpy array (n, h, w, 3)."""
    args = ["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(dur), "-i", str(src), "-an",
            "-vf", f"fps={fps},scale={w}:{h},format={pix}", "-f", "rawvideo", "-"]
    raw = subprocess.run(args, capture_output=True, check=True).stdout
    ch = 3 if pix == "rgb24" else 1
    n = len(raw) // (w * h * ch)
    a = np.frombuffer(raw, np.uint8)[: n * w * h * ch]
    return a.reshape(n, h, w, ch) if ch == 3 else a.reshape(n, h, w)


def motion_signal(src, work, fps=15, w=96, h=54):
    """
    Frame-to-frame movement of the whole picture, at `fps`, cached. The TV in
    this room shows a screen saver, so its rectangle is blanked first.
    """
    cache = Path(work) / f"motion-{fps}.npy"
    if cache.exists():
        return np.load(cache)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-vf", f"fps={fps},scale={w}:{h},format=gray",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    n = len(raw) // (w * h)
    F = np.frombuffer(raw, np.uint8)[: n * w * h].reshape(n, h, w).astype(np.float32)
    tv = json.load(open(Path(work) / "room.json"))["tv"] if (Path(work) / "room.json").exists() else None
    if tv:
        x0, y0, x1, y1 = tv
        F[:, int(y0 * h / 1080): int(y1 * h / 1080), int(x0 * w / 1920): int(x1 * w / 1920)] = 0
    d = np.r_[0, np.abs(np.diff(F, axis=0)).mean((1, 2))]
    np.save(cache, d)
    return d


def onset_envelope(wav, hop=256):
    """Spectral-flux onsets per band, summed. `wav` is mono 11025 Hz."""
    from scipy.io import wavfile
    from scipy.signal import stft
    sr, x = wavfile.read(wav)
    x = x.astype(np.float32)
    if x.ndim > 1:
        x = x.mean(1)
    f, t, Z = stft(x, fs=sr, nperseg=1024, noverlap=1024 - hop, boundary=None)
    S = np.log1p(1000 * np.abs(Z))
    edges = np.geomspace(60, 5000, 17)
    o = np.zeros(S.shape[1], np.float32)
    for a, b in zip(edges[:-1], edges[1:]):
        m = (f >= a) & (f < b)
        e = S[m].mean(0)
        d = np.maximum(0, np.diff(e, prepend=e[0]))
        o += (d - d.mean()) / (d.std() + 1e-9)
    return o, sr / hop


def master_wav(m4a, work):
    """The master as mono 11025 Hz WAV, cached beside the work dir."""
    out = Path(work) / (Path(m4a).stem + ".11k.wav")
    if not out.exists():
        sh(["ffmpeg", "-v", "error", "-y", "-i", str(m4a), "-ac", "1", "-ar", "11025", str(out)])
    return out
