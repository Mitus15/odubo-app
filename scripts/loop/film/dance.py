"""
A dance to a song from outside the album: one take, a song or a few, a colour each.

    npm run film:dance -- <take> setup --song="<audio>" --at=<s> --bpm=<tempo> --field=#rrggbb --artist=".." [--title=".."] [--slug=x]
    npm run film:dance -- <take> cut [--from=<s> --to=<s>] [--audio=full|silent] [--name=x] [--slug=x] [--marker= --look= ..]
    npm run film:dance -- <take> cut --show=data/loop/film/shows/<name>.json --name=<name>   # the show's own bars
    npm run film:dance -- <take> cut --show=.. --from=<s> --to=<s> --outro=no   # the training ground: no outro, it loops

The album's pieces take their chapters from D1 (film:pull) and their sound
from the masters. A dance to someone else's song (the Billie Jean take) has
neither, so `setup` writes the song's chapter and its place in the take
straight into story.json and align.json, the colourway resolved by
palette.ts, the one implementation. --at is where the song's first sample
falls in the take (take seconds; found by listening, see the take's notes).

One take can hold more than one song (the Stromae take: Fils de joie, then
Santé). Give each its own --slug at setup: each setup adds its song, or
replaces the one with the same slug, and cut takes --slug to say which song
the piece is (the only song needs none).

`cut` is the social piece, 9:16: the dance on its field in the gloss look,
the marker over his head, then the outro (the seed grows into the Danceman),
with the song laid where it plays and faded under the growth. No card: a
song that is not ours carries no scripture. A training-ground piece
(--outro=no) has no outro: practice has no ending, and a short clip that
stops on the beat loops cleanly in a feed. Default range: the whole song,
as far as the take has it. Compose options (--marker, --look, --effects,
--shadow, --height) pass through.

Run ingest, segment, skin and figure first, as for any take.
"""
import json, subprocess, sys
from pathlib import Path
from film_common import work
from take import load_take, take_dir
import compose
from cut import FADE_TAIL, mux, sheet
from show import resolve_palettes

SLUG = "dance"
LOOP_FADE = 0.04  # s: a training piece's sound eases in and out this much, so the loop's seam does not click


def duration_of(path: str) -> float:
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                                capture_output=True, text=True, check=True).stdout)


def setup(name: str, opts: dict):
    for k in ("song", "at", "bpm", "field", "artist"):  # the artist: a song that is not ours is always credited
        if k not in opts:
            raise SystemExit(f"setup needs --{k}")
    load_take(name)
    d = take_dir(name)
    song = str(Path(opts["song"]).expanduser().resolve())
    at, bpm = float(opts["at"]), float(opts["bpm"])
    end = at + duration_of(song)
    slug = opts.get("slug", SLUG)
    chapter = {"slug": slug, "number": None, "title": opts.get("title", Path(song).stem), "artist": opts.get("artist", ""),
               "status": "local",
               **resolve_palettes([opts["field"]])[opts["field"]], "shadowMode": opts.get("shadow", "sync"), "shadowLag": 0,
               "badgeFrom": None, "filmStart": at, "filmEnd": end, "master": song, "bpm": bpm}
    placed = {"slug": slug, "number": None, "filmStart": at, "filmEnd": end, "master": song, "manual": True}
    story, align = local_files(d)
    story["chapters"] = sorted([c for c in story["chapters"] if c["slug"] != slug] + [chapter], key=lambda c: c["filmStart"])
    align["songs"] = sorted([s for s in align["songs"] if s["slug"] != slug] + [placed], key=lambda s: s["filmStart"])
    clash = [(x["slug"], y["slug"]) for x, y in zip(align["songs"], align["songs"][1:]) if y["filmStart"] < x["filmEnd"]]
    if clash:
        raise SystemExit(f"songs overlap in the take: {clash}")
    (d / "story.json").write_text(json.dumps(story, indent=2))
    (d / "align.json").write_text(json.dumps(align, indent=2))
    print(f"{name}: {chapter['title']} ({slug}) at take {at:.3f}-{end:.3f}s, {bpm} bpm, field {opts['field']}")


def local_files(d: Path) -> tuple[dict, dict]:
    """The take's story and align as setup keeps them: its own songs, or none yet."""
    story = {"local": True, "chapters": [], "cards": []}
    align = {"take": d.name, "tone": None, "songs": []}
    if (d / "story.json").exists() and (d / "align.json").exists():
        old = json.loads((d / "story.json").read_text())
        if old.get("local"):  # never mix a song into an album take's pulled story
            story, align = old, json.loads((d / "align.json").read_text())
    return story, align


def chapter_of(chapters: list, slug: str | None) -> dict:
    if slug is None:
        if len(chapters) > 1:
            raise SystemExit(f"this take holds {len(chapters)} songs: say which with --slug= ({', '.join(c['slug'] for c in chapters)})")
        return chapters[0]
    found = [c for c in chapters if c["slug"] == slug]
    if not found:
        raise SystemExit(f"no song {slug!r} in this take ({', '.join(c['slug'] for c in chapters)})")
    return found[0]


def cut(name: str, opts: dict, passthrough: list):
    take, d = load_take(name), take_dir(name)
    ch = chapter_of(json.loads((d / "story.json").read_text())["chapters"], opts.get("slug"))
    win = take["window"]
    a = float(opts.get("from", max(ch["filmStart"], win["start"])))
    b = float(opts.get("to", min(ch["filmEnd"], win["end"])))
    if opts.get("show") and "from" not in opts and "to" not in opts:
        # A show file says which bars it is: the piece runs from its first bar to its last.
        from beats import chapter_grid
        from show import Show
        g = chapter_grid(ch, drums=True)
        sh = Show.load(opts["show"], ch["filmStart"] + g["one"], g["bar"])
        if sh.range:
            a, b = max(a, sh.time_of(sh.range[0])), min(b, sh.time_of(sh.range[1]))
    audio = opts.get("audio", "full")
    out_dir = work(name, "out")
    label = opts.get("name", f"{a:.0f}-{b:.0f}")
    silent = out_dir / f"_dance-{label}.mp4"
    outro = opts.get("outro", "yes") != "no"
    compose.main([name, f"--from={a}", f"--to={b}", "--aspect=9x16", *(["--outro"] if outro else []), f"--out={silent}",
                  *passthrough])
    fps = take["fps"]
    tail = (len(list((work("cache", "marks") / "morph").glob("*.png"))) + int(compose.HOLD_S * fps)) / fps if outro else 0.0
    duration = (b - a) + tail
    if audio == "full":
        at = a - ch["filmStart"]  # where in the song the piece starts
        # under the outro the song fades as the seed grows; a loop only clears the click at its seam
        fade_at, fade_d = ((b - a) - compose.FLY_S, compose.FLY_S + FADE_TAIL) if outro else (duration - LOOP_FADE, LOOP_FADE)
        afilter = (f"[1:a]atrim=start={at:.3f}:duration={duration:.3f},asetpts=PTS-STARTPTS,"
                   f"{'' if outro else f'afade=t=in:d={LOOP_FADE},'}afade=t=out:st={fade_at:.3f}:d={fade_d:.3f},"
                   f"apad,atrim=0:{duration:.3f}[aout]")
        src = [["-i", ch["master"]]]
    else:
        afilter = f"anullsrc=r=48000:cl=stereo,atrim=0:{duration:.3f}[aout]"
        src = []
    dest = out_dir / f"dance-{label}-{audio}.mp4"
    mux(silent, [], [], afilter, src, dest, duration)
    silent.unlink(missing_ok=True)
    print(f"dance: {dest}\nsheet: {sheet(dest)}")
    return dest


def main(argv):
    if len(argv) < 2 or argv[1] not in ("setup", "cut"):
        raise SystemExit(__doc__)
    name, verb = argv[0], argv[1]
    opts = dict(a[2:].split("=", 1) for a in argv[2:] if a.startswith("--") and "=" in a)
    if verb == "setup":
        return setup(name, opts)
    own = {"from", "to", "audio", "name", "slug", "outro"}
    return cut(name, opts, [f"--{k}={v}" for k, v in opts.items() if k not in own])


if __name__ == "__main__":
    main(sys.argv[1:])
