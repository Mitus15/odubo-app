"""
A take, end to end.

    npm run film:run -- "<the take>" [--name=<take>] [--drafts] [--height=2160]

  ingest -> align (by listening; --push saves each song's range) -> segment
  -> figure -> pull the story -> cards -> the outro marks -> for every card
  with a moment: its clip (tease audio before the song is out, the song
  after) -> for every song: its 16:9 cut -> the film.

Every stage skips itself when its output exists and nothing it depends on
changed, so a stopped run picks up where it stopped. Delete a stage's output
to redo it.
"""
import json, subprocess, sys
from pathlib import Path
from film_common import REPO, WORK
from take import take_dir

HERE = Path(__file__).resolve().parent


def py(*args):
    subprocess.run([sys.executable, *map(str, args)], check=True, cwd=HERE)


def node(script, *args):
    subprocess.run(["npx", "tsx", "--env-file=.env.local", f"scripts/loop/film/{script}", *map(str, args)], check=True, cwd=REPO)


def released_slugs():
    """Singles that are out (the audio rule): read once, through the site's own code."""
    out = subprocess.run(["npx", "tsx", "--env-file=.env.local", "-e",
                          "import('./src/lib/loop/singlesStore.ts').then(async m => console.log(JSON.stringify((await m.getSingleStatuses()).filter(s => s.out).map(s => s.slug))))"],
                         capture_output=True, text=True, cwd=REPO)
    try:
        return set(json.loads(out.stdout.strip().splitlines()[-1]))
    except Exception:
        return set()


def main(argv):
    src = argv[0]
    opts = dict(a[2:].split("=", 1) for a in argv[1:] if a.startswith("--") and "=" in a)
    flags = {a[2:] for a in argv[1:] if a.startswith("--") and "=" not in a}
    name = opts.get("name", Path(src).stem)
    height = opts.get("height", "2160")
    d = take_dir(name)
    if not (d / "take.json").exists():
        py("ingest.py", src, f"--name={name}")
    if not (d / "align.json").exists():
        py("align.py", name, "--push")
    if not (d / "mask.mkv").exists():
        py("segment.py", name)
    if not (d / "labels.mkv").exists():
        py("figure.py", name, f"--height={height}", f"--look={opts.get('look', 'gloss')}")
    node("pull.ts", name, *(["--drafts"] if "drafts" in flags else []))
    node("cards.ts", name, f"--film-height={height}")
    py("outro.py")
    story = json.loads((d / "story.json").read_text())
    out = released_slugs()
    for c in story["cards"]:
        if c.get("filmStart") is not None and c.get("filmEnd") is not None:
            py("cut.py", name, "clip", c["id"], f"--audio={'full' if c['chapter'] in out else 'tease'}")
    align = json.loads((d / "align.json").read_text())
    for s in align["songs"]:
        py("cut.py", name, "song", s["slug"], "--audio=full", f"--height={height}")
    py("cut.py", name, "film", f"--height={height}")
    print(f"done: {d / 'out'}")


if __name__ == "__main__":
    main(sys.argv[1:])
