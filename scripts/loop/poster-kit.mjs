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

/**
 * Rough advance-width estimate for a line of Avenir Next set in caps.
 *
 * SVG gives us no way to measure text before rasterising, and the ticket's
 * type is left-anchored against a hero that has to fit beside it — so a guess
 * that is never checked is exactly how the crowd ended up printed through the
 * slogan. This only has to be good enough to catch a collision: every caller
 * asserts the result against a real budget, and over-estimating is safe.
 */
const CAP_ADVANCE = { 500: 0.6, 600: 0.62, 700: 0.64 };
const estWidth = (text, size, { weight = 600, track = 0 } = {}) =>
  String(text).length * size * ((CAP_ADVANCE[weight] ?? 0.62) + track);

/** Refuse to render rather than ship an overlap — the kit's one hard rule. */
const assertFits = (what, needed, budget) => {
  if (needed > budget) {
    throw new Error(
      `${what} needs ${Math.round(needed)}px but only ${Math.round(budget)}px is free. ` +
        `Shrink the type or widen the column — do not let it overlap.`,
    );
  }
};

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
  const volY = headBottom + Math.round(250 * S);

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

/**
 * The ticket is three ZONES, not a set of percentages: an identity column on
 * the left, the crowd in the middle, and the tear-off stub on the right. The
 * middle is whatever is left over once the other two have been measured —
 * which is the whole point. The previous version pinned the crowd at 66% height
 * and x=30%, so at the crowd's 2.44:1 it rendered 1608px wide and printed
 * straight through both the slogan and the entire stub.
 */
async function ticket({ ev, out, W = 2550, H = 1000 }) {
  const S = W / 2550;
  const pad = Math.round(90 * S);
  const gutter = Math.round(70 * S);
  const wordmark = await inkSvg("loop-soul.svg");
  const odubo = await inkSvg("odubo.svg");
  const scotts = await inkSvg("scotts-bw.svg");
  const layers = [];

  // The stub edge is the fixed landmark; both other zones measure against it.
  const stubX = Math.round(W * 0.7);
  const mainInnerW = stubX - pad * 2;
  const mainCx = pad + mainInnerW / 2;

  /* ── zone 1: the main body, stacked in rows ──────────────────────────────
     Wordmark and credits take the two top corners, the slogan spans the full
     width between them, and the crowd gets every pixel that is left. Stacking
     rather than columning is what lets the hero be a hero: side by side, the
     slogan's width starved the crowd down to a footnote. */
  const labelSize = Math.round(16 * S);
  const labelTrack = 0.2;
  const wmW = Math.round(340 * S);
  const wmH = Math.round(wmW * wordmark.ratio);
  const wmTop = pad;

  const odW = Math.round(140 * S);
  const odH = Math.round(odW * odubo.ratio);
  const scW = Math.round(190 * S);
  const scH = Math.round(scW * scotts.ratio);
  // Each credit is a COLUMN as wide as the wider of its mark and its label —
  // the labels are longer than the logos they caption, so sizing the block off
  // the logos ran "PRESENTED BY" straight into "IN PARTNERSHIP WITH".
  const odLabel = "PRESENTED BY";
  const scLabel = "IN PARTNERSHIP WITH";
  const odColW = Math.max(odW, estWidth(odLabel, labelSize, { track: labelTrack }));
  const scColW = Math.max(scW, estWidth(scLabel, labelSize, { track: labelTrack }));
  const creditGap = Math.round(60 * S);
  const creditRowW = odColW + creditGap + scColW;
  const creditLeft = stubX - pad - creditRowW;
  const odCx = creditLeft + odColW / 2;
  const scCx = creditLeft + odColW + creditGap + scColW / 2;
  const creditLabelY = pad + Math.round(22 * S);
  const creditTop = creditLabelY + Math.round(18 * S);
  const creditRowH = Math.max(odH, scH);
  assertFits("ticket credit block", creditRowW, mainInnerW - wmW - Math.round(80 * S));

  const rowABottom = Math.max(wmTop + wmH, creditTop + creditRowH);

  const sloganSize = Math.round(116 * S);
  const triadSize = Math.round(30 * S);
  const sloganY = rowABottom + Math.round(120 * S);
  const triadY = sloganY + Math.round(58 * S);
  assertFits("ticket slogan", estWidth(BRAND.slogan, sloganSize, { weight: 700, track: 0.02 }), mainInnerW);
  assertFits("ticket triad", estWidth(BRAND.triad, triadSize, { weight: 600, track: 0.4 }), mainInnerW);

  /* ── zone 3: the stub, right ─────────────────────────────────────────── */
  const stubInnerW = W - stubX - pad * 2;
  const sx = stubX + (W - stubX) / 2;
  const volSize = Math.round(46 * S);
  const dateSize = Math.round(38 * S);
  const doorsSize = Math.round(29 * S);
  const venueSize = Math.round(23 * S);
  const admitsSize = Math.round(44 * S);
  const qrPx = Math.round(200 * S);
  const volText = `${ev.volume} · ${ev.theme}`;
  const dateText = ev.date.replace("SATURDAY ", "SAT ");

  assertFits("stub volume line", estWidth(volText, volSize, { weight: 700, track: 0.04 }), stubInnerW);
  assertFits("stub date line", estWidth(dateText, dateSize, { weight: 600, track: 0.08 }), stubInnerW);
  assertFits("stub venue line", estWidth(ev.venueShort, venueSize, { weight: 500, track: 0.1 }), stubInnerW);

  const volY = pad + volSize + Math.round(40 * S);
  const dateY = volY + Math.round(80 * S);
  const doorsY = dateY + Math.round(58 * S);
  const venueY = doorsY + Math.round(52 * S);
  const admitsY = venueY + Math.round(105 * S);
  const qrTop = admitsY + Math.round(40 * S);
  const scanY = qrTop + qrPx + Math.round(38 * S);
  assertFits("ticket stub", scanY, H - pad);

  /* ── zone 2: the crowd, everything left under the type ───────────────── */
  const heroTop = triadY + Math.round(50 * S);
  const heroMaxH = H - heroTop;
  const heroMaxW = mainInnerW;
  assertFits("ticket hero band", Math.round(300 * S), heroMaxH);

  const figBuf = await fs.readFile(path.join(ROOT, "public/loop/figures", FIGURES.crowd));
  const figMeta = await sharp(figBuf).metadata();
  const heroScale = Math.min(heroMaxW / figMeta.width, heroMaxH / figMeta.height);
  const heroW = Math.round(figMeta.width * heroScale);
  const heroH = Math.round(figMeta.height * heroScale);

  layers.push({
    input: await sharp(figBuf).resize({ width: heroW, height: heroH }).toBuffer(),
    // Stands on the bottom edge like a stage, centred in the main body.
    left: Math.round(mainCx - heroW / 2),
    top: H - heroH,
  });
  layers.push({
    input: await sharp(wordmark.buf, { density: 900 }).resize({ width: wmW }).png().toBuffer(),
    left: pad,
    top: wmTop,
  });
  layers.push({
    input: await qrPng(ev.url, qrPx),
    left: Math.round(sx - qrPx / 2),
    top: qrTop,
  });
  layers.push({
    input: await sharp(odubo.buf, { density: 900 }).resize({ width: odW }).png().toBuffer(),
    left: Math.round(odCx - odW / 2),
    top: creditTop + Math.round((creditRowH - odH) / 2),
  });
  layers.push({
    input: await sharp(scotts.buf, { density: 900 }).resize({ width: scW }).png().toBuffer(),
    left: Math.round(scCx - scW / 2),
    top: creditTop + Math.round((creditRowH - scH) / 2),
  });

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <line x1="${stubX}" y1="${Math.round(50 * S)}" x2="${stubX}" y2="${H - Math.round(50 * S)}" stroke="${BRAND.ink}" stroke-width="${Math.round(5 * S)}" stroke-dasharray="${Math.round(20 * S)} ${Math.round(24 * S)}" opacity="0.45"/>
    ${line(BRAND.slogan, { x: mainCx, y: sloganY, size: sloganSize, weight: 700, track: 0.02 })}
    ${line(BRAND.triad, { x: mainCx, y: triadY, size: triadSize, weight: 600, track: 0.4, opacity: 0.75 })}
    ${line(odLabel, { x: odCx, y: creditLabelY, size: labelSize, track: labelTrack, opacity: 0.55 })}
    ${line(scLabel, { x: scCx, y: creditLabelY, size: labelSize, track: labelTrack, opacity: 0.55 })}
    ${line(volText, { x: sx, y: volY, size: volSize, weight: 700, track: 0.04 })}
    ${line(dateText, { x: sx, y: dateY, size: dateSize, weight: 600, track: 0.08 })}
    ${line(ev.doors, { x: sx, y: doorsY, size: doorsSize, weight: 500, track: 0.12, opacity: 0.85 })}
    ${line(ev.venueShort, { x: sx, y: venueY, size: venueSize, weight: 500, track: 0.1, opacity: 0.75 })}
    ${line("ADMITS ONE", { x: sx, y: admitsY, size: admitsSize, weight: 700, track: 0.08 })}
    ${line("SCAN FOR YOUR CODE", { x: sx, y: scanY, size: labelSize, track: 0.16, opacity: 0.6 })}
  </svg>`;
  layers.push({ input: Buffer.from(svg), left: 0, top: 0 });

  const file = `loop-soul-v${args.volume ?? 1}-ticket.png`;
  await sharp({ create: { width: W, height: H, channels: 3, background: BRAND.sand } })
    .composite(layers)
    .png()
    .toFile(path.join(out, file));
  console.log("ticket →", file);
}

/**
 * The pass as a STORE PRODUCT IMAGE — square, because the store grid is
 * `aspect-square` (src/components/store/ProductBrowse.tsx). This is the pass's
 * shelf face in the Loop Soul store, so it carries no QR (the buyer is already
 * in the app) and no price — Shopify owns price and currency, and a baked-in
 * "$20" would go stale and would read wrong for anyone shopping outside CAD.
 */
async function passCard({ ev, out, W = 2000 }) {
  const H = W;
  const S = W / 2000;
  const pad = Math.round(150 * S);
  const wordmark = await inkSvg("loop-soul.svg");
  const layers = [];

  const wmW = Math.round(520 * S);
  const wmH = Math.round(wmW * wordmark.ratio);
  const wmTop = pad;

  const volSize = Math.round(46 * S);
  const volY = wmTop + wmH + Math.round(96 * S);

  // Bottom-anchored type, computed before the hero so the hero gets the rest.
  const admitsSize = Math.round(78 * S);
  const venueSize = Math.round(34 * S);
  const dateSize = Math.round(44 * S);
  const admitsY = H - pad;
  const venueY = admitsY - Math.round(96 * S);
  const dateY = venueY - Math.round(62 * S);

  const innerW = W - pad * 2;
  const dateText = `${ev.date.replace("SATURDAY ", "SAT ")} · ${ev.doors}`;
  assertFits("pass card date line", estWidth(dateText, dateSize, { weight: 600, track: 0.06 }), innerW);
  assertFits("pass card venue line", estWidth(ev.venueShort, venueSize, { weight: 500, track: 0.12 }), innerW);
  assertFits("pass card admits line", estWidth("ADMITS ONE", admitsSize, { weight: 700, track: 0.08 }), innerW);

  const heroTop = volY + Math.round(70 * S);
  const heroMaxH = dateY - dateSize - Math.round(90 * S) - heroTop;
  const heroMaxW = innerW;
  assertFits("pass card hero band", Math.round(420 * S), heroMaxH);

  const figBuf = await fs.readFile(path.join(ROOT, "public/loop/figures", FIGURES.crowd));
  const figMeta = await sharp(figBuf).metadata();
  const heroScale = Math.min(heroMaxW / figMeta.width, heroMaxH / figMeta.height);
  const heroW = Math.round(figMeta.width * heroScale);
  const heroH = Math.round(figMeta.height * heroScale);

  layers.push({
    input: await sharp(figBuf).resize({ width: heroW, height: heroH }).toBuffer(),
    left: Math.round(W / 2 - heroW / 2),
    top: Math.round(heroTop + (heroMaxH - heroH) / 2),
  });
  layers.push({
    input: await sharp(wordmark.buf, { density: 900 }).resize({ width: wmW }).png().toBuffer(),
    left: Math.round(W / 2 - wmW / 2),
    top: wmTop,
  });

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${line(`${ev.volume} · ${ev.theme}`, { x: W / 2, y: volY, size: volSize, weight: 600, track: 0.3, opacity: 0.85 })}
    ${line(dateText, { x: W / 2, y: dateY, size: dateSize, weight: 600, track: 0.06 })}
    ${line(ev.venueShort, { x: W / 2, y: venueY, size: venueSize, weight: 500, track: 0.12, opacity: 0.8 })}
    ${line("ADMITS ONE", { x: W / 2, y: admitsY, size: admitsSize, weight: 700, track: 0.08 })}
  </svg>`;
  layers.push({ input: Buffer.from(svg), left: 0, top: 0 });

  const file = `loop-soul-v${args.volume ?? 1}-pass-square.png`;
  await sharp({ create: { width: W, height: H, channels: 3, background: BRAND.sand } })
    .composite(layers)
    .png()
    .toFile(path.join(out, file));
  console.log("pass card →", file);
}

/* ──────────────────────────────────── run ───────────────────────────────── */

const ev = VOLUMES[args.volume ?? 1];
if (!ev) throw new Error(`no config for volume ${args.volume}`);
const out =
  args.out || "/Users/maniodubo/Documents/Loop-soul-the-entertainment-room/print-2026-08";
const figures = String(args.figures || "crowd,dance,spin").split(",");
const sizes = String(args.sizes || "print,story").split(",");

const pieces = String(args.pieces || "posters,ticket,pass").split(",");

await fs.mkdir(out, { recursive: true });
if (pieces.includes("posters")) {
  for (const figure of figures) {
    if (!FIGURES[figure]) throw new Error(`unknown figure "${figure}"`);
    for (const size of sizes) await poster({ ev, figure, size, out });
  }
}
if (pieces.includes("ticket")) await ticket({ ev, out });
if (pieces.includes("pass")) await passCard({ ev, out });
console.log("\nout:", out);
