# 2026-09-13 — the dancer's detail, the music in sync, a 30s cut

**Asked:** the subject's quality in the new colourway is not what it was in the
green version; add the music; give me the most visually striking 30-60s for
Reels.

**Shipped:** three 30.6s cuts — `loop`, `energetic`, `calm` — each with a
silent twin, in
`Loop-soul-the-entertainment-room/social-2026-09/living-poster/`. Reasoning in
[loop-video-converter.md](../decisions/loop-video-converter.md) (the `regrade`
mode) and [loop-living-poster.md](../decisions/loop-living-poster.md) (the
music and the bar snapping).

---

## The three findings that shaped the work

**1. The pipeline was reading an upscale.** `Mani-Billie-Jean.mp4` at 2160×3840
is a 2× upscale of a 1080p render — round-trip PSNR 61.4 dB proves there is
nothing above 1080 Nyquist — and it carries **31% less line-art** than the
native `loopsoul-full-hq.mp4`. A third of the dancer's detail was gone before
the converter saw the file.

**2. `recolor` was painting the dancer's detail the background colour.** The
green look draws interior detail as green Sobel line-art, and the old key
`g > 60` classifies the strongest 45% of it as field. Measured: the figure came
out **94.6% flat INK** with **9,441 holes**. And even keyed correctly the
contrast would have died, because in the green look the detail is carried by
**hue**, not brightness.

**3. The audio is not a room recording.** Loudness splits the assets cleanly:
room mic at −35.2 LUFS, and a clean studio Billie Jean dubbed on at −11 LUFS.
The only file with both a logo-free picture and clean music has a dub that
drifts against its own frames — the owner's report. `mani-billie-jean-4.mov` is
in sync but has the marks burned in. So picture and sound had to come from
different files.

## What was built

- **`regrade` mode** in `scripts/loop/video-convert.mjs` — hysteresis field
  detection, levels measured once across the whole clip, native-resolution
  analysis, ink rim, and an interior that can never take the field colour.
  `recolor`, `scene` and `flat` untouched.
- **`scripts/loop/align-takes.mjs`** — measures the offset between two renders
  of the same performance by correlating silhouette signatures, and reports
  whether the two run at the same *rate* as well as the same position.
  Result: **−15.900s, confidence 107.65×, no drift**.
- **`scripts/loop/check-sync.mjs`** — verifies a *finished* file's music was
  lifted from the position it claims. (Its first design did not work; see the
  owner-review section below.)
- **Bar snapping and music** in `living-poster.ts` — tempo from the audio
  (117.65 BPM detected on Billie Jean), only bar lines as candidate starts,
  prefix-summed energy, two-pass loudnorm, and two deliverables from one encode.

## Verified

| | |
|---|---|
| non-INK share of figure | 5.08% → **12.31%** (measured on the `bright` ladder) |
| figure px painted the field colour | 8,702 → **762** (boundary, not holes) |
| field colour | SAND_BRIGHT (wrong) → **SAND 99.95%** |
| `scene` / `flat` output | **byte-identical** before and after |
| loudness | **−14.1 LUFS** against a −14 target |
| bar multiple | 30.600 / 2.040 = **15.0000** exactly |
| music trimmed where it claims | **5ms** on all three, at 16-18σ |
| picture-to-sound offset | **-15.900s, spread 0ms** across four windows |
| QR out of a finished frame | decodes, destination returns 200 |
| tests / lint / print kit | 95 pass · clean · renders |

## What went wrong on the way

1. **Judged the interior tone by contrast against the reference, and got it
   backwards.** Capping at SAND_DEEP looked "too quiet" beside the green, so it
   went to SAND_BRIGHT — but quiet is what the record is. Reverted on owner
   review and made a named option; see below. The lesson is that matching a
   measurement is not the same as matching an intent.
2. **A field-colour trap nearly shipped with the source switch.** Native green
   resolves to `SAND_BRIGHT`, not `SAND`, so the plate would have sat on the
   sheet as a visibly brighter rectangle. It had never shown up because the old
   upscaled source's softened green fell just under the threshold.
3. **`-v error` suppressed the loudnorm measurement**, so the two-pass silently
   became one pass. It prints at info level.
4. **The 1/6s probe grid would have desynced the audio by up to 83ms.** Window
   scoring is on that grid, so the exact bar time is snapped back after
   selection.
5. Planning predicted the longer cut would make the dancer *bigger* (~84%). It
   did not — the 30s envelope is no tighter than the 15s one, so he is the same
   63%.

## Second pass, same day — owner review

Three notes back, all acted on:

1. **"The highlights are too bright, it's meant to be chill."** Correct. The
   first ladder used SAND_BRIGHT for strong line-art, chosen because capping at
   SAND_DEEP had read too quiet against the green reference — but "quiet" was
   the point. Now `--gradeTone`, defaulting to `chill`
   (INK · INK_SOFT · SAND_DEEP), with `warm` and `bright` available.
2. **"The space above and below seems large — is that good for Reels?"** Half
   right, and the half that was right mattered. The bottom 300px is reserved
   for Instagram's caption and has to stay. The top 250px was inherited from
   the STORY layout, where the profile row makes the top heavy too, and is far
   more than a reel needs — cut to 170px. Hero band 776px → 856px, dancer
   63% → 70%.
3. **"Do two other sections for comparing energy."** `--pick=loop|energetic|calm`.

### And a check that had to be thrown away

`check-sync.mjs` originally correlated the music's onsets against the dancer's
movement. It reported 10ms drift on the first cut and looked authoritative.
When the other two sections came back at 130ms and 770ms, the tool — not the
render — turned out to be wrong: the correlation is about 0.03, i.e. noise, and
a dancer does not move in step with onsets anyway.

Chasing it down produced a real improvement. `align-takes.mjs` now measures the
offset at five points down the take instead of one, because its original drift
test resolved to 1/6s and could have hidden ±83ms of creeping rate difference.
Result: **-15.900s at every trusted window, spread 0ms**, confidences to 119×.
And `check-sync.mjs` was rewritten to verify the half that can actually break —
whether the render trimmed the music where it claims — by correlating the
finished audio against the reference. All three cuts: **5ms, at 16-18σ**. It
now refuses to give a verdict below 6σ rather than reporting noise.

## Next

- **Re-run `npm run loop:posters`.** Still outstanding from yesterday:
  `print-2026-09-v2/` says SEPTEMBER 26, the code says OCTOBER 10.
- If more subject detail is ever wanted, the two fallbacks are recorded in the
  converter doc: re-render from the raw via the Python matting pipeline (its
  torch/MPS environment still works), or use the green render as a matte over
  the raw as a tone source — now cheap, since the two share a timeline and a
  frame count exactly.
