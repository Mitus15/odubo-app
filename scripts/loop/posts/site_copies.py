"""
The site's own copy of every song's dance: clean and silent, for the rooms on odubostudio.com.

    python3 site_copies.py                    # dry run: what each song's copy would be (touches nothing)
    python3 site_copies.py --apply            # make, upload, and link each song (skips what the ledger has)
    python3 site_copies.py --apply monkey     # only these songs (slugs)
    python3 site_copies.py --check            # every frame of every Reel against the HUD strip (writes nothing)
    python3 site_copies.py --link --apply     # only write the ledger's copies to the songs' campaigns

The apps' posts keep the song (in-app sounds, the YouTube cuts with it laid in). The site never
carries it: its copy is him, his floor, his shadow, and the B.A.A.D seal over his head (the badge
stays, his word 2026-10-27). No HUD (the site draws its own, from the Studio's data), no song.

A room on the site is a loop of the dance, not the whole song (the whole song with its music is
the YouTube post), so a copy is the song's Reel: 30 s to a minute of the best of it.

  every song but Billie Jean   its silent Reel, the HUD strip covered in the field's own colour
                               (the field is flat: the box is invisible), the sound dropped.
                               Minutes, not hours. Every frame is checked first: where he, or the
                               seal over his head, comes within REACH of the strip, a box would cut
                               him (the HUD is drawn in his ink, so where they meet nothing tells
                               them apart), and that song is left for a clean render instead.
  Billie Jean                  its Reel's stretch rendered clean (compose --hud=none, the plain
                               lacquer stage shows/site.json): its close-ups light the field, so no
                               box could hide its HUD. About 8 minutes on the GPU.

Each copy goes to Cloudflare Stream as "site · <song>" and the song's campaign `site_video` gets
its uid (migration 170), which the site reads (src/lib/levels.ts). A ledger (site-copies.json beside
the catalogue's data) records each step, so a run picks up where the last one stopped.
"""
import json, subprocess, sys
from pathlib import Path

import numpy as np

import catalog
from stage import Cloud, env

FILM = Path(__file__).resolve().parents[1] / "film"
sys.path.insert(0, str(FILM))
from split import hud_rows  # noqa: E402  the HUD's own geometry: how far down it reaches

SHOW = Path(__file__).resolve().parents[3] / "data/loop/film/shows/site.json"
REELS = catalog.POSTS / "reels"
OUT = catalog.DATA / "site-copies"
LEDGER = catalog.DATA / "site-copies.json"
SCHEDULE = json.loads((catalog.DATA / "schedule.json").read_text()) if (catalog.DATA / "schedule.json").exists() else []

TITLES = {"billie-jean": "Billie Jean", **{s: v[0] for s, v in catalog.SONGS.items()}}
REACH = 100  # px under the strip, at 1080x1920, that must stay clear: his head, and the seal floating over it
INK = 120    # how far from the field (summed over r, g, b) a pixel must be to be something
# Billie Jean's Reel ("Ready Player 1") opens 2:12 into the song; the song starts 14.72 s into the take
BILLIE_JEAN = {"take": "billie-jean", "from": 14.72 + 132, "to": 14.72 + 192}


def campaign_id(slug: str) -> str:
    return "camp_20261011_billie_jean_1_1" if slug == "billie-jean" else f"camp_training_{slug.replace('-', '_')}"


def order() -> list:
    """Billie Jean first (out), then each song by its first day on the schedule."""
    seen = ["billie-jean"]
    for e in sorted(SCHEDULE, key=lambda x: (x["date"], x["time"])):
        slug = next((s for s, t in TITLES.items() if t == e["song"]), None)
        if slug and slug not in seen:
            seen.append(slug)
    return seen + [s for s in TITLES if s not in seen]


def reels_of(slug: str) -> list:
    """The song's silent Reels, A first: the first that stays clear of the HUD is the copy."""
    found = sorted(REELS.glob(f"*-{slug}-reel-?-silent.mp4"))
    if not found:
        raise SystemExit(f"{slug}: no silent Reel in {REELS}")
    return found


def reel_of(slug: str) -> Path:
    return reels_of(slug)[0]


def frames(path: Path, w: int, h: int, fps: int):
    """Every frame (at fps), as rows of RGB, read straight from ffmpeg."""
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"fps={fps}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE)
    size = w * h * 3
    while True:
        b = p.stdout.read(size)
        if len(b) < size:
            break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3).astype(np.int16)
    p.wait()


def probe(path: Path) -> tuple:
    w, h = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0",
                           str(path)], capture_output=True, text=True, check=True).stdout.strip().split(",")
    return int(w), int(h)


def clear_of_hud(path: Path) -> dict:
    """The field's colour, and whether he (or the seal) ever comes near the HUD strip: every frame."""
    w, h = probe(path)
    strip = hud_rows(w, h)
    reach = int(REACH * min(w, h) / 1080)
    field, near, count = None, 0, 0
    for f in frames(path, w, h, 30):
        if field is None:
            field = np.median(f[strip + reach: strip + reach + 20, :20].reshape(-1, 3), 0)
        zone = f[strip: strip + reach]
        if (np.abs(zone - field).sum(2) > INK).any():
            near += 1
        count += 1
    return {"field": "#%02x%02x%02x" % tuple(int(v) for v in field), "strip": strip, "frames": count, "near": near}


# The renders are written untagged with the SD colour formula (BT.601); a browser plays an untagged
# video with the HD one (BT.709), so the field came out lighter than the room around it (#f491a5
# played as #fd9da5, 2026-10-27). A copy is converted to BT.709 and says so, and matches its room.
COLOUR = "bt709"


def finish(src: Path, dest: Path, field: str | None = None, strip: int = 0):
    """The site's copy: in BT.709 and tagged, the sound gone; with field and strip, the HUD strip covered in the field's colour."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    vf = ([f"drawbox=x=0:y=0:w=iw:h={strip}:color=0x{field[1:]}@1:t=fill"] if field and strip else []) + [
        "scale=in_color_matrix=bt601:out_color_matrix=bt709:in_range=tv:out_range=tv", "format=yuv420p"]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", ",".join(vf), "-an",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
                    "-movflags", "+faststart", str(dest)], check=True)


def render_clean(take: str, a: float, b: float, name: str, slug: str | None = None) -> Path:
    """A stretch of a take rendered clean: no HUD, the plain lacquer stage, silent, no outro (kept: never rendered twice)."""
    out = catalog.WORK / take / "out" / f"dance-{name}-silent.mp4"
    if out.exists():
        return out
    subprocess.run(["python3", "dance.py", take, "cut", f"--show={SHOW}", "--outro=no", "--audio=silent", "--hud=none",
                    f"--from={a:.3f}", f"--to={b:.3f}", f"--name={name}", *([f"--slug={slug}"] if slug else [])],
                   cwd=FILM, check=True)
    return catalog.WORK / take / "out" / f"dance-{name}-silent.mp4"


def reel_in_take(slug: str, reel: Path) -> tuple:
    """(take, from, to, slug for a shared take): where a Reel's stretch sits in its take, from the catalogue."""
    pieces = json.loads((catalog.POSTS / "catalog.json").read_text())
    entry = next(p for p in pieces if p["file"] == reel.name.replace("-silent", ""))
    _, t0, key, training = catalog.FULL_SRC[slug]
    take = key if training else "img-0327"  # the two Stromae levels share one take; their key is the grid's
    a = t0 + entry["in_full"]
    return take, a, a + entry["seconds"], None if training else slug


def make(slug: str, have: dict) -> dict:
    if slug == "billie-jean":
        raw = render_clean(BILLIE_JEAN["take"], BILLIE_JEAN["from"], BILLIE_JEAN["to"], "site-billie-jean")
        dest = OUT / "site-billie-jean.mp4"
        finish(raw, dest)
        return {**have, "file": str(dest), "colour": COLOUR, "how": "its Reel's stretch, rendered clean"}
    tried = []
    for src in reels_of(slug):
        check = clear_of_hud(src)
        if not check["near"]:
            dest = OUT / f"site-{slug}.mp4"
            finish(src, dest, check["field"], check["strip"])
            return {**have, "file": str(dest), "colour": COLOUR, "reel": src.name, "check": check, "how": f"{src.name}, HUD covered"}
        tried.append((check["near"], src))
    # Every Reel comes near the HUD somewhere: the one that does least, rendered clean
    reel = min(tried, key=lambda t: t[0])[1]
    take, a, b, shared = reel_in_take(slug, reel)
    raw = render_clean(take, a, b, f"site-{slug}", shared)
    dest = OUT / f"site-{slug}.mp4"
    finish(raw, dest)
    return {**have, "file": str(dest), "colour": COLOUR, "reel": reel.name, "how": f"{reel.name}'s stretch, rendered clean"}


def main(argv):
    apply, link_only, check_only = "--apply" in argv, "--link" in argv, "--check" in argv
    only = [a for a in argv if not a.startswith("--")]
    songs = [s for s in order() if not only or s in only]
    ledger = json.loads(LEDGER.read_text()) if LEDGER.exists() else {}
    cloud = Cloud(env()) if apply else None

    def save(slug, have):
        ledger[slug] = have
        LEDGER.write_text(json.dumps(ledger, indent=2))

    for slug in songs:
        have = ledger.get(slug, {})
        title = TITLES[slug]
        if check_only:  # every frame of every Reel, against the HUD strip: nothing is written
            if slug != "billie-jean":
                for reel in reels_of(slug):
                    c = clear_of_hud(reel)
                    verdict = "clear" if not c["near"] else f"near in {c['near']} of {c['frames']} frames"
                    print(f"{slug:26} {reel.name[-18:]:18} {verdict}", flush=True)
                    if not c["near"]:
                        break
            continue
        if not apply:
            src = "a clean render of its Reel stretch" if slug == "billie-jean" else reel_of(slug).name
            print(f"{slug:26} {have.get('how') or 'to make'}  ({src})")
            continue
        if have.get("uid") and have.get("colour") != COLOUR and not link_only:
            # made before the colour fix: made again (its old upload is kept aside in the ledger)
            have = {"replaced": [*have.get("replaced", []), have["uid"]]}
        if not link_only:
            if not have.get("file") or not Path(have["file"]).exists() or have.get("colour") != COLOUR:
                print(f"\n{title}: making", flush=True)
                have = make(slug, have)
                save(slug, have)
                print(f"{title}: {have['how']}", flush=True)
                if not have.get("file"):
                    continue
            if not have.get("uid"):
                print(f"{title}: uploading", flush=True)
                uid = cloud.upload(Path(have["file"]), f"site · {title}")
                cloud.finish(uid, title)
                have["uid"] = uid
                save(slug, have)
        if have.get("uid") and not have.get("linked"):
            try:
                cloud.sql("UPDATE campaigns SET site_video = ? WHERE id = ?", [have["uid"], campaign_id(slug)])
            except SystemExit as no:  # before migration 170 there is no column to write: keep making the rest
                print(f"{title}: not linked yet ({no}); run migration 170, then --link --apply", flush=True)
                continue
            have["linked"] = True
            save(slug, have)
            print(f"{title}: linked ({have['uid']})", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])
