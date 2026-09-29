"""
The bar grid of a song, measured from its master.

Tempo comes from data/loop/film/shape.json (film:listen). The phase, where the
beats fall, is the offset that puts the most onset energy on the beat
positions; the downbeat is the one of the four beats whose positions carry the
most. Returned in the song's own time; the caller adds where the song sits in
the take.
"""
import json
from functools import lru_cache
import numpy as np
from film_common import REPO, master
from sync_audio import load_mono, onset_envelope

RATE = 11025


@lru_cache(maxsize=16)
def grid(number: int) -> dict:
    shape = json.loads((REPO / "data/loop/film/shape.json").read_text())
    song = next(s for s in shape["songs"] if s["number"] == number)
    beat = 60.0 / song["bpm"]
    env, env_rate = onset_envelope(load_mono(master(number), RATE), RATE)
    t = np.arange(len(env)) / env_rate
    # Phase: sample the envelope on the beat grid for candidate offsets.
    offsets = np.linspace(0, beat, 48, endpoint=False)
    energy = [float(np.interp(np.arange(o, t[-1], beat), t, env).sum()) for o in offsets]
    phase = float(offsets[int(np.argmax(energy))])
    # Downbeat: which of the four beats carries the bar.
    bar = 4 * beat
    down = [float(np.interp(np.arange(phase + k * beat, t[-1], bar), t, env).sum()) for k in range(4)]
    first = phase + int(np.argmax(down)) * beat
    return {"beat": beat, "bar": bar, "first": first % bar}


def freeze_map(t_out: float, bar_start: float, bar: float, hold: float = 0.18, eps: float = 0.06) -> float:
    """
    The time warp that freezes on every downbeat without changing the length:
    near the bar's start time crawls (eps of real speed) for `hold` seconds,
    then runs a little fast to be back on time by the next bar. Pure.
    """
    u = (t_out - bar_start) % bar
    b0 = t_out - u
    if u < hold:
        return b0 + u * eps
    return b0 + eps * hold + (u - hold) * (bar - eps * hold) / (bar - hold)
