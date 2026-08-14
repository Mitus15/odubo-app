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
  withBleed,
  qrSrc,
  WORDMARK_SRC,
  ODUBO_SRC,
  SCOTTS_SRC,
  POSTER_SIZES,
  PRINT_BLEED,
  type EventPosterSpec,
  type PosterSize,
  type LayoutResult,
} from "./layout";
import { prepareImages, renderCanvas } from "./render-canvas";

export { POSTER_SIZES, PRINT_BLEED };
export type { PosterSize };

/** The studio's spec shape (kept stable for PosterStudio). */
export type PosterSpec = {
  size: PosterSize;
  figureSrc: string | null;
  tagline: string;
  qrUrl: string;
  showDetails: boolean;
  details: { title: string; theme: string; venue: string; dateLabel: string };
  /** Ignored — the face is the committed brand font. Kept for compatibility. */
  fontSans?: string;
};

function toEngineSpec(spec: PosterSpec): EventPosterSpec {
  return {
    size: spec.size,
    figureSrc: spec.figureSrc,
    // The studio's free-text line rides the slogan slot; empty = brand default.
    slogan: spec.tagline.trim() || undefined,
    qrUrl: spec.qrUrl.trim() || "/loop",
    details: spec.showDetails
      ? {
          volume: spec.details.title || undefined,
          theme: spec.details.theme || undefined,
          date: spec.details.dateLabel || undefined,
          venue: spec.details.venue || undefined,
        }
      : null,
  };
}

function srcsFor(spec: EventPosterSpec): string[] {
  return [
    WORDMARK_SRC,
    ODUBO_SRC,
    SCOTTS_SRC,
    qrSrc(spec.qrUrl),
    ...(spec.figureSrc ? [spec.figureSrc] : []),
  ];
}

function unwrap(result: LayoutResult) {
  if (!result.ok) throw new Error(result.error);
  return result.list;
}

/** Compose the full poster; returns the canvas (caller previews or exports). */
export async function composePoster(spec: PosterSpec): Promise<HTMLCanvasElement> {
  const engineSpec = toEngineSpec(spec);
  const prepared = await prepareImages(srcsFor(engineSpec));
  const list = unwrap(layoutEventPoster(engineSpec, { sizes: prepared.sizes }));
  return renderCanvas(list, prepared);
}

/** The print-shop file: trim + bleed + crop marks, via the pure transform. */
export async function composePrintWithBleed(spec: PosterSpec): Promise<HTMLCanvasElement> {
  const engineSpec = toEngineSpec({ ...spec, size: "print" });
  const prepared = await prepareImages(srcsFor(engineSpec));
  const list = unwrap(layoutEventPoster(engineSpec, { sizes: prepared.sizes }));
  return renderCanvas(withBleed(list, "TRIM 8 × 11 IN · BLEED ⅛ IN · 300 DPI"), prepared);
}
