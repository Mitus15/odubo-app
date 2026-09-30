"""
The person, as a video matte: Robust Video Matting (RVM, mobilenetv3).

A model made for exactly this: a whole human body in a video, with a memory
of the frames before, so the outline holds still instead of boiling. On the
June take it keeps his head against the dark TV, his arms apart from his body
and his feet, where the selfie segmenter (seg.py, the fallback) swells into
the screen and loses the feet.

The model is not in this repo (it is GPL-3.0, used as a tool, never shipped).
It loads from the torch hub cache. To install it once:

    python3 -c "import torch; torch.hub.load('PeterL1n/RobustVideoMatting', 'mobilenetv3')"

or point FILM_RVM at a checkout of github.com/PeterL1n/RobustVideoMatting.
"""
import os
from pathlib import Path
import numpy as np

HUB = Path.home() / ".cache/torch/hub"
REPO = Path(os.environ.get("FILM_RVM", HUB / "PeterL1n_RobustVideoMatting_master")).expanduser()
WEIGHTS = HUB / "checkpoints/rvm_mobilenetv3.pth"
WORK_HEIGHT = 640  # the model's internal height; its refiner restores the input's size


def available() -> bool:
    return (REPO / "hubconf.py").exists() and WEIGHTS.exists()


class Matte:
    """Call with frames in order; returns alpha 0..1 (float32) at the frame's size."""

    def __init__(self, height: int):
        import torch
        if not available():
            raise SystemExit(f"Robust Video Matting is not installed ({REPO}, {WEIGHTS}). See scripts/loop/film/matte.py.")
        self.torch = torch
        self.dev = "mps" if torch.backends.mps.is_available() else "cpu"
        self.model = torch.hub.load(str(REPO), "mobilenetv3", source="local").eval().to(self.dev)
        self.ratio = min(1.0, WORK_HEIGHT / height)
        self.rec = [None] * 4

    def __call__(self, rgb: np.ndarray) -> np.ndarray:
        t = self.torch
        with t.no_grad():
            src = t.from_numpy(np.ascontiguousarray(rgb)).to(self.dev).permute(2, 0, 1).float().div(255).unsqueeze(0)
            _, pha, *self.rec = self.model(src, *self.rec, downsample_ratio=self.ratio)
            return pha[0, 0].clamp(0, 1).cpu().numpy().astype(np.float32)
