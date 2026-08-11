/**
 * Loop Soul print artwork — posters and the ticket/wristband.
 *
 *   cd <repo root with node_modules> && node scripts/loop/print-artwork.mjs [outDir]
 *
 * Renders with sharp + SVG (no browser), so the same files can be regenerated
 * exactly whenever the date, price or theme changes.
 *
 * Brand rules encoded here:
 *  · Slogan: WHAT WE DANCIN' TO — no closing punctuation. Said aloud it is
 *    also "what we dance into", and it reads as question and statement at
 *    once. The ambiguity IS the brand line.
 *  · Catchphrase (spoken, not set on the artwork): "That's how we do it."
 *  · Triad: MUSIC · MODE · MOVEMENT.
 *  · ONE typographic voice: the loop∞Soul wordmark SVG is the only script on
 *    the piece; everything else is a single grotesque, tracked. (Two cursives
 *    fought each other in the old drafts.)
 *  · Credits: PRESENTED BY → Odubo; IN PARTNERSHIP WITH → Scott's, in the
 *    black mark only — never the colour logo.
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT =
  process.argv[2] ||
  "/Users/maniodubo/Documents/Loop-soul-the-entertainment-room/print-2026-08";

const SAND = "#d9aa7a";
const INK = "#2a0f0a";
const SANS = "Futura";
const SANS_HEAVY = "Futura"; // ExtraBold weight is selected by font-weight

const EVENT = {
  volume: "VOLUME 1",
  theme: "1984",
  slogan: "WHAT WE DANCIN' TO",
  triad: "MUSIC · MODE · MOVEMENT",
  date: "SATURDAY SEPTEMBER 12 · DOORS 9PM",
  dateShort: "SATURDAY SEPT 12",
  venue: "SCOTT'S INN & SUITES · KAMLOOPS",
  venueShort: "SCOTT'S INN, KAMLOOPS",
  passes: "75 PASSES · $20",
};

const inkSvg = async (file) => {
  let s = await fs.readFile(path.join(ROOT, "public/loop/branding", file), "utf8");
  const vb = s.match(/viewBox="([\d.\s-]+)"/)?.[1].split(/\s+/).map(Number);
  const [, , vw, vh] = vb ?? [0, 0, 300, 150];
  s = s.replace(/fill:\s*#[0-9a-fA-F]{3,6}/g, `fill:${INK}`);
  s = s.replace(/<svg/, `<svg fill="${INK}" width="${vw}" height="${vh}"`);
  return { buf: Buffer.from(s), ratio: vh / vw };
};

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Text on a downward arc, one glyph at a time (no textPath dependency). */
function arcText(text, { cx, cy, rx, ry, size, spread = 50, weight = 700, color = INK }) {
  const chars = [...text];
  const step = (spread * 2) / Math.max(1, chars.length - 1);
  return chars
    .map((ch, i) => {
      const deg = -spread + step * i;
      const a = (deg * Math.PI) / 180;
      const x = cx + Math.sin(a) * rx;
      const y = cy - Math.cos(a) * ry;
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${(deg * 0.9).toFixed(2)} ${x.toFixed(1)} ${y.toFixed(1)})" font-family="${SANS}" font-weight="${weight}" font-size="${size}" fill="${color}" text-anchor="middle">${esc(ch)}</text>`;
    })
    .join("");
}

const T = (text, { x, y, size, weight = 700, anchor = "middle", track = 0, opacity = 1, color = INK }) =>
  `<text x="${x}" y="${y}" font-family="${SANS}" font-weight="${weight}" font-size="${size}" fill="${color}"${track ? ` letter-spacing="${(size * track).toFixed(1)}"` : ""} text-anchor="${anchor}" opacity="${opacity}">${esc(text)}</text>`;

async function poster({ figure, file, W = 2400, H = 3300 }) {
  const wordmark = await inkSvg("loop-soul.svg");
  const odubo = await inkSvg("odubo.svg");
  const scotts = await inkSvg("scotts-bw.svg");
  const layers = [];

  // Vertical grid, computed then asserted — the first drafts collided.
  const wmW = Math.round(W * 0.30);
  const wmH = Math.round(wmW * wordmark.ratio);
  const wmTop = Math.round(H * 0.045);
  const volY = wmTop + wmH + Math.round(H * 0.045);
  const themeY = volY + Math.round(H * 0.070);
  const arcCy = themeY + Math.round(H * 0.098);
  const figTop = arcCy + Math.round(H * 0.030);
  const figH = Math.round(H * 0.310);
  const figBottom = figTop + figH;

  const triadY = figBottom + Math.round(H * 0.038);
  const dateY = triadY + Math.round(H * 0.036);
  const venueY = dateY + Math.round(H * 0.026);
  const passY = venueY + Math.round(H * 0.024);

  const labelY = passY + Math.round(H * 0.030);
  const markTop = labelY + Math.round(H * 0.008);
  const odW = Math.round(W * 0.115);
  const odH = Math.round(odW * odubo.ratio);
  const scW = Math.round(W * 0.155);
  const scH = Math.round(scW * scotts.ratio);
  const rowH = Math.max(odH, scH);
  if (markTop + rowH > H - 20) throw new Error(`layout overflows: ${markTop + rowH} > ${H}`);

  const figBuf = await fs.readFile(path.join(ROOT, "public/loop/figures", figure));
  const figMeta = await sharp(figBuf).metadata();
  const figW = Math.round((figMeta.width / figMeta.height) * figH);
  layers.push({
    input: await sharp(figBuf).resize({ height: figH }).toBuffer(),
    left: Math.round(W / 2 - figW / 2),
    top: figTop,
  });
  layers.push({
    input: await sharp(wordmark.buf, { density: 900 }).resize({ width: wmW }).png().toBuffer(),
    left: Math.round(W / 2 - wmW / 2),
    top: wmTop,
  });
  layers.push({
    input: await sharp(odubo.buf, { density: 900 }).resize({ width: odW }).png().toBuffer(),
    left: Math.round(W * 0.33 - odW / 2),
    top: markTop + Math.round((rowH - odH) / 2),
  });
  layers.push({
    input: await sharp(scotts.buf, { density: 900 }).resize({ width: scW }).png().toBuffer(),
    left: Math.round(W * 0.67 - scW / 2),
    top: markTop + Math.round((rowH - scH) / 2),
  });

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${T(EVENT.volume, { x: W / 2, y: volY, size: Math.round(W * 0.024), track: 0.32, opacity: 0.75 })}
    ${T(EVENT.theme, { x: W / 2, y: themeY, size: Math.round(W * 0.115), weight: 900, track: 0.02 })}
    ${arcText(EVENT.slogan, { cx: W / 2, cy: arcCy, rx: W * 0.40, ry: H * 0.046, size: Math.round(W * 0.055), spread: 44 })}
    ${T(EVENT.triad, { x: W / 2, y: triadY, size: Math.round(W * 0.022), track: 0.42, opacity: 0.9 })}
    ${T(EVENT.date, { x: W / 2, y: dateY, size: Math.round(W * 0.027), track: 0.08 })}
    ${T(EVENT.venue, { x: W / 2, y: venueY, size: Math.round(W * 0.020), track: 0.10, opacity: 0.8 })}
    ${T(EVENT.passes, { x: W / 2, y: passY, size: Math.round(W * 0.018), track: 0.14, opacity: 0.7 })}
    ${T("PRESENTED BY", { x: W * 0.33, y: labelY, size: Math.round(W * 0.0125), track: 0.3, opacity: 0.6 })}
    ${T("IN PARTNERSHIP WITH", { x: W * 0.67, y: labelY, size: Math.round(W * 0.0125), track: 0.3, opacity: 0.6 })}
  </svg>`;
  layers.push({ input: Buffer.from(svg), left: 0, top: 0 });

  await sharp({ create: { width: W, height: H, channels: 3, background: SAND } })
    .composite(layers)
    .png()
    .toFile(path.join(OUT, file));
  console.log("poster →", file);
}

async function ticket({ file, W = 2550, H = 1000 }) {
  const wordmark = await inkSvg("loop-soul.svg");
  const odubo = await inkSvg("odubo.svg");
  const scotts = await inkSvg("scotts-bw.svg");
  const layers = [];
  const stubX = Math.round(W * 0.72);

  const wmW = Math.round(W * 0.135);
  layers.push({
    input: await sharp(wordmark.buf, { density: 900 }).resize({ width: wmW }).png().toBuffer(),
    left: Math.round(W * 0.035),
    top: Math.round(H * 0.10),
  });

  const figBuf = await fs.readFile(path.join(ROOT, "public/loop/figures/dance.png"));
  const figMeta = await sharp(figBuf).metadata();
  const figH = Math.round(H * 0.80);
  layers.push({
    input: await sharp(figBuf).resize({ height: figH }).toBuffer(),
    left: Math.round(W * 0.335),
    top: Math.round(H * 0.13),
  });

  const odW = Math.round(W * 0.052);
  const odH = Math.round(odW * odubo.ratio);
  const scW = Math.round(W * 0.075);
  const scH = Math.round(scW * scotts.ratio);
  const markTop = Math.round(H * 0.70);
  layers.push({
    input: await sharp(odubo.buf, { density: 900 }).resize({ width: odW }).png().toBuffer(),
    left: Math.round(W * 0.035),
    top: markTop,
  });
  layers.push({
    input: await sharp(scotts.buf, { density: 900 }).resize({ width: scW }).png().toBuffer(),
    left: Math.round(W * 0.205),
    top: markTop + Math.round((odH - scH) / 2),
  });

  const sx = stubX + (W - stubX) / 2;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <line x1="${stubX}" y1="46" x2="${stubX}" y2="${H - 46}" stroke="${INK}" stroke-width="5" stroke-dasharray="20 24" opacity="0.5"/>
    ${T(EVENT.slogan, { x: W * 0.035, y: H * 0.545, size: Math.round(H * 0.052), track: 0.10, anchor: "start" })}
    ${T(EVENT.triad, { x: W * 0.035, y: H * 0.615, size: Math.round(H * 0.022), track: 0.26, anchor: "start", opacity: 0.8 })}
    ${T("PRESENTED BY", { x: W * 0.035, y: H * 0.675, size: Math.round(H * 0.019), track: 0.28, anchor: "start", opacity: 0.6 })}
    ${T("IN PARTNERSHIP WITH", { x: W * 0.205, y: H * 0.675, size: Math.round(H * 0.019), track: 0.28, anchor: "start", opacity: 0.6 })}
    ${T(`${EVENT.volume} · ${EVENT.theme}`, { x: sx, y: H * 0.235, size: Math.round(H * 0.058), weight: 900 })}
    ${T(EVENT.dateShort, { x: sx, y: H * 0.355, size: Math.round(H * 0.036), track: 0.08 })}
    ${T("DOORS 9PM", { x: sx, y: H * 0.445, size: Math.round(H * 0.030), track: 0.10, opacity: 0.85 })}
    ${T(EVENT.venueShort, { x: sx, y: H * 0.535, size: Math.round(H * 0.022), track: 0.08, opacity: 0.75 })}
    ${T("ADMITS ONE", { x: sx, y: H * 0.675, size: Math.round(H * 0.040), weight: 900, track: 0.06 })}
    ${T("YOUR EVENT CODE COMES BY EMAIL", { x: sx, y: H * 0.775, size: Math.round(H * 0.017), track: 0.06, opacity: 0.6 })}
  </svg>`;
  layers.push({ input: Buffer.from(svg), left: 0, top: 0 });

  await sharp({ create: { width: W, height: H, channels: 3, background: SAND } })
    .composite(layers)
    .png()
    .toFile(path.join(OUT, file));
  console.log("ticket →", file);
}

await fs.mkdir(OUT, { recursive: true });
await poster({ figure: "dance.png", file: "loop-soul-vol1-poster-dance.png" });
await poster({ figure: "spin.png", file: "loop-soul-vol1-poster-spin.png" });
await poster({ figure: "listen.png", file: "loop-soul-vol1-poster-listen.png" });
await ticket({ file: "loop-soul-vol1-ticket.png" });
console.log("OUT:", OUT);
