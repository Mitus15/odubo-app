"""
A tentative posting schedule for everything in Posts/Ready to post, and the page that shows it.

    python3 schedule.py [--start=2026-10-26] [--out=<dir>]   # writes schedule.json, and <dir>/index.html + thumbs/

The rhythm (his to change): every day a Reel (Instagram, TikTok) at 12:00 and a short (YouTube
Shorts) at 18:00; Tuesdays and Fridays a full song (YouTube) at 10:00, Pacific time. Each stream
runs in the order the sessions were filmed, so the feed shows the training getting better, and
never puts the same song on two days running. He posts every one by hand (the Studio's Post view).
"""
import datetime as dt, html, json, shutil, sys
from pathlib import Path

import catalog
import stage

KINDS = {"reels": ("Reel", "12:00", ["Instagram", "TikTok"]),
         "shorts": ("Short", "18:00", ["YouTube Shorts"]),
         "full": ("Full song", "10:00", ["YouTube"])}
SESSIONS = ["Oct 11", "Oct 13", "Oct 14", "Oct 19", "Oct 21", "Oct 22", "Oct 23"]


def ordered(rows: list) -> list:
    """Filmed order, the earliest piece next whose song differs from the one before."""
    queue = sorted(rows, key=lambda e: (SESSIONS.index(e["date"]), rows.index(e)))
    out = []
    while queue:
        pick = next((e for e in queue if not out or e["song"] != out[-1]["song"]), queue[0])
        queue.remove(pick)
        out.append(pick)
    return out


def build(start: dt.date) -> list:
    entries = json.loads((catalog.POSTS / "catalog.json").read_text())
    plan = []
    for kind in ("reels", "shorts"):
        for i, e in enumerate(ordered([x for x in entries if x["kind"] == kind])):
            plan.append((start + dt.timedelta(days=i), kind, e))
    day, fulls = start, ordered([x for x in entries if x["kind"] == "full"])
    for e in fulls:
        while day.weekday() not in (1, 4):  # Tuesday, Friday
            day += dt.timedelta(days=1)
        plan.append((day, "full", e))
        day += dt.timedelta(days=1)
    out = []
    for d, kind, e in sorted(plan, key=lambda p: (p[0], KINDS[p[1]][1])):
        cid, cname, colour = stage.campaign_of(e)
        label, time, platforms = KINDS[kind]
        out.append({"date": d.isoformat(), "time": time, "kind": kind, "label": label, "platforms": platforms,
                    "piece": e["file"][:-4], "caption": e["caption"], "song": e["song"], "artist": e["artist"],
                    "filmed": e["date"], "seconds": e["seconds"], "colour": colour, "song_line": catalog.where(e),
                    "thumb": e["thumb"]})
    return out


def page(rows: list, out: Path):
    (out / "thumbs").mkdir(parents=True, exist_ok=True)
    for r in rows:
        shutil.copy(catalog.POSTS / r["thumb"], out / r["thumb"])
    first, last = dt.date.fromisoformat(rows[0]["date"]), dt.date.fromisoformat(rows[-1]["date"])
    count = {k: sum(r["kind"] == k for r in rows) for k in KINDS}
    reels = [r for r in rows if r["kind"] == "reels"]
    e = html.escape

    def tile(r):
        mins = f"{int(r['seconds'] // 60)}:{int(r['seconds'] % 60):02d}" if r["seconds"] >= 60 else f"{r['seconds']:.0f} s"
        return (f"<article class='post {r['kind']}' style='--song:{r['colour']}'>"
                f"<img src='{e(r['thumb'])}' alt='' loading='lazy' width='54' height='96'>"
                f"<div class='meta'><div class='row1'><span class='kind'>{e(r['label'])}</span><span class='time'>{r['time']}</span></div>"
                f"<div class='cap'>{e(r['caption'])}</div>"
                f"<div class='song'><span class='dot'></span>{e(r['song'])} · {e(r['artist'])}</div>"
                f"<div class='small'>{' · '.join(map(e, r['platforms']))} · {mins} · filmed {e(r['filmed'])}</div>"
                f"<div class='small line'>{e(r['song_line'])}</div></div></article>")

    days, weeks = {}, {}
    for r in rows:
        days.setdefault(r["date"], []).append(r)
    for d in sorted(days):
        day = dt.date.fromisoformat(d)
        weeks.setdefault(day - dt.timedelta(days=day.weekday()), []).append(day)
    parts = []
    for n, (monday, ds) in enumerate(sorted(weeks.items()), 1):
        parts.append(f"<section class='week' id='w{n}'><h2><span>Week {n}</span> {monday.strftime('%b %-d')} to "
                     f"{(monday + dt.timedelta(days=6)).strftime('%b %-d')}</h2>")
        for day in ds:
            parts.append(f"<div class='day'><div class='date'><b>{day.strftime('%a')}</b>{day.strftime('%b %-d')}</div>"
                         f"<div class='posts'>{''.join(tile(r) for r in days[day.isoformat()])}</div></div>")
        parts.append("</section>")
    grid = "".join(f"<img src='{e(r['thumb'])}' alt='{e(r['song'])}' style='--song:{r['colour']}' loading='lazy'>"
                   for r in reversed(reels))
    nav = "".join(f"<a href='#w{n}'>W{n}</a>" for n in range(1, len(weeks) + 1))
    doc = f"""<title>Training Ground Schedule</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* layout: a feed-shaped plan; the profile grid first, then the weeks, each day a row of posts edged in the song's colour */
:root{{--bg:#f1efeb;--panel:#ffffff;--ink:#2a0f0a;--muted:#6f6461;--rule:#ddd7d1;--chip:#ece7e2;
  --display:"Jost",ui-sans-serif,system-ui,sans-serif;--body:"Jost",ui-sans-serif,system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#16110f;--panel:#201a18;--ink:#f1e8e3;--muted:#a99c96;--rule:#3a312e;--chip:#2c2421;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#16110f;--panel:#201a18;--ink:#f1e8e3;--muted:#a99c96;--rule:#3a312e;--chip:#2c2421;color-scheme:dark}}
*{{box-sizing:border-box}}
body{{background:var(--bg);color:var(--ink);font:15px/1.45 var(--body);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
main{{max-width:980px;margin:0 auto;padding-block:28px 64px;display:grid;gap:28px}}
header h1{{font:700 clamp(30px,6vw,46px)/1.02 var(--display);letter-spacing:.04em;text-transform:uppercase;margin:0;text-wrap:balance}}
header p{{margin:8px 0 0;color:var(--muted);max-width:62ch}}
.stats{{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}}
.stats span{{font:500 13px var(--mono);background:var(--chip);border-radius:999px;padding:5px 12px}}
.rhythm{{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}}
.rhythm div{{background:var(--panel);border:1px solid var(--rule);border-radius:10px;padding:12px 14px}}
.rhythm b{{display:block;font:600 12px var(--display);letter-spacing:.12em;text-transform:uppercase}}
.rhythm span{{color:var(--muted);font-size:14px}}
h2{{font:600 13px var(--display);letter-spacing:.14em;text-transform:uppercase;margin:0 0 12px;color:var(--muted)}}
h2 span{{color:var(--ink)}}
.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;max-width:420px}}
.grid img{{width:100%;aspect-ratio:9/16;object-fit:cover;display:block;background:var(--song);outline:3px solid var(--song);outline-offset:-3px}}
.note{{color:var(--muted);font-size:13px;margin-top:8px;max-width:420px}}
nav{{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);display:flex;gap:6px;overflow-x:auto;padding-block:8px}}
body::before{{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}}
nav a{{font:500 13px var(--mono);color:var(--ink);text-decoration:none;border:1px solid var(--rule);border-radius:999px;padding:4px 12px;flex:none}}
nav a:focus-visible,nav a:hover{{border-color:var(--ink)}}
.week{{display:grid;gap:10px;scroll-margin-top:56px}}
.day{{display:grid;grid-template-columns:64px 1fr;gap:12px;align-items:start;border-top:1px solid var(--rule);padding-top:10px}}
.date{{font:500 13px var(--mono);display:grid;color:var(--muted)}}
.date b{{font:600 13px var(--display);letter-spacing:.1em;text-transform:uppercase;color:var(--ink)}}
.posts{{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;min-width:0}}
.post{{display:grid;grid-template-columns:54px 1fr;gap:10px;background:var(--panel);border:1px solid var(--rule);border-left:5px solid var(--song);border-radius:8px;padding:8px;min-width:0}}
.post img{{width:54px;height:96px;object-fit:cover;border-radius:4px;background:var(--song)}}
.meta{{min-width:0;display:grid;gap:2px;align-content:start}}
.row1{{display:flex;justify-content:space-between;gap:8px}}
.kind{{font:600 11px var(--display);letter-spacing:.14em;text-transform:uppercase}}
.time{{font:500 12px var(--mono);color:var(--muted);font-variant-numeric:tabular-nums}}
.cap{{font:600 17px/1.2 var(--display)}}
.song{{font-size:13px;display:flex;gap:6px;align-items:center;overflow-wrap:anywhere}}
.dot{{width:10px;height:10px;border-radius:50%;background:var(--song);flex:none;box-shadow:0 0 0 1px var(--rule)}}
.small{{font-size:12px;color:var(--muted);overflow-wrap:anywhere}}
.line{{font-family:var(--mono);font-size:11px}}
@media (max-width:520px){{.day{{grid-template-columns:1fr}}.date{{grid-auto-flow:column;justify-content:start;gap:8px}}}}
@media (prefers-reduced-motion:reduce){{html{{scroll-behavior:auto}}}}
</style>
<main>
<header>
  <h1>Training Ground Schedule</h1>
  <p>A tentative plan for every finished piece, {first.strftime('%a %b %-d')} to {last.strftime('%a %b %-d')}. You post each one by hand from the Studio's Post view. Song times fill in once you send them.</p>
  <div class="stats"><span>{count['reels']} Reels</span><span>{count['shorts']} shorts</span><span>{count['full']} full songs</span><span>{len(rows)} posts</span></div>
</header>
<section class="rhythm" aria-label="The rhythm">
  <div><b>Every day · 12:00</b><span>One Reel to Instagram and TikTok</span></div>
  <div><b>Every day · 18:00</b><span>One short to YouTube Shorts</span></div>
  <div><b>Tue and Fri · 10:00</b><span>One full song to YouTube</span></div>
</section>
<section aria-label="Instagram grid">
  <h2><span>Your profile grid</span> after the last Reel, newest first</h2>
  <div class="grid">{grid}</div>
  <p class="note">The order follows the sessions as filmed, so the look improves as the month goes on and ends on the lacquer floor. The same song never runs two days in a row.</p>
</section>
<nav aria-label="Weeks">{nav}</nav>
{''.join(parts)}
</main>
"""
    (out / "index.html").write_text(doc)


def main(argv):
    opts = dict(a[2:].split("=", 1) for a in argv if a.startswith("--") and "=" in a)
    start = dt.date.fromisoformat(opts.get("start", "2026-10-26"))
    rows = build(start)
    (catalog.DATA / "schedule.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False))
    if opts.get("out"):
        page(rows, Path(opts["out"]))
    print(f"{len(rows)} posts, {rows[0]['date']} to {rows[-1]['date']}")


if __name__ == "__main__":
    main(sys.argv[1:])
