# Pose Studio: how a take is recorded

**2026-08-29.** Why the long take bypasses the canvas, why the filtered take
stays short, and what studio mode actually changes. Written because all three
are the kind of decision that gets relitigated in six months by someone
reasonably asking "why doesn't the filter just run for five minutes?"

---

## The two jobs one camera does

| | Guest, on the night | Owner, shooting promo |
|---|---|---|
| Length | 15s | 60s filtered / **5 min raw** |
| Resolution asked for | 1280 long edge | 1920 long edge |
| Audio | none | mic, muxed in |
| Where it goes | the Wall (contest entry) | download → offline converter |

Studio mode is a **visible toggle shown only to a signed-in loop admin**
(`/loop/pose`, resolved server-side). It replaced a hidden `?studio=1` URL flag
that anyone could stumble into and that gave no signal about whether it had
taken effect.

`isAdmin` is a **capability hint, not a security boundary** — the state is
client-side and anyone can flip it in devtools. The worst outcome is a slower
camera and a large file on their own phone. Nothing that matters may ever hang
off it.

---

## Three bugs this work fixed, all pre-existing

**1. The auto-stop cap had never worked.** The cap was
`setTimeout(() => toggleRecord(), maxClipS * 1000)`. `toggleRecord` is
re-created every render, so the timer captured *that* render's copy, where
`recording` was still `false`. On firing it took the **start** branch, hit the
`if (!type || this.recorder) return false` guard, and displayed *"Recording
isn't supported here"* while the take kept rolling. Manual stop worked (that
button always used the latest render), which is why nobody noticed — 15s is
roughly how long people record anyway.

Fixed by splitting `toggleRecord` into `startRec`/`stopRec` and having the
ticker call `stopRecRef.current`, which is reassigned every render.

**2. Studio mode had never produced HD.** `getUserMedia` requested
`{ facingMode: { ideal } }` and no resolution. iOS Safari and Chrome both
default to **640×480**. `sizeCanvas` only ever scales *down*, so a render cap
of 1920 was handed a 480-tall source and did nothing. The "HD" shipped in
`fcc9dd0` was a no-op on every device.

Fixed by asking for a resolution — and, just as importantly, by **reading back
what was granted** and showing it in the viewfinder.

**3. The blob's mime was the mime we asked for, not the one we got.** Safari's
`isTypeSupported` is loose: it accepts `video/mp4;codecs=h264` and then encodes
what it likes. The recorder now reads `recorder.mimeType` back **after**
`start()` (it is only populated then), which is what keeps the file extension
and the stored mime honest.

---

## Why the long take bypasses the canvas

The filtered path records `canvas.captureStream()`, which preserves a genuinely
good invariant: what you see is what you record. The long raw take breaks that
invariant deliberately, and records the camera track directly.

- **The converter wants the original plate.** `scripts/loop/video-convert.mjs`
  builds the house look from threshold crossings of fields analysed at reduced
  resolution (see `loop-video-converter.md`). A canvas round-trip inserts a
  second lossy generation — camera H.264 → decode → 2D canvas → re-encode —
  that buys the look nothing.
- **Thermals.** 300s × 30fps of `drawImage` into a 1080×1920 canvas plus a
  `captureStream` readback throttles on a phone. The frame rate then falls out
  of the middle of the take, which is the worst possible input for a two-pass
  plate analysis that assumes temporal consistency.
- **rAF stops when the page hides**, so the canvas path would silently record a
  frozen frame. Direct track recording degrades honestly.
- **A/V sync.** Canvas timestamps come from rAF; mic timestamps from the audio
  clock. Tolerable drift at 60s, not at 300s.

**The preview follows the file, not the other way round.** For the raw take the
preview is the bare `<video>`, `object-contain` (so you see the true recorded
frame, bars and all) and **unmirrored** — mirroring is a preview convention,
and baking a flip into the master gives the converter something it has no flag
to undo.

## Why the filtered take stays at 60s

Segmentation plus the vector redraw is per-frame CPU. No phone holds that for
minutes at full height; it thermal-throttles and the take degrades as it runs.
If this number ever grows it should be because a real device was measured, not
because 60 felt arbitrary.

**Untested at 1920:** whether segmentation holds at full vertical HD for a full
60s is device-dependent and still unverified on hardware. If it can't, lower
`RENDER_MAX_HEIGHT.studio` — not the clip limit. The limit is about heat; the
height is about the frame budget.

---

## Duration safety

Three independent layers, because a five-minute take has three ways to die:

1. **Wall-clock ticker** (250ms), comparing `performance.now()` against the
   start stamp. Wall-clock means a throttled interval can only stop the take
   *late* — never miss it, and never take the wrong branch.
2. **`visibilitychange` ends the take** and keeps the partial file. On iOS the
   tab is about to be suspended and anything past that point is garbage.
3. **Screen Wake Lock** (`src/lib/loop/capture/wake-lock.ts`). Not optional:
   iOS auto-lock defaults to 30s, which is shorter than every studio clip
   length. This was the single most likely reason a real-device test would have
   failed. Absent below iOS 16.4 — when it can't be held, the viewfinder says
   so rather than letting the take die silently.

Plus `recorder.onerror` and a 5s stop watchdog: without them, a Safari error
under memory pressure means `onstop` never fires and the UI hangs in
"recording" forever.

---

## Size, and where a take is allowed to go

5 min at 8 Mbps ≈ **300 MB**, the practical ceiling for a phone blob plus a
download. Source bitrate above ~8 Mbps buys the house look nothing, because the
converter analyses at reduced resolution specifically to let noise average away.

**iOS Safari ignores `videoBitsPerSecond`** and picks its own rate. Expect a
smaller file on iPhone, with no way to force it up.

Two hard ceilings, both enforced client-side so nothing is offered that can't
work:

- **`WALL_MAX_BYTES` (30 MB)** mirrors the Wall API. Over it, the "Post to the
  Wall" button is hidden rather than letting a 200 MB upload crawl to a 413.
- **`GALLERY_MAX_BYTES` (40 MB)** keeps long takes out of IndexedDB.
  `WallGallery` reads *every* stored blob at once and object-URLs them on each
  visit to `/loop/pose`, so one 300 MB take would wedge that page — and a
  studio plate is headed for a desktop converter, not the phone's grid.

## The workflow this produces

```
/loop/pose → Studio mode on → filter OFF → record (≤5 min, with sound)
  → Keep (downloads to Files) → move to the Mac
  → node scripts/loop/video-convert.mjs --in=<file> --scale=2
```

The in-app filter and the offline converter are **different looks**, not two
qualities of the same one: the filter isolates the person and discards the
room; the converter keeps the room as flat graphic shapes with the dancer most
pronounced. Promo goes through the converter.
