"""
The HUD: the game's own layer over the stage (compose --hud="1-1|Billie Jean",
or a show file's "hud": {"level": "1-1", "title": "Billie Jean",
"artist": "Michael Jackson", "player": "Mitus Young History"}).

Minimal, ink on the field, in Jost. Who is playing on one side, where on
the other, as Super Mario Bros lays out its own (whose "WORLD 1-1" the
numbering borrows). Two sizes only: the numbers big, the names small, every
number over its name (the owner chose this layout, "D", 2026-10-12, when the
player's name made the first one crowded).

  left        the player: the seal (the marker over his head, his icon), as
              tall as the two rows; his steps so far ("056 STEPS": real
              footfalls, read from the pose, floor.footfalls, never a
              made-up score) over the character he plays, "MITUS YOUNG
              HISTORY" (owner, 2026-10-12: "im playing as Mitus Young
              History. there could be other characters")
  right       the level (world-level numbering: a season is a world, 1-1 to
              1-17, so it never reaches "level 100") over the song and its
              artist, "FILS DE JOIE · STROMAE": the credit is never left off
              a song that is not ours
  under both  a thin line, the piece's progress

The two big lines share a baseline and the two small ones another.

The training ground wears the same HUD with two differences (owner,
2026-10-15: "the hud and other layouts can tell us if its an actual level or
the training ground but we remain in the pop art world"): the level slot reads
TRAINING, and there is no progress line, since practice has no finish. A show
file says so with "level": "TRAINING", "progress": false.

It keeps out of the platforms' own furniture (the top bar of a Reel, the side
buttons, the caption at the bottom) and fades with him at the end, so the
Danceman closes the piece alone.
"""
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from film_common import REPO
from gpu import band, lay
from outro import SEAL, raster

FONTS = REPO / "public/loop/fonts"
MARGIN, TOP_PORTRAIT, TOP_LANDSCAPE = 72, 236, 72  # px at a 1080 short side; a Reel's top bar ends near 200
BIG_PX, SMALL_PX = 40, 20    # the numbers (Jost 700) and the names (Jost 500, letterspaced)
ROW_GAP, SEAL_GAP, LABEL_GAP = 14, 20, 10  # between the rows, after the seal, between a number and its word
LINE_PX, LINE_GAP = 3, 80    # the progress line: its weight, and how far under the top (the big caps) it runs
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


def credit(title: str, artist: str = "") -> str:
    """The song's line: its title, and who made it."""
    return " · ".join(x.strip().upper() for x in (title, artist) if x.strip())


class Hud:
    def __init__(self, width: int, height: int, level: str, title: str, falls: list, k_start: int, artist: str = "",
                 player: str = "", progress: bool = True):
        self.W, self.H = width, height
        self.progress = progress
        s = min(width, height) / 1080
        self.s = s
        self.margin = MARGIN * s
        self.top = (TOP_PORTRAIT if height > width else TOP_LANDSCAPE) * s
        font = lambda weight, px: ImageFont.truetype(str(FONTS / f"Jost-{weight}.ttf"), max(8, int(round(px * s))))  # noqa: E731
        self.f_big, self.f_small = font(700, BIG_PX), font(500, SMALL_PX)
        cap = lambda f: f.getbbox("H")[3] - f.getbbox("H")[1]  # noqa: E731
        # The rows: the big caps from the top, the small caps ROW_GAP under them.
        self.base_big = self.top + cap(self.f_big)
        self.base_small = self.base_big + ROW_GAP * s + cap(self.f_small)
        tall = max(8, int(round(self.base_small - self.top)))
        seal = raster(SEAL, int(tall * 1.3))
        ys, xs = np.where(seal > 0.02)
        seal = seal[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        self.seal = cv2.resize(seal, (max(1, int(round(seal.shape[1] * tall / seal.shape[0]))), tall),
                               interpolation=cv2.INTER_AREA)
        self.level = _text(level, self.f_big, 0.08)
        self.credit = _text(credit(title, artist), self.f_small, 0.16)
        self.label = _text("STEPS", self.f_small, 0.2)
        self.player = _text(player.strip().upper(), self.f_small, 0.16) if player.strip() else None
        self.steps = sorted(f for f, *_ in falls if f > k_start)
        self.numbers = {}

    def _number(self, n: int) -> np.ndarray:
        key = f"{n:03d}"
        if key not in self.numbers:
            self.numbers[key] = _text(key, self.f_big, 0.06)
        return self.numbers[key]

    def _on(self, canvas, cov, x, baseline, font, ink, opacity, right=False):
        """Lay a line of text with its baseline at `baseline`, from x (or ending at x)."""
        self._lay(canvas, cov, x - cov.shape[1] if right else x, baseline - font.getmetrics()[0], ink, opacity)

    def draw(self, canvas: np.ndarray, k: int, progress: float, ink, opacity: float = 1.0):
        """Lay the HUD on `canvas` (float RGB) at take frame k, the piece `progress` (0..1) through."""
        if opacity <= 0.01:
            return
        m, s, right = self.margin, self.s, self.W - self.margin
        # The player: the seal, his steps over his name.
        self._lay(canvas, self.seal, m, self.top, ink, opacity)
        tx = m + self.seal.shape[1] + SEAL_GAP * s
        num = self._number(int(np.searchsorted(self.steps, k, side="right")))
        self._on(canvas, num, tx, self.base_big, self.f_big, ink, opacity)
        self._on(canvas, self.label, tx + num.shape[1] + LABEL_GAP * s, self.base_big, self.f_small, ink, opacity)
        if self.player is not None:
            self._on(canvas, self.player, tx, self.base_small, self.f_small, ink, opacity)
        # The level over the song.
        self._on(canvas, self.level, right, self.base_big, self.f_big, ink, opacity, right=True)
        self._on(canvas, self.credit, right, self.base_small, self.f_small, ink, opacity, right=True)
        if not self.progress:
            return
        y = int(round(self.top + LINE_GAP * s))
        x0, x1 = int(round(m)), int(round(right))
        xp = int(round(x0 + (x1 - x0) * min(1.0, max(0.0, progress))))
        lw = max(1, int(round(LINE_PX * s)))
        band(canvas, x0, y, x1, y + lw, ink, FAINT * opacity)
        band(canvas, x0, y, xp, y + lw, ink, opacity)

    def _lay(self, canvas, cov: np.ndarray, x: float, y: float, ink, opacity: float):
        """A line of the HUD on the frame (numpy, or the GPU's: its lines go up once and stay)."""
        lay(canvas, cov, int(round(x)), int(round(y)), ink, opacity, keep=True)
