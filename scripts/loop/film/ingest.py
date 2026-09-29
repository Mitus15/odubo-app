"""
Take a recording in.

    npm run film:ingest -- "<the take>"                  # the whole take
    npm run film:ingest -- "<file>" --name=golden --from=542 --to=562

Records what the camera made (size, fps, length) in $FILM_WORK/<take>/take.json
and pulls the take's own audio out for alignment. --from/--to restrict every
later stage to a window of the take (the golden test uses 20 seconds).
"""
import json, subprocess, sys
from pathlib import Path
from film_common import model, run
from take import take_dir
import seg


def probe(path: Path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", str(path)],
                         capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    num, den = (v["r_frame_rate"].split("/") + ["1"])[:2]
    return {"w": int(v["width"]), "h": int(v["height"]), "fps": round(float(num) / float(den or 1), 3),
            "duration": float(j["format"]["duration"]),
            "audio": any(s["codec_type"] == "audio" for s in j["streams"])}


def main(argv):
    if not argv:
        raise SystemExit('usage: npm run film:ingest -- "<the take>" [--name=x] [--from=s --to=s]')
    src = Path(argv[0]).expanduser().resolve()
    opts = dict(a[2:].split("=", 1) for a in argv[1:] if a.startswith("--") and "=" in a)
    name = opts.get("name", src.stem)
    info = probe(src)
    start = float(opts.get("from", 0))
    end = float(opts.get("to", info["duration"]))
    d = take_dir(name)
    take = {"name": name, "path": str(src), **info, "window": {"start": start, "end": end}}
    (d / "take.json").write_text(json.dumps(take, indent=2))
    if info["audio"]:
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.3f}", "-i", src, "-t", f"{end - start:.3f}", "-vn",
             "-ac", "1", "-ar", "11025", d / "room.11k.wav"])
    for m in (seg.SEGMENTER, seg.POSE):
        model(m)  # fails loudly now rather than an hour into a render
    print(f"{name}: {info['w']}x{info['h']} {info['fps']} fps, {info['duration'] / 60:.1f} min, "
          f"window {start:.1f}-{end:.1f}s -> {d}")


if __name__ == "__main__":
    main(sys.argv[1:])
