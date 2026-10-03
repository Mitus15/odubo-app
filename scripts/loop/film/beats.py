"""
The bar grid of a song, measured from its master.

Tempo starts from data/loop/film/shape.json (film:listen) or the tempo a
chapter carries, and is refined here within TEMPO_REACH: a tempo a hair off
drifts a beat grid off the music over a whole song (Billie Jean at 116.75
for 116.69 ran 60 ms ahead of the drums by the middle). The tempo and the
phase together are the pair that puts the most onset energy on the beats.

The downbeat is the kick's: with the drums separated (hits.py), the one is
where the kick lands on the song's first hit. Without them, the one of the
four beats whose positions carry the most energy, which on a song with a
loud snare is a snare beat, not the one. Returned in the song's own time;
the caller adds where the song sits in the take.
"""
import json
from functools import lru_cache
import numpy as np
from film_common import REPO, master
from sync_audio import load_mono, onset_envelope

RATE = 11025
TEMPO_REACH, TEMPO_STEP = 0.3, 0.01  # bpm either side of the given tempo, and the search step
ONSET_DELAY = (1024 / 2 - 256 / 2) / RATE  # onset_envelope's frames: where a frame's change sits in time


def song_of(chapter: dict) -> tuple[str, float]:
    """A chapter's song file and tempo: an album song's master, or the file a
    song from outside the album (film:dance) carries."""
    if chapter.get("master"):
        return chapter["master"], chapter["bpm"]
    shape = json.loads((REPO / "data/loop/film/shape.json").read_text())
    song = next(s for s in shape["songs"] if s["number"] == chapter["number"])
    return str(master(chapter["number"])), song["bpm"]


@lru_cache(maxsize=16)
def grid(number: int) -> dict:
    return chapter_grid({"number": number})


def chapter_grid(chapter: dict, drums: bool = False) -> dict:
    """A chapter's bar grid; `drums` takes the downbeat from the separated kick (hits.py)."""
    path, bpm = song_of(chapter)
    if drums:
        from hits import hits_of
        return grid_of(path, bpm, hits_of(path, bpm)["downbeat"])
    return grid_of(path, bpm)


@lru_cache(maxsize=16)
def pulse(path: str, bpm: float) -> dict:
    """The beat: {"beat": s, "phase": s}, the tempo refined, the phase where the beats fall."""
    env, env_rate = onset_envelope(load_mono(path, RATE), RATE)
    t = np.arange(len(env)) / env_rate + ONSET_DELAY
    best = (-1.0, 60.0 / bpm, 0.0)
    for b in np.arange(bpm - TEMPO_REACH, bpm + TEMPO_REACH + TEMPO_STEP / 2, TEMPO_STEP):
        beat = 60.0 / b
        grid_t = np.arange(0, t[-1], beat)
        for o in np.linspace(0, beat, 48, endpoint=False):
            e = float(np.interp(grid_t + o, t, env).sum())
            if e > best[0]:
                best = (e, beat, float(o))
    return {"beat": best[1], "phase": best[2]}


@lru_cache(maxsize=16)
def grid_of(path: str, bpm: float, downbeat: float | None = None) -> dict:
    p = pulse(path, bpm)
    beat, phase = p["beat"], p["phase"]
    bar = 4 * beat
    if downbeat is not None:
        return {"beat": beat, "bar": bar, "first": downbeat % bar, "one": downbeat}
    env, env_rate = onset_envelope(load_mono(path, RATE), RATE)
    t = np.arange(len(env)) / env_rate + ONSET_DELAY
    down = [float(np.interp(np.arange(phase + k * beat, t[-1], bar), t, env).sum()) for k in range(4)]
    first = phase + int(np.argmax(down)) * beat
    return {"beat": beat, "bar": bar, "first": first % bar, "one": first % bar}


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
