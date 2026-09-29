"""Build the Odubo Studio logo files from the danceman and Libre Baskerville.

    pip install fonttools
    python3 scripts/brand/build-odubo-lockup.py

Writes, into public/brand-logos/odubo-brand/:
  odubo-lockup.svg   ODUBO in Libre Baskerville Bold over the danceman
  odubo-mark.svg     the danceman alone

Both are outlined (no <text>, so no font needed to view them), baked into one
coordinate space normalised to 1200 on the long side, with the fill on the root
<svg> so the poster engine can recolour them. The numbers below are the adopted
ones (owner, 2026-09-29); change them here and rerun, never by hand in the SVG.
See docs/decisions/odubo-logo.md.
"""
import os
import re

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONT = os.path.join(ROOT, "scripts/brand/fonts/LibreBaskerville[wght].ttf")  # v2.005, OFL
FIGURE = os.path.join(ROOT, "public/brand-logos/odubo-brand/Danceman_Logo_Red.svg")
OUT = os.path.join(ROOT, "public/brand-logos/odubo-brand")

WORD = "ODUBO"
WEIGHT = 700        # Bold: Regular went spindly beside the figure at small sizes
CAP_RATIO = 0.17    # cap height as a share of the figure's height
TRACKING = 0.17     # added between letters, in em, on top of the font's kerning
GAP_CAPS = 0.65     # baseline to the figure's top, in cap heights
LONG_SIDE = 1200
FILL = "#843c2d"    # the house oxblood
# The figure's ink centroid sits 0.6% right of its box centre (measured off a
# raster); centring on it rather than the box keeps him under the word.
FIGURE_CENTROID_X = 0.5063628


def fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def figure_paths():
    svg = open(FIGURE).read()
    # cls-1 is a white hairline sliver the export left under the right foot
    return [d for cls, d in re.findall(r'<path class="(cls-\d)" d="([^"]+)"', svg) if cls != "cls-1"]


def pair_kern(font, a, b):
    """The font's own kern for a pair, from a static instance's GPOS."""
    total = 0
    for lookup in font["GPOS"].table.LookupList.Lookup:
        for sub in lookup.SubTable:
            t = sub.ExtSubTable if lookup.LookupType == 9 else sub
            if getattr(t, "LookupType", lookup.LookupType) != 2 or a not in t.Coverage.glyphs:
                continue
            if t.Format == 1:
                for pv in t.PairSet[t.Coverage.glyphs.index(a)].PairValueRecord:
                    if pv.SecondGlyph == b and pv.Value1:
                        total += getattr(pv.Value1, "XAdvance", 0) or 0
            else:
                c1 = t.ClassDef1.classDefs.get(a, 0)
                c2 = t.ClassDef2.classDefs.get(b, 0)
                v = t.Class1Record[c1].Class2Record[c2].Value1
                total += (getattr(v, "XAdvance", 0) or 0) if v else 0
    return total


def svg_file(w, h, note, paths):
    body = "".join(f'  <path d="{d}"/>\n' for d in paths)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(w)} {fmt(h)}" fill="{FILL}">\n'
        f"  <title>Odubo Studio</title>\n"
        f"  <!-- {note} -->\n{body}</svg>\n"
    )


def build_lockup(fig):
    font = instantiateVariableFont(TTFont(FONT), {"wght": WEIGHT})
    glyphs_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    cap = font["OS/2"].sCapHeight

    bounds = BoundsPen(None)
    for d in fig:
        parse_path(d, bounds)
    fx0, fy0, fx1, fy1 = bounds.bounds  # svg space, y down
    fig_w, fig_h = fx1 - fx0, fy1 - fy0

    # set the word in font units: advance + kern + tracking
    names = [cmap[ord(ch)] for ch in WORD]
    placed, x = [], 0.0
    for i, g in enumerate(names):
        placed.append((g, x))
        if i < len(names) - 1:
            x += glyphs_set[g].width + pair_kern(font, g, names[i + 1]) + TRACKING * upm
    ink = BoundsPen(glyphs_set)
    for g, gx in placed:
        glyphs_set[g].draw(TransformPen(ink, (1, 0, 0, 1, gx, 0)))
    wx0, wy0, wx1, wy1 = ink.bounds  # y up

    s = CAP_RATIO * fig_h / cap
    word_w = (wx1 - wx0) * s
    baseline = wy1 * s  # the O's overshoot touches the top edge
    fig_top = baseline + GAP_CAPS * cap * s
    total_w = max(word_w, fig_w)
    total_h = fig_top + fig_h
    cx = total_w / 2
    k = LONG_SIDE / max(total_w, total_h)

    word = []
    for g, gx in placed:
        pen = SVGPathPen(glyphs_set, ntos=fmt)
        t = (s * k, 0, 0, -s * k, (cx - word_w / 2 + (gx - wx0) * s) * k, baseline * k)
        glyphs_set[g].draw(TransformPen(pen, t))
        word.append(pen.getCommands())

    pen = SVGPathPen(None, ntos=fmt)
    t = (k, 0, 0, k, (cx - (fx0 + fig_w * FIGURE_CENTROID_X)) * k, (fig_top - fy0) * k)
    for d in fig:
        parse_path(d, TransformPen(pen, t))

    note = (
        f"ODUBO lockup, the studio's standard logo (adopted 2026-09-29). Libre Baskerville v2.005 "
        f"Bold (wght {WEIGHT}), outlined, font kerning applied, tracked +{round(TRACKING * 1000)}/1000. "
        f"Cap height = {round(CAP_RATIO * 100)}% of the figure; baseline to figure top = {GAP_CAPS} cap. "
        f"Figure is Danceman_Logo_Red.svg, centred on its ink centroid. Recolour via the root fill. "
        f"Built by scripts/brand/build-odubo-lockup.py."
    )
    return svg_file(total_w * k, total_h * k, note, [" ".join(word), pen.getCommands()])


def build_mark(fig):
    bounds = BoundsPen(None)
    for d in fig:
        parse_path(d, bounds)
    x0, y0, x1, y1 = bounds.bounds
    k = LONG_SIDE / max(x1 - x0, y1 - y0)
    pen = SVGPathPen(None, ntos=fmt)
    for d in fig:
        parse_path(d, TransformPen(pen, (k, 0, 0, k, -x0 * k, -y0 * k)))
    note = (
        "The danceman alone: the house mark, for anywhere the lockup (odubo-lockup.svg) would be "
        "under ~96px tall. Same drawing as Danceman_Logo_Red.svg, minus its white export sliver, "
        "fill on the root so it recolours. Built by scripts/brand/build-odubo-lockup.py."
    )
    return svg_file((x1 - x0) * k, (y1 - y0) * k, note, [pen.getCommands()])


if __name__ == "__main__":
    fig = figure_paths()
    for name, svg in (("odubo-lockup.svg", build_lockup(fig)), ("odubo-mark.svg", build_mark(fig))):
        path = os.path.join(OUT, name)
        open(path, "w").write(svg)
        print(f"→ {os.path.relpath(path, ROOT)} ({len(svg)} bytes)")
