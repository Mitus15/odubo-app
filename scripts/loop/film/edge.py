"""
Crisp edges cut from smooth fields: the look's one drawing rule.

Every edge in the film (his outline, his pools of light, his shadow, his
echoes) is where a smooth field crosses a level, cut at the size it is drawn,
so it is a clean anti-aliased curve at any scale, never an upscaled staircase.
"""
import numpy as np


def cut(f: np.ndarray, level: float) -> np.ndarray:
    """Where a smooth field crosses `level`, as coverage 0..1 with a one pixel
    ramp: a crisp, anti-aliased edge at whatever scale it is drawn."""
    gy, gx = np.gradient(f)
    return np.clip((f - level) / (np.sqrt(gx * gx + gy * gy) + 1e-4) + 0.5, 0, 1)


def melt(f: np.ndarray, level: float, soft: float) -> np.ndarray:
    u = np.clip((f - level + soft) / (2 * soft), 0, 1)
    return u * u * (3 - 2 * u)
