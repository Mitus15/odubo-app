"""Where each clip sits in its song's full video: the clip's sound matched against the full video's sound."""
import json, subprocess, sys
from pathlib import Path
import numpy as np

POSTS = Path("/Users/maniodubo/Documents/Apps/odubo/projects/Loop Soul Dance/Posts/Ready to post")
RATE = 4000


def sound(path: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32).astype(np.float64)
    return a - a.mean()


def locate(clip: np.ndarray, full: np.ndarray):
    """(offset s, sharpness): the lag where the clip best matches the full sound, by normalised cross-correlation."""
    n = len(full) + len(clip)
    size = 1 << (n - 1).bit_length()
    xc = np.fft.irfft(np.fft.rfft(full, size) * np.conj(np.fft.rfft(clip, size)), size)[:len(full) - len(clip) + 1]
    c2 = np.concatenate([[0], np.cumsum(full ** 2)])
    energy = np.sqrt(np.maximum(c2[len(clip):] - c2[:-len(clip)], 1e-12)) * np.sqrt((clip ** 2).sum())
    score = xc / energy
    k = int(np.argmax(score))
    others = np.delete(score, range(max(0, k - RATE), min(len(score), k + RATE)))
    return k / RATE, float(score[k]), float(score[k] / (np.percentile(np.abs(others), 99.9) + 1e-9))


cat = json.loads((POSTS / "catalog.json").read_text())
fulls = {(e["song"], e["date"]): e for e in cat if e["kind"] == "full"}
cache = {}
out = {}
for e in cat:
    if e["kind"] == "full":
        continue
    f = fulls[(e["song"], e["date"])]
    if f["file"] not in cache:
        cache[f["file"]] = sound(POSTS / "full" / f["file"])
    off, score, sharp = locate(sound(POSTS / e["kind"] / e["file"]), cache[f["file"]])
    out[e["file"]] = {"full": f["file"], "offset": round(off, 2), "score": round(score, 3), "sharp": round(sharp, 1)}
    print(f"{e['file']:<46} in {f['file']:<40} at {off:7.2f}s  score {score:.3f}  x{sharp:.1f}", flush=True)
(Path.home() / "Documents/Apps/odubo/projects/Loop Soul Dance/Work files/catalogue/offsets.json").write_text(json.dumps(out, indent=1))
