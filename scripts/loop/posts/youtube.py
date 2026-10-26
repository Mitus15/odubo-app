"""
The YouTube cuts: each full video with the official song laid in, cut so it opens and closes
like a piece, not a recording. Usage: python3 youtube.py [names...]

- Opens on the song's first note when he is already in place by then; when the song was playing
  before he settled (the camera set up, the walk back), on the first bar after he settles, the
  song easing in over a beat.
- Closes on the last bar before he stops (walks to the camera, changes the song), the song fading
  over two bars and the picture fading to its floor in the last second; or on the song's own end.
- The song is the official track at song-starts.json's place, at its mastered level; the room's
  sound is not used. In and out points: Work files/catalogue/youtube-cuts.json.
Writes Posts/Ready to post/youtube/<name>.mp4 and youtube.json (where each cut sits in the song).
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np

HOME = Path.home()
P = HOME / "Documents/Apps/odubo/projects/Loop Soul Dance"
DATA = P / "Work files/catalogue"
FULL = P / "Posts/Ready to post/full"
OUT = P / "Posts/Ready to post/youtube"
STARTS = json.loads((DATA / "song-starts.json").read_text())
LOCKS = json.loads((DATA / "song-locks.json").read_text())
CUTS = json.loads((DATA / "youtube-cuts.json").read_text())
STROMAE = P / "Work files/img-0327/songs"
FPS = 30
EASE_IN = 0.5       # seconds of fade when the cut opens mid-song
FADE_BARS = 2       # bars the song fades over at the close
PICTURE_OUT = 1.0   # seconds the picture fades to its floor


def song_file(name: str) -> Path:
    if "fils-de-joie" in name:
        return STROMAE / "fils-de-joie.mp3"
    if "sante" in name:
        return STROMAE / "sante.mp3"
    f = LOCKS[name]["song_file"]
    return Path(f[:f.index(".mp3") + 4].replace("~", str(HOME)))


def bars(song: Path):
    """Downbeats of the official track (song seconds): its beats, and the phase of four where the chords change."""
    import librosa
    y, sr = librosa.load(str(song), sr=22050, mono=True)
    _, beats = librosa.beat.beat_track(y=y, sr=sr, units="frames", tightness=100)
    chroma = librosa.util.sync(librosa.feature.chroma_cqt(y=y, sr=sr), beats, aggregate=np.median)
    change = np.r_[0, np.linalg.norm(np.diff(chroma, axis=1), axis=0)]
    spec = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
    low = np.log1p(spec[librosa.fft_frequencies(sr=sr, n_fft=2048) < 150].sum(0))
    kick = np.maximum(0, np.diff(low, prepend=low[0]))[beats]
    score = [np.mean(change[p::4]) / (change.mean() + 1e-9) + np.mean(kick[p::4]) / (kick.mean() + 1e-9) for p in range(4)]
    t = librosa.frames_to_time(beats, sr=sr, hop_length=512)
    phase = int(np.argmax(score))
    down, bar, L = t[phase::4], float(np.median(np.diff(t))) * 4, len(y) / sr
    # carry the grid through an intro or a fading outro, where the tracker loses the beat
    before = down[0] - bar * np.arange(int(down[0] // bar), 0, -1)
    after = down[-1] + bar * np.arange(1, int((L - down[-1]) // bar) + 1)
    return np.r_[before, down, after], bar, L


def floor_colour(video: Path, t: float) -> str:
    """The flat ground beside him: a strip at the frame's left edge, middle height."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1", "-vf", "scale=108:192",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    img = np.frombuffer(raw, np.uint8).reshape(192, 108, 3)
    r, g, b = np.median(img[60:120, 2:14].reshape(-1, 3), 0).astype(int)
    return f"0x{r:02x}{g:02x}{b:02x}"


def plan(name: str) -> dict:
    video, song, s = FULL / f"{name}.mp4", song_file(name), STARTS[name]
    V = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(video)],
                             capture_output=True, text=True).stdout)
    down, bar, L = bars(song)
    cut = CUTS[name]
    song_in = -s                     # the song's first note, in video seconds
    if song_in >= cut["settled"] - 0.05:
        a, eased = max(0.0, song_in), False
    else:                            # the first bar after he settles
        a = next(d - s for d in down if d - s >= cut["settled"])
        eased = True
    stop = min(cut["stop"], V, L - s)
    if cut.get("to_end"):            # a level video with its own outro: keep its ending
        b, natural = V, True
    elif L - s <= stop + 0.05:       # the song ends first: end with it
        b, natural = L - s, True
    else:
        b, natural = max(d - s for d in down if d - s <= stop), False
    f0, f1 = round(a * FPS), round(b * FPS)
    return {"video": str(video), "song": str(song), "song_at": round(f0 / FPS + s, 3), "start": f0 / FPS, "end": f1 / FPS,
            "frames": (f0, f1), "eased": eased, "natural_end": natural, "bar": round(bar, 3),
            "colour": floor_colour(video, max(0, f1 / FPS - 2))}


def make(name: str) -> dict:
    p = plan(name)
    f0, f1 = p["frames"]
    d = (f1 - f0) / FPS
    fade = min(FADE_BARS * p["bar"], 6.0) if not p["natural_end"] else 0.6
    vf = [f"trim=start_frame={f0}:end_frame={f1}", "setpts=PTS-STARTPTS"]
    if p["eased"]:
        vf.append(f"fade=t=in:st=0:d={EASE_IN}:color={p['colour']}")
    vf.append(f"fade=t=out:st={d - PICTURE_OUT:.3f}:d={PICTURE_OUT}:color={p['colour']}")
    af = [f"atrim=start={p['song_at']:.3f}:duration={d:.3f}", "asetpts=PTS-STARTPTS"]
    if p["eased"]:
        af.append(f"afade=t=in:d={EASE_IN}")
    af.append(f"afade=t=out:st={d - fade:.3f}:d={fade:.3f}")
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / f"{name}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", p["video"], "-i", p["song"],
                    "-filter_complex", f"[0:v]{','.join(vf)}[v];[1:a]aresample=48000,{','.join(af)}[a]",
                    "-map", "[v]", "-map", "[a]", "-c:v", "h264_videotoolbox", "-q:v", "75", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", str(dest)], check=True)
    row = {"file": dest.name, "song_from": p["song_at"], "song_to": round(p["song_at"] + d, 3), "seconds": round(d, 2),
           "video_from": p["start"], "video_to": p["end"], "opens": "mid-song, eased" if p["eased"] else "the song's first note",
           "closes": ("its own outro" if CUTS[name].get("to_end") else "the song's end") if p["natural_end"]
           else f"a bar line, {fade:.1f} s fade"}
    print(f"{name:34s} video {p['start']:6.2f}-{p['end']:6.2f} ({int(d // 60)}:{d % 60:04.1f})  song {p['song_at']:6.2f}  "
          f"{row['opens']:22s} {row['closes']}", flush=True)
    return row


if __name__ == "__main__":
    names = sys.argv[1:] or [k for k in CUTS if not k.startswith("_")]
    index = OUT / "youtube.json"
    rows = json.loads(index.read_text()) if index.exists() else {}
    for name in names:
        rows[name] = make(name)
        index.write_text(json.dumps(rows, indent=1))
