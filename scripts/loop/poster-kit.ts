import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  layoutEventPoster,
  layoutTicket,
  layoutPassCard,
  layoutTournament,
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
import { tournamentSpec, TOURNAMENT_EMPTY_FIGURE } from "../../src/lib/loop/poster/tournament";
import {
  getPublicBaseUrl,
  normalizeBaseUrl,
  destinationFor,
} from "../../src/lib/loop/publicUrl";
import { getSetting } from "../../src/lib/loop/loopSetting";
import { priceLabel } from "../../src/lib/loop/priceLabel";
import type { AnthemState } from "../../src/lib/loop/anthem-server";
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

const VOLUMES: Record<string, EventDetails & { venueShort: string }> = {
  1: {
    date: "SATURDAY SEPTEMBER 26",
    // The one thing a reader has to act on is BE HERE BEFORE 8 — an end time
    // only tells them when to leave.
    doors: "DOORS 6:30 · ALBUM AT 8",
    venue: "SCOTT'S INN & SUITES · KAMLOOPS",
    venueShort: "SCOTT'S INN · KAMLOOPS",
    note: "DRESS CODE · 1984",
    record: "AN ALBUM BY MANI ODUBO",
  },
  2: {
    date: "DATE TBD",
    doors: "DOORS 6:30 · ALBUM AT 8",
    venue: "SCOTT'S INN & SUITES · KAMLOOPS",
    venueShort: "SCOTT'S INN · KAMLOOPS",
    note: "DRESS CODE · TBD",
    record: "AN ALBUM BY MANI ODUBO",
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
  flyer: "flyer-5.5x8.5in-300dpi",
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

  // Where every QR in this run points. A printed code cannot be corrected, so
  // there is deliberately NO default: the kit refuses rather than bake in a
  // host that might not be ours by the time the posters come back.
  //   --url=…  >  LOOP_PUBLIC_BASE_URL  >  loop_settings.public_base_url
  const placement = typeof args.placement === "string" ? args.placement : null;
  const baseUrl =
    normalizeBaseUrl(typeof args.url === "string" ? args.url : null) ??
    normalizeBaseUrl(process.env.LOOP_PUBLIC_BASE_URL) ??
    (await getPublicBaseUrl());
  if (!baseUrl) {
    throw new Error(
      "No public base URL. A QR code is permanent once printed, so this kit will not " +
        "guess one.\n  Set it in /loop/admin/studio (Pass sales → public base URL), or " +
        "pass --url=https://your-domain, or export LOOP_PUBLIC_BASE_URL.",
    );
  }
  const qrFor = (piece: "event" | "tournament" | "ticket" | "flyer") =>
    destinationFor(piece, baseUrl, placement)!;
  console.log(`→ QR destination: ${qrFor("event")}`);

  // The price on artwork is the SAME value the front door shows — read from
  // loop_settings, never typed in twice. An unset or zero price prints
  // "FREE ENTRY", so opening the door is one field, not a poster rewrite.
  ev.price =
    typeof args.price === "string"
      ? args.price
      : priceLabel(await getSetting("pass_price"), await getSetting("pass_currency"));
  console.log(`→ price line: ${ev.price}`);

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
    // Every distinct destination in this run — pieces may diverge later, and a
    // QR whose image was never prepared renders as a blank square.
    ...[...new Set((["event", "tournament", "ticket", "flyer"] as const).map(qrFor))].map(qrSrc),
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
          layoutEventPoster({ size, figureSrc: src, slogan, qrUrl: qrFor("event"), details: ev }, deps),
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
        { qrUrl: qrFor("ticket"), figureSrc: FIGURES.crowd, details: { ...ev, venue: ev.venueShort } },
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

  // The tournament poster renders the LIVE anthem — same data the app draws,
  // fetched from the volume's own deployment. Offline → skip loudly, never
  // render a stale guess.
  if (pieces.includes("tournament")) {
    const api = new URL("/api/loop/anthem", baseUrl).toString();
    let state: AnthemState;
    try {
      const res = await fetch(api);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state = (await res.json()) as AnthemState;
    } catch (e) {
      console.error(`✗ tournament skipped — anthem state unreachable at ${api} (${String(e)})`);
      state = null as never;
    }
    if (state) {
      for (const size of sizes) {
        const spec = tournamentSpec(state, { size, qrUrl: qrFor("tournament"), now: Date.now() });
        const artSrcs: string[] = [TOURNAMENT_EMPTY_FIGURE];
        const band = spec.band;
        if (band.kind === "grid" || band.kind === "seeds") {
          artSrcs.push(...band.art.map((a) => a.src).filter(Boolean));
        } else if (band.kind === "pairs") {
          for (const p of band.pairs) {
            if (p.a?.src) artSrcs.push(p.a.src);
            if (p.b?.src) artSrcs.push(p.b.src);
          }
        } else if (band.art.src) {
          artSrcs.push(band.art.src);
        }
        const artPrepared = await prepareSharp(artSrcs);
        const merged = {
          sizes: { ...prepared.sizes, ...artPrepared.sizes },
          raw: new Map([...prepared.raw, ...artPrepared.raw]),
        };
        const list = unwrap(
          `tournament ${state.stage}/${size}`,
          layoutTournament(spec, { sizes: merged.sizes }),
        );
        await write(
          `loop-soul-v${volume}-anthem-${state.stage}-${FILE_LABELS[size]}.png`,
          await renderSharp(list, merged),
        );
        if (bleed && size === "print") {
          await write(
            `loop-soul-v${volume}-anthem-${state.stage}-print-bleed.png`,
            await renderSharp(withBleed(list, "TRIM 8 × 11 IN · BLEED ⅛ IN · 300 DPI"), merged),
          );
        }
      }
    }
  }

  console.log("\nout:", out);
}

main().catch((e) => {
  console.error(String((e as Error).message ?? e));
  process.exit(1);
});
