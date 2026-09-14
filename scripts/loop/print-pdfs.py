#!/usr/bin/env python3
"""Turn the print kit's PNGs into PDFs a print shop will accept.

    python3 scripts/loop/print-pdfs.py --in=print-2026-09-v3 [--out=DIR]

Print shops ask for PDF, and the reason is not the file extension: a PDF
carries the PAGE SIZE IN INCHES, so the press knows how big the thing is
without anyone typing a number. A PNG carries pixels and a hopeful DPI tag that
half the software in the chain ignores, which is how a poster comes back at the
wrong size.

So the whole job here is to set the page geometry honestly:

  poster  2626 x 3526 px  /  300 dpi  =  8.753 x 11.753 in
  flyer   1876 x 2776 px  /  300 dpi  =  6.253 x  9.253 in

Those are trim + 1/8in bleed + 1/4in crop-mark margin, per PRINT_BLEED in
src/lib/loop/poster/layout.ts. The artwork already prints its own spec line in
that margin ("TRIM 8 x 11 IN . BLEED 1/8 IN . 300 DPI"), so the file tells the
shop what to do with it and the margin is trimmed away.

Two things it does deliberately:

**Flattens the alpha onto white.** The kit's PNGs are RGBA. An alpha channel in
a print PDF is a coin flip — some RIPs composite it on white, some on black,
some drop it. The margin is white anyway, so flattening changes nothing visible
and removes the question.

**Leaves the colour in RGB.** Converting to CMYK without the press's own ICC
profile is worse than not converting: the sand (#d9aa7a) and ink (#2a0f0a) would
shift, and the shop's RIP does a better job with the real profile than a guess
does here. Digital presses take RGB. If this shop asks for CMYK, get their
profile and convert to that rather than to a generic one.
"""
import argparse
import pathlib
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("needs Pillow:  python3 -m pip install Pillow")

DPI = 300


def to_pdf(png: pathlib.Path, out: pathlib.Path) -> tuple[float, float, int]:
    im = Image.open(png)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        flat = Image.new("RGB", im.size, "white")
        flat.paste(im, mask=im.split()[-1])
        im = flat
    elif im.mode != "RGB":
        im = im.convert("RGB")

    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "PDF", resolution=DPI, title=png.stem)
    w_in = im.size[0] / DPI
    h_in = im.size[1] / DPI
    return w_in, h_in, out.stat().st_size


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", required=True)
    ap.add_argument("--out", dest="dst", default=None)
    # Default to the bleed files: they are the ones with the trim marks and the
    # spec line, i.e. the ones meant to leave the building.
    ap.add_argument("--all", action="store_true", help="also convert the trim-only files")
    a = ap.parse_args()

    src = pathlib.Path(a.src).expanduser().resolve()
    dst = pathlib.Path(a.dst).expanduser().resolve() if a.dst else src / "pdf"

    wanted = []
    for p in sorted(src.glob("*.png")):
        is_bleed = p.stem.endswith("-bleed")
        is_sheet = "300dpi" in p.stem or "ticket" in p.stem
        if not is_sheet:
            continue  # feed/story/pass are screen pieces, not press pieces
        if is_bleed or a.all:
            wanted.append(p)

    if not wanted:
        sys.exit(f"no press-ready PNGs found in {src}")

    print(f"{src}\n")
    for p in wanted:
        w, h, size = to_pdf(p, dst / f"{p.stem}.pdf")
        print(f"  {p.stem + '.pdf':<56} {w:.3f} x {h:.3f} in   {size/1e6:.1f} MB")
    print(f"\nout: {dst}")


if __name__ == "__main__":
    main()
