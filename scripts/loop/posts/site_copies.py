"""
The site's own copy of every song's dance: the whole dance, clean and silent, for the rooms on odubostudio.com.

    python3 site_copies.py                    # dry run: what each song's copy would be (touches nothing)
    python3 site_copies.py --apply            # render, upload and link each song (skips what the ledger has)
    python3 site_copies.py --apply monkey     # only these songs (slugs)
    python3 site_copies.py --link --apply     # only write the ledger's copies to the songs' campaigns

The apps' posts keep the song (in-app sounds, the YouTube cuts with it laid in). The site never
carries it: its copy is him, his floor, his shadow, and the B.A.A.D seal over his head (the badge
stays, his word 2026-10-27). No HUD (the site draws its own, from the Studio's data), no song.

A copy is the WHOLE dance, not a Reel (his word, 2026-10-27: "we're not even going to use the reels
at all"), rendered again from the take with the HUD off (compose --hud=none) from the song's own
show, so nothing has to be covered: a box over the HUD could cut his hand wherever he reaches into a
corner. Every copy stands on the lacquer floor (a floor made as a floor: its texture, his reflection
and his contact shadow, plane.py), the same in all fifteen rooms (his pick, 2026-10-27), and carries
no effects: Billie Jean's echo and tiles stay in its posted video, "the website doesn't need" them.
The song's show file is left as it is; the copy's show is written beside the copies (site-shows/).

A copy opens and closes like the YouTube cut (youtube.py, his word 2026-10-27): it opens where the cut
opens (the song's first note, or the first bar after he settles) and closes on its last bar, before
he walks to the camera. Its timeline is the posted full video's, frame for frame (his movement in
both lines up at 0.0 s), so the cut's in and out points (youtube.json) are the copy's. Billie Jean,
cut by its show's bars, already opens and closes on them. Every copy fades in from its field and out
to it, so on the page, where it loops, he appears on the room and leaves it.

It is quick: the take's matte, field and paint are already made (segment, skin, figure), so only
compose runs, faster than real time on the GPU (37 fps, 2026-10-27): a 5-minute song in about 6.
Rendering the next song runs while the last one is encoded and uploaded.

Each copy goes to Cloudflare Stream as "site · <song>" and the song's campaign `site_video` gets its
uid (migration 170), which the site reads (src/lib/levelsServer.ts). The site samples its room
colour from the copy itself, so nothing here names a colour. A ledger (site-copies.json beside the
catalogue's data) records each step, so a run picks up where the last one stopped; a song's earlier
uploads are kept aside in its `replaced`.
"""
import json, subprocess, sys, threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import catalog
import youtube
from stage import Cloud, env

ROOT = Path(__file__).resolve().parents[3]
FILM = ROOT / "scripts/loop/film"
SHOWS = ROOT / "data/loop/film/shows"
BASE = SHOWS / "site.json"  # Billie Jean's stage on the site: its own show is its tiles and echo
#: Every room's floor, and its effects: none
FLOOR = "lacquer"
SITE_SHOWS = catalog.DATA / "site-shows"
OUT = catalog.DATA / "site-copies"
LEDGER = catalog.DATA / "site-copies.json"
SCHEDULE = json.loads((catalog.DATA / "schedule.json").read_text()) if (catalog.DATA / "schedule.json").exists() else []

TITLES = {"billie-jean": "Billie Jean", **{s: v[0] for s, v in catalog.SONGS.items()}}
#: What a copy is now; a ledger entry made as anything else (a Reel, another floor) is made again
CUT = "full"
#: Where a copy opens and closes: the YouTube cut's points
SPAN = "youtube"
CUTS = json.loads((youtube.OUT / "youtube.json").read_text())
EASE_IN, PICTURE_OUT = 0.5, youtube.PICTURE_OUT  # seconds it fades in from its field, and out to it
#: Songs encoded and uploaded at once, once their renders are made
SHIPPING_AT_ONCE = 2


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


def source(slug: str) -> tuple:
    """(take, the song's own show, the song's slug in a take that holds two songs, or None)."""
    if slug == "billie-jean":
        return "billie-jean", BASE, None
    _, _, key, training = catalog.FULL_SRC[slug]
    if training:
        return key, SHOWS / "training" / f"{slug}.json", None
    return "img-0327", SHOWS / f"{slug}.json", slug  # the two Stromae levels share one take


def span(slug: str):
    """(open, close) in the copy's seconds: its YouTube cut's, or None for the whole render (Billie Jean)."""
    name = next((k for k in CUTS if k.split("-", 1)[1].removesuffix("-full").split("-level-")[0] == slug), None)
    return (CUTS[name]["video_from"], CUTS[name]["video_to"]) if name else None


def site_show(slug: str) -> Path:
    """The song's show on the site's stage: its own, on the lacquer floor, with no effects."""
    _, show, _ = source(slug)
    spec = json.loads(show.read_text())
    spec["stage"] = {**spec.get("stage", {}), "floor": FLOOR, "effects": []}
    SITE_SHOWS.mkdir(parents=True, exist_ok=True)
    out = SITE_SHOWS / f"{slug}.json"
    out.write_text(json.dumps(spec, indent=2))
    return out


# The renders are written untagged with the SD colour formula (BT.601); a browser plays an untagged
# video with the HD one (BT.709), so the field came out lighter than the room around it (#f491a5
# played as #fd9da5, 2026-10-27). A copy is converted to BT.709 and says so.
# Its tone curve has to be said too: these are graphics made in the web's own colour (sRGB), and a
# copy that names no curve is drawn with video's (BT.709), a touch lighter and bluer than the room's
# CSS pink on screen (#e79eaf against #e998a7 in Chromium; tagged sRGB, #e695a4). The ffmpeg colour
# flags did not reach the stream's header, so the header is written directly (h264_metadata):
# primaries BT.709, transfer sRGB (13), matrix BT.709. Stream keeps it in every rendition.
COLOUR = "srgb"
TAGS = "h264_metadata=colour_primaries=1:transfer_characteristics=13:matrix_coefficients=1"


def finish(src: Path, dest: Path, slug: str):
    """The site's copy: opened and closed like its YouTube cut, in BT.709, tagged with the sRGB curve, the sound gone."""
    a, b = span(slug) or (0.0, catalog.length(src))
    field = youtube.floor_colour(src, max(0.0, b - 2))  # read as the render is coded (BT.601), faded before it is converted
    vf = [f"trim=start={a:.3f}:end={b:.3f}", "setpts=PTS-STARTPTS",
          f"fade=t=in:st=0:d={EASE_IN}:color={field}", f"fade=t=out:st={b - a - PICTURE_OUT:.3f}:d={PICTURE_OUT}:color={field}",
          "scale=in_color_matrix=bt601:out_color_matrix=bt709:in_range=tv:out_range=tv", "format=yuv420p"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-an", "-vf", ",".join(vf),
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "iec61966-2-1", "-color_range", "tv",
                    "-bsf:v", TAGS, "-movflags", "+faststart", str(dest)], check=True)


def render(slug: str) -> Path:
    """The whole dance, rendered clean: no HUD, silent, no outro (kept: never rendered twice)."""
    take, _, shared = source(slug)
    show = site_show(slug)
    name = f"site-{FLOOR}-{slug}"
    out = catalog.WORK / take / "out" / f"dance-{name}-silent.mp4"
    if out.exists():
        return out
    subprocess.run(["python3", "dance.py", take, "cut", f"--show={show}", "--outro=no", "--audio=silent", "--hud=none",
                    f"--name={name}", *([f"--slug={shared}"] if shared else [])],
                   cwd=FILM, check=True, stdout=subprocess.DEVNULL)
    return out


def current(have: dict) -> bool:
    """Whether a ledger entry was made as a copy is made now."""
    return (have.get("cut"), have.get("floor"), have.get("colour"), have.get("span")) == (CUT, FLOOR, COLOUR, SPAN)


def main(argv):
    apply, link_only = "--apply" in argv, "--link" in argv
    only = [a for a in argv if not a.startswith("--")]
    songs = [s for s in order() if not only or s in only]
    ledger = json.loads(LEDGER.read_text()) if LEDGER.exists() else {}
    lock = threading.Lock()

    def save(slug, have):
        with lock:
            ledger[slug] = have
            LEDGER.write_text(json.dumps(ledger, indent=2))

    def say(line):
        with lock:
            print(line, flush=True)

    if not apply:
        for slug in songs:
            have = ledger.get(slug, {})
            done = current(have) and have.get("linked")
            take, show, _ = source(slug)
            say(f"{slug:26} {'done' if done else 'to make'}  ({take}, {show.relative_to(SHOWS)})")
        return

    cloud = Cloud(env())

    def ship(slug, have):
        """Encode, upload, link: the half that runs while the next song renders."""
        title = TITLES[slug]
        try:
            if not link_only and not have.get("uid"):
                dest = OUT / f"site-{slug}.mp4"
                finish(Path(have["raw"]), dest, slug)
                have = {**have, "file": str(dest)}
                save(slug, have)
                say(f"{title}: uploading")
                uid = cloud.upload(dest, f"site · {title}")
                cloud.finish(uid, title)
                have = {**have, "uid": uid}
                save(slug, have)
            if have.get("uid") and not have.get("linked"):
                cloud.sql("UPDATE campaigns SET site_video = ? WHERE id = ?", [have["uid"], campaign_id(slug)])
                have = {**have, "linked": True}
                save(slug, have)
                say(f"{title}: linked ({have['uid']})")
        except (Exception, SystemExit) as failed:  # one song failing leaves the rest to go on; a rerun picks it up
            say(f"{title}: FAILED ({failed})")

    # songs ship behind the next one's render; once the renders are made, a couple at a time
    with ThreadPoolExecutor(SHIPPING_AT_ONCE) as shipping:
        for slug in songs:
            have = ledger.get(slug, {})
            if not link_only and not current(have):
                # made before as a Reel, on another floor, before the colour fix or uncut: made again (a render already
                # made is kept), its old upload kept aside
                have = {"replaced": [*have.get("replaced", []), *([have["uid"]] if have.get("uid") else [])],
                        "cut": CUT, "floor": FLOOR, "colour": COLOUR, "span": SPAN,
                        "how": f"the whole dance, rendered clean on the {FLOOR} floor, opened and closed like its YouTube cut"}
                save(slug, have)
            if not link_only and not have.get("raw"):
                say(f"{TITLES[slug]}: rendering")
                have = {**have, "raw": str(render(slug))}
                save(slug, have)
            shipping.submit(ship, slug, have)


if __name__ == "__main__":
    main(sys.argv[1:])
