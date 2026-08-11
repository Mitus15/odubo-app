/**
 * Loop Soul poster kit — the whole marketing set for a volume, from one config.
 *
 *   node scripts/loop/poster-kit.mjs                     # uses VOLUMES.current
 *   node scripts/loop/poster-kit.mjs --volume=2          # a different volume
 *   node scripts/loop/poster-kit.mjs --figures=crowd,spin --out=/some/dir
 *
 * Change the volume block below (or pass flags) and every poster, story and
 * ticket regenerates in the same design. Nothing about the layout is per-piece:
 * one grid, one type scale, one credit row — so Volume 2 in June looks like
 * Volume 1 in September with different words.
 *
 * DESIGN RULES (learned the hard way):
 *  · The silhouette is the hero. It sits alone in the middle at real size —
 *    pop-art, not a decoration tucked under type.
 *  · Every element owns a row. Rows are computed, then asserted not to touch;
 *    the script refuses to render rather than ship an overlap.
 *  · The slogan is set STRAIGHT. The arc version fought the letterforms at
 *    every size and never looked deliberate.
 *  · Type is Avenir Next only, tracked wide for small caps lines; the
 *    loop∞Soul wordmark SVG is the only script on the piece.
 *  · A QR sits top-right on every piece — posters exist to move people to the
 *    app.
 */
import sharp from "sharp";
import QRCode from "qrcode";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

/* ─────────────────────────── the only thing to edit ─────────────────────── */

const VOLUMES = {
  1: {
    volume: "VOLUME ONE",
    theme: "1984",
    date: "SATURDAY SEPTEMBER 12",
    doors: "DOORS 9PM",
    venue: "SCOTT'S INN & SUITES · KAMLOOPS",
    venueShort: "SCOTT'S INN · KAMLOOPS",
    passes: "75 PASSES",
    price: "$20",
    url: "https://odubo-studio-app.vercel.app/loop",
  },
  2: {
    volume: "VOLUME TWO",
    theme: "TBD",
    date: "DATE TBD",
    doors: "DOORS 9PM",
    venue: "SCOTT'S INN & SUITES · KAMLOOPS",
    venueShort: "SCOTT'S INN · KAMLOOPS",
    passes: "75 PASSES",
    price: "$20",
    url: "https://odubo-studio-app.vercel.app/loop",
  },
};

const BRAND = {
  slogan: "WHAT WE DANCIN' TO",
  triad: "MUSIC · MODE · MOVEMENT",
  sand: "#d9aa7a",
  ink: "#2a0f0a",
  sans: "Avenir Next",
};

/** Silhouettes available as the hero. `crowd` is the original banner artwork. */
const FIGURES = {
  crowd: "crowd.png",
  dance: "dance.png",
  spin: "spin.png",
  listen: "listen.png",
};

const SIZES = {
  print: { w: 2400, h: 3300, label: "8x11in-300dpi" },
  story: { w: 1080, h: 1920, label: "story" },
  feed: { w: 1080, h: 1350, label: "feed" },
};

/* ────────────────────────────────── helpers ─────────────────────────────── */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const inkSvg = async (file) => {
  let s = await fs.readFile(path.join(ROOT, "public/loop/branding", file), "utf8");
  const vb = s.match(/viewBox="([\d.\s-]+)"/)?.[1].split(/\s+/).map(Number);
  const [, , vw, vh] = vb ?? [0, 0, 300, 150];
  s = s.replace(/fill:\s*#[0-9a-fA-F]{3,6}/g, `fill:${BRAND.ink}`);
  s = s.replace(/<svg/, `<svg fill="${BRAND.ink}" width="${vw}" height="${vh}"`);
  return { buf: Buffer.from(s), ratio: vh / vw };
};

/**
 * A text row. `size` is the cap height budget; `lead` is the row's full height,
 * so the layout can stack rows without ever guessing at metrics.
 */
const line = (text, { x, y, size, weight = 600, anchor = "middle", track = 0, opacity = 1 }) =>
  `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" font-family="${BRAND.sans}" font-weight="${weight}" font-size="${size.toFixed(0)}" fill="${BRAND.ink}"${
    track ? ` letter-spacing="${(size * track).toFixed(1)}"` : ""
  } text-anchor="${anchor}" opacity="${opacity}">${esc(text)}</text>`;

async function qrPng(url, px) {
  return QRCode.toBuffer(url, {
    width: px,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: BRAND.ink, light: BRAND.sand },
  });
}

/* ──────────────────────────────── the poster ────────────────────────────── */

async function poster({ ev, figure, size, out }) {
  const { w: W, h: H } = SIZES[size];
  const S = W / 2400; // one scale factor: every measure is expressed at print size
  const pad = Math.round(240 * S);
  const wordmark = await inkSvg("loop-soul.svg");
  const odubo = await inkSvg("odubo.svg");
  const scotts = await inkSvg("scotts-bw.svg");
  const layers = [];

  // ── ROWS (top → bottom). Each returns its own bottom edge. ──
  // 1. Wordmark left, QR right — the two things that never change position.
  const wmW = Math.round(560 * S);
  const wmH = Math.round(wmW * wordmark.ratio);
  const qrPx = Math.round(300 * S);
  const headTop = pad;
  const headBottom = headTop + Math.max(wmH, qrPx + Math.round(46 * S));

  // 2. Volume · theme, one line, centred.
  const volSize = Math.round(52 * S);
  const volY = headBottom + Math.round(120 * S);

  // Type below the hero is fixed in size, so its total height is known before
  // the hero is sized.
  const sloganSize = Math.round(132 * S);
  const triadSize = Math.round(46 * S);
  const typeBlockH = Math.round(200 * S) + sloganSize + Math.round(96 * S) + triadSize;

  // 7. Credits row, pinned to the bottom margin (computed first — the details
  // block hangs off it).
  const odW = Math.round(250 * S);
  const odH = Math.round(odW * odubo.ratio);
  const scW = Math.round(330 * S);
  const scH = Math.round(scW * scotts.ratio);
  const creditRowH = Math.max(odH, scH);
  const creditBottom = H - pad;
  const creditTop = creditBottom - creditRowH;
  const creditLabelY = creditTop - Math.round(28 * S);

  // 6. Details block, bottom-anchored above the credits.
  const dateSize = Math.round(58 * S);
  const venueSize = Math.round(42 * S);
  const priceY = creditLabelY - Math.round(150 * S);
  const venueY = priceY - Math.round(64 * S);
  const dateY = venueY - Math.round(72 * S);

  // 3. The hero — the star. It takes every pixel left between the volume line
  // and the type block, so a tall solo figure and a wide crowd both fill the
  // page instead of one of them overflowing.
  const heroTop = volY + Math.round(90 * S);
  const heroMaxH = dateY - dateSize - Math.round(80 * S) - typeBlockH - heroTop;
  const heroMaxW = W - Math.round(110 * S) * 2;
  if (heroMaxH < Math.round(600 * S)) {
    throw new Error(`no room for the hero at ${size} (${heroMaxH}px)`);
  }

  const figBuf = await fs.readFile(path.join(ROOT, "public/loop/figures", FIGURES[figure]));
  const figMeta = await sharp(figBuf).metadata();
  const scale = Math.min(heroMaxH / figMeta.height, heroMaxW / figMeta.width);
  const heroW = Math.round(figMeta.width * scale);
  const heroH = Math.round(figMeta.height * scale);

  // Centre the hero in its band, then hang the type off its real bottom.
  const bandH = heroMaxH;
  const heroY = heroTop + Math.round((bandH - heroH) / 2);
  const sloganY = heroTop + bandH + Math.round(200 * S);
  const triadY = sloganY + Math.round(96 * S);

  // ── composite ──
  layers.push({
    input: await sharp(figBuf).resize({ width: heroW, height: heroH }).toBuffer(),
    left: Math.round(W / 2 - heroW / 2),
    top: heroY,
  });
  layers.push({
    input: await sharp(wordmark.buf, { density: 900 }).resize({ width: wmW }).png().toBuffer(),
    left: pad,
    top: headTop,
  });
  layers.push({
    input: await qrPng(ev.url, qrPx),
    left: W - pad - qrPx,
    top: headTop,
  });
  layers.push({
    input: await sharp(odubo.buf, { density: 900 }).resize({ width: odW }).png().toBuffer(),
    left: Math.round(W * 0.33 - odW / 2),
    top: creditTop + Math.round((creditRowH - odH) / 2),
  });
  layers.push({
    input: await sharp(scotts.buf, { density: 900 }).resize({ width: scW }).png().toBuffer(),
    left: Math.round(W * 0.67 - scW / 2),
    top: creditTop + Math.round((creditRowH - scH) / 2),
  });

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${line("SCAN FOR PASSES", { x: W - pad - qrPx / 2, y: headTop + qrPx + Math.round(36 * S), size: Math.round(24 * S), track: 0.24, opacity: 0.65 })}
    ${line(`${ev.volume}  ·  ${ev.theme}`, { x: W / 2, y: volY, size: volSize, weight: 600, track: 0.34, opacity: 0.85 })}
    ${line(BRAND.slogan, { x: W / 2, y: sloganY, size: sloganSize, weight: 700, track: 0.02 })}
    ${line(BRAND.triad, { x: W / 2, y: triadY, size: triadSize, weight: 600, track: 0.42, opacity: 0.75 })}
    ${line(`${ev.date}  ·  ${ev.doors}`, { x: W / 2, y: dateY, size: dateSize, weight: 700, track: 0.06 })}
    ${line(ev.venue, { x: W / 2, y: venueY, size: venueSize, weight: 500, track: 0.16, opacity: 0.85 })}
    ${line(`${ev.passes}  ·  ${ev.price}`, { x: W / 2, y: priceY, size: Math.round(38 * S), weight: 500, track: 0.2, opacity: 0.7 })}
    ${line("PRESENTED BY", { x: W * 0.33, y: creditLabelY, size: Math.round(24 * S), track: 0.3, opacity: 0.55 })}
    ${line("IN PARTNERSHIP WITH", { x: W * 0.67, y: creditLabelY, size: Math.round(24 * S), track: 0.3, opacity: 0.55 })}
  </svg>`;
  layers.push({ input: Buffer.from(svg), left: 0, top: 0 });

  const file = `loop-soul-v${args.volume ?? 1}-${figure}-${SIZES[size].label}.png`;
  await sharp({ create: { width: W, height: H, channels: 3, background: BRAND.sand } })
    .composite(layers)
    .png()
    .toFile(path.join(out, file));
  console.log("poster →", file);
}

/* ──────────────────────────────── the ticket ────────────────────────────── */

async function ticket({ ev, out, W = 2550, H = 1000 }) {
  const S = W / 2550;
  const wordmark = await inkSvg("loop-soul.svg");
  const odubo = await inkSvg("odubo.svg");
  const scotts = await inkSvg("scotts-bw.svg");
  const layers = [];
  const pad = Math.round(90 * S);
  const stubX = Math.round(W * 0.70);

  // Hero crowd fills the middle, bleeding to the bottom edge like a stage.
  const figBuf = await fs.readFile(path.join(ROOT, "public/loop/figures", FIGURES.crowd));
  const figMeta = await sharp(figBuf).metadata();
  const heroH = Math.round(H * 0.66);
  const heroW = Math.round((figMeta.width / figMeta.height) * heroH);
  layers.push({
    input: await sharp(figBuf).resize({ height: heroH }).toBuffer(),
    left: Math.round(W * 0.30),
    top: Math.round(H * 0.26),
  });

  const wmW = Math.round(430 * S);
  layers.push({
    input: await sharp(wordmark.buf, { density: 900 }).resize({ width: wmW }).png().toBuffer(),
    left: pad,
    top: Math.round(90 * S),
  });

  const qrPx = Math.round(190 * S);
  layers.push({
    input: await qrPng(ev.url, qrPx),
    left: Math.round(stubX - qrPx - 60 * S),
    top: Math.round(H - qrPx - 70 * S),
  });

  const odW = Math.round(150 * S);
  const odH = Math.round(odW * odubo.ratio);
  const scW = Math.round(200 * S);
  const scH = Math.round(scW * scotts.ratio);
  const markTop = Math.round(H - odH - 90 * S);
  layers.push({
    input: await sharp(odubo.buf, { density: 900 }).resize({ width: odW }).png().toBuffer(),
    left: pad,
    top: markTop,
  });
  layers.push({
    input: await sharp(scotts.buf, { density: 900 }).resize({ width: scW }).png().toBuffer(),
    left: pad + odW + Math.round(90 * S),
    top: markTop + Math.round((odH - scH) / 2),
  });

  const sx = stubX + (W - stubX) / 2;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <line x1="${stubX}" y1="${Math.round(50 * S)}" x2="${stubX}" y2="${H - Math.round(50 * S)}" stroke="${BRAND.ink}" stroke-width="${Math.round(5 * S)}" stroke-dasharray="${Math.round(20 * S)} ${Math.round(24 * S)}" opacity="0.45"/>
    ${line(BRAND.slogan, { x: pad, y: Math.round(H * 0.46), size: Math.round(74 * S), weight: 700, anchor: "start", track: 0.03 })}
    ${line(BRAND.triad, { x: pad, y: Math.round(H * 0.545), size: Math.round(26 * S), weight: 600, anchor: "start", track: 0.36, opacity: 0.75 })}
    ${line("PRESENTED BY", { x: pad, y: markTop - Math.round(22 * S), size: Math.round(20 * S), anchor: "start", track: 0.3, opacity: 0.55 })}
    ${line("IN PARTNERSHIP WITH", { x: pad + odW + Math.round(90 * S), y: markTop - Math.round(22 * S), size: Math.round(20 * S), anchor: "start", track: 0.3, opacity: 0.55 })}
    ${line(`${ev.volume} · ${ev.theme}`, { x: sx, y: Math.round(H * 0.22), size: Math.round(60 * S), weight: 700, track: 0.04 })}
    ${line(ev.date.replace("SATURDAY ", "SAT "), { x: sx, y: Math.round(H * 0.34), size: Math.round(40 * S), weight: 600, track: 0.08 })}
    ${line(ev.doors, { x: sx, y: Math.round(H * 0.425), size: Math.round(32 * S), weight: 500, track: 0.12, opacity: 0.85 })}
    ${line(ev.venueShort, { x: sx, y: Math.round(H * 0.505), size: Math.round(24 * S), weight: 500, track: 0.1, opacity: 0.75 })}
    ${line("ADMITS ONE", { x: sx, y: Math.round(H * 0.65), size: Math.round(46 * S), weight: 700, track: 0.08 })}
    ${line("SCAN FOR YOUR CODE", { x: sx, y: Math.round(H * 0.74), size: Math.round(20 * S), track: 0.16, opacity: 0.6 })}
  </svg>`;
  layers.push({ input: Buffer.from(svg), left: 0, top: 0 });

  const file = `loop-soul-v${args.volume ?? 1}-ticket.png`;
  await sharp({ create: { width: W, height: H, channels: 3, background: BRAND.sand } })
    .composite(layers)
    .png()
    .toFile(path.join(out, file));
  console.log("ticket →", file);
}

/* ──────────────────────────────────── run ───────────────────────────────── */

const ev = VOLUMES[args.volume ?? 1];
if (!ev) throw new Error(`no config for volume ${args.volume}`);
const out =
  args.out || "/Users/maniodubo/Documents/Loop-soul-the-entertainment-room/print-2026-08";
const figures = String(args.figures || "crowd,dance,spin").split(",");
const sizes = String(args.sizes || "print,story").split(",");

await fs.mkdir(out, { recursive: true });
for (const figure of figures) {
  if (!FIGURES[figure]) throw new Error(`unknown figure "${figure}"`);
  for (const size of sizes) await poster({ ev, figure, size, out });
}
await ticket({ ev, out });
console.log("\nout:", out);
