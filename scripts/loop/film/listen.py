"""
Hear the album the way a machine can: its shape, not its meaning.

For each master: the loudness over time (EBU R128 momentary loudness, as one
value per second and as a 16-step contour), the integrated loudness and range,
the tempo, and the last strong hit (for Welcome, the moment he takes off).

    npm run film:listen

Writes data/loop/film/shape.json (committed: the story bible, the cut
proposals and Soul Loop's pacing read it).
"""
import json, math, re, subprocess
import numpy as np
from film_common import REPO, SONGS, master, onset_envelope, work, run

BARS = " \u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588"


def momentary(path):
    out = subprocess.run(["ffmpeg", "-v", "verbose", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    frames = [(float(t), float(m)) for t, m in re.findall(r"t:\s*([\d.]+)\s+TARGET.*?M:\s*(-?\d+\.\d+)", out)]
    integrated = [float(x) for x in re.findall(r"I:\s*(-?[\d.]+) LUFS", out)]
    lra = [float(x) for x in re.findall(r"LRA:\s*([\d.]+) LU", out)]
    return frames, (integrated[-1] if integrated else None), (lra[-1] if lra else None)


def power_mean(values):
    v = [x for x in values if x > -70]
    return 10 * math.log10(sum(10 ** (x / 10) for x in v) / len(v)) if v else -70.0


def per_second(frames, seconds):
    out = []
    for s in range(seconds):
        out.append(round(power_mean([m for t, m in frames if s <= t < s + 1]), 1))
    return out


def tempo(onset, rate):
    """
    Beats per minute from onset autocorrelation, in 65..135.

    A single autocorrelation peak confuses a tempo with its 3:2 and 2:3
    relatives (the bar lines of a slow song also repeat at 1.5x). A comb
    scores each candidate by the energy at its multiples too, so the true beat,
    which every multiple agrees on, wins.
    """
    o = onset - onset.mean()
    ac = np.correlate(o, o, "full")[len(o) - 1:]
    ac = ac / (ac[0] + 1e-9)
    lo, hi = int(rate * 60 / 135), int(rate * 60 / 65)
    scores = {lag: sum(ac[k * lag] / k for k in (1, 2, 3, 4) if k * lag < len(ac)) for lag in range(lo, hi + 1)}
    best = max(scores, key=scores.get)
    # A rival more than 10% away in tempo that scores within 10% of the best is
    # a genuine ambiguity (3:2, 4:3). Say so rather than pretend.
    rivals = [lag for lag, sc in scores.items()
              if abs(lag - best) / best > 0.1 and sc >= 0.9 * scores[best]
              and all(abs(lag - o) / o > 0.03 for o in (best,))]
    alt = round(60 * rate / max(rivals, key=scores.get), 1) if rivals else None
    return round(60 * rate / best, 1), round(float(ac[best]), 3), alt


def falls_away(per_sec):
    """The last second the song is still near its loudest: where it lets go."""
    v = np.array(per_sec, dtype=float)
    if not len(v):
        return None
    near = np.where(v >= v.max() - 3.0)[0]
    return int(near[-1]) if len(near) else None


def last_hit(onset, rate, seconds):
    """The last onset standing well above the song's own level."""
    z = (onset - onset.mean()) / (onset.std() + 1e-9)
    idx = np.where(z > 3.0)[0]
    if not len(idx):
        return None
    t = float(idx[-1] / rate)
    return round(min(t, seconds), 2)


def main():
    scratch = work("album", "wav")
    shape = {"measured": "EBU R128 momentary loudness (ffmpeg ebur128); tempo by onset autocorrelation", "songs": []}
    for s in SONGS:
        m = master(s["number"])
        frames, integrated, lra = momentary(m)
        secs = per_second(frames, s["seconds"])
        n = 16
        contour = [round(power_mean([m_ for t, m_ in frames if k * s["seconds"] / n <= t < (k + 1) * s["seconds"] / n]), 1)
                   for k in range(n)]
        wav = scratch / f"m{s['number']:02d}.11k.wav"
        if not wav.exists():
            run(["ffmpeg", "-v", "error", "-y", "-i", m, "-ac", "1", "-ar", "11025", wav])
        onset, rate = onset_envelope(str(wav))
        bpm, strength, alt = tempo(onset, rate)
        hit = last_hit(onset, rate, s["seconds"])
        peak = int(np.argmax(contour))
        shape["songs"].append({
            "number": s["number"], "slug": s["slug"], "title": s["title"],
            "integratedLufs": integrated, "rangeLu": lra,
            "bpm": bpm, "bpmAlternate": alt, "beatStrength": strength, "lastHit": hit, "fallsAwayAt": falls_away(secs),
            "loudestAt": round((peak + 0.5) / n, 3),
            "contour16": contour, "perSecond": secs,
        })
        hi = max(contour); lo = hi - 20
        spark = "".join(BARS[max(0, min(8, int((v - lo) / (hi - lo) * 8)))] for v in contour)
        print(f"{s['number']:>2} {s['title']:<19} {integrated:6.1f} LUFS  {bpm:6.1f} bpm{(' or ' + str(alt)) if alt else '':<9}  lets go at {falls_away(secs)}s  {spark}")
    dest = REPO / "data/loop/film/shape.json"
    dest.write_text(json.dumps(shape, separators=(",", ":")) + "\n")
    print(f"wrote {dest}")


if __name__ == "__main__":
    main()
