# The living poster

`scripts/loop/living-poster.ts` — the Loop Soul poster with the dance take
playing inside it, cut to a seamless loop for Reels.

```bash
npm run loop:living-poster -- \
  --in=loopsoul-full-hq.mp4 \
  --music=mani-billie-jean-4.mov --musicOffset=-15.900 \
  --seconds=30
```

It is one piece of artwork, not a video with a logo dropped on it. The
furniture comes from the same layout engine that prints the flyer, so the reel
and the sheet on the wall carry the same date, the same marks and the same air.

---

## Why it replaced the green cuts

The versions in circulation (`media/social-media/mani-billie-jean-*.mov`, and
the sand recolour derived from them) were stale in four ways at once, and no
amount of re-grading fixes three of them:

| stale | now |
|---|---|
| Green field | Sand `#d9aa7a` / ink `#2a0f0a`, the house palette |
| Old Scott's mark | The venue's 2026 mark, supplied 2026-09-09 |
| No date, no venue, no code | All three, from the same source the print kit reads |
| Logos **baked into the footage** | Furniture composited from the engine, re-renderable |

That last row is the one that mattered. Because the marks were burned into the
render, every brand change meant re-rendering five minutes of 4K. The plate and
the furniture are separate files now, and the furniture is 67 KB.

**The plate source is
`digital-hub/loopsoulca/video-converter/loopsoul-full-hq.mp4`** — green, no
logos, 1080x1920 @30fps, and per `hq-render.log` the direct native output of
the matting renderer.

It replaced `media/working-files/Mani-Billie-Jean.mp4` on 2026-09-13, on
measurement. That file is **a 2x upscale, not a 4K render**: a resolution
round-trip (2160 -> 1080 -> 2160) returns 61.4 dB, a residual under a quarter
of a least-significant bit, where a genuine 1080 render under the equivalent
test loses 14 dB. It is also a lossy generation - at matched 1080x1920 inside
the figure it carries **31% less line-art** (mean abs Laplacian 0.01627 against
0.02375). The pipeline was throwing away a third of the dancer's detail before
the converter ever saw it.

Everything in `media/social-media/` has the old marks burned in and cannot be a
plate - but see the audio section: one of those files is the sync reference.

## Why it is not the event poster with a hole in it

That was the first build, and it failed on arithmetic. `layoutEventPoster`
budgets a full type block — slogan, triad, date, venue, dress code, price, two
captioned marks — which on a 1080×1920 sheet leaves the hero **27%** of the
frame. A dancer shot full body occupies **48%**. Running one through the other
put "AN ALBUM BY MANI ODUBO" across his head and "Come Dance" across his shins.

So `layoutLivingPoster` is its own layout carrying only what a scrolling
stranger can act on: **the mark · the code · the date · the venue · who is
behind it**. Dropped on purpose — the triad (decoration at 17px), the dress code
and price (unreadable at this size, and not the reason to stop scrolling), and
the "PRESENTED BY" captions (smaller than the mark they label). All of it is
still said on the sheet at the venue and behind the code.

That buys the hero **41%** of the frame instead of 27%.

## Why the story carries a QR when the story format drops it

`layoutEventPoster` omits the code at story size on the reasoning that a story
is scrolled past inside the app, where a link sticker does the job better. A
reel breaks that reasoning: it is reshared, downloaded, screen recorded and
replayed on a screen at the venue, and no sticker travels with it. `showQr`
forces it on, and asking for the code reverts the header to the print treatment
— wordmark left, code right — because a centred wordmark leaves the code
nowhere to go but on top of it.

## The three measurements

Everything that makes this piece work is measured rather than guessed.

**1. The palette needed no seam.** The converter's `SAND`/`INK` and the brand's
are the same two values, so the video's field *is* the poster's sheet. The
furniture renders onto transparency and composites straight on.

**2. The dancer is fitted to the band, not hoped into it.** `figureBand()`
decodes the plate small and grey, thresholds to a silhouette, and takes the
**absolute** vertical extent across every frame — not a percentile, because a
percentile clips the one frame where he throws an arm up and that is the frame
people screenshot. The take spans 11%→74% over the 30s cut; the band is 41% of the frame; so the
video is scaled to 63% and padded with sand, which is invisible because the pad
colour is the field colour. Scaling *up* is refused — it would crop him.

**3. His feet are the anchor, not his middle.** The floor is the stable edge of
the envelope — it moves by a shoe — while the top is set by that one raised arm.
Centring the envelope in the band therefore parks him an arm's length above the
type on every frame but one, and he reads as floating. Standing him on the band
puts the slack overhead, where the masthead already is.

## Choosing the cut

A living poster loops whether the viewer means it to or not, so `bestWindow()`
scores every candidate on two things:

- **match** — how closely the frame *after* the window resembles the first one.
  That is the frame the loop actually replaces, so that is what is compared.
- **energy** — how much the body moves inside the window. A perfectly matched
  window of a man standing still is a still poster with extra steps.

Match is the constraint and energy the tiebreak: a seam the eye catches ruins
the piece, whereas calmer dancing only makes it quieter. Windows where the
figure is missing — the black head and tail of the take — are disqualified
outright. On the 30s cut it picks 244.650s with a 2.0% seam.

Since 2026-09-13 the candidates are **only bar lines**, and the per-pair
differences are **prefix-summed once** so a window's energy is a subtraction
rather than a re-scan. The original re-derived every pair for every candidate:
about 8.9×10⁹ byte comparisons at a 60s span, against ~3×10⁷ now.

## The music, and why it comes from a different file

Reversed on 2026-09-13. The reel now carries Billie Jean, which is what Mani
danced to, and ships **twice**: once with the music and once silent on
byte-identical frames.

The audio is not a room recording - measured, the assets split into two
lineages. Room mic at **-35.2 LUFS** (`IMG_0191.MOV`, `loopsoul-full-hq.mp4`)
and a clean studio dub at **-10.5 to -11.1 LUFS** (the DaVinci exports and
their descendants). So the plate source has only the quiet room mic, and the
music has to be lifted from elsewhere.

**Which elsewhere matters.** `Mani-Billie-Jean.mp4` carries a clean dub that
DRIFTS against its own picture - the owner's report, and the reason this is not
a one-line change. `mani-billie-jean-4.mov` carries the same music correctly in
sync, but has the marks burned in. So: picture from one file, sound from the
other, at a fixed offset.

`scripts/loop/align-takes.mjs` measures that offset. It aligns on **picture**,
not audio, because correlating a phone room mic against a studio master means
correlating two very different timbres, whereas two renders of the same dancer
are the same shape. The signal is a per-frame silhouette signature - area,
centroid, extent - which is immune to the two files being different
resolutions. Result:

```
OFFSET  B is -15.900s from A · confidence 107.65x · no rate drift
```

Verified two ways: matched frames at t=100 and t=200 show the same pose, and
head-vs-tail offsets agree exactly, so a constant seek holds for the whole take
(a rate difference would have meant a shift could never hold sync).

Then `--musicOffset=-15.900`. It is a property of the two files, not of a
render, so it is passed in rather than recomputed each time.

**Level**: EBU R128 two-pass `loudnorm` to -14 LUFS / -1 dBTP. Instagram's
target; the repo's music scripts use -16, which is right for a streaming album
and wrong for a reel. Worth knowing the source measures -10.23 LUFS with a
**+1.23 dBTP** true peak, i.e. already clipping.

**Why the silent twin.** This is an exact commercial master, so Instagram's
fingerprinting will match it. If the post gets claimed, muted or region-locked,
the silent version has identical frames and the script prints the timecode into
the song, so the platform's own licensed copy can be dropped over it and will
land in sync.

### Verifying it — and the check that had to be thrown away

The obvious verification is to correlate the music's onsets against the
dancer's movement and see whether they line up. **It does not work, and it
looked like it did.** On this material the two correlate at about 0.03 — noise
— and the lag it reported swung by hundreds of milliseconds between cuts that
are provably aligned identically. A dancer does not move in step with onsets:
he anticipates, he holds, and a silhouette changes fastest BETWEEN poses rather
than on them. It emitted confident PASS/FAIL verdicts from nothing, which is
worse than no check at all.

So the question is split, and each half gets a check that actually works:

**Is the offset right?** `align-takes.mjs`, correlating PICTURE, which is
unambiguous. It now reports the offset at five points down the take rather than
one, because the original coarse drift test resolved to 1/6s and could have
hidden ±83ms of creeping rate difference per third. Result:

```
A t= 30s → offset -15.900s (confidence   9.2x)
A t= 91s → offset -15.900s (confidence  71.5x)
A t=151s → offset -15.900s (confidence 110.4x)
A t=211s → offset -15.900s (confidence 119.1x)
median -15.900s · spread 0ms
```

Zero spread across four independent windows. A single seek holds for the whole
take. (The fifth window, at t=261s, correlates at 1.5x and is correctly
excluded — it is past where the two files still overlap.)

**Did this render trim where it meant to?** `check-sync.mjs`, which correlates
the finished reel's audio against the reference's, on onset envelopes so that
loudnorm and the AAC re-encode cannot affect it, and reports the absolute
position it was lifted from. All three cuts: **5ms error** — one hop at the
tool's 200Hz resolution — at 16-18σ above the search mean. It refuses to give a
verdict below 6σ rather than reporting noise.

## The cut is a whole number of bars

A reel loops whether the viewer means it to or not, and a cut that starts or
ends mid-bar lurches on every repeat. So the tempo is measured from the music -
onset envelope (half-wave-rectified difference of 10ms RMS), autocorrelated for
the beat period, phase from summed onset strength - and only bar lines are
candidate start points. `--seconds` is a target the bar count rounds to.

The period is the number that has to be right, and that is the happy part: a
cut whose LENGTH is an exact multiple of the bar loops seamlessly even if its
phase is a beat out. Phase errors are a musical nicety, period errors are an
audible lurch, and autocorrelation is reliable at exactly the half that
matters.

Detected on Billie Jean: **117.65 BPM**, bar 2.040s, so 30s becomes **15 bars =
30.600s** - and 30.600 / 2.040 = 15.0000 exactly.

`--bpm=` and `--downbeat=` override; the script always prints what it detected.
One subtlety worth keeping: `bestWindow` scores on a 1/6s probe grid, so its
answer is rounded, and the exact bar time is snapped back afterwards. An 83ms
rounding would put the picture and the sound on different clocks, which is the
bug this whole section exists to fix.

## Three cuts, not one

`--pick` chooses how a window is scored, so one take can be shown three ways
and the energy compared side by side:

| `--pick` | scored on | on this take |
|---|---|---|
| `loop` (default) | seam first, movement as tiebreak | 244.65s · seam 2.0% · motion 2.6%/frame · dancer 70% |
| `energetic` | most movement | 171.21s · seam 9.6% · motion 4.5%/frame · dancer 62% |
| `calm` | least movement | 238.53s · seam 11.7% · motion 2.2%/frame · dancer 86% |

The trade is visible in the numbers and worth knowing before posting. `loop`
repeats invisibly; the other two are chosen without regard to the seam, so both
show a jump when the reel wraps. And the dancer's size runs the other way from
the energy: the energetic passage contains a full overhead reach, which widens
the envelope the band is sized to, so he ends up **smaller** on screen than in
the calm one.

## The margins, and which of them are real

The outer margins are not symmetric and should not be.

**The bottom 300px is reserved, not wasted.** Instagram puts the caption,
username and audio ticker there. In a plain video player it reads as dead sand;
in the app it is covered. Shrink it and the partner marks render underneath
Instagram's own furniture.

**The top was 250px and that was too much.** It was inherited from the STORY
layout, where the profile row makes the top heavy as well. A reel's top carries
only a title and a camera icon. Cut to **170px** on 2026-09-13, which gives the
hero band 856px instead of 776 and takes the dancer from 63% to 70%.

There is a third cause of him looking small, separate from the margins: the
band is sized to the union of every pose in the cut, and over 30s that union
(10.9%-72.9% of frame) is much taller than a typical frame (19.8%-67.2%). He is
therefore scaled about 31% smaller than any ordinary frame needs, all of it
paid for the single most extended pose. That is the right default — that pose
is the one people screenshot — but `--envelopeTolerance=0.02` will size the
band to p2-p98 instead and buy roughly 20%, at the cost of the extreme frame
grazing the type.

## Verified

- The QR is **decoded back out of a finished frame** — not from the source PNG.
  It is rendered at 135px, nearest-resized, composited over video and run
  through H.264 chroma subsampling, any of which can smear a module.
  `https://www.odubostudio.com/loop?p=reel` survives, and returns 200.
- 73 cases in `src/__tests__/loopPosterLayout.test.ts`, including that nothing
  the engine draws reaches into the hero band, that the credit stack reads
  top-down, and that the hero keeps at least a third of the frame.
- The print kit renders byte-compatible output after the config extraction —
  `layoutEventPoster` is unchanged for every existing piece.
- **`scene` and `flat` are byte-identical** after the `regrade` mode was added:
  60 frames of each rendered before and after, raw rgb24 streams hashed and
  compared. The addition is purely additive.
- **Loudness** `-14.1 LUFS` on the finished file, against a `-14` target.
- **Bar multiple** 30.600 / 2.040 = 15.0000 exactly.
- **Sync** 10ms of drift against `mani-billie-jean-4.mov`, the reference the
  owner confirms is correct (`scripts/loop/check-sync.mjs`).
- **Subject detail** measured, not eyeballed — see the table in
  `docs/decisions/loop-video-converter.md` under `regrade`.

## Known, not fixed

- **The shipped print kits are stale too.** `print-2026-09-v2/` still says
  SEPTEMBER 26; the code says OCTOBER 10. Re-run `npm run loop:posters`.
- `?p=reel` is set as the QR placement, but nothing reads placement back out
  into analytics yet.
- `--musicOffset` is measured once and pasted in. It would be nicer for
  `align-takes.mjs` to be importable so the render could do it itself, but the
  offset is a property of two files that do not change, and recomputing a 20s
  correlation on every render to get the same number back is worse.
- The dancer still scales to 63%, not the ~84% predicted when planning the
  longer cut. The 30s window's envelope (11%→74%) turned out no tighter than
  the 15s one's, so he is the same size as before, not bigger.
