"""
Every post in Posts/Ready to post, staged in the Social Studio as an undated DRAFT, so he can open
the Studio on his phone, see the clip, its song line and caption, and post it by hand.

    python3 stage.py                     # dry run: what would be staged (touches nothing)
    python3 stage.py --apply             # upload and write the drafts (skips what staged.json has)
    python3 stage.py --notes --apply     # rewrite every staged draft's note (after song-starts.json changes)
    python3 stage.py --apply 1021-prayer-in-c-reel-a ...   # only these

Per piece: the SOUND version goes to Cloudflare Stream (a full piece goes as its YouTube cut, the
song laid in), MP4 downloads on, and one `social_posts` row: status 'draft', dated by
schedule.json (scheduled_at puts it on the calendar and in the Post view on its day; drafts never
publish: process-scheduled takes 'scheduled' only), the schedule's platforms, the caption, a note with the song, where it plays and how to line it up, in a
campaign per song in that song's colour. Never sets 'scheduled', never calls PostForMe.

HTTP goes through curl: this Python's certificate store fails. The keys come from the main
checkout's .env.local and are never printed. staged.json (beside the catalogue's data) records
each upload and draft, so a run picks up where the last one stopped.
"""
import json, subprocess, sys, tempfile, time, uuid
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import catalog  # SONGS, FULL_SRC, POSTS, DATA, where()

ENV = Path.home() / "Documents/Apps/odubo/.env.local"
LEDGER = catalog.DATA / "staged.json"
WORK = Path.home() / "Documents/Apps/odubo/projects/Loop Soul Dance/Work files"
PLATFORMS = {"reels": ["instagram", "tiktok"], "shorts": ["tiktok", "youtube"], "full": ["youtube"]}
LEVELS = {"fils-de-joie": "1-2", "sante": "1-3"}
ZONE = "America/Vancouver"  # his clock: BC stays on UTC-7 from Nov 2026, where Los Angeles falls back
SCHEDULE = {x["piece"]: x for x in json.loads((catalog.DATA / "schedule.json").read_text())} \
    if (catalog.DATA / "schedule.json").exists() else {}
APP = {"Instagram": "instagram", "TikTok": "tiktok", "YouTube Shorts": "youtube", "YouTube": "youtube"}


def when(e: dict):
    """The schedule's day and time for a piece, as UTC ISO, or None."""
    s = SCHEDULE.get(e["file"][:-4])
    if not s:
        return None
    local = datetime.fromisoformat(f"{s['date']}T{s['time']}").replace(tzinfo=ZoneInfo(ZONE))
    return local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def platforms_of(e: dict) -> list:
    s = SCHEDULE.get(e["file"][:-4])
    return [APP[p] for p in s["platforms"]] if s else PLATFORMS[e["kind"]]


def env() -> dict:
    out = {}
    for line in ENV.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    need = ("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_STREAM_API_TOKEN", "CLOUDFLARE_D1_API_TOKEN", "CLOUDFLARE_D1_DATABASE_ID")
    missing = [k for k in need if not out.get(k)]
    if missing:
        raise SystemExit(f"missing in .env.local: {', '.join(missing)}")
    return out


NETWORK = {6, 7, 18, 28, 35, 52, 55, 56}  # curl's exit codes for a dropped or failed connection


def curl(args: list, token: str) -> dict:
    """A Cloudflare API call; the token goes in a private header file, never on the command line."""
    with tempfile.NamedTemporaryFile("w", suffix=".hdr", delete=True) as hdr:
        hdr.write(f"Authorization: Bearer {token}\n")
        hdr.flush()
        for attempt in range(4):  # the line drops now and then mid-upload: try again, not give up
            out = subprocess.run(["curl", "-sS", "--fail-with-body", "-H", f"@{hdr.name}", *args], capture_output=True, text=True)
            if out.returncode not in NETWORK:
                break
            time.sleep(10 * (attempt + 1))
    try:
        body = json.loads(out.stdout or "{}")
    except json.JSONDecodeError:
        raise SystemExit(f"curl: {out.stderr.strip() or out.stdout[:300]}")
    if out.returncode or not body.get("success", False):
        raise SystemExit(f"Cloudflare said no: {json.dumps(body.get('errors') or out.stderr)[:400]}")
    return body["result"]


class Cloud:
    def __init__(self, e: dict):
        a = e["CLOUDFLARE_ACCOUNT_ID"]
        self.stream, self.stoken = f"https://api.cloudflare.com/client/v4/accounts/{a}/stream", e["CLOUDFLARE_STREAM_API_TOKEN"]
        self.d1url = f"https://api.cloudflare.com/client/v4/accounts/{a}/d1/database/{e['CLOUDFLARE_D1_DATABASE_ID']}/query"
        self.dtoken = e["CLOUDFLARE_D1_API_TOKEN"]

    def upload(self, path: Path, name: str) -> str:
        uid = curl(["-X", "POST", "-F", f"file=@{path}", self.stream], self.stoken)["uid"]
        curl(["-X", "POST", "-H", "Content-Type: application/json", "--data", json.dumps({"meta": {"name": name}}),
              f"{self.stream}/{uid}"], self.stoken)
        return uid

    def finish(self, uid: str, name: str) -> dict:
        """The MP4 download, once Stream has processed the video (it refuses one before)."""
        for _ in range(240):
            state = curl([f"{self.stream}/{uid}"], self.stoken).get("status", {}).get("state")
            if state == "ready":
                break
            if state == "error":
                raise SystemExit(f"{name}: Stream could not process the video (uid {uid})")
            time.sleep(5)
        else:
            raise SystemExit(f"{name}: not processed after 20 minutes (uid {uid})")
        curl(["-X", "POST", f"{self.stream}/{uid}/downloads"], self.stoken)
        for _ in range(120):  # the MP4 must exist before a post points at it
            d = curl([f"{self.stream}/{uid}/downloads"], self.stoken).get("default", {})
            if d.get("status") == "ready":
                return {"uid": uid, "mp4": d["url"], "thumb": curl([f"{self.stream}/{uid}"], self.stoken).get("thumbnail")}
            if d.get("status") == "error":
                raise SystemExit(f"{name}: Stream could not make the MP4 (uid {uid})")
            time.sleep(5)
        raise SystemExit(f"{name}: the MP4 was not ready after 10 minutes (uid {uid})")

    def sql(self, sql: str, params: list):
        return curl(["-X", "POST", "-H", "Content-Type: application/json", "--data", json.dumps({"sql": sql, "params": params}),
                     self.d1url], self.dtoken)


def note(e: dict) -> str:
    # The first line is the credit as the public sees it (YouTube description, the site); the version is a note to him
    lines = [f"{e['song']} · {e['artist']}"]
    if e.get("version"):
        lines.append(e["version"][0].upper() + e["version"][1:])
    lines.append(catalog.where(e))
    if e["kind"] != "full":
        lines.append("Add the song in the app from that time, then turn the original sound down to 0: the video opens on "
                     "that second of the song, so it lines up as it is.")
    if e.get("faint"):
        lines.append("The room was faint here: its sound is turned up and noisy, only there to line up by.")
    lines.append(f"{e['date']} · {e['file'][:-4]}")
    return "\n".join(lines)


def campaign_of(e: dict) -> tuple:
    """(id, name, colour) of the song's campaign, in the song's own field colour."""
    slug = next(s for s, v in catalog.SONGS.items() if v[0] == e["song"])
    level = LEVELS.get(slug)
    take = "img-0327" if level else catalog.FULL_SRC[slug][2]  # the two Stromae levels share one take
    story = json.loads((WORK / take / "story.json").read_text())
    ch = next((c for c in story["chapters"] if c["slug"] == slug), story["chapters"][0])
    colour = "#%02x%02x%02x" % tuple(ch["palette"]["field"])
    return f"camp_training_{slug.replace('-', '_')}", f"{level} · {e['song']}" if level else f"Training · {e['song']}", colour


def main(argv):
    apply, notes_only = "--apply" in argv, "--notes" in argv
    only = {a for a in argv if not a.startswith("--")}
    entries = json.loads((catalog.POSTS / "catalog.json").read_text())
    ledger = json.loads(LEDGER.read_text()) if LEDGER.exists() else {}
    cloud = Cloud(env()) if apply else None
    todo = [e for e in entries if not only or e["file"][:-4] in only]
    camps = {}
    for e in todo:
        camps.setdefault(campaign_of(e), []).append(e)
    print(f"{len(todo)} pieces in {len(camps)} campaigns ({'APPLY' if apply else 'dry run'}{', notes only' if notes_only else ''})")
    for (cid, name, colour), rows in camps.items():
        print(f"  {name:<34} {colour}  {len(rows)} posts")
        if apply and not notes_only:
            cloud.sql("INSERT OR IGNORE INTO campaigns (id, name, description, color, status) VALUES (?, ?, ?, ?, 'active')",
                      [cid, name, "Training posts, staged from Posts/Ready to post", colour])
    for e in todo:
        key = e["file"][:-4]
        have = ledger.get(key, {})
        if notes_only:
            if have.get("post") and apply:  # the note, the day and the platforms, while still a draft
                cloud.sql("UPDATE social_posts SET notes = ?, scheduled_at = ?, platforms = ?, updated_at = datetime('now') "
                          "WHERE id = ? AND status = 'draft'", [note(e), when(e), json.dumps(platforms_of(e)), have["post"]])
            print(f"  note {key}: {when(e)}  {catalog.where(e)}")
            continue
        if have.get("post"):
            continue
        if not apply:
            print(f"  {(SCHEDULE.get(key) or {}).get('date', 'undated'):<10} {key:<44} {', '.join(platforms_of(e)):<18} {e['caption']}")
            continue
        if not have.get("uid"):
            src = catalog.POSTS / e["youtube"]["file"] if "youtube" in e else catalog.POSTS / e["kind"] / e["file"]
            have["uid"] = cloud.upload(src, key)  # a full piece goes up as its YouTube cut, the song laid in
            ledger[key] = have
            LEDGER.write_text(json.dumps(ledger, indent=1))
        if not have.get("mp4"):
            have.update(cloud.finish(have["uid"], key))
            ledger[key] = have
            LEDGER.write_text(json.dumps(ledger, indent=1))
        pid = str(uuid.uuid4())
        cloud.sql("""INSERT INTO social_posts (id, status, created_by, media_type, media_url, thumbnail_url, source_type, source_id,
                     caption, caption_by_platform, hashtags, platforms, title, notes, tags, campaign_id, timezone, scheduled_at,
                     created_at, updated_at)
                     VALUES (?, 'draft', 'system', 'video', ?, ?, 'upload', ?, ?, '{}', '[]', ?, ?, ?, ?, ?, ?, ?,
                             datetime('now'), datetime('now'))""",
                  [pid, have["mp4"], have.get("thumb"), have["uid"], e["caption"], json.dumps(platforms_of(e)), key, note(e),
                   json.dumps(["training", e["kind"]]), campaign_of(e)[0], ZONE, when(e)])
        have["post"] = pid
        ledger[key] = have
        LEDGER.write_text(json.dumps(ledger, indent=1))
        print(f"  staged {key}", flush=True)
    if apply and not notes_only:
        for cid, _, _ in camps:
            cloud.sql("UPDATE campaigns SET post_count = (SELECT COUNT(*) FROM social_posts WHERE campaign_id = ?) WHERE id = ?", [cid, cid])


if __name__ == "__main__":
    main(sys.argv[1:])
