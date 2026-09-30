"""
Cut the finished pieces: a clip per card, a cut per song, and the film.

    npm run film:cut -- <take> clip <card-id> [--audio=tease|full|silent] [--effects=freeze,flip]
    npm run film:cut -- <take> song <slug>    [--audio=full|silent] [--effects=freeze,flip]
    npm run film:cut -- <take> film           [--height=2160]

    Any of --effects, --marker, --look pass through to film:compose.

  clip   9:16, for Reels, TikTok and Shorts. The card's moment of the dance,
         the scripture card laid over it, then the outro: the player's marker
         grows into the Danceman. One episode; it stands alone.
  song   16:9, the whole chapter: the chapter card, then the dance with each
         of its cards over their moments. No outro.
  film   16:9, the whole take: every chapter, every card, the outro once at
         the very end. The same render as the clips, so it matches them.

The sound is the master itself, laid where the song sits in the take, never
the room's recording of it. Before a song is out, its clips carry 4 seconds
of it at its peak and silence around them (--audio=tease); after, the song.

Every output gets a contact sheet beside it.
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from film_common import REPO, SONGS, master, run, work
from take import load_take, take_dir
import compose

FADE_CARD = 0.4
CARD_IN = 0.4
TEASE_S = 4.0


def sheet(video: Path, tiles: int = 8):
    """A strip of frames across the piece, for review at a glance."""
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(video)],
                               capture_output=True, text=True, check=True).stdout)
    step = max(0.1, dur / tiles)
    out = video.with_suffix(".sheet.jpg")
    run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf",
         f"fps=1/{step:.3f},scale=240:-2,tile={tiles}x1", "-frames:v", "1", out])
    return out


def chapter_of(story, slug):
    return next(c for c in story["chapters"] if c["slug"] == slug)


def song_of(slug):
    return next(s for s in SONGS if s["slug"] == slug)


def align_of(align, slug):
    s = next((x for x in align["songs"] if x["slug"] == slug), None)
    if s is None:
        raise SystemExit(f"{slug} is not aligned in this take (film:align)")
    return s


def peak_window(slug: str, a: float, b: float, length: float = TEASE_S) -> float:
    """Where, between master seconds a and b, the loudest `length` seconds start."""
    shape = json.loads((REPO / "data/loop/film/shape.json").read_text())
    per = next(s for s in shape["songs"] if s["slug"] == slug)["perSecond"]
    lo, hi = int(max(0, a)), int(min(len(per), b))
    n = int(length)
    if hi - lo <= n:
        return max(0.0, a)
    energy = [sum(10 ** (v / 10) for v in per[i:i + n]) for i in range(lo, hi - n + 1)]
    return float(lo + int(np.argmax(energy)))


def overlay_filters(overlays, video_label="[0:v]"):
    """Chain PNG overlays (input index, start, end) with alpha fades."""
    parts, last = [], video_label
    for n, (idx, t0, t1) in enumerate(overlays):
        fade = f"[{idx}:v]format=rgba,fade=t=in:st={t0:.3f}:d={FADE_CARD}:alpha=1,fade=t=out:st={max(t0, t1 - FADE_CARD):.3f}:d={FADE_CARD}:alpha=1[o{n}]"
        parts.append(fade)
        parts.append(f"{last}[o{n}]overlay=0:0:enable='between(t,{t0:.3f},{t1:.3f})'[v{n}]")
        last = f"[v{n}]"
    return parts, last


def mux(video: Path, pngs, overlays, audio_filter, audio_inputs, dest: Path, duration: float):
    """video + transparent PNG overlays + the audio graph -> dest."""
    inputs = ["-i", str(video)]
    for p in pngs:
        inputs += ["-loop", "1", "-t", f"{duration:.3f}", "-i", str(p)]
    for a in audio_inputs:
        inputs += a
    vparts, vlast = overlay_filters(overlays)
    graph = ";".join(vparts + [audio_filter]) if vparts else audio_filter
    vmap = vlast if vparts else "0:v"
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", vmap, "-map", "[aout]",
         "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
         "-c:a", "aac", "-b:a", "256k", "-t", f"{duration:.3f}", str(dest)])


def clip(name: str, card_id: str, audio: str, style: list = ()):
    take, d = load_take(name), take_dir(name)
    story = json.loads((d / "story.json").read_text())
    align = json.loads((d / "align.json").read_text())
    card = next(c for c in story["cards"] if c["id"] == card_id)
    if card.get("filmStart") is None or card.get("filmEnd") is None:
        raise SystemExit(f"card {card['verseRef']} has no moment in the film yet (set it in admin)")
    a, b = float(card["filmStart"]), float(card["filmEnd"])
    out_dir = work(name, "out")
    silent_video = out_dir / f"_clip-{card_id}.mp4"
    compose.main([name, f"--from={a}", f"--to={b}", "--aspect=9x16", "--outro", f"--out={silent_video}"]
                 + list(style))
    fps = take["fps"]
    tail = (len(list((work("cache", "marks") / "morph").glob("*.png"))) + int(compose.HOLD_S * fps)) / fps
    duration = (b - a) + tail
    png = d / "cards" / f"{card_id}-9x16.png"
    overlays = [(1, CARD_IN, (b - a) - compose.FLY_S)] if png.exists() else []
    slug = card["chapter"]
    al = align_of(align, slug)
    m_at = a - al["filmStart"]  # where in the master the clip starts
    src = ["-i", str(master(song_of(slug)["number"]))]
    ai = 1 + (1 if png.exists() else 0)
    if audio == "full":
        fade_at = (b - a) - compose.FLY_S
        afilter = (f"[{ai}:a]atrim=start={m_at:.3f}:duration={duration:.3f},asetpts=PTS-STARTPTS,"
                   f"afade=t=out:st={fade_at:.3f}:d={compose.FLY_S + 0.8:.3f},apad,atrim=0:{duration:.3f}[aout]")
    elif audio == "tease":
        at = peak_window(slug, m_at, m_at + (b - a))
        rel = at - m_at
        afilter = (f"[{ai}:a]atrim=start={at:.3f}:duration={TEASE_S},asetpts=PTS-STARTPTS,"
                   f"adelay={int(rel * 1000)}|{int(rel * 1000)},apad,atrim=0:{duration:.3f}[aout]")
    else:
        afilter = f"anullsrc=r=48000:cl=stereo,atrim=0:{duration:.3f}[aout]"
        src = []
    dest = out_dir / f"clip-{slug}-{card_id[:8]}-{audio}.mp4"
    mux(silent_video, [png] if png.exists() else [], overlays, afilter, [src] if src else [], dest, duration)
    silent_video.unlink(missing_ok=True)
    print(f"clip: {dest}\nsheet: {sheet(dest)}")
    return dest


def song(name: str, slug: str, audio: str, height: int = 1080, style: list = ()):
    take, d = load_take(name), take_dir(name)
    story = json.loads((d / "story.json").read_text())
    align = json.loads((d / "align.json").read_text())
    al = align_of(align, slug)
    win = take["window"]
    a, b = max(al["filmStart"], win["start"]), min(al["filmEnd"], win["end"])
    out_dir = work(name, "out")
    silent_video = out_dir / f"_song-{slug}.mp4"
    compose.main([name, f"--from={a}", f"--to={b}", "--aspect=16x9", f"--height={height}", f"--out={silent_video}"]
                 + list(style))
    duration = b - a
    pngs, overlays = [], []
    chapter_png = d / "cards" / f"chapter-{slug}.png"
    if chapter_png.exists() and a <= al["filmStart"] + 0.01:
        pngs.append(chapter_png)
        overlays.append((len(pngs), 0.0, min(3.5, duration)))
    for c in story["cards"]:
        if c["chapter"] == slug and c.get("filmStart") is not None:
            p = d / "cards" / f"{c['id']}-16x9.png"
            s0, s1 = float(c["filmStart"]) - a, float(c["filmEnd"]) - a
            if p.exists() and s1 > 0 and s0 < duration:
                pngs.append(p)
                overlays.append((len(pngs), max(0.0, s0), min(duration, s1)))
    ai = 1 + len(pngs)
    m_at = a - al["filmStart"]
    if audio == "full":
        afilter = f"[{ai}:a]atrim=start={m_at:.3f}:duration={duration:.3f},asetpts=PTS-STARTPTS,apad,atrim=0:{duration:.3f}[aout]"
        src = [["-i", str(master(song_of(slug)["number"]))]]
    else:
        afilter = f"anullsrc=r=48000:cl=stereo,atrim=0:{duration:.3f}[aout]"
        src = []
    dest = out_dir / f"song-{slug}-{audio}.mp4"
    mux(silent_video, pngs, overlays, afilter, src, dest, duration)
    silent_video.unlink(missing_ok=True)
    print(f"song: {dest}\nsheet: {sheet(dest)}")
    return dest


def film(name: str, height: int = 1080, style: list = ()):
    """The whole take, one render, chapter and scripture cards over it, the masters under it."""
    take, d = load_take(name), take_dir(name)
    story = json.loads((d / "story.json").read_text())
    align = json.loads((d / "align.json").read_text())
    win = take["window"]
    a, b = win["start"], win["end"]
    out_dir = work(name, "out")
    silent_video = out_dir / "_film.mp4"
    compose.main([name, f"--from={a}", f"--to={b}", "--aspect=16x9", f"--height={height}", "--outro", f"--out={silent_video}"]
                 + list(style))
    fps = take["fps"]
    tail = (len(list((work("cache", "marks") / "morph").glob("*.png"))) + int(compose.HOLD_S * fps)) / fps
    duration = (b - a) + tail
    pngs, overlays = [], []
    for s in align["songs"]:
        p = d / "cards" / f"chapter-{s['slug']}.png"
        t0 = s["filmStart"] - a
        if p.exists() and 0 <= t0 < (b - a):
            pngs.append(p)
            overlays.append((len(pngs), t0, min(t0 + 3.5, b - a)))
    for c in story["cards"]:
        if c.get("filmStart") is None:
            continue
        p = d / "cards" / f"{c['id']}-16x9.png"
        s0, s1 = float(c["filmStart"]) - a, float(c["filmEnd"]) - a
        if p.exists() and s1 > 0 and s0 < (b - a):
            pngs.append(p)
            overlays.append((len(pngs), max(0.0, s0), min(b - a, s1)))
    # Every master, laid at its place in the take.
    audio_inputs, parts, labels = [], [], []
    for s in align["songs"]:
        idx = 1 + len(pngs) + len(audio_inputs)
        audio_inputs.append(["-i", str(master(song_of(s["slug"])["number"]))])
        start_in_master = max(0.0, a - s["filmStart"])
        delay = max(0.0, s["filmStart"] - a)
        parts.append(f"[{idx}:a]atrim=start={start_in_master:.3f},asetpts=PTS-STARTPTS,adelay={int(delay * 1000)}|{int(delay * 1000)}[m{len(labels)}]")
        labels.append(f"[m{len(labels)}]")
    if labels:
        afilter = ";".join(parts) + f";{''.join(labels)}amix=inputs={len(labels)}:normalize=0,apad,atrim=0:{duration:.3f}[aout]"
    else:
        afilter = f"anullsrc=r=48000:cl=stereo,atrim=0:{duration:.3f}[aout]"
    dest = out_dir / "film.mp4"
    mux(silent_video, pngs, overlays, afilter, audio_inputs, dest, duration)
    silent_video.unlink(missing_ok=True)
    print(f"film: {dest}\nsheet: {sheet(dest, 12)}")
    return dest


def main(argv):
    name, kind = argv[0], argv[1]
    opts = dict(a[2:].split("=", 1) for a in argv[2:] if a.startswith("--") and "=" in a)
    style = [f"--{k}={opts[k]}" for k in ("effects", "marker", "look") if opts.get(k)]
    if kind == "clip":
        return clip(name, argv[2], opts.get("audio", "tease"), style)
    if kind == "song":
        return song(name, argv[2], opts.get("audio", "full"), int(opts.get("height", 1080)), style)
    if kind == "film":
        return film(name, int(opts.get("height", 1080)), style)
    raise SystemExit("usage: film:cut -- <take> clip <card-id> | song <slug> | film")


if __name__ == "__main__":
    main(sys.argv[1:])
