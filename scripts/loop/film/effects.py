"""
What the effects decide, apart from the drawing (compose draws them).

  echo   motion_gate: how far his echoes trail behind him, from how fast his
         hands and feet move. When he is still they sit under him, unseen; on
         a spin, a kick, an arm thrown out, they fan out behind him.
  close  close_bars: in each phrase of eight bars, the one bar where his feet
         move most (if they move at all), for a close-up that cuts in and out
         on the downbeats.
  hits   on_snare: whether the field is on its sister colour at a moment. It
         cuts to it on the snare and back on the kick (hits.py hears them).
  claps  jump_claps and echo_lags: the trail cusps on a clap over his head.
         It shortens as his hands come together, is gone on the clap, and
         grows back out of the clap, never reaching back past it (the
         owner, 2026-10-03: "trail to the clap and from the clap but not at
         the clap").

The sidewalk lives in floor.py. All are read from the pose and the drums,
never chosen at random: run twice, a cut is the same cut.
"""
import numpy as np
from scipy.ndimage import gaussian_filter1d

ECHO_LAGS = (12, 8, 4)          # frames behind him at full trail, the oldest first
ECHO_MIX = (1.0, 0.6, 0.2)      # each echo's colour, from the palette's mid toward its shadow: the oldest nearest the field
GATE = (0.035, 0.06)            # hand and foot speed, a share of his height per frame: echoes begin (his 80th
                                # percentile on the Billie Jean take), and are full (about his 96th)
GATE_S = 0.1                    # the gate eases over about twice this, in seconds
LIMBS = (15, 16, 27, 28)        # wrists and ankles
ANKLES = (27, 28)
CLAP_NEAR = 0.15                # wrists this close (a share of his height): his hands are together
CLAP_ABOVE = 0.1                # both hands at least this far above his nose: the clap is over his head
CLAP_SNAP = 0.12                # seconds: a clap counts only this close to a snare (Billie Jean's clap is on it)
CLOSE_ZOOM = 2.5                # the close-up, against the clip's scale
CLOSE_GROUND = 0.75             # where the floor sits in a close-up, a share of the height
PHRASE = 8                      # bars to a phrase: one close-up in each
FOOTWORK = 0.004                # a phrase whose busiest bar moves his feet less than this (a share of his
                                # height per frame) gets no close-up: there is nothing to see


def track(poses: dict, k0: int, k1: int, idx, w: int, h: int) -> np.ndarray:
    """(frames, len(idx), 2) take pixels for the points idx over frames k0..k1, gaps filled, a little smoothed."""
    n = k1 - k0
    pts = np.full((n, len(idx), 2), np.nan, np.float32)
    for i in range(n):
        lm = poses.get(k0 + i)
        if lm is not None:
            pts[i] = lm[list(idx), :2] * np.array([w, h], np.float32)
    flat = pts.reshape(n, -1)
    for c in range(flat.shape[1]):
        ok = ~np.isnan(flat[:, c])
        if ok.sum() >= 2:
            flat[~ok, c] = np.interp(np.where(~ok)[0], np.where(ok)[0], flat[ok, c])
        else:
            flat[:, c] = 0
    return gaussian_filter1d(flat, 1.0, axis=0).reshape(n, len(idx), 2)


def limb_speed(poses: dict, k0: int, k1: int, idx, w: int, h: int, body: float) -> np.ndarray:
    """Per frame, the fastest of the points idx, as a share of his height per frame."""
    pts = track(poses, k0, k1, idx, w, h)
    v = np.linalg.norm(np.diff(pts, axis=0, prepend=pts[:1]), axis=2).max(1)
    return v / max(1.0, body)


def motion_gate(poses: dict, k0: int, k1: int, w: int, h: int, body: float, fps: float) -> np.ndarray:
    """Per frame 0..1: how far the echoes trail. 0 when he is still, 1 on his biggest moves."""
    v = limb_speed(poses, k0, k1, LIMBS, w, h, body)
    u = np.clip((v - GATE[0]) / (GATE[1] - GATE[0]), 0, 1)
    u = u * u * (3 - 2 * u)
    return np.clip(gaussian_filter1d(u, GATE_S * fps), 0, 1)


def close_bars(poses: dict, k0: int, w: int, h: int, fps: float, body: float,
               downbeat: float, bar: float, t_from: float, t_to: float, win0: float, picks=None) -> list:
    """
    [(start, end, focus_x)] in take seconds and take pixels: the bars to show
    close. `downbeat` is a bar line in take seconds; bars are counted from it
    in phrases of PHRASE. A bar is a candidate when it lies wholly inside
    t_from..t_to and is not the first bar of the piece. `picks` (take
    seconds) chooses bars by hand, each snapped to the bar it falls in.
    """
    n0 = int(np.ceil((t_from - downbeat) / bar - 1e-6))
    starts = [downbeat + n * bar for n in range(n0, n0 + 10_000) if downbeat + (n + 1) * bar <= t_to]
    starts = [s for s in starts if s > t_from + 0.5 * bar]
    if not starts:
        return []
    k1 = int(round((max(starts) + bar - win0) * fps)) + 2
    feet = track(poses, k0, k1, ANKLES, w, h)
    speed = limb_speed(poses, k0, k1, ANKLES, w, h, body)

    def frames(s):
        a = int(round((s - win0) * fps)) - k0
        return max(0, a), max(0, a + int(round(bar * fps)))

    if picks:
        chosen = sorted({s for s in starts for p in picks if s <= p < s + bar})
    else:
        by_phrase = {}
        for s in starts:
            a, b = frames(s)
            score = float(speed[a:b].mean()) if b > a else 0.0
            phrase = int(np.floor((s - downbeat) / bar + 1e-6)) // PHRASE
            if phrase not in by_phrase or score > by_phrase[phrase][1]:
                by_phrase[phrase] = (s, score)
        chosen = sorted(s for s, score in by_phrase.values() if score >= FOOTWORK)
    out = []
    for s in chosen:
        a, b = frames(s)
        out.append((float(s), float(s + bar), float(feet[a:b, :, 0].mean())))
    return out


def on_snare(t: float, kicks: np.ndarray, snares: np.ndarray) -> bool:
    """True when the latest hit at or before t is a snare."""
    i = np.searchsorted(kicks, t, side="right") - 1
    j = np.searchsorted(snares, t, side="right") - 1
    if j < 0:
        return False
    return i < 0 or snares[j] > kicks[i]


def close_spans(poses: dict, k0: int, w: int, h: int, fps: float, spans, win0: float) -> list:
    """[(start, end, focus_x)] for spans chosen by a show file (take seconds): framed on his feet over the span."""
    out = []
    for start, end in spans:
        a = max(0, int(round((start - win0) * fps)) - k0)
        b = max(a + 1, int(round((end - win0) * fps)) - k0)
        feet = track(poses, k0, k0 + b, ANKLES, w, h)[a:b]
        out.append((float(start), float(end), float(feet[:, :, 0].mean()) if len(feet) else w / 2))
    return out


def jump_claps(poses: dict, k0: int, k1: int, w: int, h: int, body: float, fps: float, win0: float,
               snares=None) -> np.ndarray:
    """
    Take frames where he claps over his head: his wrists meet (a local least
    distance under CLAP_NEAR) with both hands above his nose. With the song's
    snares (take seconds), only a clap within CLAP_SNAP of a snare counts (the
    song's own clap), but it stays where his hands meet: the cusp is for the
    eye, and on Billie Jean he lands the jump clap two frames ahead of the beat.
    """
    from scipy.signal import find_peaks
    pts = track(poses, k0, k1, (15, 16, 0), w, h)
    dist = np.linalg.norm(pts[:, 0] - pts[:, 1], axis=1) / max(1.0, body)
    above = (pts[:, 2, 1] - pts[:, :2, 1].max(1)) / max(1.0, body)
    near, _ = find_peaks(-dist, distance=max(1, int(0.25 * fps)))
    out = []
    for i in near:
        if dist[i] >= CLAP_NEAR or above[i] <= CLAP_ABOVE:
            continue
        t = win0 + (k0 + i) / fps
        if snares is not None and len(snares):
            if np.abs(snares - t).min() > CLAP_SNAP:
                continue
        out.append(k0 + int(i))
    return np.array(sorted(set(out)), int)


def echo_lags(gate: float, k: int, claps: np.ndarray, fps: float) -> list:
    """
    How many frames back each echo reaches at take frame k (ECHO_LAGS order),
    cusping on the claps: near one, no echo reaches further back than the
    frames between him and the clap. So the trail shortens as his hands come
    together, is gone on the clap, and grows back out of it, never reaching
    back past it: a V in time, the same on both sides.
    """
    to_clap = None
    if len(claps):
        j = int(np.searchsorted(claps, k))
        near = [abs(int(claps[i]) - k) for i in (j - 1, j) if 0 <= i < len(claps)]
        to_clap = min(near) if near else None
    lags = []
    for back in ECHO_LAGS:
        lag = int(round(gate * back))
        if to_clap is not None and to_clap < back:
            lag = min(lag, to_clap)
        lags.append(lag)
    return lags
