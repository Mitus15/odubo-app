"""
Find every song in the take.

    npm run film:align -- <take>                       # listen for all fourteen
    npm run film:align -- <take> --push                # and save to the chapters
    npm run film:align -- <take> --manual=1984:542@117 # take 542 s is 1984 at 117 s

With the playlist played aloud, each master is locked to the room audio near
where the playlist says it sits (after the tone), then locked again near its
end to catch any drift. A take recorded in headphones has no music in it, so
it is lined up by hand (--manual), as the June take is.

Writes $FILM_WORK/<take>/align.json: each song's range in take time.
"""
import json, sys
import numpy as np
from film_common import REPO, SONGS, d1, master
from take import load_take, take_dir
from sync_audio import LOCKED, find_tone, load_mono, lock, onset_envelope

LOCK_S, SEARCH_S = 30.0, 8.0


def main(argv):
    name = argv[0]
    take = load_take(name)
    d = take_dir(name)
    manual = [a.split("=", 1)[1] for a in argv if a.startswith("--manual=")]
    plan = json.loads((REPO / "data/loop/film/playlist.json").read_text())
    songs = []
    if manual:
        for m in manual:
            slug, rest = m.split(":", 1)
            at, master_t = (float(v) for v in rest.split("@"))
            s = next(x for x in SONGS if x["slug"] == slug)
            start = at - master_t
            songs.append({"number": s["number"], "slug": slug, "filmStart": round(start, 3),
                          "filmEnd": round(start + s["seconds"], 3), "manual": True})
        tone = None
    else:
        win0 = take["window"]["start"]
        rate = 16000
        tone = find_tone(load_mono(take["path"], rate, seconds=120, start=win0), rate)
        if tone is None:
            raise SystemExit("no tone found in the first two minutes: was the playlist played from the top? "
                             "(a take without the music in it needs --manual)")
        tone += win0
        room, env_rate = onset_envelope(load_mono(d / "room.11k.wav", 11025), 11025)
        for s, p in zip(SONGS, plan["songs"]):
            head, _ = onset_envelope(load_mono(master(s["number"]), 11025, seconds=LOCK_S), 11025)
            expected = tone + p["start"] - win0
            at, corr, z = lock(room, head, env_rate, expected, SEARCH_S)
            if at is None:
                print(f"{s['number']:>2} {s['title']:<19} outside the take")
                continue
            tail_start = max(0.0, s["seconds"] - LOCK_S)
            tail, _ = onset_envelope(load_mono(master(s["number"]), 11025, seconds=LOCK_S, start=tail_start), 11025)
            at_end, corr_end, _ = lock(room, tail, env_rate, at + tail_start, 2.0)
            rate_fix = ((at_end - at) / tail_start) if at_end is not None and tail_start > 0 and corr_end >= LOCKED else 1.0
            start = at + win0
            songs.append({"number": s["number"], "slug": s["slug"], "filmStart": round(start, 3),
                          "filmEnd": round(start + s["seconds"] * rate_fix, 3), "lock": round(corr, 3),
                          "endLock": round(corr_end, 3), "drift": round(rate_fix, 5)})
            flag = "" if corr >= LOCKED else "   <- weak lock, check by eye"
            print(f"{s['number']:>2} {s['title']:<19} {start:8.2f}s  lock {corr:.2f}  end {corr_end:.2f}{flag}")
    out = {"take": name, "tone": tone, "songs": songs}
    (d / "align.json").write_text(json.dumps(out, indent=2))
    if "--push" in argv:
        for s in songs:
            d1("UPDATE loop_film_chapters SET film_start = ?1, film_end = ?2 WHERE slug = ?3",
               [s["filmStart"], s["filmEnd"], s["slug"]])
        print("saved to the chapters")
    print(f"wrote {d / 'align.json'}")


if __name__ == "__main__":
    main(sys.argv[1:])
