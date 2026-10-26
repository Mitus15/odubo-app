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


def ratio(r: str) -> float:
    num, den = (r.split("/") + ["1"])[:2]
    return float(num) / float(den) if float(den or 0) else 0.0


def true_rate(r_frame_rate: str, avg_frame_rate: str) -> float:
    """
    The frames a second the camera made. ffprobe's r_frame_rate is usually it,
    but a phone can write a finer timebase (IMG_0330.MOV: r 120, the frames
    30), and every stage read 120: each frame four times over, at a quarter of
    the speed (2026-10-20). The average rate counts the real frames, so it
    wins when the two disagree, as the whole number it wobbles round (29.96,
    a phone's variable timing). Otherwise the stated rate stands (29.97 is
    29.97: rounded, a long take drifts out of sync).
    """
    r, avg = ratio(r_frame_rate), ratio(avg_frame_rate)
    if avg > 0 and r > 1.5 * avg:
        return float(round(avg)) if abs(avg - round(avg)) < 0.1 else round(avg, 3)
    return round(r or avg, 3)


def probe(path: Path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "stream=codec_type,width,height,r_frame_rate,avg_frame_rate:stream_side_data=rotation:format=duration",
                          "-of", "json", str(path)],
                         capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    w, h = int(v["width"]), int(v["height"])
    # A phone stores portrait as landscape plus a rotation, and ffmpeg turns
    # the frames upright when it decodes them: the take is the upright size.
    turn = next((int(sd["rotation"]) for sd in v.get("side_data_list", []) if "rotation" in sd), 0)
    if abs(turn) % 180 == 90:
        w, h = h, w
    return {"w": w, "h": h, "fps": true_rate(v["r_frame_rate"], v.get("avg_frame_rate", "0/0")),
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
