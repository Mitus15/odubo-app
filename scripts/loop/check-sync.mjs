/**
 * Does the music in this file land on the dancer's movement?
 *
 *   node scripts/loop/check-sync.mjs --file=reel.mp4 --reference=known-good.mov
 *
 * The living poster takes its picture from one file and its sound from
 * another, so "did the sync survive" is a question that has to be answered
 * about the FINISHED file, not about the inputs. A drift of 50ms is audible
 * on a dance clip and invisible in every other check in the pipeline.
 *
 * How it answers it: build two envelopes from the same file — where the music
 * has its onsets, and where the body changes shape fastest — and cross
 * correlate them. The lag between them is not zero and is not supposed to be
 * (a dancer anticipates a beat, and a silhouette changes fastest between
 * poses, not on them), so the number is meaningless on its own. It is only
 * meaningful against a reference the owner has confirmed is in sync: if the
 * finished reel shows the same lag as that reference, the relationship
 * between sound and movement was preserved.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const FFMPEG = "/opt/homebrew/bin/ffmpeg";
const HOP_HZ = 100;
const AUDIO_HZ = 22050;
const PROBE_W = 96;
const PROBE_H = 171;

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

async function audioOnsets(src, start, dur) {
  const raw = path.join(os.tmpdir(), `sync-a-${process.pid}.pcm`);
  await run(FFMPEG, [
    "-v", "error", ...(start ? ["-ss", String(start)] : []), "-i", src,
    ...(dur ? ["-t", String(dur)] : []),
    "-vn", "-ac", "1", "-ar", String(AUDIO_HZ), "-f", "s16le", raw, "-y",
  ]);
  const buf = await fs.readFile(raw);
  await fs.rm(raw, { force: true });
  const s = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
  const hop = Math.round(AUDIO_HZ / HOP_HZ);
  const hops = Math.floor(s.length / hop);
  const rms = new Float64Array(hops);
  for (let h = 0; h < hops; h++) {
    let acc = 0;
    for (let i = h * hop; i < (h + 1) * hop; i++) acc += s[i] * s[i];
    rms[h] = Math.sqrt(acc / hop);
  }
  const env = new Float64Array(hops);
  for (let h = 1; h < hops; h++) env[h] = Math.max(0, rms[h] - rms[h - 1]);
  return env;
}

/** How fast the silhouette is changing, resampled onto the audio hop grid. */
async function motionEnvelope(src, start, dur) {
  const raw = path.join(os.tmpdir(), `sync-v-${process.pid}.gray`);
  await run(FFMPEG, [
    "-v", "error", ...(start ? ["-ss", String(start)] : []), "-i", src,
    ...(dur ? ["-t", String(dur)] : []),
    "-vf", `fps=${HOP_HZ / 2},scale=${PROBE_W}:${PROBE_H},format=gray`,
    "-f", "rawvideo", "-pix_fmt", "gray", raw, "-y",
  ]);
  const buf = await fs.readFile(raw);
  await fs.rm(raw, { force: true });
  const size = PROBE_W * PROBE_H;
  const masks = [];
  for (let i = 0; i + size <= buf.length; i += size) {
    const f = new Uint8Array(size);
    for (let p = 0; p < size; p++) f[p] = buf[i + p] < 96 ? 1 : 0;
    masks.push(f);
  }
  // One value per video frame, then repeated to reach the audio hop rate.
  const perFrame = new Float64Array(masks.length);
  for (let i = 1; i < masks.length; i++) {
    let d = 0;
    for (let p = 0; p < size; p++) if (masks[i][p] !== masks[i - 1][p]) d++;
    perFrame[i] = d / size;
  }
  const env = new Float64Array(perFrame.length * 2);
  for (let i = 0; i < env.length; i++) env[i] = perFrame[i >> 1];
  return env;
}

function standardise(v) {
  let m = 0;
  for (const x of v) m += x;
  m /= v.length;
  let s = 0;
  for (const x of v) s += (x - m) ** 2;
  s = Math.sqrt(s / v.length) || 1;
  const out = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = (v[i] - m) / s;
  return out;
}

/** Lag, in seconds, at which motion best explains the audio. */
function bestLag(a, b, maxHops) {
  const n = Math.min(a.length, b.length);
  let best = -Infinity, bestLag = 0;
  for (let lag = -maxHops; lag <= maxHops; lag++) {
    let acc = 0, count = 0;
    for (let i = 0; i < n; i++) {
      const j = i + lag;
      if (j < 0 || j >= n) continue;
      acc += a[i] * b[j];
      count++;
    }
    const score = acc / count;
    if (score > best) { best = score; bestLag = lag; }
  }
  return { lag: bestLag / HOP_HZ, score: best };
}

async function measure(file, start, dur, label) {
  const [au, mo] = await Promise.all([
    audioOnsets(file, start, dur),
    motionEnvelope(file, start, dur),
  ]);
  const r = bestLag(standardise(au), standardise(mo), HOP_HZ); // ±1s
  console.log(`${label.padEnd(26)} lag ${(r.lag * 1000).toFixed(0).padStart(5)}ms   (corr ${r.score.toFixed(3)})`);
  return r.lag;
}

const file = path.resolve(args.file);
const ref = args.reference ? path.resolve(args.reference) : null;
const refStart = args.refStart ? Number(args.refStart) : 0;
const refDur = args.refDur ? Number(args.refDur) : 60;

console.log("Lag between the music's onsets and the body's movement.\n");
const mine = await measure(file, null, null, path.basename(file));
if (ref) {
  const theirs = await measure(ref, refStart, refDur, `${path.basename(ref)} (reference)`);
  const drift = Math.abs(mine - theirs);
  console.log(`\ndrift against reference: ${(drift * 1000).toFixed(0)}ms`);
  console.log(drift <= 0.05 ? "PASS — sync preserved" : "FAIL — the music has moved against the picture");
  process.exit(drift <= 0.05 ? 0 : 1);
}
