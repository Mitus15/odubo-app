"""
Hear the words: a first transcription of every song, for Mani to correct.

    npm run film:transcribe                  # all fourteen, pushed to admin
    npm run film:transcribe -- 9 6           # just Makunahea and News Peak
    npm run film:transcribe -- --no-push     # write the files only
    npm run film:transcribe -- --model=small # a smaller model (turbo is default)
    npm run film:transcribe -- --force       # redo songs already transcribed

For each song:
  1. The vocals alone. From a stem if one exists (FILM_STEMS/<slug>/vox.*, or
     the Fract pack for News Peak); otherwise separated from the master with
     Demucs (`pip install demucs`, about 80 MB of model on first use).
  2. Where a voice actually sings: the vocal stem's loudness, above its own
     noise floor, gaps under 0.6 s merged. A song with no voice is marked
     instrumental and never sent to Whisper, which would otherwise invent words.
  3. Whisper (openai-whisper, already installed), word timestamps on, only
     over the sung ranges, never conditioned on its own previous guess.

Writes $FILM_WORK/lyrics/NN.json and, unless --no-push, puts the draft beside
the chapter at /loop/admin/film (loop_film_chapters.lyrics_draft). Corrected
words are saved to the song from there. Nothing here is ever shown to a guest.

Needs disk: the turbo model is 1.6 GB, Demucs writes ~50 MB per song.
"""
import json, os, subprocess, sys
from pathlib import Path
import numpy as np
from film_common import SONGS, WORK, d1, master, run, work

HOME = Path.home()
STEMS = Path(os.environ.get("FILM_STEMS", HOME / "Documents/Apps/fract/stems")).expanduser()
KNOWN_VOX = {"newspeak": HOME / "Documents/Apps/fract/packs/newspeak/vox.opus"}
FRAME_S = 0.05


def rms_db(x: np.ndarray, rate: int, frame_s: float = FRAME_S) -> np.ndarray:
    n = max(1, int(rate * frame_s))
    k = len(x) // n
    if k == 0:
        return np.array([-120.0])
    fr = x[: k * n].reshape(k, n)
    return 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)


def voiced_segments(db: np.ndarray, frame_s: float = FRAME_S, floor_db: float = -50.0,
                    above_noise: float = 18.0, merge_gap: float = 0.6, min_len: float = 0.4):
    """
    Where a voice is: frames louder than both an absolute floor and the stem's
    own noise (its 10th percentile) by `above_noise` dB, merged across short
    breaths, short blips dropped. Pure, so it is tested without a model.
    """
    if not len(db):
        return []
    noise = float(np.percentile(db, 10))
    on = db > max(floor_db, noise + above_noise)
    segs, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        elif not v and start is not None:
            segs.append([start * frame_s, i * frame_s])
            start = None
    if start is not None:
        segs.append([start * frame_s, len(on) * frame_s])
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < merge_gap:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return [[round(a, 2), round(b, 2)] for a, b in merged if b - a >= min_len]


# What Whisper says when it hears music and no words: the sign-off of every
# video it was trained on. Never a lyric here.
HALLUCINATIONS = ("thanks for watching", "thank you for watching", "subscribe", "see you next time",
                  "see you soon", "please like", "amara.org", "subtitles by")


def doubtful(seg: dict, text: str) -> bool:
    """A line Whisper was unsure of, or one of its stock inventions."""
    t = text.lower()
    if any(h in t for h in HALLUCINATIONS):
        return True
    if seg.get("no_speech_prob", 0) > 0.6 or seg.get("avg_logprob", 0) < -1.2:
        return True
    if seg.get("compression_ratio", 0) > 2.4:
        return True
    # Not English letters: the model has wandered off the language.
    letters = [c for c in text if c.isalpha()]
    return bool(letters) and sum(c.isascii() for c in letters) / len(letters) < 0.9


def load_mono(path: Path, rate: int = 16000) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(rate), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def vocals_for(song) -> tuple[Path, str]:
    slug = song["slug"]
    candidates = [KNOWN_VOX.get(slug)]
    if (STEMS / slug).exists():
        candidates += sorted((STEMS / slug).glob("vox.*"))
    for p in candidates:
        if p and Path(p).exists():
            return Path(p), f"stem {Path(p).name}"
    out = work("sep")
    target = out / "htdemucs" / f"m{song['number']:02d}" / "vocals.wav"
    if not target.exists():
        try:
            import torch
            device = "mps" if torch.backends.mps.is_available() else "cpu"
            run([sys.executable, "-m", "demucs", "--two-stems=vocals", "-n", "htdemucs", "-d", device, "-o", out,
                 master(song["number"])])
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise SystemExit("Demucs is needed to separate the vocals: pip install demucs (about 80 MB of model on first use).")
    return target, "separated by Demucs"


def main(argv):
    push = "--no-push" not in argv
    model_name = next((a.split("=", 1)[1] for a in argv if a.startswith("--model=")), "turbo")
    wanted = {int(a) for a in argv if a.isdigit()}
    songs = [s for s in SONGS if not wanted or s["number"] in wanted]
    out_dir = work("lyrics")

    import whisper  # openai-whisper; imported late so --help costs nothing
    model = None
    force = "--force" in argv
    for s in songs:
        done_path = out_dir / f"{s['number']:02d}.json"
        if done_path.exists() and not force:
            # Already heard: push the saved draft again (cheap) rather than redo it.
            print(f"{s['number']:>2} {s['title']:<19} already transcribed (--force to redo)")
            if push:
                d1("UPDATE loop_film_chapters SET lyrics_draft = ?1 WHERE slug = ?2 AND lyrics_draft IS NULL",
                   [done_path.read_text(), s["slug"]])
            continue
        vox, source = vocals_for(s)
        x = load_mono(vox)
        segs = voiced_segments(rms_db(x, 16000))
        result = {"song": s["title"], "slug": s["slug"], "vocalsFrom": source, "model": model_name,
                  "voiced": segs, "instrumental": not segs, "segments": []}
        if segs:
            if model is None:
                model = whisper.load_model(model_name)
            r = model.transcribe(str(vox), language="en", word_timestamps=True, condition_on_previous_text=False,
                                 clip_timestamps=[t for seg in segs for t in seg], fp16=False,
                                 hallucination_silence_threshold=2.0)
            for seg in r["segments"]:
                text = seg["text"].strip()
                if not text or doubtful(seg, text):
                    result["dropped"] = result.get("dropped", 0) + 1
                    continue
                result["segments"].append({
                    "start": round(seg["start"], 2), "end": round(seg["end"], 2), "text": text,
                    "words": [{"w": w["word"].strip(), "start": round(w["start"], 2), "end": round(w["end"], 2),
                               "p": round(w.get("probability", 0), 2)} for w in seg.get("words", [])],
                })
        path = out_dir / f"{s['number']:02d}.json"
        path.write_text(json.dumps(result, indent=1))
        lines = len(result["segments"])
        dropped = result.get("dropped", 0)
        print(f"{s['number']:>2} {s['title']:<19} {source:<22} "
              f"{'instrumental' if not segs else f'{lines} lines' + (f', {dropped} doubtful dropped' if dropped else '')}")
        if push:
            d1("UPDATE loop_film_chapters SET lyrics_draft = ?1, updated_at = ?2 WHERE slug = ?3",
               [json.dumps(result), __import__("datetime").datetime.utcnow().isoformat() + "Z", s["slug"]])
    print(f"written to {out_dir}" + ("; drafts are in /loop/admin/film" if push else ""))


if __name__ == "__main__":
    main(sys.argv[1:])
