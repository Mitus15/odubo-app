"""
The catalogue: every piece since Billie Jean, rebuilt with the painted strokes, laid out as
posts/reels, posts/shorts, posts/full, with an index page, a caption list and contact sheets.
Usage: python3 catalog.py [only-these-names...]
"""
import html, json, math, shutil, subprocess, sys
from pathlib import Path
import time as _t
while (Path(__file__).resolve().parent / 'hold').exists():  # a redraw is still writing renders
    _t.sleep(15)
import numpy as np
import cv2

MEDIA = Path.home() / "Documents/Loop-soul-the-entertainment-room"
WORK = MEDIA / "film-work"  # a shortcut to projects/Loop Soul Dance/Work files
POSTS = Path.home() / "Documents/Apps/odubo/projects/Loop Soul Dance/Posts/Ready to post"
DATA = Path.home() / "Documents/Apps/odubo/projects/Loop Soul Dance/Work files/catalogue"  # grid, plans, offsets, his song starts
G = json.loads((DATA / "grid.json").read_text())
PLAN = json.loads((DATA / "oct21-plan.json").read_text())
NEW = json.loads((DATA / "oct22-23-plan.json").read_text()) if (DATA / "oct22-23-plan.json").exists() else {}
OFFSETS = json.loads((DATA / "offsets.json").read_text())   # where each older clip sits in its full video (offsets.py)
STARTS = json.loads((DATA / "song-starts.json").read_text()) if (DATA / "song-starts.json").exists() else {}  # the song time at each full video's first frame (negative: the song begins later)
LOCKS = json.loads((DATA / "song-locks.json").read_text()) if (DATA / "song-locks.json").exists() else {}  # how each start was found, and the song's length
FPS, FADE = 30, 0.04

SONGS = {
    "fils-de-joie": ("Fils de joie", "Stromae", "1011"), "sante": ("Santé", "Stromae", "1011"),
    "raise-da-roof": ("Raise Da Roof", "Jazzman Olofin ft. Adewale Ayuba", "1013"),
    "give-life-back-to-music": ("Give Life Back to Music", "Daft Punk", "1014"),
    "hold-the-line": ("Hold the Line", "Toto", "1014"),
    "planet-rock": ("Planet Rock", "Afrika Bambaataa & the Soulsonic Force", "1019"),
    "fly-as-me": ("Fly as Me", "Silk Sonic", "1019"),
    "around-the-world": ("Around the World", "Daft Punk", "1021"),
    "prayer-in-c": ("Prayer in C", "Lilly Wood & The Prick and Robin Schulz", "1021"),
    "lady-hear-me-tonight": ("Lady (Hear Me Tonight)", "Modjo", "1021"),
    "molowo-noni": ("Molowo Noni", "Samklef ft. Wizkid, D'Prince & Ice Prince", "1013"),
    "memories": ("Memories", "David Guetta ft. Kid Cudi", "1022"),
    "on-form": ("On Form", "Burna Boy", "1023"),
    "monkey": ("Monkey", "M.I Abaga", "1023"),
}
FULL_SRC = {
    "fils-de-joie": (WORK / "img-0327/out/dance-fils-de-joie-v6-full.mp4", 8.1582, "fils-de-joie", False),
    "sante": (WORK / "img-0327/out/dance-sante-v6-full.mp4", 222.4491, "sante", False),
    **{s: (WORK / f"train-0344-full-{s}/out/dance-training-full-{s}-full.mp4", t0, f"train-0344-full-{s}", True)
       for s, t0 in (("planet-rock", 46.916), ("fly-as-me", 375.297))},
    **{s: (WORK / f"train-0356-full-{s}/out/dance-training-full-{s}-full.mp4", t0, f"train-0356-full-{s}", True)
       for s, t0 in (("around-the-world", 3.0), ("prayer-in-c", 333.0), ("lady-hear-me-tonight", 530.0))},
    **{s: (WORK / f"train-{take}-full-{s}/out/dance-training-full-{s}-full.mp4", t0, f"train-{take}-full-{s}", True)
       for s, take, t0 in (("molowo-noni", "0330", 2.0), ("raise-da-roof", "0330", 274.0),
                           ("give-life-back-to-music", "0337", 2.0), ("hold-the-line", "0337", 287.0))},
}
FULL_SRC.update({s: (WORK / f"train-{take}-full-{s}/out/dance-training-full-{s}-full.mp4", t0, f"train-{take}-full-{s}", True)
                 for s, take, t0 in (("memories", "0359", 287.0), ("on-form", "0362", 42.0), ("monkey", "0362", 315.0))})
MOLOWO = DATA / "molowo-plan.json"
FULL_NAME = {}  # song -> its full video's name, filled by main()
YOUTUBE_DIR = POSTS / "youtube"
YOUTUBE = json.loads((YOUTUBE_DIR / "youtube.json").read_text()) if (YOUTUBE_DIR / "youtube.json").exists() else {}
# which recording he danced to, where the title alone could pick the wrong one in the apps
VERSION = {"planet-rock": "the 1982 single, 5:20, not the 6:24 12-inch",
           "prayer-in-c": "the Robin Schulz radio edit, 3:09",
           "around-the-world": "the album version, 7:10", "lady-hear-me-tonight": "the album version, 5:07"}


def pieces():
    """(kind, name, song, caption, how): how = ("bars", song, b0, b1|None) or ("file", path, silent)."""
    out = []
    add = lambda kind, name, song, cap, how: out.append((kind, name, song, cap, how))  # noqa: E731
    # Stromae: the two levels, two Reels each, four moments each
    for song, level, reels, moments in (
            ("fils-de-joie", "1-2", [("a", 1, 32, "Next level."), ("b", 77, None, "Stage clear.")],
             [("1-open", 1, "Ready?"), ("2-knee", 19, "Combo."), ("3-leap", 89, "Power up."), ("4-finish", 98, "Victory.")]),
            ("sante", "1-3", [("a", 1, 24, "Cheers, player one."), ("b", 49, None, "Level complete.")],
             [("1-open", 1, "Start."), ("2-crouch", 18, "Checkpoint."), ("3-kick", 52, "High score."), ("4-sweep", 61, "Bonus round.")])):
        add("full", f"1011-{song}-level-{level}", song, f"Level {level}.", ("bars", song, None, None))
        for x, b0, b1, cap in reels:
            add("reels", f"1011-{song}-reel-{x}", song, cap, ("bars", song, b0, b1))
        for tag, b0, cap in moments:
            add("shorts", f"1011-{song}-short-{tag}", song, cap, ("bars", song, b0, b0 + 3))
    # Oct 13/14: each song whole; Molowo Noni's Reels and shorts from its whole render
    for song, cap in (("molowo-noni", "Warm start."), ("raise-da-roof", "Roof up."),
                      ("give-life-back-to-music", "Extra lives."), ("hold-the-line", "Stay on the line.")):
        add("full", f"{SONGS[song][2]}-{song}-full", song, cap, ("bars", song, None, None))
    if MOLOWO.exists():
        plan = json.loads(MOLOWO.read_text())
        for x, b0, cap in zip("ab", plan["reels"], ["First stage.", "Afro mode."]):
            add("reels", f"1013-molowo-noni-reel-{x}", "molowo-noni", cap, ("bars", "molowo-noni", b0, b0 + plan["reel_bars"] - 1))
        for k, (b0, cap) in enumerate(zip(plan["shorts"], ["Wind up.", "Bounce.", "Lean in."]), 1):
            add("shorts", f"1013-molowo-noni-short-{k}", "molowo-noni", cap, ("bars", "molowo-noni", b0, b0 + plan["short_bars"] - 1))
    # Oct 13/14: windowed renders
    for take, song, x, cap in (("reel-0330-raise-da-roof-a", "raise-da-roof", "a", "Warm up."),
                               ("reel-0330-raise-da-roof-b", "raise-da-roof", "b", "Balance check."),
                               ("reel-0337-give-life-back-to-music-a", "give-life-back-to-music", "a", "Rewind."),
                               ("reel-0337-give-life-back-to-music-b", "give-life-back-to-music", "b", "Lock in."),
                               ("reel-0337-hold-the-line-a", "hold-the-line", "a", "Run it back."),
                               ("reel-0337-hold-the-line-b", "hold-the-line", "b", "Again and again.")):
        silent = False  # every piece has a sound version; its silent twin is made from it
        add("reels", f"{SONGS[song][2]}-{song}-reel-{x}", song, cap, ("file", WORK / take / "out" / f"dance-reel-{'silent' if silent else 'full'}.mp4", silent))
    for take, name, song, cap in (("train-0330d", "balance", "raise-da-roof", "Steady."), ("train-0330b", "arch", "raise-da-roof", "Look up."),
                                  ("train-0337d", "points", "hold-the-line", "Continue?"), ("train-0337a", "lunge", "give-life-back-to-music", "Respawn."),
                                  ("train-0337e", "lunges", "hold-the-line", "Again."), ("train-0337c", "point", "give-life-back-to-music", "Retry."),
                                  ("train-0337b", "locks", "give-life-back-to-music", "Press start.")):
        silent = False  # every piece has a sound version; its silent twin is made from it
        add("shorts", f"{SONGS[song][2]}-{song}-short-{name}", song, cap,
            ("file", WORK / take / "out" / f"dance-training-{name}-{'silent' if silent else 'full'}.mp4", silent))
    # Oct 19: the songs whole, Reels from them, the seven shorts (windowed renders)
    for song, cap, reels in (("planet-rock", "Practice mode.", [("a", 17, 48, "Boot up."), ("b", 73, 104, "Player one, go."), ("c", 137, 168, "Low mode.")]),
                             ("fly-as-me", "Free play.", [("a", 25, 48, "Fly mode."), ("b", 49, 72, "Wings unlocked.")])):
        add("full", f"1019-{song}-full", song, cap, ("bars", song, None, None))
        for x, b0, b1, c in reels:
            add("reels", f"1019-{song}-reel-{x}", song, c, ("bars", song, b0, b1))
    for move, song, cap in (("slide", "planet-rock", "Insert coin."), ("step-in", "planet-rock", "Player one."),
                            ("lean-back", "planet-rock", "Hold."), ("ground", "planet-rock", "Crouch."),
                            ("reach", "fly-as-me", "Level up."), ("fly", "fly-as-me", "Pause."), ("wings", "fly-as-me", "Extra life.")):
        label = {"fly": "hands"}.get(move, move)
        add("shorts", f"1019-{song}-short-{label}", song, cap, ("file", WORK / f"train-0344-{move}" / "out" / f"dance-training-{move}-full.mp4", False))
    # Oct 21: the songs whole, Reels and shorts from them
    caps = {"around-the-world": ("Free roam.", ["New world.", "Orbit.", "Round two."], ["Spin.", "Loop.", "Warp."]),
            "prayer-in-c": ("Quiet run.", ["Save point.", "Hold on."], ["Breathe.", "Rise.", "Steady hands."]),
            "lady-hear-me-tonight": ("Two player.", ["Player two?", "Co-op."], ["Hear me.", "Duet.", "Encore."])}
    for song, plan in PLAN.items():
        full_cap, reel_caps, short_caps = caps[song]
        add("full", f"1021-{song}-full", song, full_cap, ("bars", song, None, None))
        for x, b0, cap in zip("abc", plan["reels"], reel_caps):
            add("reels", f"1021-{song}-reel-{x}", song, cap, ("bars", song, b0, b0 + plan["reel_bars"] - 1))
        for k, (b0, cap) in enumerate(zip(plan["shorts"], short_caps), 1):
            add("shorts", f"1021-{song}-short-{k}", song, cap, ("bars", song, b0, b0 + plan["short_bars"] - 1))
    # Oct 22 and 23: the songs whole, Reels and shorts from them (oct22-23-plan.json)
    for song, plan in NEW.items():
        day = SONGS[song][2]
        add("full", f"{day}-{song}-full", song, plan["full_caption"], ("bars", song, None, None))
        for x, (b0, cap) in zip("abc", plan["reels"]):
            add("reels", f"{day}-{song}-reel-{x}", song, cap, ("bars", song, b0, b0 + plan["reel_bars"] - 1))
        for k, (b0, cap) in enumerate(plan["shorts"], 1):
            add("shorts", f"{day}-{song}-short-{k}", song, cap, ("bars", song, b0, b0 + plan["short_bars"] - 1))
    return out


def song_at_full(song: str):
    """The song's time at its full video's first frame (song-starts.json), or None."""
    return STARTS.get(FULL_NAME.get(song, ""))


def first_frame(fname, song, how) -> int:
    """
    Where a piece opens, as a frame of its source. The Instagram and TikTok sound pickers start a
    song on a whole second, so every piece opens on one: a piece cut by bars from the full render
    opens up to a second earlier (a short lead-in); a separately rendered piece loses up to a
    second from its head; one that opened before the song opens on its first note.
    """
    s = song_at_full(song)
    if how[0] == "bars":
        _, key, b0, _ = how
        src, t0, gkey, _ = FULL_SRC[key]
        f0 = round((G[gkey]["one"] + (b0 - 1) * G[gkey]["bar"] - t0) * FPS)
        if s is None:
            return f0
        x = s + f0 / FPS
        n = 0 if x < 0 else math.floor(x + 1e-6)
        return max(0, round((n - s) * FPS))
    if s is None:
        return 0
    x = s + OFFSETS[fname]["offset"]
    n = 0 if x < 0 else math.ceil(x - 1e-6)
    return round((n - x) * FPS)


def in_full(kind, fname, song, how) -> float:
    """Where a piece starts in its song's full video, seconds."""
    if kind == "full":
        return 0.0
    if how[0] == "bars" and how[2] is not None:
        return round(first_frame(fname, song, how) / FPS, 3)
    return round(OFFSETS[fname]["offset"] + first_frame(fname, song, how) / FPS, 3)


def frames_in(path: Path) -> int:
    return int(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries",
                               "stream=nb_read_frames", "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout)


def length(path: Path) -> float:
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                                capture_output=True, text=True).stdout)


def source_of(how) -> Path:
    return how[1] if how[0] == "file" else FULL_SRC[how[1]][0]


def make(kind, name, song, how, dest: Path):
    if how[0] == "file":
        src, silent = how[1], how[2]
        trim = first_frame(dest.name, song, how)
        if trim:  # open on the whole second
            af = (["loudnorm=I=-14:TP=-1.5:LRA=11"] if not silent else [])
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", f"trim=start_frame={trim},setpts=PTS-STARTPTS",
                            "-af", ",".join([f"atrim=start={trim / FPS:.4f}", "asetpts=PTS-STARTPTS", f"afade=t=in:d={FADE}"] + af),
                            "-c:v", "h264_videotoolbox", "-q:v", "65", "-pix_fmt", "yuv420p", "-ar", "48000",
                            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dest)], check=True)
        elif silent:
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-c", "copy", "-movflags", "+faststart", str(dest)], check=True)
        else:
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
                            "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dest)], check=True)
        return
    _, key, b0, b1 = how
    src, t0, gkey, room = FULL_SRC[key]
    g = G.get(gkey)  # a whole render needs no grid
    sound = ["loudnorm=I=-14:TP=-1.5:LRA=11"] if room else []
    if b0 is None:  # the whole render
        af = ",".join(sound) if sound else "anull"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-c:v", "copy", "-af", af, "-ar", "48000", "-c:a", "aac",
                        "-b:a", "192k", "-movflags", "+faststart", str(dest)], check=True)
        return
    f0 = first_frame(dest.name, song, how)
    f1 = round((g["one"] + b1 * g["bar"] - t0) * FPS) if b1 else frames_in(src)
    a, d = f0 / FPS, (f1 - f0) / FPS
    chain = [f"atrim=start={a:.4f}:duration={d:.4f}", "asetpts=PTS-STARTPTS", f"afade=t=in:d={FADE}"]
    if b1:
        chain.append(f"afade=t=out:st={d - FADE:.4f}:d={FADE}")
    chain += sound
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", f"trim=start_frame={f0}:end_frame={f1},setpts=PTS-STARTPTS",
                    "-af", ",".join(chain), "-c:v", "h264_videotoolbox", "-q:v", "65", "-pix_fmt", "yuv420p", "-ar", "48000",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dest)], check=True)


def hush(src: Path, out: Path):
    """The same video stream, frame for frame, over silence: post it and add the song in the app."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest",
                    "-movflags", "+faststart", str(out)], check=True)


def thumb(path: Path, out: Path):
    t = length(path) * 0.4
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(path), "-frames:v", "1", "-vf", "scale=360:-2",
                    "-q:v", "4", str(out)], check=True)


def sheet(entries, out: Path, cols=8):
    tiles = []
    for e in entries:
        img = cv2.imread(str(POSTS / e["thumb"]))
        img = cv2.resize(img, (240, 426))
        cv2.rectangle(img, (0, 396), (240, 426), (255, 255, 255), -1)
        cv2.putText(img, f"{e['file'][:-4][:28]}", (5, 415), cv2.FONT_HERSHEY_SIMPLEX, 0.33, (20, 20, 20), 1, cv2.LINE_AA)
        tiles.append(img)
    while len(tiles) % cols:
        tiles.append(np.full_like(tiles[0], 255))
    cv2.imwrite(str(out), np.vstack([np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]), [cv2.IMWRITE_JPEG_QUALITY, 86])


def main(only):
    entries = []
    all_pieces = pieces()
    full_of = {song: name for kind, name, song, _, _ in all_pieces if kind == "full"}
    FULL_NAME.update(full_of)
    for kind, name, song, cap, how in all_pieces:
        fname, quiet = f"{name}.mp4", f"{name}-silent.mp4"
        dest = POSTS / kind / fname
        dest.parent.mkdir(parents=True, exist_ok=True)
        (POSTS / "thumbs").mkdir(parents=True, exist_ok=True)
        if not source_of(how).exists() or how[0] == "bars" and how[2] is not None and FULL_SRC[how[1]][2] not in G:
            print(f"waiting: {kind}/{fname} (not rendered yet)", flush=True)
            continue
        if not only or name in only:
            make(kind, name, song, how, dest)
            thumb(dest, POSTS / "thumbs" / f"{name}.jpg")
            print(f"{kind}/{fname}", flush=True)
        if dest.exists() and (not (POSTS / kind / quiet).exists() or (POSTS / kind / quiet).stat().st_mtime < dest.stat().st_mtime):
            hush(dest, POSTS / kind / quiet)
            print(f"{kind}/{quiet}", flush=True)
        if dest.exists():
            title, artist, day = SONGS[song]
            entries.append({"kind": kind, "file": fname, "thumb": f"thumbs/{name}.jpg", "song": title, "artist": artist,
                            "date": f"Oct {int(day[2:])}", "caption": cap, "seconds": round(length(dest), 1), "quiet": quiet, "faint": day == "1014",
                            "full_video": f"{full_of[song]}.mp4", "in_full": in_full(kind, fname, song, how)})
            e = entries[-1]
            if full_of[song] in STARTS:  # the song time at the full video's first frame
                e["song_from"] = round(STARTS[full_of[song]] + e["in_full"], 1)
                e["song_to"] = round(e["song_from"] + e["seconds"], 1)
                e["song_length"] = (LOCKS.get(full_of[song]) or {}).get("song_length")
                e["version"] = VERSION.get(song, "")
            if kind == "full" and (YOUTUBE_DIR / fname).exists():  # the YouTube cut, the song laid in (youtube.py)
                e["youtube"] = {**YOUTUBE.get(name, {}), "file": f"youtube/{fname}"}
    (POSTS / "catalog.json").write_text(json.dumps(entries, indent=1, ensure_ascii=False))
    for kind in ("reels", "shorts", "full"):
        rows = [e for e in entries if e["kind"] == kind]
        if rows:
            sheet(rows, POSTS / f"00-{kind}-sheet.jpg")
    write_text(entries)
    write_index(entries)
    print(POSTS)


def mmss(s):
    return f"{int(s // 60)}:{int(s % 60):02d}" if s >= 60 else f"{s:.0f} s"


def clock(s: float) -> str:
    s = int(round(s))
    return f"{s // 60}:{s % 60:02d}"


def where(e) -> str:
    """Where in the song the piece plays, as he lines it up in the app."""
    if "youtube" in e and "song_from" in e["youtube"]:
        y = e["youtube"]
        return f"Song laid in: {clock(y['song_from'])} to {clock(y['song_to'])} (opens on {y['opens']}, closes on {y['closes']})"
    if "song_from" in e:
        a, b, end = e["song_from"], e["song_to"], e.get("song_length")
        if e["kind"] != "full":  # the silent file, the app's sound from a whole second
            line = f"Sound from {clock(max(0, a))} (to {clock(min(b, end) if end else b)})"
        else:
            line = f"Song: {clock(max(0, a))} to {clock(min(b, end) if end else b)}"
        if a < -0.5:  # the piece opens before the song does
            line += f" (the song starts {round(-a)} s into the video)"
        if end and b > end + 0.5:
            line += f" (the song ends {round(end - a)} s into the video)"
        return line
    if e["kind"] == "full":
        return "Song: to come (where in the song this video begins)"
    return f"Song: to come ({clock(e['in_full'])} to {clock(e['in_full'] + e['seconds'])} into the full video)"


def write_text(entries):
    lines = ["POSTS (none of these are up yet)", "",
             "Reels are 30 s to 1 min, shorts 7 to 15 s, the full versions are the home (YouTube, the site).",
             "Reels and shorts: post <name>-silent.mp4 and add the song in the app (Instagram, TikTok, YouTube",
             "Shorts), starting the sound at the time given. Every piece opens on that whole second of the song,",
             "so it lines up as it is. <name>.mp4 is the same video with the room's sound, to check by ear.",
             "Full: the YouTube cut in youtube/, the official song already laid in.",
             "Oct 14 (marked *): the room was faint; its sound is turned up, noisy, there to line up by.",
             "Captions: one line, the game talking, no hashtags. Pick one or post with none.", ""]
    for kind, head in (("reels", "REELS"), ("shorts", "SHORTS"), ("full", "FULL")):
        lines += [head, ""]
        for e in (x for x in entries if x["kind"] == kind):
            mark = "*" if e["faint"] else ""
            y = e.get("youtube", {})
            head = f"{mark}{e['file'][:-4]}  ({mmss(y.get('seconds', e['seconds']))}, {e['date']})"
            lines += [head + (f"  {y['file']}" if y else ""),
                      f"  {e['song']} · {e['artist']}" + (f" ({e['version']})" if e.get("version") else ""),
                      f"  {where(e)}",
                      f"  Caption: {e['caption']}", ""]
    (POSTS / "CATALOG.txt").write_text("\n".join(lines))


def write_index(entries):
    css = """
:root{--bg:#f4efe6;--ink:#2a0f0a;--muted:#7a6a62;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#1a1210;--ink:#f0e6dc;--muted:#a8978e;--card:#261c19}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.4 -apple-system,system-ui,sans-serif}
header{padding:28px 16px 8px}h1{font-size:28px;margin:0}header p{margin:6px 0 0;color:var(--muted)}
nav{position:sticky;top:0;background:var(--bg);padding:10px 16px;display:flex;gap:8px;z-index:2}
nav a{color:var(--ink);text-decoration:none;border:1px solid var(--ink);border-radius:999px;padding:6px 14px}
section{padding:8px 16px 32px}h2{font-size:20px;margin:16px 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
.card{background:var(--card);border-radius:10px;overflow:hidden}
video{width:100%;aspect-ratio:9/16;display:block;background:#000;object-fit:cover}
.meta{padding:8px 10px 10px}.cap{font-weight:600}.song,.small{color:var(--muted);font-size:13px}.small a{color:var(--ink)}
"""
    parts = ["<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>",
             f"<title>Posts</title><style>{css}</style></head><body>",
             "<header><h1>Posts</h1><p>Everything since Billie Jean. Each one with sound and silent, and where it plays in the song.</p></header>",
             "<nav><a href='#reels'>Reels</a><a href='#shorts'>Shorts</a><a href='#full'>Full</a></nav>"]
    for kind, head in (("reels", "Reels"), ("shorts", "Shorts"), ("full", "Full")):
        rows = [e for e in entries if e["kind"] == kind]
        parts.append(f"<section id={kind}><h2>{head} · {len(rows)}</h2><div class=grid>")
        for e in rows:
            note = " · room faint" if e["faint"] else ""
            y = e.get("youtube")
            src = y["file"] if y else f"{kind}/{e['file']}"
            links = (f"<a href='{html.escape(y['file'])}'>YouTube cut</a> · <a href='{kind}/{html.escape(e['file'])}'>Room sound</a>" if y else
                     f"<a href='{kind}/{html.escape(e['file'])}'>Sound</a> · <a href='{kind}/{html.escape(e['quiet'])}'>Silent</a>")
            parts.append(f"<div class=card><video controls preload=none playsinline poster='{html.escape(e['thumb'])}' "
                         f"src='{html.escape(src)}'></video><div class=meta><div class=cap>{html.escape(e['caption'])}</div>"
                         f"<div class=song>{html.escape(e['song'])} · {html.escape(e['artist'])}</div>"
                         f"<div class=small>{e['date']} · {mmss(y.get('seconds', e['seconds']) if y else e['seconds'])}{note}</div>"
                         f"<div class=small>{html.escape(where(e))}</div>"
                         f"<div class=small>{links}</div></div></div>")
        parts.append("</div></section>")
    parts.append("</body></html>")
    (POSTS / "index.html").write_text("\n".join(parts))


if __name__ == "__main__":
    main(set(sys.argv[1:]))
