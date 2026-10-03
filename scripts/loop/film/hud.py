"""
The HUD: the game's own layer over the stage (compose --hud="1-1|Billie Jean",
or a show file's "hud": {"level": "1-1", "title": "Billie Jean"}).

Minimal, ink on the field, in Jost. Top left the seal (player one), the level
(world-level numbering: a season is a world, 1-1 to 1-17, so it never reaches
"level 100") and the song. Top right his steps so far: real footfalls, read
from the pose (floor.footfalls), never a made-up score. Under them a thin
line, the piece's progress.

It keeps out of the platforms' own furniture (the top bar of a Reel, the side
buttons, the caption at the bottom) and fades with him at the end, so the
Danceman closes the piece alone.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from film_common import REPO
from outro import SEAL, raster

FONTS = REPO / "public/loop/fonts"
MARGIN, TOP_PORTRAIT, TOP_LANDSCAPE = 72, 236, 72  # px at a 1080 short side; a Reel's top bar ends near 200
SEAL_H, LEVEL_PX, TITLE_PX, NUM_PX, LABEL_PX = 52, 40, 24, 58, 20
LINE_PX, LINE_GAP = 3, 104   # the progress line: its weight, and how far under the top it runs
FAINT = 0.22                 # the unrun part of the line


def _text(text: str, font: ImageFont.FreeTypeFont, track: float) -> np.ndarray:
    """Coverage (0..1) of a line of text, letters spaced by `track` of the font size."""
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    widths = [probe.textlength(c, font=font) for c in text]
    w = int(np.ceil(sum(widths) + track * font.size * max(0, len(text) - 1))) + 4
    h = int(font.size * 1.35)
    img = Image.new("L", (max(1, w), h), 0)
    d = ImageDraw.Draw(img)
    x = 0.0
    for c, cw in zip(text, widths):
        d.text((x, 0), c, font=font, fill=255)
        x += cw + track * font.size
    return np.asarray(img, np.float32) / 255


class Hud:
    def __init__(self, width: int, height: int, level: str, title: str, falls: list, k_start: int):
        self.W, self.H = width, height
        s = min(width, height) / 1080
        self.s = s
        self.margin = MARGIN * s
        self.top = (TOP_PORTRAIT if height > width else TOP_LANDSCAPE) * s
        font = lambda weight, px: ImageFont.truetype(str(FONTS / f"Jost-{weight}.ttf"), max(8, int(round(px * s))))  # noqa: E731
        self.f_num, self.f_label = font(700, NUM_PX), font(500, LABEL_PX)
        seal = raster(SEAL, max(16, int(round(SEAL_H * s * 1.3))))
        ys, xs = np.where(seal > 0.02)
        self.seal = seal[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        self.level = _text(level, font(700, LEVEL_PX), 0.08)
        self.title = _text(title.upper(), font(500, TITLE_PX), 0.16)
        self.label = _text("STEPS", self.f_label, 0.2)
        self.steps = sorted(f for f, *_ in falls if f > k_start)
        self.numbers = {}

    def _number(self, n: int) -> np.ndarray:
        key = f"{n:03d}"
        if key not in self.numbers:
            self.numbers[key] = _text(key, self.f_num, 0.06)
        return self.numbers[key]

    def draw(self, canvas: np.ndarray, k: int, progress: float, ink, opacity: float = 1.0):
        """Lay the HUD on `canvas` (float RGB) at take frame k, the piece `progress` (0..1) through."""
        if opacity <= 0.01:
            return
        m, top, s = self.margin, self.top, self.s
        seal_x, seal_y = m, top + 4 * s
        self._lay(canvas, self.seal, seal_x, seal_y, ink, opacity)
        tx = seal_x + self.seal.shape[1] + 20 * s
        self._lay(canvas, self.level, tx, top - 4 * s, ink, opacity)
        self._lay(canvas, self.title, tx, top + 42 * s, ink, opacity)
        n = int(np.searchsorted(self.steps, k, side="right"))
        num = self._number(n)
        self._lay(canvas, num, self.W - m - num.shape[1], top - 12 * s, ink, opacity)
        self._lay(canvas, self.label, self.W - m - self.label.shape[1], top + 52 * s, ink, opacity)
        y = int(round(top + LINE_GAP * s))
        x0, x1 = int(round(m)), int(round(self.W - m))
        xp = int(round(x0 + (x1 - x0) * min(1.0, max(0.0, progress))))
        lw = max(1, int(round(LINE_PX * s)))
        band = canvas[y:y + lw, x0:x1]
        band += (ink - band) * (FAINT * opacity)
        run = canvas[y:y + lw, x0:xp]
        run += (ink - run) * opacity

    def _lay(self, canvas: np.ndarray, cov: np.ndarray, x: float, y: float, ink, opacity: float):
        x, y = int(round(x)), int(round(y))
        h, w = cov.shape
        x0, y0, x1, y1 = max(0, x), max(0, y), min(self.W, x + w), min(self.H, y + h)
        if x1 <= x0 or y1 <= y0:
            return
        a = cov[y0 - y:y1 - y, x0 - x:x1 - x][..., None] * opacity
        view = canvas[y0:y1, x0:x1]
        view += (ink - view) * a
