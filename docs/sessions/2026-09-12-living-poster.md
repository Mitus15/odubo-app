# 2026-09-12 — the dance video becomes a living poster

**Asked:** how is the dance video looking, and make it a living poster for
Reels — logos, date/venue and QR on the final video. The green cuts carrying
the Loop Soul and Scott's marks are stale.

**Shipped:** `npm run loop:living-poster`. Full reasoning in
[docs/decisions/loop-living-poster.md](../decisions/loop-living-poster.md).

---

## The footage, assessed

It is in good shape and it was shot in a way that suits this. Measured the ink
envelope across all 310s of the take: the dancer occupies **21%–69%** of frame
height with the bottom 27% and top 20% essentially never touched. The
composition is already a poster with a hole in the middle.

Four assets, and only one is usable as a source:

| file | verdict |
|---|---|
| `media/working-files/Mani-Billie-Jean.mp4` | **the clean plate** — green, 2160×3840, no logos |
| `media/social-media/mani-billie-jean-3/4.mov` | old marks burned in |
| `media/social-2026-08/billie-jean-loopsoul-1080x1920.mp4` | sand recolour of the above, same burned-in marks |
| `media/loopsoul-dance-sandink-full.mp4` | a different take, landscape, head clipped by the frame |

## What was built

- **`scripts/loop/living-poster.ts`** — picks a seamless loop window, recolours
  it green→sand through the existing converter, renders the poster furniture
  transparent through the existing engine, fits the dancer to the reserved band
  and composites. 30 seconds end to end.
- **`layoutLivingPoster`** in the shared engine — its own layout, because the
  event poster leaves the hero only 27% of a 9:16 sheet and a full-body take
  needs 48%.
- **`showQr`** on `EventPosterSpec` — lets a story carry a code, reverting the
  header to the print treatment when it does.
- **`hero`** on `DisplayList` — the band the layout reserved, so a caller can
  put something there the engine cannot rasterise.
- **`transparent`** on `renderSharp`.
- **`scripts/loop/event-config.ts`** — the night's facts, lifted out of
  `poster-kit.ts` so the video and the print kit cannot disagree about the date.

## What went wrong on the way

1. **First build ran the video through the full event poster.** The album credit
   landed on his head and the slogan on his shins. Fixed by giving the piece its
   own layout rather than by nudging numbers.
2. **Centring the dancer in the band made him float.** The band is sized to the
   union of every pose including one raised arm, so centring parks him high on
   every ordinary frame. Anchored his feet to the foot of the band instead.
3. **The credit stack rendered upside down** — "WITH AMEN THE DJ" above "AN
   ALBUM BY MANI ODUBO". The bottom block builds upward, so subordinate lines
   have to be emitted *first*. There is now a test asserting the reading order.
4. **The slogan silently vanished.** `str("slogan")` returns null for an absent
   flag, and null was also the sentinel for "drop it". Absent is `undefined`.
5. Nearly restyled every existing print piece by vertically centring the
   wordmark against the QR block. Caught and reverted before it shipped.

## Verified

- QR decoded back out of a finished video frame (not the source PNG) →
  `https://www.odubostudio.com/loop?p=reel`, which returns 200.
  `odubo.studio` still does not resolve.
- 95 loop tests pass, 73 of them in the poster layout suite.
- Lint clean; the files touched typecheck clean.
- Print kit re-rendered and inspected — unchanged behaviour.

## Next

- **Re-run `npm run loop:posters`.** The shipped `print-2026-09-v2/` still says
  SEPTEMBER 26; the code says OCTOBER 10. The print pieces are as stale as the
  video was.
- Audio: the reel ships silent on purpose. The single goes on in the Reels
  editor.
- Nothing reads the `?p=reel` placement back into analytics yet.
