"""
The Mac's GPU for the drawing stages: figure (his look) and compose (the frame).

Until 2026-10-20 only the learned steps (the matte, the pose, the skin) ran on
the GPU, while the drawing ran on one CPU core: about 45 minutes for a ten
minute take. The owner: "all this type of video work is gpu stuff. we should
know better."

These are the operations the numpy reference draws with (cv2's Gaussian blur,
its area and bilinear resizes, its affine warps and remap, np.gradient), in
torch on Apple's Metal ("mps"), each matched to OpenCV's own sampling (its
kernels, its reflected borders, its pixel centres), so the look does not move
when the work moves. The numpy code stays the reference and the fallback: with
no torch, no Metal, or FILM_GPU=0, everything draws as before.
tests/test_gpu.py holds the two together.

Video goes through VideoToolbox, the Mac's media engine (take.Reader and
take.Writer): the phone's HEVC is decoded there, the pictures encoded there.
"""
import os
import numpy as np
import cv2

try:
    import torch
    import torch.nn.functional as F
except ImportError:  # the numpy path needs none of this
    torch = F = None

_device = False  # not looked up yet


def device():
    """The Metal device, or None: no torch, no Metal, or FILM_GPU=0."""
    global _device
    if _device is False:
        _device = None
        if torch is not None and os.environ.get("FILM_GPU", "1") != "0" and torch.backends.mps.is_available():
            _device = torch.device("mps")
    return _device


def fused(fn=None, *, sizes: str = "fixed"):
    """
    fn compiled by torch into a few GPU kernels: a chain of elementwise steps
    costs one pass over the picture instead of one per step (an interp over
    four frames: 49 ms as separate steps, 0.8 ms fused). Where torch cannot
    compile it, or FILM_FUSE=0, fn runs step by step: the same values.

    sizes="fixed" compiles each size it meets on its own: a kernel compiled
    for any size ran a warp 50 times slower. A function given plain numbers
    that change every frame (an opacity) takes sizes="any", so those numbers
    do not each cost a compile.
    """
    if fn is None:
        return lambda f: fused(f, sizes=sizes)
    if torch is None or os.environ.get("FILM_FUSE", "1") == "0":
        return fn
    state = {"compiled": None, "ok": True}

    def call(*args):
        if state["ok"]:
            try:
                if state["compiled"] is None:  # compiled on first use: the numpy path never pays for it
                    state["compiled"] = torch.compile(fn, dynamic=False if sizes == "fixed" else None)
                return state["compiled"](*args)
            except Exception as e:  # noqa: BLE001 (any compiler failure: the plain steps give the same answer)
                state["ok"] = False
                print(f"  gpu: {fn.__name__} runs unfused ({type(e).__name__}: {str(e)[:120]})", flush=True)
        return fn(*args)
    return call


_inflight = []   # (serial, array) sent and maybe not yet arrived
_sent = [0]


def send(a: np.ndarray):
    """
    A numpy array onto the GPU without waiting for it. A plain .to() waits for
    every job queued before it; this one does not, so the array is kept alive
    here until a download has waited past it (settle).
    """
    if not (a.flags.writeable and a.flags.c_contiguous):  # torch takes only an array it may write (a decoded frame is not)
        a = np.array(a)
    t = torch.from_numpy(a)
    _sent[0] += 1
    _inflight.append((_sent[0], t))
    return t.to(device(), non_blocking=True)


def settle(upto: int | None = None):
    """After a download: everything sent before it (up to serial `upto`, else all) has arrived, so its arrays may go."""
    while _inflight and (upto is None or _inflight[0][0] <= upto):
        _inflight.pop(0)


class Download:
    """A tensor on its way to the CPU while the GPU goes on: result() waits for it alone."""

    def __init__(self, t):
        self.cpu = torch.empty(t.shape, dtype=t.dtype)
        self.cpu.copy_(t, non_blocking=True)
        self.gpu, self.upto = t, _sent[0]
        self.done = torch.mps.event.Event()
        self.done.record()

    def result(self) -> np.ndarray:
        self.done.synchronize()
        settle(self.upto)
        self.gpu = self.done = None
        return self.cpu.numpy()


_cache = {}


def _const(key, make, dev):
    """A small tensor built once per device (kernels, border indices)."""
    k = (key, str(dev))
    if k not in _cache:
        _cache[k] = make()
    return _cache[k]


# --- blur and resize, as cv2 does them -------------------------------------------------------------------------

def gauss_taps(sigma: float) -> np.ndarray:
    """cv2.GaussianBlur's own kernel for a float image given only sigma: 4 sigma each side."""
    k = int(round(sigma * 8 + 1)) | 1
    return cv2.getGaussianKernel(k, sigma, cv2.CV_32F).ravel()


def reflect101(n: int, pad: int) -> np.ndarray:
    """The source index of each of n + 2 pad samples, the border mirrored without its edge (cv2's default)."""
    return mirror(np.arange(-pad, n + pad), n)


def mirror(i: np.ndarray, n: int) -> np.ndarray:
    """Any index brought inside 0..n-1 as cv2's BORDER_REFLECT_101 brings it, however far out."""
    if n == 1:
        return np.zeros_like(i)
    i = np.abs(i) % (2 * (n - 1))
    return np.where(i >= n, 2 * (n - 1) - i, i)


def _blur_axis(x, taps: np.ndarray, axis: int):
    """x (N, H, W) filtered along one axis (1: down the columns, 2: along the rows)."""
    k, n = len(taps), x.shape[axis]
    idx = _const(("reflect", n, k // 2), lambda: torch.from_numpy(reflect101(n, k // 2)).to(x.device), x.device)
    w = _const(("taps", taps.tobytes(), axis),
               lambda: torch.from_numpy(taps).to(x.device).view(1, 1, *((1, k) if axis == 2 else (k, 1))), x.device)
    return F.conv2d(x.index_select(axis, idx).unsqueeze(1), w).squeeze(1)


def blur(x, sigma: float):
    """cv2.GaussianBlur(x, (0, 0), sigma) on (N, H, W) float32: the rows, then the columns."""
    taps = gauss_taps(sigma)
    return _blur_axis(_blur_axis(x, taps, 2), taps, 1)


def blur_within(x, sigma: float, y0: int, y1: int):
    """
    cv2.GaussianBlur of the strip x[y0:y1] of x (H, W), laid back in place at
    the full size (rows outside the strip hold nothing meaningful): the strip's
    ends mirror as they would cut out, and the GPU sees one size every frame.
    """
    taps = gauss_taps(sigma)
    k, H = len(taps), x.shape[0]
    rows = send(y0 + mirror(np.arange(-(k // 2), H + k // 2) - y0, y1 - y0))
    w = _const(("taps", taps.tobytes(), 1), lambda: torch.from_numpy(taps).to(x.device).view(1, 1, k, 1), x.device)
    r = _blur_axis(x[None], taps, 2)[0]
    return F.conv2d(r.index_select(0, rows)[None, None], w)[0, 0]


def _area_weights(n_in: int, n_out: int) -> np.ndarray:
    """cv2's INTER_AREA shrink along one axis, as an (n_out, n_in) matrix: each output averages what it covers."""
    scale = n_in / n_out
    w = np.zeros((n_out, n_in), np.float64)
    for d in range(n_out):
        f1 = d * scale
        f2 = f1 + scale
        cell = min(scale, n_in - f1)
        s1, s2 = int(np.ceil(f1)), int(np.floor(f2))
        s2 = min(s2, n_in - 1)
        s1 = min(s1, s2)
        if s1 - f1 > 1e-3:
            w[d, s1 - 1] = (s1 - f1) / cell
        w[d, s1:s2] = 1 / cell
        if f2 - s2 > 1e-3:
            w[d, s2] = min(min(f2 - s2, 1.0), cell) / cell
    return w.astype(np.float32)


def area(x, w: int, h: int):
    """cv2.resize(x, (w, h), interpolation=INTER_AREA) for a shrink, on (N, H, W)."""
    H, W = x.shape[-2:]
    if H % h == 0 and W % w == 0:
        return F.avg_pool2d(x.unsqueeze(1), (H // h, W // w)).squeeze(1)
    ry = _const(("area", H, h), lambda: torch.from_numpy(_area_weights(H, h)).to(x.device), x.device)
    rx = _const(("area", W, w), lambda: torch.from_numpy(_area_weights(W, w)).to(x.device), x.device)
    return ry @ x @ rx.T


def linear(x, w: int, h: int):
    """cv2.resize(x, (w, h), interpolation=INTER_LINEAR) on (N, H, W): pixel centres, edges held."""
    return F.interpolate(x.unsqueeze(1), size=(h, w), mode="bilinear", align_corners=False).squeeze(1)


def _cubic(f: np.ndarray) -> list:
    """The four weights of cv2's bicubic (A = -0.75) at fractional offsets f."""
    a = -0.75
    w0 = ((a * (f + 1) - 5 * a) * (f + 1) + 8 * a) * (f + 1) - 4 * a
    w1 = ((a + 2) * f - (a + 3)) * f * f + 1
    w2 = ((a + 2) * (1 - f) - (a + 3)) * (1 - f) * (1 - f) + 1
    return [w0, w1, w2, 1 - w0 - w1 - w2]


def _resize_taps(n_in: int, n_out: int):
    c = (np.arange(n_out) + 0.5) * (n_in / n_out) - 0.5
    i0 = np.floor(c).astype(np.int64)
    idx = np.clip(i0[:, None] + np.arange(-1, 3), 0, n_in - 1)
    return idx, np.stack(_cubic(c - i0), 1).astype(np.float32)


def cubic(x, w: int, h: int):
    """cv2.resize(x, (w, h), interpolation=INTER_CUBIC) on (N, H, W); the same size is a copy, as in cv2."""
    H, W = x.shape[-2:]
    if (H, W) == (h, w):
        return x
    return _sample(x, *_resize_taps(W, w), *_resize_taps(H, h))


def wide_blur(x, sigma: float):
    """figure.wide_blur on (N, H, W): a wide Gaussian worked at a quarter or half of the size."""
    k = 4 if sigma >= 12 else 2 if sigma >= 6 else 1
    if k == 1:
        return blur(x, sigma)
    h, w = x.shape[-2:]
    return linear(blur(area(x, w // k, h // k), sigma / k), w, h)


# --- warps, as cv2.warpAffine and cv2.remap sample ----------------------------------------------------------------

def invert(M: np.ndarray) -> np.ndarray:
    """cv2.invertAffineTransform, in its own double arithmetic: the output-to-source map, flat."""
    m = M.astype(np.float64).ravel().copy()
    d = m[0] * m[4] - m[1] * m[3]
    d = 1.0 / d if d else 0.0
    a11, a22 = m[4] * d, m[0] * d
    m[0], m[1], m[3], m[4] = a11, m[1] * -d, m[3] * -d, a22
    b1, b2 = -m[0] * m[2] - m[1] * m[5], -m[3] * m[2] - m[4] * m[5]
    m[2], m[5] = b1, b2
    return m


def _warp_taps(c: np.ndarray, n: int, bicubic: bool):
    """Source taps and weights for sample points c along an axis of n; a tap off the source weighs nothing."""
    i0 = np.floor(c).astype(np.int64)
    f = c - i0
    if bicubic:
        idx, wts = i0[:, None] + np.arange(-1, 3), np.stack(_cubic(f), 1)
    else:
        idx, wts = i0[:, None] + np.arange(2), np.stack([1 - f, f], 1)
    off = (idx < 0) | (idx >= n)
    return np.clip(idx, 0, n - 1), np.where(off, 0.0, wts).astype(np.float32)


def _sample(src, ix: np.ndarray, wx: np.ndarray, iy: np.ndarray, wy: np.ndarray):
    """src (..., Hs, Ws) sampled at separable taps (numpy, sent as they are): along the rows, then down the columns."""
    return _resample(src, send(ix.ravel()), send(wx), send(iy.ravel()), send(wy))


@fused
def _resample(src, ix, wx, iy, wy):
    k = wx.shape[1]
    t = (src.index_select(-1, ix).unflatten(-1, (-1, k)) * wx).sum(-1)
    return (t.index_select(-2, iy).unflatten(-2, (-1, k)) * wy[:, :, None]).sum(-2)


def warp(src, M: np.ndarray, w: int, h: int, bicubic: bool = False, rows: int | None = None):
    """
    cv2.warpAffine(src, M, (w, h), INTER_LINEAR or INTER_CUBIC, borderValue=0)
    on (..., Hs, Ws), for the warps compose makes: scale and move (and mirror),
    never turn, so each axis is sampled on its own. With `rows`, the output
    stops there (zero below), as a warp to (w, rows) would, at the same size.
    """
    m = invert(M)
    if m[1] or m[3]:
        raise ValueError("gpu.warp samples each axis on its own: no rotation")
    ix, wx = _warp_taps(m[0] * np.arange(w) + m[2], src.shape[-1], bicubic)
    iy, wy = _warp_taps(m[4] * np.arange(h) + m[5], src.shape[-2], bicubic)
    if rows is not None:
        wy[rows:] = 0
    return _sample(src, ix, wx, iy, wy)


def remap(src, map_x, map_y):
    """cv2.remap(src, map_x, map_y, INTER_LINEAR, borderValue=0) for src (H, W) and maps (h, w), all tensors."""
    H, W = src.shape
    grid = torch.stack(((2 * map_x + 1) / W - 1, (2 * map_y + 1) / H - 1), -1)
    return F.grid_sample(src[None, None], grid[None], mode="bilinear", padding_mode="zeros", align_corners=False)[0, 0]


# --- the look's drawing rule (edge.py) ---------------------------------------------------------------------------

def gradient(f):
    """np.gradient over the last two axes: central differences inside, one-sided at the edges. (d/dy, d/dx)"""
    def along(axis):
        n = f.shape[axis]
        g = torch.empty_like(f)
        g.narrow(axis, 1, n - 2).copy_((f.narrow(axis, 2, n - 2) - f.narrow(axis, 0, n - 2)) / 2)
        g.narrow(axis, 0, 1).copy_(f.narrow(axis, 1, 1) - f.narrow(axis, 0, 1))
        g.narrow(axis, n - 1, 1).copy_(f.narrow(axis, n - 1, 1) - f.narrow(axis, n - 2, 1))
        return g
    return along(f.dim() - 2), along(f.dim() - 1)


def cut(f, level: float):
    """edge.cut: where a smooth field crosses `level`, a crisp anti-aliased edge."""
    gy, gx = gradient(f)
    return ((f - level) / (torch.sqrt(gx * gx + gy * gy) + 1e-4) + 0.5).clamp_(0, 1)


def melt(f, level: float, soft: float):
    """edge.melt"""
    u = ((f - level + soft) / (2 * soft)).clamp_(0, 1)
    return u * u * (3 - 2 * u)


# --- the frame ---------------------------------------------------------------------------------------------------

class Canvas:
    """
    The frame being drawn, on the GPU: float RGB as (3, H, W). It takes the
    same strokes compose lays on a numpy frame (lay), and gives the frame back
    as the numpy uint8 picture the encoder takes (frame).
    """

    def __init__(self, w: int, h: int, dev):
        self.W, self.H, self.dev = w, h, dev
        self.px = torch.empty((3, h, w), dtype=torch.float32, device=dev)
        self._colours = {}
        self._held = {}

    @property
    def shape(self):
        return self.H, self.W, 3

    def colour(self, c):
        """A palette colour as (3, 1, 1) on the device."""
        c = np.asarray(c, np.float32)
        key = c.tobytes()
        if key not in self._colours:
            self._colours[key] = send(np.broadcast_to(c, (3,)).copy()).view(3, 1, 1)
        return self._colours[key]

    def tensor(self, a):
        """A numpy array on the device (sent without waiting)."""
        return a if not isinstance(a, np.ndarray) else send(np.asarray(a, np.float32))

    def fill(self, colour):
        self.px.copy_(self.colour(colour).expand(3, self.H, self.W))

    def lay(self, cov, x0: int, y0: int, colour, opacity=1.0, keep: bool = False):
        """
        region += (colour - region) * cov * opacity, cov (h, w) laid with its
        corner at (x0, y0), clipped. The patch is padded with nothing to a
        multiple of BUCKET, so the GPU meets a few patch sizes, not a new one
        each frame (each new size costs it a compile).
        """
        h, w = cov.shape
        ax0, ay0, ax1, ay1 = max(0, x0), max(0, y0), min(self.W, x0 + w), min(self.H, y0 + h)
        if ax1 <= ax0 or ay1 <= ay0:
            return
        bh, bw = min(self.H - ay0, -(-(ay1 - ay0) // BUCKET) * BUCKET), min(self.W - ax0, -(-(ax1 - ax0) // BUCKET) * BUCKET)
        key = (id(cov), ax0 - x0, ay0 - y0, bh, bw)
        hit = self._held.get(key) if keep else None
        if hit is not None and hit[0] is cov:
            a = hit[1]
        else:
            pad = np.zeros((bh, bw), np.float32)
            pad[:ay1 - ay0, :ax1 - ax0] = cov[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0]
            a = send(pad)
            if keep:
                self._held[key] = (cov, a)
        view = self.px[:, ay0:ay0 + bh, ax0:ax0 + bw]
        view += (self.colour(colour) - view) * (a * opacity)

    def darken(self, cast, strength: float, dark):
        """A shadow: the rows from y0 darkened toward `dark` (per channel) by cov times strength. cast: (cov, y0) or None."""
        if cast is not None:
            cov, y0 = cast
            band = self.px[:, y0:y0 + cov.shape[0]]
            band.copy_(_darken(band, cov, strength, self.colour(dark)))

    def band(self, x0: int, y0: int, x1: int, y1: int, colour, opacity: float):
        """A flat rectangle laid at one opacity (the HUD's progress line)."""
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(self.W, x1), min(self.H, y1)
        if x1 > x0 and y1 > y0:
            view = self.px[:, y0:y1, x0:x1]
            view += (self.colour(colour) - view) * opacity

    def spot(self, x0: int, y0: int, x1: int, y1: int, highlight, lift: float, dim, pool):
        """floor.spotlight: the stage dims by `dim`; inside the box, `pool` mixes in the light lifted before the dim."""
        lit = None
        if pool is not None:  # the box padded to a bucket with no pool in it, as lay pads
            bh, bw = min(self.H - y0, -(-(y1 - y0) // BUCKET) * BUCKET), min(self.W - x0, -(-(x1 - x0) // BUCKET) * BUCKET)
            m = np.zeros((bh, bw), np.float32)
            m[:y1 - y0, :x1 - x0] = pool
            y1, x1, m = y0 + bh, x0 + bw, send(m)
            before = self.px[:, y0:y1, x0:x1]
            lit = before + (self.colour(highlight) - before) * lift
        self.px *= self.colour(dim)
        if lit is not None:
            view = self.px[:, y0:y1, x0:x1]
            view.copy_(view * (1 - m) + lit * m)

    def frame(self) -> np.ndarray:
        """np.clip(canvas, 0, 255).astype(np.uint8), as (H, W, 3)."""
        return self.send_frame().result()

    def send_frame(self) -> Download:
        """The frame, on its way: the next one can be drawn while it comes down."""
        return Download(_bytes(self.px))


BUCKET = 32  # px: patch sizes on the canvas are rounded up to this


@fused
def _bytes(px):
    return px.clamp(0, 255).to(torch.uint8).permute(1, 2, 0).contiguous()


@fused(sizes="any")
def _darken(px, cov, strength, dark):
    return px * (1 - cov * strength * dark)


def lay(canvas, cov: np.ndarray, x0: int, y0: int, colour, opacity=1.0, keep: bool = False):
    """
    Lay a coverage on either kind of frame: a numpy (H, W, 3) float frame or a
    Canvas. The numpy arithmetic is the drawing every helper always did.
    """
    if not isinstance(canvas, np.ndarray):
        return canvas.lay(cov, x0, y0, colour, opacity, keep)
    H, W = canvas.shape[:2]
    h, w = cov.shape
    ax0, ay0, ax1, ay1 = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if ax1 <= ax0 or ay1 <= ay0:
        return
    a = cov[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0][..., None] * opacity
    view = canvas[ay0:ay1, ax0:ax1]
    view += (colour - view) * a


def band(canvas, x0: int, y0: int, x1: int, y1: int, colour, opacity: float):
    """A flat rectangle laid at one opacity, on either kind of frame."""
    if not isinstance(canvas, np.ndarray):
        return canvas.band(x0, y0, x1, y1, colour, opacity)
    view = canvas[y0:y1, x0:x1]
    view += (colour - view) * opacity
