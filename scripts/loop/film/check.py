"""
Check a test take before the real one.

    npm run film:check -- "<path to the test take>"

Film five minutes exactly as the real take will be (same spot, same light,
same clothes, the playlist playing out loud), then run this. It answers the
questions that would otherwise be discovered after 51 minutes of dancing:

  camera     is it 4K at 30 fps?
  sound      can the playlist's tone be heard, and does Welcome lock to it?
  framing    is he whole in every sampled frame: headroom, feet, sides?
  the floor  are the feet on screen (his shadow needs the ground)?
  the wall   does the background hold still (no moving light, no TV)?
  the light  does his body have enough tonal range for the highlight cuts?

It writes a contact sheet of the sampled frames with his outline drawn on.
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from film_common import REPO, master, read_frames, work
import seg

SAMPLES = 8


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "stream=codec_type,codec_name,width,height,r_frame_rate:format=duration",
                          "-of", "json", str(path)], capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    v = next((s for s in j["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in j["streams"] if s["codec_type"] == "audio"), None)
    num, den = (v["r_frame_rate"].split("/") + ["1"])[:2] if v else ("0", "1")
    return {"w": v["width"] if v else 0, "h": v["height"] if v else 0, "fps": float(num) / float(den or 1),
            "codec": v["codec_name"] if v else None, "audio": a is not None, "duration": float(j["format"]["duration"])}


from sync_audio import LOCKED, find_tone, load_mono, lock, onset_envelope as onset_of


def main(path: str):
    take = Path(path).expanduser()
    out = work("check", take.stem)
    lines = []
    ok = lambda good, msg, fix="": lines.append(("PASS " if good else "WARN ") + msg + ("" if good or not fix else f"  -> {fix}"))

    p = probe(take)
    ok(p["w"] >= 3840 and p["h"] >= 2160, f"camera {p['w']}x{p['h']}", "shoot 4K UHD: 1080p limits how close the clips can frame him")
    ok(abs(p["fps"] - 30) < 0.5, f"{p['fps']:.2f} fps", "set the camera to 30 fps")
    ok(p["audio"], "the take has sound" if p["audio"] else "the take has no sound", "turn the microphone on: the sync listens to it")

    # Sound: the tone, then Welcome locked against the room.
    if p["audio"]:
        head = min(90.0, p["duration"])
        rate = 16000
        x = load_mono(take, rate, seconds=head)
        tone = find_tone(x, rate)
        ok(tone is not None, f"tone heard at {tone:.2f}s" if tone is not None else "no tone heard in the first 90 s",
           "start the playlist from the very top, loud enough to hear from the camera")
        if tone is not None:
            plan = json.loads((REPO / "data/loop/film/playlist.json").read_text())
            welcome = plan["songs"][0]
            room, env_rate = onset_of(load_mono(take, 11025, seconds=head), 11025)
            piece, _ = onset_of(load_mono(master(1), 11025, seconds=20), 11025)
            at, score, z = lock(room, piece, env_rate, tone + welcome["start"], window=4.0)
            locked = at is not None and score >= LOCKED
            ok(locked, f"Welcome locks at {at:.2f}s (correlation {score:.2f})" if at is not None else "Welcome not found",
               "play it louder, keep the speaker near the camera, or keep other noise down")

    # Picture: sampled frames, segmented and posed.
    s, pose = seg.segmenter(video=False), seg.poser(video=False)
    W, H = 960, int(960 * p["h"] / max(1, p["w"]))
    # Clear of the first and last seconds: walking to the camera to start and
    # stop it is not the dance.
    edge = min(8.0, p["duration"] * 0.1)
    times = np.linspace(edge, p["duration"] - edge, SAMPLES)
    frames, masks, poses = [], [], []
    for t in times:
        fr = read_frames(take, float(t), 0.04, W, H)[0]
        frames.append(fr)
        masks.append(seg.person(s, fr) > 0.5)
        poses.append(seg.landmarks(pose, fr))
    found = [m.sum() > 0.01 * W * H for m in masks]
    ok(all(found), f"he is found in {sum(found)} of {SAMPLES} frames", "stay inside the taped box")
    top = min((m.nonzero()[0].min() / H) for m, f in zip(masks, found) if f) if any(found) else 0
    bottom = min(((H - 1 - m.nonzero()[0].max()) / H) for m, f in zip(masks, found) if f) if any(found) else 0
    side = min(min(m.nonzero()[1].min(), W - 1 - m.nonzero()[1].max()) / W for m, f in zip(masks, found) if f) if any(found) else 0
    height = np.median([(m.nonzero()[0].max() - m.nonzero()[0].min()) / H for m, f in zip(masks, found) if f]) if any(found) else 0
    ok(top >= 0.05, f"headroom {top:.0%} at the tightest", "tilt down or step back: jumps need room above the head")
    ok(bottom >= 0.02, f"feet clear of the bottom edge by {bottom:.0%}", "tilt up: the feet and the floor must stay in frame")
    ok(side >= 0.04, f"side margin {side:.0%} at the tightest", "centre the box, or widen the frame")
    ok(0.35 <= height <= 0.85, f"he fills {height:.0%} of the frame height", "move the camera so he is roughly half to three quarters of the height")
    feet = [pl is not None and min(pl[27][2], pl[28][2]) > 0.5 for pl in poses]
    ok(sum(feet) >= SAMPLES - 1, f"both ankles seen in {sum(feet)} of {SAMPLES} frames", "the floor line and the feet must be visible for his shadow")

    # The wall: pixels that are never him should not change.
    bg = np.ones((H, W), bool)
    for m in masks:
        from scipy.ndimage import binary_dilation
        bg &= ~binary_dilation(m, iterations=12)
    stack = np.stack([f.astype(np.float32).mean(2) for f in frames])
    drift = float(np.abs(stack[:, bg] - stack[:, bg].mean(0)).mean()) if bg.any() else 0.0
    ok(drift < 6.0, f"background drift {drift:.1f} levels", "something behind him moves or the light changes: lock exposure, cover screens and windows")

    # The light: tonal range inside his body.
    spans = []
    for fr, m in zip(frames, masks):
        if m.sum() > 500:
            lum = fr.astype(np.float32).mean(2)[m]
            spans.append(float(np.percentile(lum, 95) - np.percentile(lum, 5)))
    span = float(np.median(spans)) if spans else 0.0
    ok(span >= 45, f"tonal range on his body {span:.0f} levels", "add a soft key light from one side: the highlight cuts need light and shade on him")

    # Contact sheet: each sample with his outline.
    from PIL import Image, ImageDraw
    tiles = []
    for fr, m in zip(frames, masks):
        im = Image.fromarray(fr).resize((320, int(320 * H / W)))
        edge = np.zeros_like(m)
        edge[1:-1, 1:-1] = m[1:-1, 1:-1] & ~(m[:-2, 1:-1] & m[2:, 1:-1] & m[1:-1, :-2] & m[1:-1, 2:])
        e = Image.fromarray((edge * 255).astype(np.uint8)).resize(im.size)
        red = Image.new("RGB", im.size, (220, 40, 40))
        im.paste(red, (0, 0), e)
        tiles.append(im)
    sheet = Image.new("RGB", (320 * 4, tiles[0].height * 2), (0, 0, 0))
    for i, tile in enumerate(tiles):
        sheet.paste(tile, ((i % 4) * 320, (i // 4) * tile.height))
    sheet_path = out / "contact-sheet.jpg"
    sheet.save(sheet_path, quality=85)

    print(f"\n{take.name}\n")
    for l in lines:
        print(" ", l)
    warns = sum(1 for l in lines if l.startswith("WARN"))
    print(f"\n{'Ready to shoot.' if not warns else f'{warns} thing(s) to fix before the real take.'}")
    print(f"contact sheet: {sheet_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit('usage: npm run film:check -- "<path to the test take>"')
    main(sys.argv[1])
