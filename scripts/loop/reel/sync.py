"""
Pin a song's start in the video to the frame.

    python3 scripts/loop/reel/sync.py --src=IMG_0129.MOV --work=DIR --master=m02.m4a --near=425 [--window=20]

The owner knows roughly where each song began (his timestamps). This takes
that guess and slides the song's beat onsets against the dancer's movement
onsets within ±window seconds to find the exact start, and says how sure it
is: the correlation at the best lag against the spread of every other lag.
Chance sits around z≈3 on this footage; a real lock is z≥6.
"""
import argparse, numpy as np
from pathlib import Path
from common import motion_signal, onset_envelope, master_wav

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True); ap.add_argument("--work", required=True)
ap.add_argument("--master", required=True); ap.add_argument("--near", type=float, required=True)
ap.add_argument("--window", type=float, default=20)
a = ap.parse_args()
FPS = 15
mot = motion_signal(a.src, a.work, FPS)
mon = np.maximum(0, np.diff(mot, prepend=mot[0]))
E, efps = onset_envelope(master_wav(a.master, a.work))
t_e = np.arange(len(E)) / efps
t15 = np.arange(0, t_e[-1], 1 / FPS)
song = np.interp(t15, t_e, E)
song = np.maximum(0, song - np.convolve(song, np.ones(15) / 15, "same"))
song = (song - song.mean()) / (song.std() + 1e-9)
L = len(song)
best = []
lags = np.arange(int((a.near - a.window) * FPS), int((a.near + a.window) * FPS) + 1)
for lag in lags:
    if lag < 0 or lag + L > len(mon):
        continue
    m = mon[lag: lag + L]; m = (m - m.mean()) / (m.std() + 1e-9)
    best.append((float((m * song).mean()), lag))
c = np.array([b[0] for b in best]); z = (c.max() - c.mean()) / c.std()
lag = best[int(np.argmax(c))][1]
print(f"start {lag / FPS:.2f}s ({lag / FPS / 60:.2f} min)  corr {c.max():.3f}  z {z:.1f}  ({'locked' if z >= 6 else 'weak'})")
