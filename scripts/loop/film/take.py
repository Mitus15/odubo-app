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
A reader decodes a few frames ahead and a writer encodes a few behind, each on
its own thread, so the drawing never waits on either. The phone's video is
decoded, and the pictures are encoded, by the Mac's media engine
(VideoToolbox); the data streams stay lossless ffv1.
"""
import json, os, queue, subprocess, sys, threading
from functools import lru_cache
from pathlib import Path
import numpy as np
from film_common import WORK, run

AHEAD = 4        # frames a reader decodes ahead, a writer holds behind
VT_QUALITY = 75  # h264_videotoolbox -q:v for libx264's crf 18: as close to the lossless frame (measured 2026-10-20)


@lru_cache(maxsize=None)
def videotoolbox() -> bool:
    """Whether this ffmpeg has the Mac's hardware encoder (FILM_VT=0 says not to use it)."""
    if os.environ.get("FILM_VT", "1") == "0" or sys.platform != "darwin":
        return False
    out = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
    return "h264_videotoolbox" in out


def h264_args(crf: int = 18, fps: float | None = None) -> list:
    """The picture encoder: VideoToolbox at the quality libx264 gave at `crf`, else libx264."""
    gop = ["-g", str(int(round(fps * 2)))] if fps else []
    if videotoolbox():
        q = int(min(100, max(1, VT_QUALITY + 3 * (18 - crf))))
        return ["-c:v", "h264_videotoolbox", "-q:v", str(q), "-profile:v", "high", "-pix_fmt", "yuv420p", *gop]
    return ["-c:v", "libx264", "-preset", "medium", "-crf", str(crf), "-pix_fmt", "yuv420p", *gop]


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
                 gray: bool = False, scale_flags: str = "bicubic", ahead: int = AHEAD):
        self.w, self.h, self.ch = w, h, 1 if gray else 3
        vf = []
        if fps:
            vf.append(f"fps={fps}")
        vf.append(f"scale={w}:{h}:flags={scale_flags}")
        vf.append(f"format={'gray' if gray else 'rgb24'}")
        args = ["ffmpeg", "-v", "error"]
        if Path(src).suffix.lower() != ".mkv" and videotoolbox() and os.environ.get("FILM_HWDEC") == "1":
            # The phone's own video on the media engine: the same frames, bit for bit, but only on request.
            # With four renders at once it refused packets ("Error submitting packet to decoder", hundreds
            # a take, 2026-10-22) and the fps filter quietly repeated the frame before; decoding in software
            # is never the slow part here (the depth model and the matte are).
            args += ["-hwaccel", "videotoolbox"]
        if start:
            args += ["-ss", f"{start:.3f}"]
        args += ["-i", str(src)]
        if dur is not None:
            args += ["-t", f"{dur:.3f}"]
        args += ["-an", "-vf", ",".join(vf), "-f", "rawvideo", "-"]
        self.proc = subprocess.Popen(args, stdout=subprocess.PIPE)
        self.size = w * h * self.ch
        self.ahead = queue.Queue(ahead) if ahead else None
        self.stopped = threading.Event()
        if self.ahead:
            threading.Thread(target=self._fill, daemon=True).start()

    def _read(self) -> np.ndarray | None:
        try:
            buf = self.proc.stdout.read(self.size)
        except (ValueError, OSError):  # closed under it
            return None
        if len(buf) < self.size:
            return None
        a = np.frombuffer(buf, np.uint8)
        return a.reshape(self.h, self.w) if self.ch == 1 else a.reshape(self.h, self.w, 3)

    def _fill(self):
        while not self.stopped.is_set():
            f = self._read()
            while not self.stopped.is_set():
                try:
                    self.ahead.put(f, timeout=0.1)
                    break
                except queue.Full:
                    pass
            if f is None:
                return

    def __iter__(self):
        return self

    def __next__(self) -> np.ndarray:
        f = None if self.stopped.is_set() else self.ahead.get() if self.ahead else self._read()
        if f is None:
            self.close()
            raise StopIteration
        return f

    def close(self):
        """Stop reading. A reader left mid-file (a clip ends, a freeze leaves the
        tail unread) is ended quietly rather than left to die on a broken pipe."""
        self.stopped.set()
        if self.proc.poll() is None:
            self.proc.kill()
            self.proc.wait()
        if self.proc.stdout and not self.proc.stdout.closed:
            self.proc.stdout.close()


class Writer:
    """Frames into a video: lossless grey (ffv1) for data, H.264 for pictures."""

    def __init__(self, dest, w: int, h: int, fps: float, kind: str = "ffv1-gray", crf: int = 18, behind: int = AHEAD):
        self.w, self.h = w, h
        if kind == "ffv1-gray":
            pix_in, codec = "gray", ["-c:v", "ffv1", "-level", "3", "-pix_fmt", "gray"]
        elif kind == "h264":
            pix_in, codec = "rgb24", [*h264_args(crf, fps), "-movflags", "+faststart"]
        else:
            raise ValueError(kind)
        self.ch = 1 if pix_in == "gray" else 3
        self.proc = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", pix_in, "-s", f"{w}x{h}", "-r", str(fps),
             "-i", "-", *codec, str(dest)], stdin=subprocess.PIPE)
        self.behind = queue.Queue(behind) if behind else None
        self.failed = None
        if self.behind:
            self.thread = threading.Thread(target=self._drain, daemon=True)
            self.thread.start()

    def _drain(self):
        while (buf := self.behind.get()) is not None:
            if self.failed is None:
                try:
                    self.proc.stdin.write(buf)
                except OSError as e:  # the encoder died: say so on the next write
                    self.failed = e

    def write(self, frame: np.ndarray):
        assert frame.shape[:2] == (self.h, self.w), (frame.shape, self.h, self.w)
        buf = np.ascontiguousarray(frame, dtype=np.uint8).tobytes()
        if self.failed is not None:
            raise RuntimeError("ffmpeg writer failed") from self.failed
        if self.behind:
            self.behind.put(buf)
        else:
            self.proc.stdin.write(buf)

    def close(self):
        if self.behind:
            self.behind.put(None)
            self.thread.join()
        self.proc.stdin.close()
        if self.proc.wait() != 0 or self.failed is not None:
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
