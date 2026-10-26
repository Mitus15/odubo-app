"""
The drummer's hits: where the kick and the snare land in a song.

    python3 hits.py "<song file>" <bpm>     # separates the drums once, prints what it heard

The drums come apart from the rest with Demucs (`--two-stems=drums`, the same
tool transcribe.py uses for the vocals), cached by the song file under
$FILM_WORK/cache/stems/, so a song is separated once. In the drum stem alone:

  kick    a beat whose hit is heavy in the low band (30-150 Hz): the drum you feel
  snare   a beat whose hit is heavy above 150 Hz: the crack

Read on the song's own beat grid (beats.py), not by picking every peak: in a
real drum stem both bands fire on every hit (Billie Jean's kick has a click,
its snare a body), and one beat's balance is noisy. A groove is steady, so
the balance is averaged per place in the bar over the whole song: the two
places heaviest in the low band are the kick's, the other two the snare's
(on Billie Jean, low over high is 1.1 on the kick's beats, 0.57 on the
snare's). A beat with no drums under it (a breakdown) is no hit. Times are
song seconds, where the hit's onset peaks. The downbeat is the kick's place
the song's first hit lands on: songs start on the one.

Used by compose's `hits` effect (the field cuts to its sister colour on the
snare, back on the kick) and by beats.py, which takes the downbeat from the
kick when a drum stem exists.
"""
import subprocess, sys
from functools import lru_cache
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfiltfilt
from film_common import fingerprint, work
from sync_audio import load_mono

RATE = 11025
HOP = 128                  # samples: about 12 ms between envelope points
WINDOW = 0.1               # seconds either side of a beat in which its hit may land (the drums breathe against a fixed grid)
QUIET = 0.25               # a beat this far under the song's usual hit is no hit
KICK_BAND = (30.0, 150.0)  # Hz
SNARE_FROM = 150.0         # Hz


def drum_stem(song: str) -> Path:
    """The song's drums alone, separated once and cached."""
    src = Path(song).expanduser().resolve()
    out = work("cache", "stems", fingerprint(src))
    target = out / "htdemucs" / src.stem / "drums.wav"
    if not target.exists():
        try:
            import torch
            device = "mps" if torch.backends.mps.is_available() else "cpu"
            subprocess.run([sys.executable, "-m", "demucs", "--two-stems=drums", "-n", "htdemucs", "-d", device,
                            "-o", str(out), str(src)], check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise SystemExit("Demucs is needed to separate the drums: pip install demucs (about 80 MB of model on first use).")
    return target


def envelope(x: np.ndarray, rate: int, lo: float, hi: float | None) -> np.ndarray:
    """How fast the energy in a band rises: half-wave rectified, log, per HOP."""
    nyq = rate / 2
    sos = butter(4, [lo / nyq, hi / nyq], "band", output="sos") if hi else butter(4, lo / nyq, "high", output="sos")
    band = sosfiltfilt(sos, x)
    n = len(band) // HOP
    energy = np.sqrt((band[: n * HOP].reshape(n, HOP) ** 2).mean(1))
    level = np.log1p(200 * energy)
    return np.maximum(0, np.diff(level, prepend=level[0]))


def on_grid(drums: np.ndarray, rate: int, beat: float, phase: float) -> dict:
    """
    {"kick": [s, ...], "snare": [s, ...], "downbeat": s}: every beat of the
    grid (phase plus whole beats) that carries a drum hit, told kick or snare,
    and where the first bar starts.
    """
    step = rate / HOP
    low, high = envelope(drums, rate, *KICK_BAND), envelope(drums, rate, SNARE_FROM, None)
    reach = int(round(WINDOW * step))
    times, lows, highs = [], [], []
    for t in np.arange(phase % beat, len(low) / step, beat):
        i = int(round(t * step))
        a, b = max(0, i - reach), min(len(low), i + reach + 1)
        if b <= a:
            continue
        j = a + int(np.argmax(low[a:b] + high[a:b]))
        times.append(j / step)
        lows.append(low[a:b].max())
        highs.append(high[a:b].max())
    times, lows, highs = np.array(times), np.array(lows), np.array(highs)
    if not len(times):
        return {"kick": [], "snare": [], "downbeat": None}
    total = lows + highs
    real = total > QUIET * np.median(total)
    balance = np.log((lows + 1e-4) / (highs + 1e-4))
    place = np.arange(len(times)) % 4
    mean = [balance[real & (place == k)].mean() if (real & (place == k)).any() else -np.inf for k in range(4)]
    kick_places = set(np.argsort(mean)[2:].tolist())
    kick = real & np.isin(place, list(kick_places))
    snare = real & ~kick
    first = int(np.argmax(real)) if real.any() else 0
    # The first hit is the one if it is a kick; else the kick's place before it.
    one = next(k for k in range(first, first - 4, -1) if (k % 4) in kick_places)
    downbeat = float(phase % beat + one * beat)
    return {"kick": times[kick].round(4).tolist(), "snare": times[snare].round(4).tolist(),
            "downbeat": round(downbeat, 4)}


@lru_cache(maxsize=8)
def hits_of(song: str, bpm: float) -> dict:
    """The song's kicks and snares, on its own beat (beats.pulse: the tempo refined, the phase measured)."""
    from beats import pulse
    p = pulse(song, bpm)
    return on_grid(load_mono(drum_stem(song), RATE), RATE, p["beat"], p["phase"])


if __name__ == "__main__":
    h = hits_of(sys.argv[1], float(sys.argv[2]))
    print(f"kick {len(h['kick'])}, snare {len(h['snare'])}")
    print("first kicks ", h["kick"][:8])
    print("first snares", h["snare"][:8])
    print("downbeat", h["downbeat"])
