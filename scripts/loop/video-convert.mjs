/**
 * Loop Soul video converter — two-pass, whole-scene.
 *
 *   node scripts/loop/video-convert.mjs --in=clip.mov
 *   node scripts/loop/video-convert.mjs --in=clip.mov --start=25 --preview=4
 *   node scripts/loop/video-convert.mjs --in=clip.mov --scale=2 --lossless
 *   node scripts/loop/video-convert.mjs --in=old-green.mov --mode=recolor
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY TWO PASSES
 *
 * The in-app camera filter isolates the person and throws the room away. Here
 * the room stays — wall, floor, baseboard, furniture — as flat graphic shapes,
 * with the dancer as the most pronounced thing in frame. One pass can't do
 * that: quantizing each frame independently makes the background boil (every
 * frame lands its edges a pixel differently), and there is no way to tell a
 * dancer from his own cast shadow when you only ever see one frame.
 *
 * So pass 1 watches the whole clip and builds a BACKGROUND PLATE — the
 * per-pixel median across sampled frames, which is what the room looks like
 * with the dancer statistically removed. That plate is quantized ONCE into
 * shapes that are then identical in every output frame: zero boil.
 *
 * Pass 2 renders. Each frame is compared against the plate, so the subject
 * falls out as "what changed" — and a shadow, which darkens the floor without
 * changing its colour, is rejected by a luminance-ratio and chroma test. The
 * dancer is drawn in ink with his own internal tone cuts so he reads as a
 * figure rather than a blob.
 *
 * This assumes a LOCKED-OFF CAMERA. Handheld footage breaks the plate; for
 * that, --mode=flat quantizes per frame with no plate (boilier, but works).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY IT COMES OUT SHARPER THAN THE SOURCE
 *
 * Every edge in the output is a threshold crossing of a smooth field, not a
 * copy of source pixels. So the fields are analysed at half res (where sensor
 * noise and compression mush average away), then upsampled bilinearly and
 * thresholded at OUTPUT res, which puts the crossing on a subpixel boundary.
 * --scale=2 on 1080p footage therefore produces genuinely sharp 4K lines
 * rather than a blurry upscale. Low-quality footage benefits most: the
 * analysis res is where the noise dies, the render res is where lines are born.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

/* ─────────────────────────────── palette ─────────────────────────────── */

const INK = [42, 15, 10];
const INK_SOFT = [61, 26, 18];
const SAND_DEEP = [156, 95, 60];
const SAND = [217, 170, 122];
const SAND_BRIGHT = [240, 211, 173];
const BANDS = [INK, INK_SOFT, SAND_DEEP, SAND, SAND_BRIGHT];

/* ──────────────────────────────── options ────────────────────────────── */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const IN = args.in;
if (!IN) {
  console.error("need --in=<video>");
  process.exit(1);
}

const flag = (v) => v === true || v === "1" || v === "true";

const OPTS = {
  /**
   * "scene"   — two-pass, locked-off camera (default).
   * "flat"    — single-pass quantization, no plate; for handheld footage.
   * "recolor" — for clips already rendered in the OLD green look: green field
   *             becomes sand, figure becomes ink. Moves existing videos onto
   *             the new brand without re-shooting.
   */
  mode: String(args.mode ?? "scene"),

  /** Output size multiplier against the source. 2 = 1080p in, 4K-ish out. */
  scale: Number(args.scale ?? 1),
  /** Or pin output height directly; overrides scale. */
  height: args.height ? Number(args.height) : null,
  /** Analysis height. Lower averages away more noise; higher resolves small
   *  detail like a logo on a shoe. Raise it for clean footage, drop it for
   *  grainy footage. */
  workHeight: Number(args.workHeight ?? 720),

  /** Frames sampled across the clip to build the background plate. More is
   *  better and nearly free — see buildPlate. */
  plateSamples: Number(args.plateSamples ?? 150),
  /** Which percentile of the samples seeds "the room". 0.5 is the plain
   *  median; higher biases bright, which steps over a subject darker than the
   *  room even when he holds a spot for most of the take. The whole look
   *  presumes an ink figure on a sand field, so dark-is-the-subject is a safe
   *  premise here. See buildPlate. */
  platePercentile: Number(args.platePercentile ?? 0.9),
  /** Reuse/store the analysed plate here, so the look can be re-tuned without
   *  re-watching the clip. */
  plateCache: args.plateCache ? String(args.plateCache) : null,
  /** How far a pixel must move from the plate to count as subject (0–1 lum). */
  subjectThreshold: Number(args.subjectThreshold ?? 0.055),
  /** How far a pixel's COLOUR must move from the plate to count as subject,
   *  independent of brightness. This is what catches things that match the
   *  room's tone but not its hue. */
  colorThreshold: Number(args.colorThreshold ?? 0.05),
  /** The faint-signal threshold, as a fraction of the two above. Pixels this
   *  weak only join the figure when they connect back to a confident one. */
  subjectFloor: Number(args.subjectFloor ?? 0.3),
  /** A pixel darker than the plate by a factor inside this window, with its
   *  colour intact, is a cast shadow — not the dancer. */
  shadowRatioMin: Number(args.shadowRatioMin ?? 0.35),
  shadowRatioMax: Number(args.shadowRatioMax ?? 0.985),
  /** How closely colour must still match the plate to call something a
   *  shadow. This is the sharpest tool in the box and it must stay TIGHT.
   *  Measured on this footage: a real cast shadow shifts colour by ~0.004,
   *  while pale shoes on pale floor shift by ~0.017 — only a factor of four
   *  apart, so a generous setting quietly eats the feet and leaves legs that
   *  stop at the ankle. Shadows dim; they do not recolour. */
  shadowChroma: Number(args.shadowChroma ?? 0.012),

  /** Mask blobs below this fraction of frame area are discarded before the
   *  figure is drawn — see keepLargestBlobs. Keep it well under the size of a
   *  SHOE: feet detach from the body whenever the ankle blends into a dark
   *  floor, and a threshold sized for stray artefacts silently deletes them,
   *  leaving legs that stop dead at the floor line. */
  maskMinRegion: Number(args.maskMinRegion ?? 0.0009),
  /** Radius of the thin-structure removal, as a fraction of analysis height.
   *  Sized to be narrower than a limb and wider than a floor reflection. */
  maskOpen: Number(args.maskOpen ?? 0.011),
  /** Mask smoothing radius at analysis res — the main line-quality lever. */
  maskSmooth: Number(args.maskSmooth ?? 3),
  /** Tone bands the background plate collapses to. */
  bands: Number(args.bands ?? 4),
  /** Pre-quantization smoothing for the plate / flat mode. */
  smooth: Number(args.smooth ?? 2),
  /** Regions below this fraction of frame area get absorbed into their
   *  surroundings: the "anything that can go, goes" pass. Kept small, because
   *  the cuts that give a figure its interior — a shoe, a collar, a logo —
   *  are genuinely tiny shapes, and a threshold big enough to tidy a wall
   *  swallows every one of them and leaves a solid blob. The background gets
   *  its own, much larger threshold instead (see bgMinRegion). */
  minRegion: Number(args.minRegion ?? 0.00008),
  /** The same, but for the background alone, and far more aggressive. A real
   *  wall is never one flat tone — it has a lighting gradient — and quantizing
   *  a gradient produces big soft islands with contour-map edges that read as
   *  smudges. Kept low, because with a clean plate the wall quantizes flat on
   *  its own — this only has to sweep up the crumbs. Raising it hard also
   *  eats real objects (a ceiling speaker, a chair), which are exactly what
   *  should survive as graphic shapes. */
  bgMinRegion: Number(args.bgMinRegion ?? 0.0015),
  /** Cuts inside the figure. Higher = more solid ink, less internal detail. */
  figureDetail: Number(args.figureDetail ?? 0.55),
  /** Thickness of the solid-ink rim held around the figure, as a fraction of
   *  output height. Anything bright on the figure — pale shoes, a light
   *  sleeve — is cut to sand, and a cut that reached the outline would open
   *  straight into the sand field, so the foot simply vanishes. A rim keeps
   *  the silhouette closed while the interior stays as detailed as it likes.
   *  It is measured in PIXELS rather than as a level on the smoothed mask,
   *  because a level erodes by an amount that scales with feature size — it
   *  swallows a shoe whole while barely touching a torso. */
  figureRim: Number(args.figureRim ?? 0.004),

  /** Encode losslessly (large files, exact flat colour). */
  lossless: flag(args.lossless),
  crf: Number(args.crf ?? 14),

  /** Report what the figure pass decided on the first frame. */
  debug: flag(args.debug),
  debugMask: flag(args.debugMask),
  preview: args.preview ? Number(args.preview) : null,
  start: args.start ? Number(args.start) : 0,
  fps: args.fps ? Number(args.fps) : null,
};

const OUT =
  args.out ||
  path.join(path.dirname(IN), `${path.basename(IN, path.extname(IN))}-loopsoul.mp4`);

/* ────────────────────────────── field maths ──────────────────────────── */

/** Separable box blur. Repeated passes approximate a gaussian closely enough,
 *  and this is O(n) regardless of radius. */
function blur(src, w, h, r) {
  if (r <= 0) return src;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const d = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / d;
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / d;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Bilinear upsample. Thresholding the RESULT is what puts an edge on a
 *  subpixel boundary instead of an analysis-res pixel boundary. */
function upsample(src, sw, sh, dw, dh) {
  if (sw === dw && sh === dh) return src;
  const out = new Float32Array(dw * dh);
  const fx = sw / dw;
  const fy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1.001, Math.max(0, (y + 0.5) * fy - 0.5));
    const y0 = sy | 0;
    const y1 = Math.min(sh - 1, y0 + 1);
    const wy = sy - y0;
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1.001, Math.max(0, (x + 0.5) * fx - 0.5));
      const x0 = sx | 0;
      const x1 = Math.min(sw - 1, x0 + 1);
      const wx = sx - x0;
      const a = src[y0 * sw + x0] * (1 - wx) + src[y0 * sw + x1] * wx;
      const b = src[y1 * sw + x0] * (1 - wx) + src[y1 * sw + x1] * wx;
      out[y * dw + x] = a * (1 - wy) + b * wy;
    }
  }
  return out;
}

/**
 * Absorb regions too small to be a real shape into whichever band surrounds
 * them. This is the difference between "graphic" and "dirty" — it removes
 * compression mush, sensor grain and the speckle low-light phone footage
 * leaves in the shadows.
 */
function despeckle(labels, w, h, minPx) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const region = new Int32Array(w * h);
  for (let start = 0; start < labels.length; start++) {
    if (seen[start]) continue;
    const band = labels[start];
    let sp = 0;
    let n = 0;
    stack[sp++] = start;
    seen[start] = 1;
    while (sp > 0) {
      const p = stack[--sp];
      region[n++] = p;
      const x = p % w;
      const y = (p / w) | 0;
      if (x > 0 && !seen[p - 1] && labels[p - 1] === band) { seen[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && !seen[p + 1] && labels[p + 1] === band) { seen[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && !seen[p - w] && labels[p - w] === band) { seen[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && !seen[p + w] && labels[p + w] === band) { seen[p + w] = 1; stack[sp++] = p + w; }
    }
    if (n >= minPx) continue;
    const votes = new Int32Array(BANDS.length);
    for (let i = 0; i < n; i++) {
      const p = region[i];
      const x = p % w;
      const y = (p / w) | 0;
      if (x > 0 && labels[p - 1] !== band) votes[labels[p - 1]]++;
      if (x < w - 1 && labels[p + 1] !== band) votes[labels[p + 1]]++;
      if (y > 0 && labels[p - w] !== band) votes[labels[p - w]]++;
      if (y < h - 1 && labels[p + w] !== band) votes[labels[p + w]]++;
    }
    let best = band;
    let bestVotes = -1;
    for (let b = 0; b < votes.length; b++) if (votes[b] > bestVotes) { bestVotes = votes[b]; best = b; }
    for (let i = 0; i < n; i++) labels[region[i]] = best;
  }
  return labels;
}

/**
 * Keep only mask blobs big enough to be a person, plus always the biggest one.
 *
 * Whatever the plate can't account for — a light shifting, a reflection, a
 * shadow the chroma test half-caught — arrives as small islands drifting near
 * the subject. They are the one thing that still reads as an artefact once the
 * background is stable, and they are trivially separable: a dancer is a couple
 * of large connected regions, never a scatter of little ones.
 */
function keepLargestBlobs(mask, w, h, minPx) {
  const n = w * h;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const members = new Int32Array(n);
  const drop = [];
  let biggest = -1;
  let biggestAt = -1;
  for (let start = 0; start < n; start++) {
    if (seen[start] || mask[start] < 0.5) continue;
    let sp = 0;
    let count = 0;
    stack[sp++] = start;
    seen[start] = 1;
    while (sp > 0) {
      const p = stack[--sp];
      members[count++] = p;
      const x = p % w;
      const y = (p / w) | 0;
      if (x > 0 && !seen[p - 1] && mask[p - 1] >= 0.5) { seen[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && !seen[p + 1] && mask[p + 1] >= 0.5) { seen[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && !seen[p - w] && mask[p - w] >= 0.5) { seen[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && !seen[p + w] && mask[p + w] >= 0.5) { seen[p + w] = 1; stack[sp++] = p + w; }
    }
    if (count > biggest) { biggest = count; biggestAt = start; }
    if (count < minPx) drop.push(members.slice(0, count));
  }
  for (const region of drop) {
    // Never drop the largest blob: on a frame where the subject is small or
    // partly out of shot, he could be under the threshold himself.
    if (region.length === biggest && region[0] === biggestAt) continue;
    for (let i = 0; i < region.length; i++) mask[region[i]] = 0;
  }
  return mask;
}

/**
 * Hysteresis: every confident pixel is in, and every faint pixel is in only if
 * a chain of faint pixels connects it back to a confident one. Borrowed from
 * edge detection, and it is what lets the threshold be strict enough to keep
 * the floor clean while still picking up a shoe that barely differs from it.
 */
function growFromSeeds(strong, weak, out, w, h) {
  const n = w * h;
  out.fill(0);
  const stack = new Int32Array(n);
  let sp = 0;
  for (let p = 0; p < n; p++) {
    if (strong[p] && !out[p]) { out[p] = 1; stack[sp++] = p; }
  }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0 && weak[p - 1] && !out[p - 1]) { out[p - 1] = 1; stack[sp++] = p - 1; }
    if (x < w - 1 && weak[p + 1] && !out[p + 1]) { out[p + 1] = 1; stack[sp++] = p + 1; }
    if (y > 0 && weak[p - w] && !out[p - w]) { out[p - w] = 1; stack[sp++] = p - w; }
    if (y < h - 1 && weak[p + w] && !out[p + w]) { out[p + w] = 1; stack[sp++] = p + w; }
  }
  return out;
}

/**
 * Morphological open: shrink the mask, then grow it back. Anything thinner
 * than the shrink disappears and never returns; anything thicker survives at
 * its original size.
 *
 * What this is for: a polished floor reflects the dancer, and a cast shadow
 * leaks a little wherever its colour wanders. Both arrive as thin horizontal
 * streaks pooling around his feet, and both are indistinguishable from him by
 * colour or brightness — but not by THICKNESS. A shoe is solid; a reflection
 * is a smear. Erode past the smear and it is simply gone.
 *
 * Done with blur-and-threshold rather than a true structuring element: on a
 * smooth field the level sets are the same shape, and it stays O(n).
 */
function openMask(mask, w, h, r) {
  if (r < 1) return mask;
  const eroded = blur(mask, w, h, r);
  for (let p = 0; p < mask.length; p++) mask[p] = eroded[p] >= 0.78 ? 1 : 0;
  const dilated = blur(mask, w, h, r);
  for (let p = 0; p < mask.length; p++) mask[p] = dilated[p] > 0.22 ? 1 : 0;
  return mask;
}

/** Quantize a luminance field into palette bands, auto-levelled against its
 *  own range so dim footage doesn't collapse into one flat colour. */
function quantize(field, bandCount) {
  let lo = 1;
  let hi = 0;
  for (let p = 0; p < field.length; p++) {
    if (field[p] < lo) lo = field[p];
    if (field[p] > hi) hi = field[p];
  }
  const span = Math.max(0.12, hi - lo);
  const labels = new Uint8Array(field.length);
  const k = Math.max(2, Math.min(BANDS.length, bandCount));
  for (let p = 0; p < field.length; p++) {
    const t = (field[p] - lo) / span;
    const band = Math.min(k - 1, Math.max(0, Math.round(t * (k - 1))));
    labels[p] = Math.round((band / (k - 1)) * (BANDS.length - 1));
  }
  return labels;
}

/* ──────────────────────────── ffmpeg plumbing ────────────────────────── */

function ffprobeValue(file, entries, stream) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffprobe", [
      "-v", "error",
      ...(stream ? ["-select_streams", stream] : []),
      "-show_entries", entries,
      "-of", "default=nw=1:nk=1", file,
    ]);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("error", reject);
    p.on("close", () => resolve(out.trim()));
  });
}

async function probe(file) {
  const v = await ffprobeValue(file, "stream=width,height,r_frame_rate", "v:0");
  const [w, h, rate] = v.split("\n");
  const [num, den] = rate.split("/").map(Number);
  const duration = Number(await ffprobeValue(file, "format=duration")) || 0;
  return { width: Number(w), height: Number(h), fps: num / (den || 1), duration };
}

/** Decode frames as raw RGBA at (w × h), handing each to `onFrame`. */
function decode(file, w, h, { seek = null, frames = null, duration = null, fps = null } = {}, onFrame) {
  return new Promise((resolve, reject) => {
    const vf = [fps ? `fps=${fps}` : null, `scale=${w}:${h}`].filter(Boolean).join(",");
    const proc = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error",
      ...(seek != null ? ["-ss", String(seek)] : []),
      "-i", file,
      ...(duration != null ? ["-t", String(duration)] : []),
      ...(frames != null ? ["-frames:v", String(frames)] : []),
      "-vf", vf,
      "-f", "rawvideo", "-pix_fmt", "rgba", "-",
    ]);
    const frameBytes = w * h * 4;
    const ctl = {
      pause: () => proc.stdout.pause(),
      resume: () => proc.stdout.resume(),
    };
    let carry = Buffer.alloc(0);
    proc.stderr.on("data", (d) => process.stderr.write(d));
    proc.stdout.on("data", (chunk) => {
      carry = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      while (carry.length >= frameBytes) {
        onFrame(carry.subarray(0, frameBytes), ctl);
        carry = carry.subarray(frameBytes);
      }
    });
    proc.on("error", reject);
    proc.on("close", resolve);
  });
}

/* ─────────────────────────── pass 1: the plate ───────────────────────── */

/**
 * The room with the dancer statistically removed: per pixel and per channel,
 * the median of samples taken evenly across the WHOLE clip.
 *
 * Sample count matters more than it looks. A dancer works a small patch of
 * floor, so at the centre of frame he is present in a large share of any
 * sample set — with too few samples the median there is *him*, the plate goes
 * dark, and every later frame reports the clean wall as "changed". That shows
 * up as a ghost blob hanging in the air exactly where he dances. Sampling
 * densely pushes his share back under half and the median returns to the wall.
 *
 * One decode pass with an `fps` filter is far cheaper than N seeks, so density
 * is nearly free.
 *
 * Density alone still isn't enough when someone works one spot for most of a
 * five-minute take, so the statistic is a PERCENTILE rather than a strict
 * median. A dancer is darker than a lit room, so reading a little bright of
 * centre steps over him without disturbing anything genuinely static: where
 * every sample agrees — a wall, a floor, a couch — every percentile returns
 * the same value. The bias only acts where there is disagreement, which is
 * exactly where he is.
 */
async function buildPlate(file, w, h, clipDuration) {
  const n = w * h;
  const target = OPTS.plateSamples;
  const samples = [];
  await decode(
    file, w, h,
    { fps: clipDuration > 0 ? target / clipDuration : 1 },
    (frame) => {
      const rgb = new Uint8Array(n * 3);
      for (let p = 0, i4 = 0; p < n; p++, i4 += 4) {
        rgb[p * 3] = frame[i4];
        rgb[p * 3 + 1] = frame[i4 + 1];
        rgb[p * 3 + 2] = frame[i4 + 2];
      }
      samples.push(rgb);
      if (samples.length % 10 === 0) {
        process.stdout.write(`\r  plate: ${samples.length} samples`);
      }
    },
  );
  process.stdout.write(`\r  plate: ${samples.length} samples\n`);
  if (!samples.length) throw new Error("could not sample any frames for the plate");

  const k = samples.length;
  const pick = Math.min(k - 1, Math.max(0, Math.round((k - 1) * OPTS.platePercentile)));
  const seedRGB = new Uint8Array(n * 3);
  const seedLum = new Float32Array(n);
  const scratch = new Uint8Array(k);
  for (let p = 0; p < n; p++) {
    for (let c = 0; c < 3; c++) {
      for (let s = 0; s < k; s++) scratch[s] = samples[s][p * 3 + c];
      scratch.sort();
      seedRGB[p * 3 + c] = scratch[pick];
    }
    seedLum[p] =
      (0.2126 * seedRGB[p * 3] + 0.7152 * seedRGB[p * 3 + 1] + 0.0722 * seedRGB[p * 3 + 2]) / 255;
  }

  // Second look. The percentile still leaves a faint ghost wherever someone
  // holds one spot for much of a take — a smudge of him hanging on the wall,
  // which then makes the real wall read as "changed" in every frame. So use
  // the rough plate to work out which samples had him in them AT THAT PIXEL,
  // throw those samples away, and take the median of what's left. Each pixel
  // ends up averaging only the moments the room was actually empty there.
  const tol = OPTS.subjectThreshold * 0.8;
  const minClean = Math.max(6, Math.round(k * 0.12));
  const plateRGB = new Uint8Array(n * 3);
  const plateLum = new Float32Array(n);
  const clean = new Uint8Array(k);
  const values = new Uint8Array(k);
  let rescued = 0;
  for (let p = 0; p < n; p++) {
    let count = 0;
    for (let s = 0; s < k; s++) {
      const px = samples[s];
      const lum =
        (0.2126 * px[p * 3] + 0.7152 * px[p * 3 + 1] + 0.0722 * px[p * 3 + 2]) / 255;
      if (Math.abs(lum - seedLum[p]) <= tol) clean[count++] = s;
    }
    if (count < minClean) {
      // Nothing agrees with the seed, so the seed was the outlier — a bright
      // shoe swinging over dark floor, say. Fall back to the plain median of
      // everything, which is right whenever the subject is the MINORITY at
      // this pixel (the common case away from where he plants his feet).
      for (let c = 0; c < 3; c++) {
        for (let s = 0; s < k; s++) values[s] = samples[s][p * 3 + c];
        values.sort();
        plateRGB[p * 3 + c] = values[k >> 1];
      }
    } else {
      if (count < k) rescued++;
      const mid = count >> 1;
      for (let c = 0; c < 3; c++) {
        for (let i = 0; i < count; i++) values[i] = samples[clean[i]][p * 3 + c];
        const slice = values.subarray(0, count);
        slice.sort();
        plateRGB[p * 3 + c] = slice[mid];
      }
    }
    plateLum[p] =
      (0.2126 * plateRGB[p * 3] + 0.7152 * plateRGB[p * 3 + 1] + 0.0722 * plateRGB[p * 3 + 2]) / 255;
  }
  console.log(`  plate: refined ${((rescued / n) * 100).toFixed(1)}% of pixels on the second pass`);
  return { lum: plateLum, rgb: plateRGB };
}

/** The plate depends only on the clip and the analysis size, so caching it
 *  makes look-tuning a seconds-long loop instead of a minutes-long one. */
async function getPlate(file, w, h, clipDuration) {
  const cache = OPTS.plateCache;
  if (cache && fs.existsSync(cache)) {
    const raw = fs.readFileSync(cache);
    if (raw.length === w * h * 3) {
      console.log(`  plate: reusing ${path.basename(cache)}`);
      const rgb = new Uint8Array(raw);
      const lum = new Float32Array(w * h);
      for (let p = 0; p < w * h; p++) {
        lum[p] = (0.2126 * rgb[p * 3] + 0.7152 * rgb[p * 3 + 1] + 0.0722 * rgb[p * 3 + 2]) / 255;
      }
      return { lum, rgb };
    }
    console.log("  plate: cache size mismatch, rebuilding");
  }
  const plate = await buildPlate(file, w, h, clipDuration);
  if (cache) {
    fs.mkdirSync(path.dirname(path.resolve(cache)), { recursive: true });
    fs.writeFileSync(cache, Buffer.from(plate.rgb));
  }
  return plate;
}

/* ──────────────────────────── pass 2: render ─────────────────────────── */

function makeSceneRenderer(plate, ww, wh, ow, oh) {
  const wn = ww * wh;
  const on = ow * oh;

  // The background, quantized ONCE — identical in every frame, so no boil.
  const plateSmooth = blur(blur(plate.lum, ww, wh, OPTS.smooth), ww, wh, OPTS.smooth);
  const plateLabels = despeckle(
    quantize(plateSmooth, OPTS.bands),
    ww, wh,
    Math.max(8, Math.round(wn * OPTS.bgMinRegion)),
  );
  // Carry it up as a continuous field then re-snap, so background shapes get
  // the same subpixel edges as the figure.
  const bgField = new Float32Array(wn);
  for (let p = 0; p < wn; p++) bgField[p] = plateLabels[p] / (BANDS.length - 1);
  const bgUp = upsample(bgField, ww, wh, ow, oh);
  const bgLabels = new Uint8Array(on);
  for (let p = 0; p < on; p++) bgLabels[p] = Math.round(bgUp[p] * (BANDS.length - 1));

  const strong = new Uint8Array(wn);
  const weak = new Uint8Array(wn);
  const maskField = new Float32Array(wn);
  const figField = new Float32Array(wn);
  const labels = new Uint8Array(on);
  const solid = new Float32Array(on);
  const out = Buffer.alloc(on * 3);
  let reported = false;

  return function render(rgba) {
    // How far each pixel has moved from the empty room — with cast shadow
    // rejected: a shadow scales luminance down while leaving hue alone, so a
    // pixel whose colour still matches the plate is floor, not dancer.
    for (let p = 0, i4 = 0; p < wn; p++, i4 += 4) {
      const r = rgba[i4], g = rgba[i4 + 1], b = rgba[i4 + 2];
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const pl = plate.lum[p];
      const pr = plate.rgb[p * 3], pg = plate.rgb[p * 3 + 1], pb = plate.rgb[p * 3 + 2];

      // Brightness alone misses anything that happens to sit at the room's own
      // tone — pale shoes on a pale floor is the case that started this, and
      // they vanished entirely. Colour catches those: normalised channel
      // ratios ignore how brightly lit a thing is and compare only what colour
      // it is. Only trusted where there is enough light to make the ratios
      // meaningful, since they get noisy as everything approaches black.
      const s = r + g + b + 1;
      const ps = pr + pg + pb + 1;
      const chroma =
        Math.abs(r / s - pr / ps) + Math.abs(g / s - pg / ps) + Math.abs(b / s - pb / ps);
      const litEnough = s > 90 && ps > 90;

      // A cast shadow dims the room without recolouring it, so "darker but
      // the same colour" is the signature that separates a shadow from a
      // person standing there.
      const ratio = lum / Math.max(0.02, pl);
      const shadow =
        lum < pl &&
        ratio > OPTS.shadowRatioMin &&
        ratio < OPTS.shadowRatioMax &&
        chroma < OPTS.shadowChroma;

      const isSubject =
        !shadow &&
        (Math.abs(lum - pl) > OPTS.subjectThreshold ||
          (litEnough && chroma > OPTS.colorThreshold));
      // Two thresholds, not one. Pale shoes on a pale floor barely register at
      // all — only their tread lines show — so a threshold tight enough to
      // keep the floor clean loses the feet, and one loose enough to catch
      // them fills the floor with speckle. But the shoes are ATTACHED to legs
      // that register strongly, so confident pixels seed the mask and faint
      // ones are only accepted where they connect back to something certain.
      // Isolated floor noise never connects, and the feet always do.
      strong[p] = isSubject ? 1 : 0;
      weak[p] =
        isSubject ||
        (!shadow &&
          (Math.abs(lum - pl) > OPTS.subjectThreshold * OPTS.subjectFloor ||
            (litEnough && chroma > OPTS.colorThreshold * OPTS.subjectFloor)))
          ? 1
          : 0;
      figField[p] = lum;
    }

    growFromSeeds(strong, weak, maskField, ww, wh);
    openMask(maskField, ww, wh, Math.round(wh * OPTS.maskOpen));
    keepLargestBlobs(maskField, ww, wh, Math.max(24, Math.round(wn * OPTS.maskMinRegion)));

    // Smoothing the binary mask and thresholding the smoothed field turns a
    // ragged per-pixel decision into a drawn line: nicks fill, specks
    // dissolve, and the boundary becomes a smooth curve.
    const maskUp = upsample(
      blur(blur(maskField, ww, wh, OPTS.maskSmooth), ww, wh, OPTS.maskSmooth),
      ww, wh, ow, oh,
    );
    const figUp = upsample(blur(figField, ww, wh, 1), ww, wh, ow, oh);

    // The ink rim, measured in output pixels: blur the hard silhouette and
    // read a level above 0.5, which sits a fixed distance inside the outline
    // regardless of how wide the limb is.
    for (let p = 0; p < on; p++) solid[p] = maskUp[p] >= 0.5 ? 1 : 0;
    const rim = blur(solid, ow, oh, Math.max(2, Math.round(oh * OPTS.figureRim)));

    // The figure's own tone range, so he reads as a figure and not a blob.
    let lo = 1;
    let hi = 0;
    let inside = 0;
    for (let p = 0; p < on; p++) {
      if (maskUp[p] < 0.5) continue;
      inside++;
      if (figUp[p] < lo) lo = figUp[p];
      if (figUp[p] > hi) hi = figUp[p];
    }
    const span = Math.max(0.1, hi - lo);
    const cut1 = lo + span * OPTS.figureDetail;
    const cut2 = lo + span * (OPTS.figureDetail + (1 - OPTS.figureDetail) * 0.55);

    for (let p = 0; p < on; p++) {
      if (inside > 0 && maskUp[p] >= 0.5) {
        const t = figUp[p];
        const interior = rim[p] >= 0.72;
        labels[p] = interior ? (t > cut2 ? 3 : t > cut1 ? 2 : 0) : 0;
      } else {
        labels[p] = bgLabels[p];
      }
    }
    despeckle(labels, ow, oh, Math.max(12, Math.round(on * OPTS.minRegion)));

    if (OPTS.debug && !reported) {
      reported = true;
      const tally = new Array(BANDS.length).fill(0);
      let interiorPx = 0;
      for (let p = 0; p < on; p++) {
        if (maskUp[p] >= 0.5) tally[labels[p]]++;
        if (maskUp[p] >= 0.5 && rim[p] >= 0.72) interiorPx++;
      }
      console.log(
        `\n  figure: ${inside} px, tone ${lo.toFixed(3)}–${hi.toFixed(3)}, ` +
          `cuts at ${cut1.toFixed(3)}/${cut2.toFixed(3)}, ` +
          `${interiorPx} px inside the rim (${((interiorPx / Math.max(1, inside)) * 100).toFixed(0)}%)`,
      );
      console.log(`  figure bands ink→bright: ${tally.join(" / ")}`);
    }

    if (OPTS.debugMask) {
      // Render the decision itself: white = figure, grey = inside the ink rim.
      for (let p = 0; p < on; p++) {
        const v = maskUp[p] >= 0.5 ? (rim[p] >= 0.72 ? 160 : 255) : 0;
        out[p * 3] = out[p * 3 + 1] = out[p * 3 + 2] = v;
      }
      return out;
    }

    for (let p = 0; p < on; p++) {
      const c = BANDS[labels[p]];
      out[p * 3] = c[0];
      out[p * 3 + 1] = c[1];
      out[p * 3 + 2] = c[2];
    }
    return out;
  };
}

/** Old-green footage → the house palette. The old render put the subject in
 *  near-black on a saturated green field, so keying on greenness separates
 *  field from figure, and the figure's luminance drives its internal shading. */
function makeRecolorRenderer(ow, oh) {
  const n = ow * oh;
  const out = Buffer.alloc(n * 3);
  return function render(rgba) {
    for (let p = 0, i4 = 0; p < n; p++, i4 += 4) {
      const r = rgba[i4], g = rgba[i4 + 1], b = rgba[i4 + 2];
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const c =
        g > 60 && g > r * 1.25 && g > b * 1.25
          ? (lum > 0.62 ? SAND_BRIGHT : SAND)
          : lum < 0.18 ? INK : lum < 0.34 ? INK_SOFT : lum < 0.55 ? SAND_DEEP : SAND;
      out[p * 3] = c[0];
      out[p * 3 + 1] = c[1];
      out[p * 3 + 2] = c[2];
    }
    return out;
  };
}

/** Single-pass quantization, for handheld footage where no plate is possible. */
function makeFlatRenderer(ww, wh, ow, oh) {
  const wn = ww * wh;
  const on = ow * oh;
  const lum = new Float32Array(wn);
  const field = new Float32Array(wn);
  const labels = new Uint8Array(on);
  const out = Buffer.alloc(on * 3);
  return function render(rgba) {
    for (let p = 0, i4 = 0; p < wn; p++, i4 += 4) {
      lum[p] = (0.2126 * rgba[i4] + 0.7152 * rgba[i4 + 1] + 0.0722 * rgba[i4 + 2]) / 255;
    }
    const work = quantize(blur(blur(lum, ww, wh, OPTS.smooth), ww, wh, OPTS.smooth), OPTS.bands);
    for (let p = 0; p < wn; p++) field[p] = work[p] / (BANDS.length - 1);
    const up = upsample(field, ww, wh, ow, oh);
    for (let p = 0; p < on; p++) labels[p] = Math.round(up[p] * (BANDS.length - 1));
    despeckle(labels, ow, oh, Math.max(12, Math.round(on * OPTS.minRegion)));
    for (let p = 0; p < on; p++) {
      const c = BANDS[labels[p]];
      out[p * 3] = c[0]; out[p * 3 + 1] = c[1]; out[p * 3 + 2] = c[2];
    }
    return out;
  };
}

/* ────────────────────────────────── run ──────────────────────────────── */

const meta = await probe(IN);
const outH = Math.round((OPTS.height ?? meta.height * OPTS.scale) / 2) * 2;
const outW = Math.round((meta.width / meta.height) * outH / 2) * 2;
const workH = Math.round(Math.min(OPTS.workHeight, outH) / 2) * 2;
const workW = Math.round((meta.width / meta.height) * workH / 2) * 2;
const fps = OPTS.fps ?? meta.fps;

console.log(`in   : ${path.basename(IN)}  ${meta.width}×${meta.height} @${meta.fps.toFixed(2)}  ${meta.duration.toFixed(0)}s`);
console.log(`out  : ${path.basename(OUT)}  ${outW}×${outH} @${fps.toFixed(2)}  ${OPTS.lossless ? "lossless" : `crf ${OPTS.crf}`}`);
console.log(`mode : ${OPTS.mode}${OPTS.mode === "scene" ? `  · analysis ${workW}×${workH} · ${OPTS.plateSamples} plate samples` : ""}`);

// Recolor reads the source at output res (it's a per-pixel remap, no analysis);
// the other modes analyse small and render big.
const readW = OPTS.mode === "recolor" ? outW : OPTS.mode === "flat" ? workW : workW;
const readH = OPTS.mode === "recolor" ? outH : OPTS.mode === "flat" ? workH : workH;

let render;
if (OPTS.mode === "recolor") {
  render = makeRecolorRenderer(outW, outH);
} else if (OPTS.mode === "flat") {
  render = makeFlatRenderer(workW, workH, outW, outH);
} else {
  // Sample the plate across the WHOLE clip even when rendering a short
  // preview — a 4-second window rarely holds enough movement to clear the
  // dancer out of the median.
  const plate = await getPlate(IN, workW, workH, meta.duration);
  render = makeSceneRenderer(plate, workW, workH, outW, outH);
}

fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
const enc = spawn("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${outW}x${outH}`, "-r", String(fps), "-i", "-",
  ...(OPTS.start ? ["-ss", String(OPTS.start)] : []),
  "-i", IN,
  ...(OPTS.preview ? ["-t", String(OPTS.preview)] : []),
  "-map", "0:v:0", "-map", "1:a:0?",
  "-c:v", "libx264", "-preset", OPTS.lossless ? "veryslow" : "slow",
  ...(OPTS.lossless
    ? ["-qp", "0", "-pix_fmt", "yuv444p"]
    : ["-crf", String(OPTS.crf), "-pix_fmt", "yuv420p"]),
  "-c:a", "aac", "-b:a", "192k", "-shortest",
  OUT,
]);
enc.stderr.on("data", (d) => process.stderr.write(d));

let frames = 0;
const t0 = Date.now();
await decode(
  IN,
  readW,
  readH,
  { seek: OPTS.start || null, duration: OPTS.preview, fps },
  (frame, ctl) => {
    // Copy: the renderer reuses one buffer, and a queued pipe write holds its
    // argument by reference — writing the live buffer tears frames together.
    if (!enc.stdin.write(Buffer.from(render(frame)))) {
      ctl.pause();
      enc.stdin.once("drain", ctl.resume);
    }
    frames++;
    if (frames % 30 === 0) {
      process.stdout.write(
        `\r  render: ${frames} frames · ${(frames / ((Date.now() - t0) / 1000)).toFixed(1)} fps  `,
      );
    }
  },
);
enc.stdin.end();
await new Promise((resolve) => enc.on("close", resolve));

console.log(
  `\ndone · ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s` +
    `\n→ ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`,
);
