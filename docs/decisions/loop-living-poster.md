# The living poster

`scripts/loop/living-poster.ts` — the Loop Soul poster with the dance take
playing inside it, cut to a seamless loop for Reels.

```bash
npm run loop:living-poster -- --in=Mani-Billie-Jean.mp4 --out=./living-poster
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

**The clean source is `media/working-files/Mani-Billie-Jean.mp4`** — green, but
with no logos on it. Everything in `media/social-media/` already has the old
marks burned in and is unusable as a source.

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
people screenshot. The take spans 10%→74%; the band is 41% of the frame; so the
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
outright. On the Billie Jean take it picks 265.8s with a 2.2% seam.

## Audio is stripped by default

The take's own audio is the record playing in the room. A copyright claim mutes
or blocks the post, which is the whole promotion. Add the single in the Reels
editor, or pass `--keepAudio` deliberately.

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

## Known, not fixed

- **The shipped print kits are stale too.** `print-2026-09-v2/` still says
  SEPTEMBER 26; the code says OCTOBER 10. Re-run `npm run loop:posters`.
- `?p=reel` is set as the QR placement, but nothing reads placement back out
  into analytics yet.
