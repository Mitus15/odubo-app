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
| `recolor` | Clips already rendered in the OLD GREEN look — remaps green→sand, figure→ink so existing videos move to the new brand without re-shooting. |

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
the old green filter**, not raw footage — use `--mode=recolor` on those. The
only original plate is `digital-hub/loopsoulca/video-converter/IMG_0191.MOV`.
