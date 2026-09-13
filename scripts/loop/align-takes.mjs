/**
 * Line two renders of the same performance up against each other.
 *
 *   node scripts/loop/align-takes.mjs --a=plate.mp4 --b=reference.mov
 *
 * Why this exists: the clean logo-free green render carries a music dub that
 * DRIFTS against its own picture, while `mani-billie-jean-4.mov` — which has
 * the marks burned in and so is useless as a plate — is correctly in sync. So
 * the music has to be lifted from one file and laid against another, and that
 * needs the offset between their timelines.
 *
 * It aligns on PICTURE, not audio. Correlating a phone room mic against a
 * studio master means correlating two very different timbres; correlating two
 * renders of the same dancer means correlating the same shape. The signal is a
 * per-frame silhouette signature — area, centroid, extent — which is cheap,
 * discriminative for dance, and immune to the fact that one file is 2160×3840
 * and the other 1080×1920.
 *
 * It reports the offset AND whether the two files run at the same rate: a
 * constant offset can be fixed with a seek, a rate difference cannot, and a
 * rate difference is the likeliest explanation of the original drift.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const FFMPEG = "/opt/homebrew/bin/ffmpeg";
const FFPROBE = "/opt/homebrew/bin/ffprobe";

const W = 96;
const H = 171;
const FPS = 6;

/** The marks are burned into the reference near the top and bottom. Correlate
 *  only the band the dancer lives in, so a logo cannot vote. */
const BAND_TOP = 0.18;
const BAND_BOTTOM = 0.78;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

function run(cmd, argv) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ["ignore", "ignore", "inherit"] });
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} exited ${c}`))));
  });
}

function capture(cmd, argv) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("error", reject);
    p.on("close", () => resolve(out.trim()));
  });
}

/**
 * Five numbers per frame that describe where the dancer is and how big he is.
 *
 * Deliberately not the raw mask: a 1-D signature per channel turns the search
 * from ~10^10 byte comparisons into ~10^6 float ones, and a dancer's area and
 * centroid over time are already distinctive enough that the minimum is sharp.
 */
async function signature(src, label, { fps = FPS, start = null, duration = null } = {}) {
  const raw = path.join(os.tmpdir(), `align-${label}-${process.pid}.gray`);
  await run(FFMPEG, [
    "-v", "error",
    ...(start != null ? ["-ss", String(start)] : []),
    "-i", src,
    ...(duration != null ? ["-t", String(duration)] : []),
    "-vf", `fps=${fps},scale=${W}:${H},format=gray`,
    "-f", "rawvideo", "-pix_fmt", "gray", raw, "-y",
  ]);
  const buf = await fs.readFile(raw);
  await fs.rm(raw, { force: true });

  const y0 = Math.round(H * BAND_TOP);
  const y1 = Math.round(H * BAND_BOTTOM);
  const size = W * H;
  const rows = [];
  for (let i = 0; i + size <= buf.length; i += size) {
    let n = 0, sx = 0, sy = 0, top = -1, bot = -1;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < W; x++) {
        // Ink is dark in both the green look and the sand one.
        if (buf[i + y * W + x] >= 96) continue;
        n++; sx += x; sy += y;
        if (top < 0) top = y;
        bot = y;
      }
    }
    rows.push(
      n === 0
        ? [0, 0, 0, 0, 0]
        : [n / (W * (y1 - y0)), sx / n / W, sy / n / H, top / H, bot / H],
    );
  }
  return rows;
}

/** Zero-mean, unit-variance per channel, so area and centroid weigh the same. */
function standardise(rows) {
  const k = rows[0].length;
  for (let c = 0; c < k; c++) {
    let m = 0;
    for (const r of rows) m += r[c];
    m /= rows.length;
    let v = 0;
    for (const r of rows) v += (r[c] - m) ** 2;
    const sd = Math.sqrt(v / rows.length) || 1;
    for (const r of rows) r[c] = (r[c] - m) / sd;
  }
  return rows;
}

/** Mean squared distance between A and B when B is shifted by `shift` frames,
 *  over whatever range of A the caller asks for. Lower is better. */
function distanceAt(a, b, shift, from, to) {
  let sum = 0, n = 0;
  for (let i = from; i < to; i++) {
    const j = i + shift;
    if (j < 0 || j >= b.length) continue;
    for (let c = 0; c < a[i].length; c++) sum += (a[i][c] - b[j][c]) ** 2;
    n++;
  }
  return n < 30 ? Infinity : sum / n;
}

function searchOffset(a, b, from, to, maxShift) {
  let best = Infinity, bestShift = 0;
  const all = [];
  for (let s = -maxShift; s <= maxShift; s++) {
    const d = distanceAt(a, b, s, from, to);
    if (!Number.isFinite(d)) continue;
    all.push(d);
    if (d < best) { best = d; bestShift = s; }
  }
  const mean = all.reduce((x, y) => x + y, 0) / all.length;
  return { shift: bestShift, distance: best, mean, ratio: mean / best };
}

async function main() {
  const A = path.resolve(args.a);
  const B = path.resolve(args.b);
  const durA = Number(await capture(FFPROBE, ["-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",A]));
  const durB = Number(await capture(FFPROBE, ["-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",B]));
  console.log(`A (plate)     ${path.basename(A)}  ${durA.toFixed(3)}s`);
  console.log(`B (reference) ${path.basename(B)}  ${durB.toFixed(3)}s\n`);

  const [a, b] = await Promise.all([signature(A, "a"), signature(B, "b")]);
  standardise(a);
  standardise(b);
  console.log(`signatures: A ${a.length} frames · B ${b.length} frames @${FPS}fps\n`);

  const maxShift = Math.round(60 * FPS); // ±60s is far more than any plausible trim
  const whole = searchOffset(a, b, 0, a.length, maxShift);
  console.log(`OFFSET  B is ${(whole.shift / FPS).toFixed(3)}s from A  (${whole.shift} probe frames)`);
  console.log(`        confidence ${whole.ratio.toFixed(2)}× (mean distance / best distance)`);
  console.log(`        ${whole.ratio >= 2 ? "PASS — the minimum is clearly dominant" : "FAIL — no dominant minimum, do not trust this"}\n`);

  // A constant offset can be fixed with a seek. A RATE difference cannot, and
  // is the likeliest explanation of a dub that drifts against its own picture.
  const third = Math.floor(a.length / 3);
  const head = searchOffset(a, b, 0, third, maxShift);
  const tail = searchOffset(a, b, a.length - third, a.length, maxShift);
  const driftFrames = tail.shift - head.shift;
  const spanSec = (a.length - third - third / 2) / FPS;
  console.log(`DRIFT   head ${(head.shift / FPS).toFixed(3)}s (${head.ratio.toFixed(1)}×) · tail ${(tail.shift / FPS).toFixed(3)}s (${tail.ratio.toFixed(1)}×)`);
  console.log(`        difference ${(driftFrames / FPS).toFixed(3)}s over ~${spanSec.toFixed(0)}s`);
  if (Math.abs(driftFrames) <= 1) {
    console.log(`        PASS — same rate, a constant seek is enough`);
  } else {
    const rate = 1 + driftFrames / FPS / spanSec;
    console.log(`        RATE DIFFERENCE — B runs at ~${rate.toFixed(5)}× A. A seek alone will not hold sync.`);
  }

  // The coarse pass resolves to 1/6 s, which is 6% of a beat at 117bpm — you
  // would hear that, and worse, a drift check at that resolution can hide up
  // to ±83ms of real rate difference per third. So refine at 30fps, and do it
  // at SEVERAL points down the take rather than one: a constant offset can be
  // fixed with a seek, a creeping one cannot, and the difference between them
  // is invisible at coarse resolution.
  const FINE = 30;
  const FINE_SPAN = 40;
  const coarse = whole.shift / FPS;
  console.log(`\nFINE    ${FINE_SPAN}s windows at ${FINE}fps, ±1s around the coarse answer\n`);

  const probes = [0.10, 0.30, 0.50, 0.70, 0.88]
    .map((f) => Math.max(0, Math.min(durA - FINE_SPAN - 1, durA * f)));
  const found = [];
  for (const aStart of probes) {
    const bStart = Math.max(0, aStart + coarse - 1);
    const [fa, fb] = await Promise.all([
      signature(A, "fa", { fps: FINE, start: aStart, duration: FINE_SPAN }),
      signature(B, "fb", { fps: FINE, start: bStart, duration: FINE_SPAN + 2 }),
    ]);
    standardise(fa);
    standardise(fb);
    // fb[0] is at bStart, fa[0] at aStart, so a shift of s frames means
    // b_time - a_time = (bStart - aStart) + s/FINE.
    const fine = searchOffset(fa, fb, 0, fa.length, FINE);
    const offset = bStart - aStart + fine.shift / FINE;
    found.push({ at: aStart, offset, ratio: fine.ratio });
    console.log(
      `        A t=${aStart.toFixed(0).padStart(3)}s → offset ${offset.toFixed(3)}s ` +
        `(confidence ${fine.ratio.toFixed(1)}×)`,
    );
  }

  const trusted = found.filter((f) => f.ratio >= 5);
  if (!trusted.length) {
    console.log(`\n        no window correlated strongly enough to trust. Do not use this.`);
    return;
  }
  const offsets = trusted.map((f) => f.offset);
  const spread = Math.max(...offsets) - Math.min(...offsets);
  const median = [...offsets].sort((a, b) => a - b)[Math.floor(offsets.length / 2)];
  console.log(`\n        median ${median.toFixed(3)}s · spread ${(spread * 1000).toFixed(0)}ms ` +
    `across ${trusted.length} trusted window${trusted.length === 1 ? "" : "s"}`);
  if (spread <= 0.04) {
    console.log(`        PASS — constant offset, a single seek holds for the whole take`);
  } else {
    const first = trusted[0];
    const last = trusted[trusted.length - 1];
    const rate = 1 + (last.offset - first.offset) / (last.at - first.at);
    console.log(`        DRIFT — the offset moves ${(spread * 1000).toFixed(0)}ms across the take.`);
    console.log(`        B runs at ~${rate.toFixed(6)}× A. One seek cannot hold sync;`);
    console.log(`        each cut needs its own offset, or B needs resampling.`);
  }
  console.log(`\n=>      music for plate time t  =  ${path.basename(B)} at  t + (${median.toFixed(3)})`);
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
