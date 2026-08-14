"use client";

/**
 * Browser entry to the poster engine.
 *
 * This file used to BE a second poster implementation — inline-percentage
 * layout, a downward arc the kit had deliberately abandoned, "VENUE PARTNER"
 * against the locked brand doc, no triad, no overlap guard. It is now a thin
 * wrapper: map the studio's spec, prepare images, lay out through the one
 * shared engine (src/lib/loop/poster/layout.ts), render. Both runtimes draw
 * the same display list, so /loop/admin/posters and the Node kit can no
 * longer produce different posters from the same brief.
 */

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
  TICKET_SIZE,
  PASS_CARD_SIZE,
  PRINT_BLEED,
  type EventPosterSpec,
  type EventDetails,
  type PosterSize,
  type LayoutResult,
  type TournamentPosterSpec,
} from "./layout";
import { prepareImages, renderCanvas } from "./render-canvas";

export { POSTER_SIZES, TICKET_SIZE, PASS_CARD_SIZE, PRINT_BLEED };
export type { PosterSize };

/** The studio's spec shape (kept stable for PosterStudio). */
export type PosterSpec = {
  size: PosterSize;
  figureSrc: string | null;
  tagline: string;
  qrUrl: string;
  showTriad?: boolean;
  showDetails: boolean;
  details: {
    title: string;
    theme: string;
    venue: string;
    dateLabel: string;
    doors?: string;
    passes?: string;
    price?: string;
  };
  /** Ignored — the face is the committed brand font. Kept for compatibility. */
  fontSans?: string;
};

const TRIM_LABELS = {
  poster: "TRIM 8 × 11 IN · BLEED ⅛ IN · 300 DPI",
  ticket: "TRIM 8.5 × 3.33 IN · BLEED ⅛ IN · 300 DPI",
} as const;

function toDetails(spec: PosterSpec): EventDetails {
  return {
    volume: spec.details.title || undefined,
    theme: spec.details.theme || undefined,
    date: spec.details.dateLabel || undefined,
    venue: spec.details.venue || undefined,
    doors: spec.details.doors || undefined,
    passes: spec.details.passes || undefined,
    price: spec.details.price || undefined,
  };
}

function toEngineSpec(spec: PosterSpec): EventPosterSpec {
  return {
    size: spec.size,
    figureSrc: spec.figureSrc,
    // The studio's free-text line rides the slogan slot; empty = brand default.
    slogan: spec.tagline.trim() || undefined,
    showTriad: spec.showTriad,
    qrUrl: spec.qrUrl.trim() || "/loop",
    details: spec.showDetails ? toDetails(spec) : null,
  };
}

const CHROME = [WORDMARK_SRC, ODUBO_SRC, SCOTTS_SRC];

function unwrap(result: LayoutResult) {
  if (!result.ok) throw new Error(result.error);
  return result.list;
}

/** Compose the full poster; returns the canvas (caller previews or exports). */
export async function composePoster(spec: PosterSpec): Promise<HTMLCanvasElement> {
  const engineSpec = toEngineSpec(spec);
  const prepared = await prepareImages([
    ...CHROME,
    qrSrc(engineSpec.qrUrl),
    ...(engineSpec.figureSrc ? [engineSpec.figureSrc] : []),
  ]);
  const list = unwrap(layoutEventPoster(engineSpec, { sizes: prepared.sizes }));
  return renderCanvas(list, prepared);
}

/** The print-shop file: trim + bleed + crop marks, via the pure transform. */
export async function composePrintWithBleed(spec: PosterSpec): Promise<HTMLCanvasElement> {
  const engineSpec = toEngineSpec({ ...spec, size: "print" });
  const prepared = await prepareImages([
    ...CHROME,
    qrSrc(engineSpec.qrUrl),
    ...(engineSpec.figureSrc ? [engineSpec.figureSrc] : []),
  ]);
  const list = unwrap(layoutEventPoster(engineSpec, { sizes: prepared.sizes }));
  return renderCanvas(withBleed(list, TRIM_LABELS.poster), prepared);
}

/** The door ticket — the crowd is always its hero. Optional print bleed. */
export async function composeTicket(
  spec: PosterSpec,
  opts: { bleed?: boolean } = {},
): Promise<HTMLCanvasElement> {
  const figureSrc = spec.figureSrc ?? "/loop/figures/crowd.png";
  const qrUrl = spec.qrUrl.trim() || "/loop";
  const prepared = await prepareImages([...CHROME, qrSrc(qrUrl), figureSrc]);
  const list = unwrap(
    layoutTicket({ qrUrl, figureSrc, details: toDetails(spec) }, { sizes: prepared.sizes }),
  );
  return renderCanvas(opts.bleed ? withBleed(list, TRIM_LABELS.ticket) : list, prepared);
}

/** The pass card — the store shelf face. Square, no QR, no price. */
export async function composePassCard(spec: PosterSpec): Promise<HTMLCanvasElement> {
  const figureSrc = spec.figureSrc ?? "/loop/figures/crowd.png";
  const prepared = await prepareImages([...CHROME, figureSrc]);
  const list = unwrap(
    layoutPassCard({ figureSrc, details: toDetails(spec) }, { sizes: prepared.sizes }),
  );
  return renderCanvas(list, prepared);
}

/**
 * The tournament poster — spec comes from tournamentSpec(anthemState), so the
 * caller owns the fetch; this just resolves artwork and renders.
 */
export async function composeTournament(spec: TournamentPosterSpec): Promise<HTMLCanvasElement> {
  const srcs = [...CHROME, qrSrc(spec.qrUrl)];
  const band = spec.band;
  if (band.kind === "grid") {
    srcs.push(band.emptyFigureSrc, ...band.art.map((a) => a.src).filter(Boolean));
  } else if (band.kind === "seeds") {
    srcs.push(...band.art.map((a) => a.src).filter(Boolean));
  } else if (band.kind === "pairs") {
    for (const p of band.pairs) {
      if (p.a?.src) srcs.push(p.a.src);
      if (p.b?.src) srcs.push(p.b.src);
    }
  } else if (band.art.src) {
    srcs.push(band.art.src);
  }
  const prepared = await prepareImages(srcs);
  const list = unwrap(layoutTournament(spec, { sizes: prepared.sizes }));
  return renderCanvas(list, prepared);
}
