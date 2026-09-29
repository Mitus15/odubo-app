"""
The golden run: the whole pipeline on 20 seconds of real footage.

    npm run film:golden

Proves every stage works together before the real take exists, on the June
take (1984, take 542 s = master 117 s, lined up by hand because that take was
danced in headphones). Uses a LOCAL test card: it is never written to D1 and
never published. Outputs: a 9:16 clip (song audio), the same clip with tease
audio, the 16:9 song cut and the 16:9 film, each with a contact sheet; then
check-sync proves the clip's music came from where it claims.
"""
import json, subprocess, sys
from pathlib import Path
from film_common import REPO, master
from take import take_dir

HERE = Path(__file__).resolve().parent
SOURCE = Path.home() / "Downloads/IMG_0129.MOV"
TAKE, START, END = "golden", 542.0, 562.0
TV = "741,91,1345,435"  # the June room's screen, behind him
CARD = {"id": "golden-test", "chapter": "1984", "verseRef": "Psalms 139:14",
        "verseText": "I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well.",
        "flip": "Made, and made well.", "filmStart": 545.0, "filmEnd": 552.0, "status": "draft"}


def py(*args):
    subprocess.run([sys.executable, *map(str, args)], check=True, cwd=HERE)


def main():
    if not SOURCE.exists():
        raise SystemExit(f"the golden run needs the June take at {SOURCE}")
    d = take_dir(TAKE)
    py("ingest.py", SOURCE, f"--name={TAKE}", f"--from={START}", f"--to={END}")
    py("align.py", TAKE, "--manual=1984:542@117")
    py("segment.py", TAKE, f"--screen={TV}")
    py("figure.py", TAKE, "--height=1080")
    subprocess.run(["npx", "tsx", "--env-file=.env.local", "scripts/loop/film/pull.ts", TAKE, "--drafts"], check=True, cwd=REPO)
    story = json.loads((d / "story.json").read_text())
    story["cards"] = [c for c in story["cards"] if c["id"] != CARD["id"]] + [CARD]
    (d / "story.json").write_text(json.dumps(story, indent=2))
    subprocess.run(["npx", "tsx", "scripts/loop/film/cards.ts", TAKE], check=True, cwd=REPO)
    py("outro.py")
    py("cut.py", TAKE, "clip", CARD["id"], "--audio=full")
    py("cut.py", TAKE, "clip", CARD["id"], "--audio=tease")
    py("cut.py", TAKE, "song", "1984", "--audio=full")
    py("cut.py", TAKE, "film")
    clip = d / "out" / f"clip-1984-{CARD['id'][:8]}-full.mp4"
    # The clip starts at take 545 s; 1984 sits at take 425 s, so 120 s into the master.
    subprocess.run(["node", "scripts/loop/check-sync.mjs", f"--file={clip}", f"--reference={master(2)}", "--expect=120"],
                   check=True, cwd=REPO)
    print(f"\ngolden outputs: {d / 'out'}")


if __name__ == "__main__":
    main()
