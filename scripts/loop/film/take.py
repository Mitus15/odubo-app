"""
A take, and the streams every stage reads and writes.

A take is one continuous recording, named by its file's stem. Its folder,
$FILM_WORK/<take>/, holds everything derived from it:

  take.json       what the camera recorded (size, fps, length) and where
  room.11k.wav    the take's own audio, for alignment
  align.json      where each song sits in the take
  mask.mkv        the person, per frame (lossless grey, analysis size)
  pose.jsonl      33 landmarks per frame (normalised 0..1)
  labels.mkv      the styled figure: 0 field, 1 ink, 2 mid, 3 highlight
  alpha.mkv       the figure's soft edge
  story.json      the chapters and cards, snapshotted from D1 (film:pull)

Frames stream through ffmpeg pipes, so a 52 minute take never sits in memory.
"""
import json, subprocess
from pathlib import Path
import numpy as np
from film_common import WORK, run


def take_dir(name: str) -> Path:
    d = WORK / name
    d.mkdir(parents=True, exist_ok=True)
    return d


def load_take(name: str) -> dict:
    p = WORK / name / "take.json"
    if not p.exists():
        raise SystemExit(f"no take named {name}: run `npm run film:ingest -- <file>` first")
    return json.loads(p.read_text())


class Reader:
    """Frames from a video, as numpy arrays, one at a time."""

    def __init__(self, src, w: int, h: int, start: float = 0.0, dur: float | None = None, fps: float | None = None,
                 gray: bool = False, scale_flags: str = "bicubic"):
        self.w, self.h, self.ch = w, h, 1 if gray else 3
        vf = []
        if fps:
            vf.append(f"fps={fps}")
        vf.append(f"scale={w}:{h}:flags={scale_flags}")
        vf.append(f"format={'gray' if gray else 'rgb24'}")
        args = ["ffmpeg", "-v", "error"]
        if start:
            args += ["-ss", f"{start:.3f}"]
        args += ["-i", str(src)]
        if dur is not None:
            args += ["-t", f"{dur:.3f}"]
        args += ["-an", "-vf", ",".join(vf), "-f", "rawvideo", "-"]
        self.proc = subprocess.Popen(args, stdout=subprocess.PIPE)
        self.size = w * h * self.ch

    def __iter__(self):
        return self

    def __next__(self) -> np.ndarray:
        buf = self.proc.stdout.read(self.size)
        if len(buf) < self.size:
            self.close()
            raise StopIteration
        a = np.frombuffer(buf, np.uint8)
        return a.reshape(self.h, self.w) if self.ch == 1 else a.reshape(self.h, self.w, 3)

    def close(self):
        if self.proc.poll() is None:
            self.proc.stdout.close()
            self.proc.wait()


class Writer:
    """Frames into a video: lossless grey (ffv1) for data, H.264 for pictures."""

    def __init__(self, dest, w: int, h: int, fps: float, kind: str = "ffv1-gray", crf: int = 18):
        self.w, self.h = w, h
        if kind == "ffv1-gray":
            pix_in, codec = "gray", ["-c:v", "ffv1", "-level", "3", "-pix_fmt", "gray"]
        elif kind == "h264":
            pix_in, codec = "rgb24", ["-c:v", "libx264", "-preset", "medium", "-crf", str(crf), "-pix_fmt", "yuv420p",
                                      "-g", str(int(round(fps * 2))), "-movflags", "+faststart"]
        else:
            raise ValueError(kind)
        self.ch = 1 if pix_in == "gray" else 3
        self.proc = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", pix_in, "-s", f"{w}x{h}", "-r", str(fps),
             "-i", "-", *codec, str(dest)], stdin=subprocess.PIPE)

    def write(self, frame: np.ndarray):
        assert frame.shape[:2] == (self.h, self.w), (frame.shape, self.h, self.w)
        self.proc.stdin.write(np.ascontiguousarray(frame, dtype=np.uint8).tobytes())

    def close(self):
        self.proc.stdin.close()
        if self.proc.wait() != 0:
            raise RuntimeError("ffmpeg writer failed")


def read_pose(path: Path) -> dict[int, np.ndarray]:
    """frame index -> (33, 3) normalised x, y, visibility."""
    out = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                if r.get("lm"):
                    out[r["f"]] = np.array(r["lm"], dtype=np.float32)
    return out


def even(n: float) -> int:
    """Video sizes must be even."""
    return int(round(n / 2)) * 2
