"""
The Reels and shorts of the Oct 22 and 23 songs, picked by how much he moves: per bar of the
song's own grid, the mean speed of his pose (where it is seen), and how much of each bar he is
in place (seen, not filling the frame at the phone). Reels start on 8-bar phrases, shorts on
2-bar lines; neither takes a bar he is not in place for. Writes oct22-23-plan.json.
"""
import json, sys
from pathlib import Path
import numpy as np

DATA = Path.home() / "Documents/Apps/odubo/projects/Loop Soul Dance/Work files/catalogue"  # grid, plans, offsets, his song starts
WORK = Path("/Users/maniodubo/Documents/Apps/odubo/projects/Loop Soul Dance/Work files")
G = json.loads((DATA / "grid.json").read_text())

SONGS = {
    # slug: take, reel bars, reels, short bars, shorts, captions (full, reels, shorts)
    "memories": ("train-0359-full-memories", 32, 2, 6, 3,
                 ("Memory card.", ["Load game.", "Replay mode."], ["Flashback.", "Saved.", "Déjà vu."])),
    "on-form": ("train-0362-full-on-form", 24, 2, 6, 3,
                ("Top form.", ["In form.", "Full health."], ["Form check.", "On fire.", "Hot streak."])),
    "monkey": ("train-0362-full-monkey", 16, 2, 4, 3,
               ("Monkey mode.", ["Jungle stage.", "Barrel roll."], ["Swing.", "Climb.", "Bananas."])),
}


def per_bar(take: str):
    """(speed per bar, share of each bar he is in place) over bars 1..n."""
    t = json.loads((WORK / take / "take.json").read_text())
    g = G[take]
    fps, start = t["fps"], t["window"]["start"]
    pts, seen, size = [], [], []
    for line in open(WORK / take / "pose.jsonl"):
        r = json.loads(line)
        if "lm" in r:
            a = np.array(r["lm"], np.float32)
            vis = a[:, 2] > 0.5
            pts.append(a[:, :2]), seen.append(vis)
            ys = a[vis, 1]
            size.append(float(ys.max() - ys.min()) if vis.sum() > 5 else 0.0)
        else:
            pts.append(np.full((33, 2), np.nan, np.float32)), seen.append(np.zeros(33, bool)), size.append(0.0)
    pts, seen, size = np.array(pts), np.array(seen), np.array(size)
    move = np.full(len(pts), np.nan)
    for i in range(1, len(pts)):
        both = seen[i] & seen[i - 1]
        if both.sum() > 8:
            move[i] = float(np.linalg.norm(pts[i, both] - pts[i - 1, both], axis=1).mean())
    usual = np.nanmedian(np.where(size > 0, size, np.nan))
    ok = (seen.sum(1) > 20) & (size < 1.25 * usual)  # seen whole, and not walking up to the phone
    speed, place = [], []
    for b in range(1, g["n"] + 1):
        f0 = int(round((g["one"] + (b - 1) * g["bar"] - start) * fps))
        f1 = int(round((g["one"] + b * g["bar"] - start) * fps))
        f0, f1 = max(0, f0), min(len(pts), f1)
        speed.append(float(np.nanmean(move[f0:f1])) if f1 > f0 and np.isfinite(move[f0:f1]).any() else 0.0)
        place.append(float(ok[f0:f1].mean()) if f1 > f0 else 0.0)
    return np.array(speed), np.array(place)


def best(speed, place, span: int, step: int, count: int, first: int = 1):
    """`count` non-overlapping windows of `span` bars starting on `first` + k * step, the most movement first."""
    n = len(speed)
    cands = []
    for b0 in range(first, n - span + 2, step):
        s, p = speed[b0 - 1:b0 - 1 + span], place[b0 - 1:b0 - 1 + span]
        if p.min() < 0.9:
            continue
        cands.append((float(s.mean()), b0))
    out = []
    for score, b0 in sorted(cands, reverse=True):
        if all(abs(b0 - c) >= span for c in out):
            out.append(b0)
        if len(out) == count:
            break
    return sorted(out)


plan = json.loads((DATA / "oct22-23-plan.json").read_text()) if (DATA / "oct22-23-plan.json").exists() else {}
for slug in (sys.argv[1:] or SONGS):
    take, rb, rn, sb, sn, (full_cap, reel_caps, short_caps) = SONGS[slug]
    if not (WORK / take / ".done-segment").exists():
        print(f"{slug}: not segmented yet")
        continue
    speed, place = per_bar(take)
    reels = best(speed, place, rb, 8, rn)
    shorts = best(speed, place, sb, 2, sn)
    bar = G[take]["bar"]
    print(f"{slug}: {len(speed)} bars of {bar:.2f}s, in place {np.mean(place > 0.9):.0%} of bars; "
          f"reels {reels} ({rb} bars, {rb * bar:.0f}s), shorts {shorts} ({sb} bars, {sb * bar:.1f}s)")
    plan[slug] = {"take": take, "full_caption": full_cap, "reel_bars": rb, "reels": [[b, c] for b, c in zip(reels, reel_caps)],
                  "short_bars": sb, "shorts": [[b, c] for b, c in zip(shorts, short_caps)]}
(DATA / "oct22-23-plan.json").write_text(json.dumps(plan, indent=1, ensure_ascii=False))
