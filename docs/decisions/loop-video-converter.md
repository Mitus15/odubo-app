# The Loop Soul video converter

`scripts/loop/video-convert.mjs` — turns ordinary footage into the house look
(ink figure, sand field) for social, for the Wall, and eventually for event
recordings. Built 2026-08-11, replacing the old Python converter in
`Loop-soul-the-entertainment-room/digital-hub/loopsoulca/video-converter/`.

```bash
node scripts/loop/video-convert.mjs --in=clip.mov --scale=2 --crf=12
```

Run it from `/Users/maniodubo/Documents/Apps/odubo` (node_modules live there,
not in the worktree). System `ffmpeg`/`ffprobe` at `/opt/homebrew/bin` — the
`ffmpeg-static` package's binary was never downloaded and does not exist.

---

## What makes it different from the in-app filter

The camera filter in the app isolates the person and throws the room away.
This keeps the room — wall, floor, baseboard, furniture — as flat graphic
shapes, with the dancer as the most pronounced thing in frame. That was the
brief: *"we don't have to only isolate the individual… if there are things like
tables and backgrounds we can still have them in the filter as specific
background things, but still minimize anything that's just negative space."*

## Modes

| Mode | Use |
|---|---|
| `scene` (default) | Locked-off camera. Two passes: background plate, then render. |
| `flat` | Handheld footage, where no plate is possible. Boilier but works. |
| `recolor` | Clips already rendered in the OLD GREEN look — remaps green→sand, figure→ink so existing videos move to the new brand without re-shooting. **Superseded by `regrade`**; kept only so anything already rendered from it still reproduces. |
| `regrade` | The detail-preserving successor to `recolor`. Same input, but the dancer keeps his line-art instead of flattening to a blob. See below. |

## Why two passes

Quantizing each frame independently makes the background boil (every frame
lands its edges a pixel differently), and a single frame gives no way to tell a
dancer from his own cast shadow. So pass 1 watches the whole clip and builds a
**background plate** — what the room looks like with the dancer statistically
removed — quantized ONCE into shapes identical in every output frame. Pass 2
compares each frame to the plate, so the subject falls out as "what changed".

`--plateCache=path` stores the analysed plate so the look can be re-tuned in
seconds instead of re-watching the clip. The cache is tied to the analysis
resolution; changing `--workHeight` rebuilds it automatically.

## Why the output is sharper than the source

Every edge is a threshold crossing of a smooth field, not a copy of source
pixels. Fields are analysed at reduced resolution (where noise and compression
mush average away), then upsampled and thresholded at OUTPUT resolution, so the
crossing lands on a subpixel boundary. `--scale=2` on 1080p therefore gives
genuinely sharp 4K lines rather than a blurry upscale. **Low-quality footage
benefits most**: the analysis res is where the noise dies, the render res is
where the lines are born.

---

## Why `regrade` replaced `recolor` (2026-09-13)

The owner's report: *"the quality of the subject in the new color is not the
same as that in the green version."* It was not a matter of taste. Measured
inside the true figure, `recolor` painted the dancer **94.6% flat INK** and
punched **9,441 of his best pixels out in the field colour**.

Two independent failures, and the arithmetic of both is worth keeping because
neither is visible by reading the code casually.

**1. The line-art was being keyed as background.** The green renders come from
`convert_fast.py`, which draws interior detail as green Sobel line-art on a
near-black body:

```python
INK = 5/255 · ELECTRIC_BRIGHT = [43,255,143] · edge defaults to 0.4
subject = ink + (bright - ink) * (line * edge)
```

So a full-strength line-art pixel is RGB ≈ **(20, 105, 60)**. The old green key
was `g > 60 && g > r*1.25 && g > b*1.25`; the ratio tests pass for anything
above `line·edge > 0.017`, so `g > 60` alone decides, and it trips at
`line·edge > 0.22` — **the strongest 45% of the line-art is called background**.

**2. The contrast had nowhere to go anyway.** Luma of (20,105,60) is 0.328
against a body at 0.020, which under the old fixed thresholds is `INK_SOFT`
`[61,26,18]` on `INK` `[42,15,10]` — two nearly identical browns. In the green
look the detail is carried by **hue**, not brightness, and a monochrome sand
ramp cannot hold it. No threshold-nudge fixes this; only levelling does.

### What `regrade` does differently

- **Field by hysteresis from unambiguously-green seeds** (`--fieldSeed`, 150),
  not per-pixel greenness. The two populations are cleanly bimodal — line-art
  tops out at g=111, the field sits at 224-231 — and 150 is the middle of the
  empty valley. A border flood fill was the other candidate and is worse: it
  keeps the enclosed pockets between an arm and the torso, which are field.
  Line-art is never reached by the grow because `convert_fast.py --erode 6`
  leaves a ≥6px pure-ink band inside the silhouette edge.
- **Levels measured ONCE across the whole clip**, following the background
  plate's precedent. Scene mode's min/max auto-level fails here: this figure is
  a spike at black plus a sparse tail, measured lo=0.000 / hi=0.5716, which puts
  the first cut above the figure's own 99th percentile and renders him 98.8%
  ink. Per-frame percentiles adapt but boil — the first cut swings 0.030-0.098
  across 120 frames, so a pixel of constant brightness changes colour when the
  pose changes. The cuts are fractions of the measured p99 (`--gradeLow` 0.20,
  `--gradeHigh` 0.77) so a source rendered at a different `--edge` still grades
  right.
- **Analysis at the source's own height**, not `workHeight=720`. The header's
  case for analysing small is that noise and compression mush average away
  there — but a synthetic flat render has no noise, only line-art to lose.
- **The interior can never take the field colour.** The body is INK, weak lines
  SAND_DEEP, strong lines SAND_BRIGHT. SAND is reserved for the field.

**How loud the interior gets is a named choice, `--gradeTone`.** The green look
carries its detail in HUE — mid-green lines on black — and hue is exactly what
a sand/ink ramp cannot reproduce, so the ladder has to pick a brightness to
stand in for it. There is no single right answer:

| `--gradeTone` | ladder | |
|---|---|---|
| `chill` (default) | INK · INK_SOFT · SAND_DEEP | matches the green's own weight |
| `warm` | INK · SAND_DEEP · SAND_DEEP | one tone, more of it |
| `bright` | INK · SAND_DEEP · SAND_BRIGHT | reads at a glance, but hot |

`bright` shipped first and was wrong: the owner's note was that the highlights
are too bright and the record is meant to be chill. Set against the green
reference at the same frame, `chill` is the match.

Whatever the ladder, **SAND is never in it**. The field is painted SAND
unconditionally, so the one colour a figure pixel must never take is excluded
by construction — which is what makes a hole impossible rather than merely
unlikely, and is also why SAND_BRIGHT is available to the figure at all.

### The field-colour trap

`regrade` paints the field `SAND` unconditionally, and that is load-bearing.
Native green measures luma **0.658**, which under `recolor`'s rules resolves to
`SAND_BRIGHT #f0d3ad` — while the poster sheet is `SAND #d9aa7a` and the plate
sits on it at ~63% scale. It would read as a visibly brighter rectangle.

This never shipped, but only by luck: the file the pipeline used until now was
an upscale whose softened green fell just under the 0.62 cut. Switching to the
native source would have exposed it.

### Measured, before and after

Same frame, ground-truth figure taken from the green source by the same
hysteresis:

| | `recolor` | `regrade` |
|---|---|---|
| non-INK share of figure | 5.08% | **12.31%** |
| figure px painted the field colour | 8,702 (4.42%) | **762 (0.39%)** |
| field colour | SAND_BRIGHT 99.24% (wrong) | **SAND 99.95%** |
| temporal flip rate | 2.345% | 2.575% |

The residual 762 are boundary disagreement between two masks over a ~3,000px
perimeter, not holes. The flip rate rises 0.23pp — the detail is not being
bought with boil.

**Cost**: ~12 fps at 1080p, against `recolor`'s ~11 fps with its decode-at-4K.
No regression, despite doing far more work. A 30s cut at 30fps is ~75s, plus a
one-off levels pass that `--gradeCache` stores and `--gradeCut1/2` skips.

**`scene` and `flat` are byte-identical** after this change — verified by
hashing 60 raw rgb24 frames of each, before and after.

## Tuning findings — read this before changing defaults

Everything below was measured on `IMG_0191.MOV` (the original unfiltered plate
of the Billie Jean take: 1920×1080, 30fps, 5 min, locked off). Each was a real
failure that took a diagnostic to find, so the reasoning is recorded rather
than just the number.

**1. The plate needs a lot of samples, a bright bias, AND a second pass.**
A dancer works a small patch of floor, so at the centre of frame he is present
in a large share of any sample set. Too few samples and the median there is
*him* — a ghost of his torso hangs on the wall, and every later frame then
reports the real wall as "changed". Fixed with 150 samples in one decode pass
(cheaper than 150 seeks), a bright-biased percentile (0.9 — the whole look
presumes a dark figure on a light field), and a refinement pass that uses the
rough plate to discard the samples that had him in them and re-medians the
rest. Where nothing agrees with the seed, fall back to the plain median —
that's the bright-shoe-over-dark-floor case, where the seed was the outlier.

**2. Background flattening had to come DOWN, not up.**
Early on the wall showed a soft smudge, and the obvious fix — a big minimum
shape size — worked but also ate the ceiling speaker, which is exactly the kind
of real object that should survive as a graphic shape. The smudge was never a
quantization problem; it was the dirty plate. With the plate fixed, the wall
quantizes flat on its own and `bgMinRegion` only has to sweep up crumbs.

**3. The figure and the background need different minimum shape sizes.**
`minRegion` at 0.0006 silently deleted every internal cut — the shoes, the
collar, the stripes — leaving a solid blob, because those cuts are genuinely
tiny shapes. The background gets `bgMinRegion`; the figure gets a threshold
roughly ten times smaller.

**4. The ink rim must be measured in PIXELS, not as a mask level.**
Bright things on the figure get cut to sand, and a cut reaching the outline
opens straight into the sand field — the foot vanishes. A rim of solid ink
fixes it, but defining the rim as a level on the smoothed mask erodes by an
amount that scales with feature size: it barely touches a torso and swallows a
shoe whole. Blur the hard silhouette and threshold instead.

**5. The shadow test is the sharpest tool in the box and nearly ruined it.**
The one that cost the most time. Loosening `shadowChroma` to 0.09 to kill a
wall ghost also **deleted both shoes** — legs that stopped dead at the ankle.
Measured on this footage:

| | luminance ratio | colour shift |
|---|---|---|
| real cast shadow | 0.908–0.923 (very uniform) | 0.004 |
| his shoes | 0.36–1.09 (wide) | 0.017 |

Only a factor of four apart on colour. A shadow *dims* the room; it does not
*recolour* it — so the tolerance must stay tight (0.012). Note the real
discriminator is uniformity, which a per-pixel test cannot see; if this ever
needs to be more robust, that's the direction.

**6. Thin structures are reflections, not people.**
A polished floor reflects the dancer, and a shadow leaks wherever its colour
wanders. Both pool around the feet as thin horizontal streaks, and neither is
separable by colour or brightness — but a shoe is solid and a reflection is a
smear. A morphological open sized narrower than a limb and wider than a
reflection removes them outright.

**7. Hysteresis is in, but nearly off by default.**
Confident pixels seed the mask; faint pixels join only where they connect back
to something certain. It was built for the shoes, and turned out to be the
wrong fix for them — with the shadow test corrected they clear the confident
threshold on their own. Left in at `subjectFloor` 0.3 because bare floor noise
reaches a quarter of the faint threshold, so pushing it lower floods the floor.

---

## Known limits

- **Locked-off camera only** for `scene` mode. Handheld needs `flat`, which
  boils. A future version could stabilise against the plate.
- **A small pool of reflection survives under the feet.** It reads as ground
  shadow and looks intentional, so it was left.
- **No face pass yet.** The app filter has one (top 30% of the silhouette bbox,
  own quantiles); this doesn't, so faces are flatter here than in the app.
  Worth porting when the converter is used on close-up footage.
- Runs at roughly 3 fps at 4K, 12 fps at 1080p. A 5-minute clip at 4K is about
  an hour; use `--preview` while tuning.

## Source footage note

`media/social-media/mani-billie-jean*.mov` and
`media/working-files/Mani-Billie-Jean.mp4` are all **already-rendered outputs of
the old green filter**, not raw footage — use `--mode=regrade` on those.

**Prefer `digital-hub/loopsoulca/video-converter/loopsoul-full-hq.mp4`** over
any of them. It is green, logo-free, 1080×1920 @30fps, and per `hq-render.log`
the direct native output of the matting renderer; everything else is a
re-encode of a re-encode. Measured 2026-09-13:

- `Mani-Billie-Jean.mp4` at 2160×3840 is **a 2× upscale, not a 4K render**. A
  round-trip through 1080 and back returns 61.4 dB — a residual under ¼ LSB,
  i.e. nothing above 1080 Nyquist — where a genuine 1080 render loses 14 dB
  under the equivalent test.
- At matched 1080×1920 inside the figure it carries **31% less line-art** than
  the native render (mean abs Laplacian 0.01627 against 0.02375).

The only original unfiltered plate is
`digital-hub/loopsoulca/video-converter/IMG_0191.MOV` — and note it is stored
1920×1080 with **`rotation=-90`**, so it is portrait footage that displays as
1080×1920. It has the same 9,063 frames as `loopsoul-full-hq.mp4`, which is
what makes "green as matte, raw as tone" a cheap future option.
