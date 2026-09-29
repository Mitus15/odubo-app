"""
The file Mani plays out loud while he dances the whole album.

    npm run film:playlist

A 1 kHz tone (1 s), 2 s of silence, then the fourteen masters in album order
with 3 s of silence between them. Played from a speaker beside the camera, it
puts the music into the take's own audio, so film:align can lock every song to
the picture by listening (cross-correlation), never by guessing from movement.
The tone marks the top; the clap in frame marks it for the eye.

Writes:
  <media>/film/Loop Soul - play this while you dance.m4a   (for the phone)
  data/loop/film/playlist.json                              (where each song sits)
"""
import json, subprocess
from film_common import MEDIA, REPO, SONGS, master, run

TONE_S, LEAD_S, GAP_S, RATE = 1.0, 2.0, 3.0, 48000


def duration(path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def main():
    out_dir = MEDIA / "film"
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / "Loop Soul - play this while you dance.m4a"

    inputs, filters, labels, songs = [], [], [], []
    t = TONE_S + LEAD_S
    filters.append(f"sine=frequency=1000:sample_rate={RATE}:duration={TONE_S},volume=0.25,aformat=channel_layouts=stereo[tone]")
    filters.append(f"anullsrc=r={RATE}:cl=stereo,atrim=duration={LEAD_S}[lead]")
    labels += ["[tone]", "[lead]"]
    for i, s in enumerate(SONGS):
        m = master(s["number"])
        d = duration(m)
        inputs += ["-i", str(m)]
        filters.append(f"[{i}:a]aresample={RATE},aformat=channel_layouts=stereo[s{i}]")
        labels.append(f"[s{i}]")
        songs.append({"number": s["number"], "slug": s["slug"], "start": round(t, 3), "end": round(t + d, 3)})
        t += d
        if i < len(SONGS) - 1:
            filters.append(f"anullsrc=r={RATE}:cl=stereo,atrim=duration={GAP_S}[g{i}]")
            labels.append(f"[g{i}]")
            t += GAP_S
    filters.append("".join(labels) + f"concat=n={len(labels)}:v=0:a=1[out]")
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(filters),
         "-map", "[out]", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", dest])

    plan = {"tone": {"start": 0.0, "seconds": TONE_S, "hz": 1000}, "gapSeconds": GAP_S,
            "totalSeconds": round(t, 3), "songs": songs}
    (REPO / "data/loop/film/playlist.json").write_text(json.dumps(plan, indent=2) + "\n")
    print(f"wrote {dest}  ({t / 60:.1f} min, {dest.stat().st_size / 1e6:.0f} MB)")
    for s in songs:
        print(f"  {s['number']:>2} {s['slug']:<20} {int(s['start'] // 60)}:{s['start'] % 60:05.2f}")


if __name__ == "__main__":
    main()
