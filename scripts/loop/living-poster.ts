import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_QR_CAPTION,
  layoutLivingPoster,
  qrSrc,
  WORDMARK_SRC,
  ODUBO_SRC,
  SCOTTS_SRC,
  LIVING_POSTER_SIZE,
  type DisplayList,
  type EventDetails,
  type Op,
} from "../../src/lib/loop/poster/layout";
import { SAND } from "../../src/lib/loop/brand";
import {
  getPublicBaseUrl,
  normalizeBaseUrl,
  destinationFor,
} from "../../src/lib/loop/publicUrl";
import { getSetting } from "../../src/lib/loop/loopSetting";
import { VOLUMES } from "./event-config";
import { prepareSharp, renderSharp, assertFontResolves } from "./poster-render-sharp";

/**
 * The living poster — the event poster with the dance take playing in its
 * hero band, cut to whole bars of the music so both picture and sound loop.
 *
 *   npm run loop:living-poster -- \
 *     --in=loopsoul-full-hq.mp4 \
 *     --music=mani-billie-jean-4.mov --musicOffset=-15.900 \
 *     --seconds=30
 *
 * It is one piece of artwork, not a video with a logo on it. The furniture
 * comes from the SAME layout engine that prints the flyer — so the reel and
 * the sheet on the wall carry the same date, the same marks, the same air —
 * and the footage supplies the hero the engine would otherwise fill with a
 * silhouette. `figureSrc: null` was already the engine's way of leaving that
 * hole; this fills it with 30 frames a second.
 *
 * Why it composites rather than draws: the converter's palette and the brand's
 * are the same two values (SAND #d9aa7a, INK #2a0f0a), so the video's field IS
 * the poster's field. There is no seam to hide.
 *
 * ── the two things that are not obvious ───────────────────────────────────
 *
 * **Picture and sound come from different files.** The only take with a clean
 * logo-free picture carries a music dub that drifts against its own frames;
 * the take that is correctly in sync has the marks burned in. So the sound is
 * lifted from the reference at a fixed offset, measured once by
 * `scripts/loop/align-takes.mjs` and passed in as `--musicOffset`. Verify a
 * finished file with `scripts/loop/check-sync.mjs`.
 *
 * **The cut is a whole number of bars.** A reel loops whether the viewer means
 * it to or not, and a cut that starts or ends mid-bar lurches every time it
 * repeats. The tempo is measured from the music itself; only bar lines are
 * candidate start points; `--seconds` is a target the bar count rounds to.
 *
 * Two files come out: one with the music, one silent on the same frames. The
 * music is an exact commercial master, so Instagram will fingerprint it —
 * the silent twin is there so a claim costs nothing, and the printed timecode
 * says where to drop the licensed copy so it lands in sync.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FFMPEG = "/opt/homebrew/bin/ffmpeg";
const FFPROBE = "/opt/homebrew/bin/ffprobe";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true] as const;
  }),
) as Record<string, string | true>;

const str = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : null);
const num = (k: string, d: number) => (str(k) ? Number(str(k)) : d);
const flag = (k: string) => args[k] === true || args[k] === "true";

function run(cmd: string, argv: string[], label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ["ignore", "inherit", "inherit"], cwd: ROOT });
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${label} exited ${code}`)),
    );
  });
}

/** ffmpeg's loudnorm prints its JSON analysis to stderr, not stdout. */
function captureBoth(cmd: string, argv: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("error", reject);
    p.on("close", () => resolve(out));
  });
}

function capture(cmd: string, argv: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("error", reject);
    p.on("close", () => resolve(out.trim()));
  });
}

/* ── choosing the loop ───────────────────────────────────────────────────── */

const PROBE_W = 96;
const PROBE_H = 171;
const PROBE_FPS = 6;

type Probe = { frames: Uint8Array[]; fps: number };

/**
 * Decode the take small and grey, as a silhouette mask.
 *
 * Everything downstream only asks two questions of a frame — how much did the
 * body move, and does this pose match that one — and both are questions about
 * the SHAPE. Thresholding to ink/not-ink before comparing means the answers
 * cannot be swayed by the field's colour, which is the one thing that differs
 * between the green source and the recoloured plate.
 */
async function probeFrames(src: string): Promise<Probe> {
  const raw = path.join(os.tmpdir(), `loop-living-probe-${process.pid}.gray`);
  await run(
    FFMPEG,
    // prettier-ignore
    ["-v", "error", "-i", src,
     "-vf", `fps=${PROBE_FPS},scale=${PROBE_W}:${PROBE_H},format=gray`,
     "-f", "rawvideo", "-pix_fmt", "gray", raw, "-y"],
    "ffmpeg (probe)",
  );
  const buf = await fs.readFile(raw);
  await fs.rm(raw, { force: true });
  const size = PROBE_W * PROBE_H;
  const frames: Uint8Array[] = [];
  for (let i = 0; i + size <= buf.length; i += size) {
    const f = new Uint8Array(size);
    // Ink is dark on both palettes; 96 sits well clear of SAND_DEEP's grey.
    for (let p = 0; p < size; p++) f[p] = buf[i + p] < 96 ? 1 : 0;
    frames.push(f);
  }
  return { frames, fps: PROBE_FPS };
}

const differs = (a: Uint8Array, b: Uint8Array) => {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d / a.length;
};
const inked = (a: Uint8Array) => {
  let n = 0;
  for (let i = 0; i < a.length; i++) n += a[i];
  return n / a.length;
};

/**
 * The vertical extent the dancer uses across a run of frames, as fractions of
 * frame height.
 *
 * The whole composition turns on this. The engine reserves a hero band and
 * lays type above and below it; if the figure is taller than the band, the
 * type lands on him. Measuring the take is what lets the video be fitted to
 * the poster instead of the poster being guessed around the video.
 *
 * Absolute extremes, not percentiles: a percentile would clip the one frame
 * where he throws an arm up, and that frame is the one people screenshot. A
 * row counts as his only at two or more ink pixels, which drops the stray
 * speckle a threshold always leaves behind.
 */
function figureBand(frames: Uint8Array[]): { top: number; bottom: number } {
  let top = PROBE_H;
  let bottom = -1;
  for (const f of frames) {
    for (let y = 0; y < PROBE_H; y++) {
      let n = 0;
      for (let x = 0; x < PROBE_W; x++) if (f[y * PROBE_W + x]) n++;
      if (n < 2) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (bottom < 0) throw new Error("no figure found in the cut — is this the right take?");
  // A row's worth of slack each way: the probe is 171px tall, so one row is
  // ~11px at output, and a threshold that tight would shave a shoe.
  return {
    top: Math.max(0, top - 1) / PROBE_H,
    bottom: Math.min(PROBE_H, bottom + 2) / PROBE_H,
  };
}

/* ── the music's grid ────────────────────────────────────────────────────── */

const HOP_HZ = 100; // 10ms hops
const AUDIO_HZ = 22050;

/**
 * An onset envelope: how much the sound is *starting* at each 10ms hop.
 *
 * Half-wave-rectified first difference of short-time RMS. Rectified because
 * only rises count — a note ending is not an onset, and counting it would put
 * a phantom beat halfway between the real ones.
 */
async function onsetEnvelope(src: string): Promise<Float64Array> {
  const raw = path.join(os.tmpdir(), `loop-living-audio-${process.pid}.pcm`);
  await run(
    FFMPEG,
    // prettier-ignore
    ["-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", String(AUDIO_HZ),
     "-f", "s16le", raw, "-y"],
    "ffmpeg (audio probe)",
  );
  const buf = await fs.readFile(raw);
  await fs.rm(raw, { force: true });
  const samples = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
  const hop = Math.round(AUDIO_HZ / HOP_HZ);
  const hops = Math.floor(samples.length / hop);
  const rms = new Float64Array(hops);
  for (let h = 0; h < hops; h++) {
    let acc = 0;
    for (let i = h * hop; i < (h + 1) * hop; i++) acc += samples[i] * samples[i];
    rms[h] = Math.sqrt(acc / hop);
  }
  const env = new Float64Array(hops);
  for (let h = 1; h < hops; h++) env[h] = Math.max(0, rms[h] - rms[h - 1]);
  return env;
}

type Grid = { bpm: number; beat: number; bar: number; downbeat: number };

/**
 * Find the beat period and where the bars start.
 *
 * The period is the number that has to be right, and the reason is worth
 * stating: a cut whose LENGTH is an exact multiple of the bar loops seamlessly
 * even if its phase is a beat out. Phase errors are a musical nicety; period
 * errors are an audible lurch every time the reel repeats. Autocorrelation
 * gives the period robustly, so the risky half of the problem is the harmless
 * half.
 */
function beatGrid(env: Float64Array, hint: number | null): Grid {
  const minLag = Math.round((60 / 200) * HOP_HZ); // 200 BPM
  const maxLag = Math.round((60 / 60) * HOP_HZ); // 60 BPM
  let bestLag = minLag;
  if (hint) {
    bestLag = Math.round((60 / hint) * HOP_HZ);
  } else {
    let best = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let acc = 0;
      for (let h = lag; h < env.length; h++) acc += env[h] * env[h - lag];
      // Longer lags overlap fewer samples, so normalise or slow tempos win.
      const score = acc / (env.length - lag);
      if (score > best) { best = score; bestLag = lag; }
    }
    // Autocorrelation is happy at half and double time. Prefer the reading in
    // the range dance music actually lives in.
    while (60 / (bestLag / HOP_HZ) > 180) bestLag *= 2;
    while (60 / (bestLag / HOP_HZ) < 70) bestLag = Math.round(bestLag / 2);
  }
  const beat = bestLag / HOP_HZ;
  const barHops = bestLag * 4;
  let bestPhase = 0;
  let bestScore = -Infinity;
  for (let p = 0; p < barHops; p++) {
    let acc = 0;
    for (let h = p; h < env.length; h += barHops) acc += env[h];
    if (acc > bestScore) { bestScore = acc; bestPhase = p; }
  }
  return { bpm: 60 / beat, beat, bar: beat * 4, downbeat: bestPhase / HOP_HZ };
}

type Window = { start: number; seconds: number; match: number; energy: number };

/**
 * Pick the window to cut.
 *
 * A living poster is watched more than once — it loops in the feed whether the
 * viewer means it to or not — so the cut is scored on two things at once:
 *
 *  - **match**: how closely the frame after the last one resembles the first.
 *    This is what makes the repeat invisible. Scored against the frame AFTER
 *    the window, not the last frame in it, because that is the one the loop
 *    actually replaces.
 *  - **energy**: how much the body moves inside the window. A perfectly
 *    matched window of a man standing still is a still poster with extra
 *    steps, and the whole point of the piece is that it moves.
 *
 * Frames where the figure is missing (the black head and tail of the take, or
 * a moment he walks out of shot) disqualify a window outright — a poster whose
 * hero band is empty for a second reads as a broken video.
 */
function bestWindow(
  probe: Probe,
  seconds: number,
  /** Candidate start times, in plate seconds. Null = every probe frame. */
  starts: number[] | null,
): Window {
  const { frames, fps } = probe;
  const span = Math.round(seconds * fps);
  if (frames.length < span + 2) {
    throw new Error(
      `source is only ${(frames.length / fps).toFixed(1)}s of usable frames — ` +
        `cannot cut ${seconds}s from it`,
    );
  }
  // The figure should be present and human-sized. Wildly high ink is a black
  // frame; near-zero is an empty room.
  const present = frames.map((f) => {
    const ink = inked(f);
    return ink > 0.01 && ink < 0.45;
  });
  // Prefix sums, so a window's energy is a subtraction rather than a re-scan.
  // The per-pair difference does not depend on where the window starts, but
  // the original re-derived all of them for every candidate — about 8.9x10^9
  // byte comparisons at a 60s span.
  const cumEnergy = new Float64Array(frames.length);
  for (let i = 1; i < frames.length; i++) {
    cumEnergy[i] = cumEnergy[i - 1] + differs(frames[i - 1], frames[i]);
  }
  const cumPresent = new Int32Array(frames.length + 1);
  for (let i = 0; i < frames.length; i++) {
    cumPresent[i + 1] = cumPresent[i] + (present[i] ? 1 : 0);
  }

  const candidates =
    starts?.map((t) => Math.round(t * fps)) ??
    Array.from({ length: Math.max(0, frames.length - span - 1) }, (_, i) => i);

  let best: Window | null = null;
  let bestScore = Infinity;
  for (const s of candidates) {
    if (s < 0 || s + span + 1 >= frames.length) continue;
    // Every frame in the window must have him in it.
    if (cumPresent[s + span + 1] - cumPresent[s] !== span + 1) continue;

    const match = differs(frames[s], frames[s + span + 1]);
    const energy = (cumEnergy[s + span] - cumEnergy[s]) / span;

    // Match is the constraint, energy the tiebreak: a seam the eye catches
    // ruins the piece, whereas slightly calmer dancing only makes it quieter.
    const score = match - energy * 0.35;
    if (score < bestScore) {
      bestScore = score;
      best = { start: s / fps, seconds, match, energy };
    }
  }
  if (!best) {
    throw new Error(
      `no ${seconds}s stretch of this take has the figure in frame` +
        (starts ? ` starting on a bar line` : ""),
    );
  }
  return best;
}

/* ── the furniture ───────────────────────────────────────────────────────── */

/**
 * The poster, minus its sheet.
 *
 * Two things are dropped from what the print kit would render: the background
 * rect (the video's own field replaces it, pixel for pixel) and nothing else.
 * Everything that remains — wordmark, code, album credit, slogan, date, venue,
 * both partner marks — is the engine's own arithmetic, untouched.
 */
async function furniture(opts: {
  qrUrl: string;
  qrCaption: string;
  slogan?: string | null;
  details: EventDetails;
}): Promise<{ png: Buffer; hero: NonNullable<DisplayList["hero"]> }> {
  const laid = layoutLivingPoster(
    {
      qrUrl: opts.qrUrl,
      qrCaption: opts.qrCaption,
      slogan: opts.slogan,
      details: opts.details,
    },
    {
      sizes: (await prepareSharp([WORDMARK_SRC, ODUBO_SRC, SCOTTS_SRC, qrSrc(opts.qrUrl)])).sizes,
    },
  );
  if (!laid.ok) throw new Error(`living poster layout: ${laid.error}`);
  const list = laid.list;
  if (!list.hero) throw new Error("layout returned no hero band — engine changed?");

  const isSheet = (op: Op) =>
    op.kind === "rect" && op.fill === SAND && op.w === list.w && op.h === list.h;
  const stripped: DisplayList = { ...list, ops: list.ops.filter((op) => !isSheet(op)) };
  if (stripped.ops.length === list.ops.length) {
    throw new Error("expected a full-canvas SAND rect to drop — layout changed?");
  }

  const prepared = await prepareSharp(
    stripped.ops.flatMap((op) => (op.kind === "image" ? [op.src] : [])),
  );
  return {
    png: await renderSharp(stripped, prepared, { transparent: true }),
    hero: list.hero,
  };
}

/* ── run ─────────────────────────────────────────────────────────────────── */

async function main() {
  await assertFontResolves();

  const { w: W, h: H } = LIVING_POSTER_SIZE;
  const seconds = num("seconds", 15);
  const source = str("plate") ?? str("in");
  if (!source) {
    throw new Error(
      "need --in=<take> (green or ungraded; it will be recoloured) " +
        "or --plate=<already sand/ink take>",
    );
  }
  const srcPath = path.resolve(source);
  await fs.access(srcPath);

  // Same rule as the print kit: a code is permanent once it is out in the
  // world, and a reel outlives the campaign that posted it. No default host.
  const baseUrl =
    normalizeBaseUrl(str("url")) ??
    normalizeBaseUrl(process.env.LOOP_PUBLIC_BASE_URL) ??
    (await getPublicBaseUrl());
  if (!baseUrl) {
    throw new Error(
      "No public base URL. The QR outlives the post, so this will not guess one.\n" +
        "  Set it in /loop/admin/studio, or pass --url=https://your-domain, " +
        "or export LOOP_PUBLIC_BASE_URL.",
    );
  }
  const placement = str("placement") ?? "reel";
  const qrUrl = destinationFor("event", baseUrl, placement)!;
  const qrCaption =
    str("qrCaption") ?? (await getSetting("poster_qr_caption")) ?? DEFAULT_QR_CAPTION;

  const volume = str("volume") ?? "1";
  const configured = VOLUMES[volume];
  if (!configured) throw new Error(`no config for volume ${volume}`);
  // venueShort is for the ticket stub; this piece has room for the full line.
  const details: EventDetails = { ...configured, venue: configured.venue };
  delete (details as { venueShort?: string }).venueShort;

  console.log(`→ QR destination: ${qrUrl}`);
  console.log(`→ date line     : ${details.date}  ·  ${details.venue}`);

  const outDir = path.resolve(str("out") ?? path.join(path.dirname(srcPath), "living-poster"));
  await fs.mkdir(outDir, { recursive: true });
  const stem = str("name") ?? "loop-soul-v1-living-poster";

  /* 1. The music's grid.
   *
   * The music lives in a DIFFERENT file from the picture: the only take with a
   * clean logo-free picture carries a dub that drifts against its own frames,
   * while the one that is correctly in sync has the marks burned in. So the
   * sound is lifted from the reference and laid against the plate at a fixed
   * offset — measured once by scripts/loop/align-takes.mjs, which prints the
   * number to paste in here. It is a property of the two files, not of this
   * render, so it is not recomputed every time. */
  const musicSrc = str("music") ? path.resolve(str("music")!) : null;
  const musicOffset = str("musicOffset") ? Number(str("musicOffset")) : null;
  if (musicSrc && musicOffset == null) {
    throw new Error(
      `--music needs --musicOffset=<seconds> (music time = plate time + offset).\n` +
        `  Measure it once:\n` +
        `    node scripts/loop/align-takes.mjs --a=${path.basename(srcPath)} ` +
        `--b=${path.basename(musicSrc)}`,
    );
  }

  let grid: Grid | null = null;
  let cutSeconds = seconds;
  if (musicSrc) {
    console.log(`\nreading the music…`);
    const env = await onsetEnvelope(musicSrc);
    grid = beatGrid(env, str("bpm") ? Number(str("bpm")) : null);
    if (str("downbeat")) grid.downbeat = Number(str("downbeat"));
    // Whole bars, or the sound lurches every time the reel repeats.
    const bars = Math.max(1, Math.round(seconds / grid.bar));
    cutSeconds = bars * grid.bar;
    console.log(
      `beat : ${grid.bpm.toFixed(2)} BPM · bar ${grid.bar.toFixed(3)}s · ` +
        `first downbeat ${grid.downbeat.toFixed(3)}s`,
    );
    console.log(
      `cut  : ${bars} bars = ${cutSeconds.toFixed(3)}s (asked for ${seconds}s)`,
    );
  }

  /* 2. Where to cut. */
  console.log(`\nreading the take…`);
  const probe = await probeFrames(srcPath);
  const explicitStart = str("start") ? Number(str("start")) : null;
  // Only bar lines are candidates, so the music starts where a bar does.
  // Music time = plate time + offset, so a downbeat at music time d sits at
  // plate time d - offset.
  const takeSeconds = probe.frames.length / probe.fps;
  const barStarts: number[] | null =
    grid && musicOffset != null
      ? (() => {
          const out: number[] = [];
          for (let k = 0; ; k++) {
            const t = grid!.downbeat + k * grid!.bar - musicOffset;
            if (t > takeSeconds) break;
            if (t >= 0) out.push(t);
          }
          return out;
        })()
      : null;
  const scored =
    explicitStart != null
      ? { start: explicitStart, seconds: cutSeconds, match: NaN, energy: NaN }
      : bestWindow(probe, cutSeconds, barStarts);
  // bestWindow scores on a 1/6s probe grid, so its answer is rounded. Snap
  // back to the exact bar it stands for: an 83ms rounding would put the
  // picture and the sound on different clocks, which is the bug being fixed.
  const win =
    barStarts && explicitStart == null
      ? {
          ...scored,
          start: barStarts.reduce((a, b) =>
            Math.abs(b - scored.start) < Math.abs(a - scored.start) ? b : a,
          ),
        }
      : scored;
  console.log(
    `     : ${win.start.toFixed(3)}s → ${(win.start + cutSeconds).toFixed(3)}s of the take` +
      (Number.isNaN(win.match)
        ? "  (start given)"
        : `  · loop seam ${(win.match * 100).toFixed(1)}% of silhouette` +
          `  · motion ${(win.energy * 100).toFixed(1)}%/frame`),
  );

  /* 3. The plate: sand field, ink figure, nothing else on it. */
  const plate = path.join(outDir, `${stem}-plate.mp4`);
  if (str("plate")) {
    console.log(`\nplate: trimming ${path.basename(srcPath)} (already graded)`);
    await run(
      FFMPEG,
      // prettier-ignore
      ["-v", "error", "-ss", String(win.start), "-t", String(cutSeconds), "-i", srcPath,
       "-an", "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`,
       "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", plate, "-y"],
      "ffmpeg (trim)",
    );
  } else {
    console.log(`\nplate: regrading ${cutSeconds.toFixed(2)}s of ${path.basename(srcPath)} → sand/ink`);
    await run(
      process.execPath,
      // prettier-ignore
      ["--max-old-space-size=8192", "scripts/loop/video-convert.mjs",
       `--in=${srcPath}`, `--mode=regrade`, `--start=${win.start}`, `--preview=${cutSeconds}`,
       `--height=${H}`, `--crf=12`,
       ...(str("gradeCache") ? [`--gradeCache=${str("gradeCache")}`] : []),
       `--out=${plate}`],
      "video-convert",
    );
  }
  // The composite used to synthesise its sheet at a hardcoded 24fps, which
  // silently decimated a 30fps plate. Read the plate's own rate instead.
  const rate = await capture(FFPROBE, [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
    "-of", "default=nw=1:nk=1", plate,
  ]);
  const [rNum, rDen] = rate.split("/").map(Number);
  const plateFps = rNum / (rDen || 1);

  /* 3. The furniture, and the hero band it left for the dancer. */
  const { png, hero } = await furniture({
    qrUrl,
    qrCaption,
    // null means "drop it", undefined means "use the brand's" — and str()
    // returns null for an absent flag, so the two have to be told apart here.
    slogan: flag("noSlogan") ? null : (str("slogan") ?? undefined),
    details,
  });
  const overlay = path.join(outDir, `${stem}-furniture.png`);
  await fs.writeFile(overlay, png);
  console.log(
    `\nhero : ${hero.h}px tall at y=${hero.y}  ` +
      `(${((hero.y / H) * 100).toFixed(0)}% → ${(((hero.y + hero.h) / H) * 100).toFixed(0)}% of frame)`,
  );

  /* 4. Fit the dancer to the band.
   *
   * Measured on the PLATE, not the source: the recolour is what decides which
   * pixels are ink, and a shoe that survives the grade differently would move
   * the envelope. Scaling down is invisible because the field it pads with is
   * the same SAND the plate is already made of — there is no letterbox, only
   * more sheet. Scaling UP is refused: it would crop him at the sides. */
  const band = figureBand((await probeFrames(plate)).frames);
  const figurePx = (band.bottom - band.top) * H;
  const fit = Math.min(1, hero.h / figurePx);
  const vidW = Math.round((W * fit) / 2) * 2;
  const vidH = Math.round((H * fit) / 2) * 2;
  const offX = Math.round((W - vidW) / 2);
  // Anchor his FEET to the foot of the band, not his midpoint to its middle.
  //
  // The floor is the stable edge of the envelope — it moves by a shoe — while
  // the top is set by whichever frame he throws an arm up in. Centring the
  // envelope therefore parks him a raised-arm's-length above the type on every
  // frame but one, and he reads as floating. Standing him on the band puts the
  // slack overhead, where the masthead already is.
  const offY = Math.round(hero.y + hero.h - band.bottom * H * fit);
  console.log(
    `fit  : dancer spans ${(band.top * 100).toFixed(0)}%→${(band.bottom * 100).toFixed(0)}% ` +
      `of the take · scaled to ${(fit * 100).toFixed(0)}% to land inside the band`,
  );
  if (fit === 1 && figurePx > hero.h + 1) {
    console.warn(
      `\n! the dancer is taller than the band and cannot be scaled up out of it.\n` +
        `  Drop a line (--slogan= off is already the default) or shorten the cut.`,
    );
  }

  /* 5. Composite: sheet, then dancer, then type. Picture only — the audio is
   *    muxed onto a copy afterwards, so both deliverables carry byte-identical
   *    frames and the expensive encode happens once. */
  const silent = path.join(outDir, `${stem}-silent.mp4`);
  await run(
    FFMPEG,
    // prettier-ignore
    ["-v", "error", "-stats",
     "-i", plate, "-i", overlay,
     "-filter_complex",
     `color=c=${SAND}:s=${W}x${H}:r=${plateFps}[sheet];` +
     `[0:v]scale=${vidW}:${vidH}[fig];` +
     `[sheet][fig]overlay=${offX}:${offY}:shortest=1[bed];` +
     `[bed][1:v]overlay=0:0:format=auto,format=yuv420p[v]`,
     "-map", "[v]", "-an",
     "-c:v", "libx264", "-preset", "slow", "-crf", "18",
     "-profile:v", "high", "-level", "4.1",
     // Reels wants a keyframe it can loop on and a browser-safe pixel format.
     "-g", String(Math.round(plateFps * 2)), "-movflags", "+faststart",
     silent, "-y"],
    "ffmpeg (composite)",
  );

  /* 6. The music, lifted from the reference and levelled for the platform. */
  const mode = str("audio") ?? (musicSrc ? "both" : "none");
  const musicStart = musicSrc ? win.start + musicOffset! : null;
  let withMusic: string | null = null;
  if (musicSrc && mode !== "none") {
    const trimmed = path.join(outDir, `${stem}-music.m4a`);
    // Two-pass EBU R128, the same shape as scripts/normalize_clip_audio.ts.
    // -14 LUFS is Instagram's target; the repo's music scripts use -16, which
    // is right for a streaming album and wrong for a reel.
    // NOT -v error: loudnorm prints its JSON at info level, and quieting the
    // log throws away the measurement the second pass needs.
    const analysis = await captureBoth(FFMPEG, [
      "-hide_banner", "-nostats", "-ss", String(musicStart), "-t", String(cutSeconds),
      "-i", musicSrc,
      "-vn", "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-",
    ]);
    const m = analysis.match(/\{[\s\S]*\}/);
    const measured = m ? JSON.parse(m[0]) : null;
    const norm = measured
      ? `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${measured.input_i}:` +
        `measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:` +
        `measured_thresh=${measured.input_thresh}:linear=true`
      : "loudnorm=I=-14:TP=-1:LRA=11";
    if (!measured) console.warn("! loudnorm analysis unreadable — falling back to one pass");
    await run(
      FFMPEG,
      // prettier-ignore
      ["-v", "error", "-ss", String(musicStart), "-t", String(cutSeconds), "-i", musicSrc,
       "-vn", "-af", norm, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", trimmed, "-y"],
      "ffmpeg (music)",
    );
    withMusic = path.join(outDir, `${stem}.mp4`);
    await run(
      FFMPEG,
      // prettier-ignore
      ["-v", "error", "-i", silent, "-i", trimmed,
       "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "copy",
       "-movflags", "+faststart", "-shortest", withMusic, "-y"],
      "ffmpeg (mux)",
    );
  }

  const size = async (f: string) =>
    Number(await capture(FFPROBE, ["-v","error","-show_entries","format=size","-of","default=nw=1:nk=1",f]));

  console.log(`\nout  : ${outDir}`);
  if (withMusic) {
    console.log(`       ${path.basename(withMusic)}  ${W}×${H} @${plateFps.toFixed(0)} · ` +
      `${cutSeconds.toFixed(2)}s · ${((await size(withMusic)) / 1e6).toFixed(1)} MB · with music`);
  }
  console.log(`       ${path.basename(silent)}  ${W}×${H} @${plateFps.toFixed(0)} · ` +
    `${cutSeconds.toFixed(2)}s · ${((await size(silent)) / 1e6).toFixed(1)} MB · silent`);

  if (musicStart != null) {
    const mm = Math.floor(musicStart / 60);
    const ss = (musicStart % 60).toFixed(2).padStart(5, "0");
    console.log(
      `\nThe cut starts ${mm}:${ss} into ${path.basename(musicSrc!)}.\n` +
        `Use that to line up Instagram's own licensed copy over the silent\n` +
        `version — the picture is identical, so it will land in sync.`,
    );
  }
}

main().catch((e) => {
  console.error(String((e as Error).message ?? e));
  process.exit(1);
});
