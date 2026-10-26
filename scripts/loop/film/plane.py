"""
The floor he dances on, made as a floor: a plane in the phone's own view, with
its own texture, his reflection in it, and his contact shadow on it.

The owner, 2026-10-24, of the cast shadow: "It looks like my silhouette was
flipped onto the ground and faded... It's jittery. It looks like a shape being
mapped onto me, not something the floor is actually doing." He asked for a
real virtual floor, a true reflection that blurs and fades with distance from
his feet, a contact shadow darkest and tightest where his feet touch, and
smoothness first.

  the plane       the phone never moved, so the floor is one plane in its view:
                  every row of the take below the horizon is one depth. The
                  horizon sits at the camera's eye (HORIZON of his height over
                  the floor where he usually stands), the vanishing point at
                  the take's centre. The texture is laid in the floor's own
                  coordinates, in his heights, so it lies still while the
                  virtual camera moves, and it dissolves into the field with
                  distance: the world stays a flat colour, the floor is there
                  only around him.
  the reflection  a level camera sees a mirror floor as an exact flip about
                  the floor point under each part of him (the point h above
                  the floor at depth d lands as far below it as it is above).
                  So the floor line under him is a blend of his two feet's
                  floor points (feet.py), continuous in where the feet are:
                  the old line through both feet flipped its tilt the moment
                  they crossed. A lifted foot's reflection leaves a gap as
                  wide as the lift, as a real one does. The farther below the
                  floor line, the blurrier and fainter (a lacquered floor's
                  roughness), and the boards break it a little at their seams.
  the contact     ambient occlusion from the soles: how much of him is within
  shadow          a short band above the floor line, column by column, laid
                  on the floor as a soft dark band under each foot: a tight
                  dark core from the soles, a wide faint skirt from the shins.
                  A foot that lifts leaves the band and its shadow fades and
                  spreads.

Both are drawn from his matte averaged over a few frames each side (the take
is recorded, so the average is centred and never lags him): the edges stop
boiling. He himself is drawn from the frame as it is.

On the GPU only (torch); the frame is a gpu.Canvas.
"""
import numpy as np
import gpu

torch = gpu.torch
F = gpu.F

KINDS = ("boards", "dots", "lacquer")
HORIZON = 0.72       # the camera's eye, a share of his height above the floor (floor.py's)
FOCAL = 0.78         # the phone's focal length, a share of the take's long side (a 26 mm equivalent)
SMOOTH_S = 0.034     # the matte behind the floor's drawing is averaged over this long each side

# the texture
NEAR_FADE, FAR_FADE = 1.2, 3.6   # full to this depth (1 is where he stands), gone into the field by this
BOARD_W, BOARD_L = 0.1, 1.4      # a board, in his heights
SEAM = 0.004                     # a seam's width
BOARD_TONE = 0.09                # a board's value strays this far toward the highlight or the shadow
SEAM_TONE = 0.55                 # a seam: this far toward the shadow
GRAIN = 0.05                     # the boards' grain
DOT_CELL, DOT_R = 0.05, 0.3      # the Ben-Day floor: a dot per cell (his heights), its radius (share of the cell)
DOT_TONE = 0.55
LACQUER_TONE = 0.06

# the reflection
GLOSS = 0.55                     # how much of him the floor gives back at his soles
REACH = 0.22                     # it fades to 1/e over this share of his height below the floor line
ROUGH = (0.6, 0.06)              # its blur: px at the floor line, and px more per px below it
LEVELS = (0.0, 1.5, 4.0, 9.0, 18.0)  # the blurs worked out once a frame; between them it blends
RIPPLE = 0.004                   # a board does not lie quite flat: it shifts his image up to this share of his height
ARCH = 0.016                     # a sole this close to the floor line (his heights) closes the gap under it
FOOT_SPAN = 0.04                 # a foot's floor point holds the floor line this far either side (his heights)
NEARER = 0.02                    # where both feet share columns, the nearer wins, more so the farther apart in depth

# the contact shadow: (band above the floor line, blur across, blur along the floor, strength), his heights
CORE = (0.03, 0.014, 0.010, 1.0)
SKIRT = (0.14, 0.06, 0.03, 0.8) 
CONTACT_INK = 0.8                # the core darkens past the shadow colour, this far toward ink

LATTICE = 256
BAND = 64


def look_ahead(fps: float) -> int:
    """Frames read past the one drawn, for the centred average."""
    return max(1, int(round(SMOOTH_S * fps)))


def weights(fps: float) -> np.ndarray:
    """The centred average's weights, frames -n..n."""
    n = look_ahead(fps)
    j = np.arange(-n, n + 1, dtype=np.float64)
    w = np.exp(-0.5 * (j / max(0.6, n * 0.75)) ** 2)
    return (w / w.sum()).astype(np.float32)


def mean_of(before: list, after: list, w: np.ndarray):
    """
    The centred mean of tensors: `before` the frames up to the one drawn (it
    last), `after` those read past it, weighted by w (frames -n..n) and
    renormalised over the frames there are (the ends of the take).
    """
    n = len(w) // 2
    ws = list(w[n + 1 - len(before):n + 1]) + list(w[n + 1:n + 1 + len(after)])
    frames = list(before) + list(after)
    total = float(sum(ws))
    out = frames[0] * (float(ws[0]) / total)
    for f, wj in zip(frames[1:], ws[1:]):
        out = out + f * (float(wj) / total)
    return out


def floor_line(feet, W: int, stand: float, body: float) -> np.ndarray:
    """
    The floor line under him at each column of the output: under a foot it
    is that foot's floor point (feet.py), and between and beyond his feet it
    eases to where he stands (their mean). Where both feet share columns the
    nearer one wins, as it hides the other. Every step of it is smooth in
    where the feet are, so it never flips when they cross.
    """
    xs = np.arange(W, dtype=np.float32)
    if not feet:
        return np.full(W, stand, np.float32)
    span = FOOT_SPAN * body
    near = max(fy for _, fy in feet)
    g = np.stack([np.exp(-0.5 * ((xs - fx) / span) ** 2) for fx, _ in feet])
    pick = g ** 4 * np.exp([[(fy - near) / (NEARER * body)] for _, fy in feet])
    pick /= np.maximum(pick.sum(0), 1e-12)
    own = (pick * np.array([[fy] for _, fy in feet])).sum(0)
    return (stand + g.max(0) * (own - stand)).astype(np.float32)


class Plane:
    """The floor of one piece: where it is in the take, and how to draw on it."""

    def __init__(self, kind: str, take_w: int, take_h: int, body: float, stand: float, dev):
        if kind not in KINDS:
            raise SystemExit(f"floor {kind!r}: one of {', '.join(KINDS)}")
        self.kind, self.dev = kind, dev
        self.body = float(body)                         # his height in the take, px
        self.stand = float(stand)                       # the row where his feet usually meet the floor, take px
        self.horizon = self.stand - HORIZON * self.body
        self.vx = take_w / 2
        self.zref = FOCAL * max(take_w, take_h) / self.body  # how far from the phone he stands, his heights
        g = torch.Generator().manual_seed(1024)
        self.table = torch.rand(LATTICE * LATTICE, generator=g).to(dev)

    # --- where each pixel lies on the floor -------------------------------------------------------------------

    def coords(self, A: np.ndarray, y0: int, H: int, W: int):
        """For output rows y0..H: depth D (1 where he stands), the floor's X and Z (his heights), and a pixel's footprint on each."""
        dev = self.dev
        ys = torch.arange(y0, H, dtype=torch.float32, device=dev)[:, None]
        xs = torch.arange(W, dtype=torch.float32, device=dev)[None, :]
        yt = (ys - float(A[1, 2])) / float(A[1, 1])
        xt = (xs - float(A[0, 2])) / float(A[0, 0])
        den = (yt - self.horizon).clamp_min(1e-3)
        D = (self.stand - self.horizon) / den
        dD = (self.stand - self.horizon) / (den * den) / float(A[1, 1])  # |dD/dy| per output px
        X = (xt - self.vx) * D / self.body
        Z = D * self.zref
        wX = D / (self.body * float(A[0, 0])) + (xt - self.vx).abs() / self.body * dD
        wZ = self.zref * dD
        return D, X, Z, wX, wZ

    def hash(self, a, b, salt: int = 0):
        """A steady random 0..1 for integer lattice points (a, b), from one table."""
        i = (a.long() * 7 + salt * 131) % LATTICE
        j = (b.long() * 13 + salt * 17) % LATTICE
        return self.table[(j * LATTICE + i).reshape(-1)].reshape(i.shape)

    def noise(self, u, v, salt: int = 0):
        """Value noise at (u, v), smooth between lattice points, 0..1."""
        iu, iv = torch.floor(u), torch.floor(v)
        fu, fv = u - iu, v - iv
        fu, fv = fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)
        a = self.hash(iu, iv, salt)
        b = self.hash(iu + 1, iv, salt)
        c = self.hash(iu, iv + 1, salt)
        d = self.hash(iu + 1, iv + 1, salt)
        return (a + (b - a) * fu) + ((c + (d - c) * fu) - (a + (b - a) * fu)) * fv

    @staticmethod
    def line(dist, width: float, foot):
        """A line `width` wide at distance `dist`, drawn into a pixel whose footprint is `foot` (all in his heights)."""
        return ((width / 2 + foot / 2 - dist) / foot).clamp(0, 1) * (width / foot).clamp(max=1.0)

    def texture(self, X, Z, wX, wZ, D):
        """(tone -1..1, seam 0..1, gloss 0..1, ripple in his heights) over the floor rows."""
        seen = 1 - ((D - NEAR_FADE) / (FAR_FADE - NEAR_FADE)).clamp(0, 1)
        seen = seen * seen * (3 - 2 * seen)
        zero = torch.zeros_like(X)
        if self.kind == "boards":
            u = X / BOARD_W
            n = torch.floor(u)
            fu = u - n
            seam_x = self.line(torch.minimum(fu, 1 - fu) * BOARD_W, SEAM, wX)
            v = (Z + self.hash(n, zero) * BOARD_L) / BOARD_L
            m = torch.floor(v)
            fv = v - m
            seam_z = self.line(torch.minimum(fv, 1 - fv) * BOARD_L, SEAM, wZ.expand_as(X))
            gate = (1 - wX / (0.3 * BOARD_W)).clamp(0, 1)            # the pattern goes before it can shimmer
            tone = (self.hash(n, m, 1) * 2 - 1) * BOARD_TONE
            grain = (self.noise(X * 110, Z * 5, 2) * 2 - 1) * GRAIN * (1 - wX * 110 / 0.6).clamp(0, 1)
            seam = torch.maximum(seam_x, seam_z) * gate
            gloss = (0.85 + 0.15 * self.hash(n, m, 3)) * (1 - 0.8 * seam)
            ripple = (self.hash(n, m, 4) * 2 - 1) * RIPPLE * gate
            return (tone * gate + grain) * seen, seam * seen, gloss, ripple
        if self.kind == "dots":
            row = torch.floor(Z / DOT_CELL)
            u = X / DOT_CELL + 0.5 * (row % 2)                      # every other row stepped half a cell
            fu, fv = u - torch.floor(u) - 0.5, Z / DOT_CELL - row - 0.5
            dist = torch.sqrt(fu * fu + fv * fv) * DOT_CELL
            foot = torch.maximum(wX, wZ.expand_as(X))
            dot = ((DOT_R * DOT_CELL - dist) / foot + 0.5).clamp(0, 1)
            gate = (1 - foot / (0.35 * DOT_CELL)).clamp(0, 1)
            return zero, dot * DOT_TONE * gate * seen, torch.ones_like(X), zero
        mottle = (self.noise(X * 9, Z * 3, 5) * 2 - 1) * LACQUER_TONE * (1 - wX * 9 / 0.6).clamp(0, 1)
        return mottle * seen, zero, torch.ones_like(X) * (0.9 + 0.1 * self.noise(X * 4, Z * 2, 6)), zero

    # --- drawing ------------------------------------------------------------------------------------------------

    def soles(self, cov, line: np.ndarray, body: float):
        """
        What lies between his soles and the floor line, (y0, fill): under an
        arch, or a heel just up, the floor is in the shoe's shade and gives
        back its dark underside, so the gap closes there. Column by column it
        closes in full when the sole is within ARCH of the floor line and
        eases open by twice that: a foot that lifts comes away smoothly.
        """
        H, W = cov.shape
        reach = ARCH * body
        y0 = int(max(0, np.floor(float(line.min()) - 2 * reach) - 1))
        y1 = int(min(H, np.ceil(float(line.max())) + 2))
        if y1 - y0 < 2:
            return y0, None
        c = self.tensor_line(line)
        rows = torch.arange(y0, y1, dtype=torch.float32, device=cov.device)[:, None]
        band = cov[y0:y1]
        lowest = torch.where((band > 0.5) & (rows <= c + 1), rows, torch.full_like(band, -1e6)).amax(0, keepdim=True)
        gap = c - lowest
        u = ((gap - reach) / reach).clamp(0, 1)
        close = 1 - u * u * (3 - 2 * u)
        fill = close * ((rows > lowest) & (rows <= c + 1)).float()
        return y0, fill

    def tensor_line(self, line: np.ndarray):
        return gpu.send(np.ascontiguousarray(line, np.float32))[None, :]

    def lay_floor(self, canvas, A: np.ndarray, pal: dict):
        """The floor's own texture in the palette's tones, below the horizon."""
        H, W = canvas.H, canvas.W
        top = int(max(0, np.ceil(float(A[1, 1]) * self.horizon + float(A[1, 2])) + 1))
        if top >= H:
            return
        D, X, Z, wX, wZ = self.coords(A, top, H, W)
        tone, seam, _, _ = self.texture(X, Z, wX, wZ, D)
        field, shade, light = canvas.colour(pal["field"]), canvas.colour(pal["shadow"]), canvas.colour(pal["highlight"])
        base = field + (light - field) * tone.clamp(min=0) + (shade - field) * (-tone).clamp(min=0)
        base = base + (shade - base) * (seam * SEAM_TONE)
        canvas.px[:, top:] = base

    def lay_contact(self, canvas, alpha_out, line: np.ndarray, body: float, pal: dict, fade: float):
        """The contact shadow: alpha_out his (averaged) matte in the output frame (H, W), line the floor line per column."""
        H, W = canvas.H, canvas.W
        lo, hi = float(line.min()), float(line.max())
        y0 = int(max(0, np.floor(lo - SKIRT[0] * body) - 2))
        y1 = int(min(H, np.ceil(hi + 4 * SKIRT[2] * body) + 2))
        if y1 - y0 < 4:
            return
        hb = min(H, -(-(y1 - y0) // BAND) * BAND)
        y0 = min(y0, H - hb)
        c = canvas.tensor(line)[None, :]
        rows = torch.arange(y0, y0 + hb, dtype=torch.float32, device=canvas.dev)[:, None]
        above = c - rows                                            # px of him above the floor line
        a = self.closed(alpha_out, line, body)[0][y0:y0 + hb]
        field = canvas.colour(pal["field"]).clamp_min(1)
        shade, ink = canvas.colour(pal["shadow"]), canvas.colour(pal["ink"])
        band_px = canvas.px[:, y0:y0 + hb]
        # the skirt darkens toward the palette's shadow, the core past it toward ink
        for (band, across, along, strength), deep in ((SKIRT, shade), (CORE, shade + (ink - shade) * CONTACT_INK)):
            reach = band * body
            w = (1 - above / reach).clamp(0, 1) * (above > -2).float()
            prof = (a * w).sum(0, keepdim=True) / max(1.0, 0.5 * reach)   # 1: a sole flat on the floor across the band
            prof = gpu.blur(prof.clamp(0, 1)[None], max(0.6, across * body))[0]
            sy = max(0.6, along * body)
            lay = prof * torch.exp(-0.5 * ((rows - c) / sy) ** 2) * strength
            band_px.mul_(1 - lay * fade * (1 - (deep / field).clamp(0, 1)))

    def closed(self, cov, line: np.ndarray, body: float):
        """cov with the gaps under his soles closed (soles): (closed, (y0, what was added) or None)."""
        y0, fill = self.soles(cov, line, body)
        if fill is None:
            return cov, None
        out = cov.clone()
        seg = out[y0:y0 + fill.shape[0]]
        add = (fill - seg).clamp(min=0)
        seg.add_(add)
        return out, (y0, add)

    def lay_reflection(self, canvas, A: np.ndarray, colour, cov, line: np.ndarray, body: float, fade: float, ink):
        """
        His reflection: colour (3, H, W) and cov (H, W) him (averaged) in the
        output frame, line the floor line per column, body his height on screen;
        the gaps under his soles reflect as their dark underside (ink).
        """
        H, W = canvas.H, canvas.W
        y0 = int(max(0, np.floor(float(line.min())) - 2))
        if y0 >= H - 2:
            return
        hb = min(H, -(-(H - y0) // BAND) * BAND)
        y0 = H - hb
        dev = canvas.dev
        c = canvas.tensor(line)[None, :]
        rows = torch.arange(y0, H, dtype=torch.float32, device=dev)[:, None]
        cols = torch.arange(W, dtype=torch.float32, device=dev)[None, :].expand(hb, W)
        D, X, Z, wX, wZ = self.coords(A, y0, H, W)
        _, _, gloss, ripple = self.texture(X, Z, wX, wZ, D)
        below = rows - c                                            # px below the floor line
        src_y = 2 * c - rows + ripple * body
        grid = torch.stack(((2 * cols + 1) / W - 1, (2 * src_y + 1) / H - 1), -1)
        cov_, added = self.closed(cov, line, body)
        layer = torch.cat((colour * cov[None], cov_[None]), 0)      # premultiplied
        if added is not None:
            fy0, add = added
            layer[:3, fy0:fy0 + add.shape[0]] += canvas.colour(ink) * add
        mirrored = F.grid_sample(layer[None], grid[None], mode="bilinear", padding_mode="zeros", align_corners=False)[0]
        # roughness: the blur grows with the distance below the floor line
        sigma = (ROUGH[0] + ROUGH[1] * below.clamp(min=0)).clamp(max=LEVELS[-1]).expand(hb, W)
        out = mirrored
        prev = mirrored
        for s0, s1 in zip(LEVELS, LEVELS[1:]):
            nxt = gpu.wide_blur(mirrored, s1)
            t = ((sigma - s0) / (s1 - s0)).clamp(0, 1)
            out = out + (nxt - prev) * t
            prev = nxt
        strength = GLOSS * torch.exp(-below.clamp(min=0) / (REACH * body)) * (below > -1).float() * gloss * fade
        band_px = canvas.px[:, y0:]
        band_px.copy_(band_px * (1 - strength * out[3:4]) + out[:3] * strength)
