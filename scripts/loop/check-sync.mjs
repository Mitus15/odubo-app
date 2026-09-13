/**
 * Prove a finished reel's music was lifted from the position it claims.
 *
 *   node scripts/loop/check-sync.mjs \
 *     --file=reel.mp4 --reference=mani-billie-jean-4.mov --expect=228.750
 *
 * The living poster takes its picture from one file and its sound from
 * another, so "did the sync survive" has to be answered about the FINISHED
 * file. This answers the half that can actually go wrong.
 *
 * WHAT IT DOES NOT DO, and why. The obvious check — correlate the music's
 * onsets against the dancer's movement and see whether they line up — was
 * tried first and does not work. On this material the two correlate at about
 * 0.03, which is noise, and the lag it reports swings by hundreds of
 * milliseconds between cuts that are provably aligned identically. It looked
 * authoritative and was worthless, which is worse than no check. A dancer does
 * not move in step with onsets: he anticipates, holds, and the silhouette
 * changes fastest BETWEEN poses rather than on them.
 *
 * So the problem is split in two, and each half gets a check that works:
 *
 *   1. Is the picture-to-sound offset right?  →  scripts/loop/align-takes.mjs,
 *      which correlates two renders of the same performance on PICTURE, gets
 *      confidences over 100x, and now reports the offset at five points down
 *      the take so a creeping rate difference cannot hide.
 *   2. Did this render actually trim the music where it meant to?  →  here.
 *
 * Together those cover it: a correct offset, correctly applied. This half is
 * the one that breaks silently when a start time is recomputed, rounded, or
 * passed through the wrong variable.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const FFMPEG = "/opt/homebrew/bin/ffmpeg";
const HOP_HZ = 200; // 5ms hops — the resolution of the answer
const AUDIO_HZ = 22050;

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

/**
 * Onset envelope, not the waveform.
 *
 * The reel's audio has been trimmed, loudness-normalised and re-encoded to
 * AAC, so it is not sample-identical to the reference even though it is the
 * same master. Transient POSITIONS survive all of that; sample values do not.
 */
async function onsets(src, start, dur) {
  const raw = path.join(os.tmpdir(), `checksync-${process.pid}-${Math.random()}.pcm`);
  await run(FFMPEG, [
    "-v", "error",
    ...(start != null ? ["-ss", String(start)] : []),
    "-i", src,
    ...(dur != null ? ["-t", String(dur)] : []),
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
  // Standardise so loudnorm's gain change cannot affect the correlation.
  let m = 0;
  for (const x of env) m += x;
  m /= env.length;
  let sd = 0;
  for (const x of env) sd += (x - m) ** 2;
  sd = Math.sqrt(sd / env.length) || 1;
  for (let i = 0; i < env.length; i++) env[i] = (env[i] - m) / sd;
  return env;
}

const file = path.resolve(args.file);
const ref = path.resolve(args.reference);
const expect = Number(args.expect);
if (!Number.isFinite(expect)) {
  console.error("need --expect=<seconds into the reference the cut should start>");
  process.exit(2);
}
const search = Number(args.search ?? 3); // seconds either side

const a = await onsets(file, null, null);
const b = await onsets(ref, Math.max(0, expect - search), a.length / HOP_HZ + search * 2);

let best = -Infinity;
let bestShift = 0;
const scores = [];
const maxShift = Math.round(search * 2 * HOP_HZ);
for (let shift = 0; shift <= maxShift; shift++) {
  let acc = 0;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    const j = i + shift;
    if (j >= b.length) break;
    acc += a[i] * b[j];
    n++;
  }
  if (n < a.length * 0.8) break;
  const score = acc / n;
  scores.push(score);
  if (score > best) { best = score; bestShift = shift; }
}
const mean = scores.reduce((x, y) => x + y, 0) / scores.length;
const sd = Math.sqrt(scores.reduce((x, y) => x + (y - mean) ** 2, 0) / scores.length) || 1e-9;
const sigma = (best - mean) / sd;

const found = Math.max(0, expect - search) + bestShift / HOP_HZ;
const err = found - expect;

console.log(`reel      ${path.basename(file)}  ${(a.length / HOP_HZ).toFixed(2)}s`);
console.log(`reference ${path.basename(ref)}`);
console.log(`\nexpected  the music to start ${expect.toFixed(3)}s into the reference`);
console.log(`found     it at ${found.toFixed(3)}s   (peak ${sigma.toFixed(1)}σ above the search mean)`);
console.log(`error     ${(err * 1000).toFixed(0)}ms`);

if (sigma < 6) {
  console.log(`\nINCONCLUSIVE — no dominant peak, so this number means nothing.`);
  process.exit(2);
}
const ok = Math.abs(err) <= 0.02;
console.log(ok ? `\nPASS — the music was lifted from where it claims` : `\nFAIL — the trim landed in the wrong place`);
process.exit(ok ? 0 : 1);
