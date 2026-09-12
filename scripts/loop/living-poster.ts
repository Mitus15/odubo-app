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
 * hero band, cut to a seamless loop for Reels.
 *
 *   npx tsx scripts/loop/living-poster.ts --in=clip.mp4 --url=https://…
 *   npx tsx scripts/loop/living-poster.ts --plate=already-sand.mp4   # skip recolour
 *   npx tsx scripts/loop/living-poster.ts --in=clip.mp4 --seconds=12 --start=96
 *
 * It is one piece of artwork, not a video with a logo on it. The furniture
 * comes from the SAME layout engine that prints the flyer — so the reel and
 * the sheet on the wall carry the same date, the same marks, the same air —
 * and the footage supplies the hero the engine would otherwise fill with a
 * silhouette. `figureSrc: null` was already the engine's way of leaving that
 * hole; this fills it with 24 frames a second.
 *
 * Why it composites rather than draws: the converter's palette and the brand's
 * are the same two values (SAND #d9aa7a, INK #2a0f0a), so the video's field IS
 * the poster's field. There is no seam to hide.
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
function bestWindow(probe: Probe, seconds: number): Window {
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

  let best: Window | null = null;
  let bestScore = Infinity;
  for (let s = 0; s + span + 1 < frames.length; s++) {
    let ok = true;
    for (let i = s; i <= s + span && ok; i++) if (!present[i]) ok = false;
    if (!ok) continue;

    const match = differs(frames[s], frames[s + span + 1]);
    let energy = 0;
    for (let i = s; i < s + span; i++) energy += differs(frames[i], frames[i + 1]);
    energy /= span;

    // Match is the constraint, energy the tiebreak: a seam the eye catches
    // ruins the piece, whereas slightly calmer dancing only makes it quieter.
    const score = match - energy * 0.35;
    if (score < bestScore) {
      bestScore = score;
      best = { start: s / fps, seconds, match, energy };
    }
  }
  if (!best) throw new Error(`no ${seconds}s stretch of this take has the figure in frame`);
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

  /* 1. Where to cut. */
  console.log(`\nreading the take…`);
  const probe = await probeFrames(srcPath);
  const explicitStart = str("start") ? Number(str("start")) : null;
  const win =
    explicitStart != null
      ? { start: explicitStart, seconds, match: NaN, energy: NaN }
      : bestWindow(probe, seconds);
  console.log(
    `cut  : ${win.start.toFixed(2)}s → ${(win.start + seconds).toFixed(2)}s` +
      (Number.isNaN(win.match)
        ? "  (start given)"
        : `  · loop seam ${(win.match * 100).toFixed(1)}% of silhouette` +
          `  · motion ${(win.energy * 100).toFixed(1)}%/frame`),
  );

  /* 2. The plate: sand field, ink figure, nothing else on it. */
  const plate = path.join(outDir, `${stem}-plate.mp4`);
  if (str("plate")) {
    console.log(`\nplate: trimming ${path.basename(srcPath)} (already graded)`);
    await run(
      FFMPEG,
      // prettier-ignore
      ["-v", "error", "-ss", String(win.start), "-t", String(seconds), "-i", srcPath,
       "-an", "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`,
       "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", plate, "-y"],
      "ffmpeg (trim)",
    );
  } else {
    console.log(`\nplate: recolouring ${seconds}s of ${path.basename(srcPath)} → sand/ink`);
    await run(
      process.execPath,
      // prettier-ignore
      ["--max-old-space-size=8192", "scripts/loop/video-convert.mjs",
       `--in=${srcPath}`, `--mode=recolor`, `--start=${win.start}`, `--preview=${seconds}`,
       `--height=${H}`, `--crf=12`, `--out=${plate}`],
      "video-convert",
    );
  }

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

  /* 5. Composite: sheet, then dancer, then type. */
  const out = path.join(outDir, `${stem}.mp4`);
  const keepAudio = flag("keepAudio");
  await run(
    FFMPEG,
    // prettier-ignore
    ["-v", "error", "-stats",
     "-i", plate, "-i", overlay,
     "-filter_complex",
     `color=c=${SAND}:s=${W}x${H}:r=24[sheet];` +
     `[0:v]scale=${vidW}:${vidH}[fig];` +
     `[sheet][fig]overlay=${offX}:${offY}:shortest=1[bed];` +
     `[bed][1:v]overlay=0:0:format=auto,format=yuv420p[v]`,
     "-map", "[v]",
     ...(keepAudio ? ["-map", "0:a?", "-c:a", "aac", "-b:a", "160k"] : ["-an"]),
     "-c:v", "libx264", "-preset", "slow", "-crf", "18",
     "-profile:v", "high", "-level", "4.1",
     // Reels wants a keyframe it can loop on and a browser-safe pixel format.
     "-g", "48", "-movflags", "+faststart",
     out, "-y"],
    "ffmpeg (composite)",
  );

  const bytes = Number(
    await capture(FFPROBE, [
      "-v", "error", "-show_entries", "format=size",
      "-of", "default=nw=1:nk=1", out,
    ]),
  );
  console.log(`\nout  : ${out}`);
  console.log(`       ${W}×${H} · ${seconds}s · ${(bytes / 1e6).toFixed(1)} MB` +
    (keepAudio ? " · audio kept" : " · silent"));
  if (!keepAudio) {
    console.log(
      `\nSilent on purpose: the take's own audio is the record playing in the\n` +
        `room, and a copyright claim mutes or blocks the post — which is the\n` +
        `whole promotion. Add the single in the Reels editor, or pass --keepAudio.`,
    );
  }
}

main().catch((e) => {
  console.error(String((e as Error).message ?? e));
  process.exit(1);
});
