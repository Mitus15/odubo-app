import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  layoutEventPoster,
  layoutTicket,
  layoutPassCard,
  withBleed,
  qrSrc,
  WORDMARK_SRC,
  ODUBO_SRC,
  SCOTTS_SRC,
  POSTER_SIZES,
  type EventDetails,
  type PosterSize,
  type LayoutResult,
} from "../../src/lib/loop/poster/layout";
import { prepareSharp, renderSharp, assertFontResolves } from "./poster-render-sharp";

/**
 * Loop Soul poster kit — the whole marketing set for a volume, from one config.
 *
 *   npx tsx scripts/loop/poster-kit.ts                    # uses volume 1
 *   npx tsx scripts/loop/poster-kit.ts --volume=2
 *   npx tsx scripts/loop/poster-kit.ts --figures=crowd,spin --sizes=print,story
 *   npx tsx scripts/loop/poster-kit.ts --pieces=posters,ticket,pass --bleed
 *   npx tsx scripts/loop/poster-kit.ts --slogan="…"       # one-off override
 *
 * The kit no longer owns any layout: every piece is laid out by the shared
 * engine (src/lib/loop/poster/layout.ts) — the same maths the in-app Poster
 * Studio renders — and rasterised by scripts/loop/poster-render-sharp.ts in
 * the committed brand face. What the studio previews is what this prints.
 */

/* ─────────────────────────── the only thing to edit ─────────────────────── */

const VOLUMES: Record<string, EventDetails & { venueShort: string; url: string }> = {
  1: {
    volume: "VOLUME ONE",
    theme: "1984",
    date: "SATURDAY SEPTEMBER 12",
    doors: "DOORS 9PM",
    venue: "SCOTT'S INN & SUITES · KAMLOOPS",
    venueShort: "SCOTT'S INN · KAMLOOPS",
    passes: "60 PASSES",
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
    passes: "60 PASSES",
    price: "$20",
    url: "https://odubo-studio-app.vercel.app/loop",
  },
};

/** Silhouettes available as the hero. `crowd` is the original banner artwork. */
const FIGURES: Record<string, string> = {
  crowd: "/loop/figures/crowd.png",
  dance: "/loop/figures/dance.png",
  spin: "/loop/figures/spin.png",
  listen: "/loop/figures/listen.png",
};

const FILE_LABELS: Record<PosterSize, string> = {
  print: "8x11in-300dpi",
  story: "story",
  feed: "feed",
};

/* ────────────────────────────────── run ─────────────────────────────────── */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true] as const;
  }),
) as Record<string, string | true>;

function unwrap(what: string, result: LayoutResult) {
  if (!result.ok) throw new Error(`${what}: ${result.error}`);
  return result.list;
}

async function main() {
  // Refuse to render a single pixel in a substitute typeface.
  await assertFontResolves();

  const volume = String(args.volume ?? "1");
  const ev = VOLUMES[volume];
  if (!ev) throw new Error(`no config for volume ${volume}`);
  const slogan = typeof args.slogan === "string" ? args.slogan : undefined;

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const out =
    typeof args.out === "string"
      ? args.out
      : path.join(process.env.HOME ?? HERE, "Documents/Loop-soul-the-entertainment-room/print-2026-08");
  await fs.mkdir(out, { recursive: true });

  const figures = String(args.figures ?? "crowd,dance,spin").split(",");
  const sizes = String(args.sizes ?? "print,story").split(",") as PosterSize[];
  const pieces = String(args.pieces ?? "posters,ticket,pass").split(",");
  const bleed = Boolean(args.bleed);

  // One prepare covers every piece — the src universe is small and shared.
  const prepared = await prepareSharp([
    WORDMARK_SRC,
    ODUBO_SRC,
    SCOTTS_SRC,
    qrSrc(ev.url),
    ...Object.values(FIGURES),
  ]);
  const deps = { sizes: prepared.sizes };

  const write = async (file: string, buf: Buffer) => {
    await fs.writeFile(path.join(out, file), buf);
    console.log("→", file);
  };

  if (pieces.includes("posters")) {
    for (const figure of figures) {
      const src = FIGURES[figure];
      if (!src) throw new Error(`unknown figure "${figure}"`);
      for (const size of sizes) {
        const list = unwrap(
          `poster ${figure}/${size}`,
          layoutEventPoster({ size, figureSrc: src, slogan, qrUrl: ev.url, details: ev }, deps),
        );
        await write(
          `loop-soul-v${volume}-${figure}-${FILE_LABELS[size]}.png`,
          await renderSharp(list, prepared),
        );
        if (bleed && size === "print") {
          await write(
            `loop-soul-v${volume}-${figure}-print-bleed.png`,
            await renderSharp(withBleed(list, "TRIM 8 × 11 IN · BLEED ⅛ IN · 300 DPI"), prepared),
          );
        }
      }
    }
  }

  if (pieces.includes("ticket")) {
    const list = unwrap(
      "ticket",
      layoutTicket(
        { qrUrl: ev.url, figureSrc: FIGURES.crowd, details: { ...ev, venue: ev.venueShort } },
        deps,
      ),
    );
    await write(`loop-soul-v${volume}-ticket.png`, await renderSharp(list, prepared));
    if (bleed) {
      await write(
        `loop-soul-v${volume}-ticket-bleed.png`,
        await renderSharp(withBleed(list, "TRIM 8.5 × 3.33 IN · BLEED ⅛ IN · 300 DPI"), prepared),
      );
    }
  }

  if (pieces.includes("pass")) {
    const list = unwrap(
      "pass card",
      layoutPassCard({ figureSrc: FIGURES.crowd, details: ev }, deps),
    );
    await write(`loop-soul-v${volume}-pass-square.png`, await renderSharp(list, prepared));
  }

  console.log("\nout:", out);
}

main().catch((e) => {
  console.error(String((e as Error).message ?? e));
  process.exit(1);
});
