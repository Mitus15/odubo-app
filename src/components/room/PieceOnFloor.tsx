'use client';

import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PieceBounds } from '@/lib/store/pieceLook';

/**
 * A piece of gear as it stands in its room, shared by /gear and the piece's
 * own page so the two are one store.
 *
 *   Piece    standing on the lacquer floor: the photo cropped to what is
 *            visible in it (lib/store/pieceLook read where that is), a shade
 *            where it stands, its hem mirrored in the floor
 *   Cutout   the photo cropped the same way, with no floor (the grid, the
 *            other photos of a piece)
 *
 * The shade and the reflection are blurred the way light is, never drawn: a
 * wide soft shade and a closer, darker one, each a Gaussian blur with no
 * edge, in a deeper tone of the room; the reflection a little out of focus
 * and fading on a curve, so it thins out instead of stopping.
 */

/** How much of the piece the floor mirrors, from its hem down */
export const REFLECTION = 0.3;

/**
 * The one size a standing piece's photo is asked for, on /gear and on its own
 * page alike: sharp on a phone (Shopify sends it as WebP, ~60 KB), and the same
 * address on both, so the flight between them lands on a photo already there.
 */
export const PIECE_WIDTH = 1080;

/** Photos already drawn in this visit: a piece showing one again stands at once, with no fade */
const drawn = new Set<string>();

export function cropOf(bounds: PieceBounds | null) {
  const b = bounds || { top: 0, bottom: 1, left: 0, right: 1, aspect: 1 };
  const w = b.right - b.left;
  const h = b.bottom - b.top;
  return {
    ratio: (w / h) * b.aspect || 1,
    style: { width: `${100 / w}%`, left: `${(-b.left / w) * 100}%`, top: `${(-b.top / h) * 100}%` } as CSSProperties,
  };
}

/** A photo cropped to what is visible in it, never tighter */
export function Cutout({ src, alt, bounds, size, eager }: { src: string; alt: string; bounds: PieceBounds | null; size: string; eager: boolean }) {
  const { ratio, style } = cropOf(bounds);
  return (
    <span className="relative block overflow-hidden" style={{ aspectRatio: ratio, width: size, ['--ratio' as string]: ratio } as CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} className="absolute max-w-none" style={style} />
    </span>
  );
}

/**
 * A piece standing on the floor, inside a size container (its height is a
 * share of the container's, `stands` in cqh). All of it, shade and reflection
 * too, fits inside its own height, so nothing below it is ever clipped. A
 * photo the server could not read stands uncropped. It comes in whole, once
 * its photo is there: never a shade on an empty floor.
 */
export const Piece = memo(function Piece({
  src,
  alt,
  bounds,
  eager,
  stands = 66,
}: {
  src: string;
  alt: string;
  bounds: PieceBounds | null;
  eager: boolean;
  /** The piece's own height, as a share of the container's (cqh) */
  stands?: number;
}) {
  const { ratio, style } = cropOf(bounds);
  const loading = eager ? 'eager' : 'lazy';
  const floor = `${(100 / (1 + REFLECTION)).toFixed(3)}%`;
  const photo = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(() => drawn.has(src));
  const show = () => {
    drawn.add(src);
    setReady(true);
  };
  // A photo already in the cache loads before the page is live, and its load event is missed
  useEffect(() => {
    if (photo.current?.complete && photo.current.naturalWidth) show();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span
      data-piece=""
      className={`relative flex flex-col transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
      style={{ width: `min(100cqw, ${(stands * ratio).toFixed(2)}cqh)` }}
    >
      {/* where it stands */}
      <span aria-hidden="true" className="floor-shade floor-shade-wide" style={{ top: floor }} />
      <span aria-hidden="true" className="floor-shade floor-shade-near" style={{ top: floor }} />
      <span className="relative block w-full overflow-hidden" style={{ aspectRatio: ratio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={photo} src={src} alt={alt} loading={loading} decoding="async" draggable={false} onLoad={show} className="absolute max-w-none" style={style} />
      </span>
      {/* the hem, mirrored in the floor */}
      <span aria-hidden="true" className="floor-reflection relative block w-full overflow-hidden" style={{ aspectRatio: ratio / REFLECTION }}>
        <span className="floor-reflection-image absolute inset-x-0 top-0 block -scale-y-100" style={{ aspectRatio: ratio }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" loading={loading} decoding="async" draggable={false} className="absolute max-w-none" style={style} />
        </span>
      </span>
    </span>
  );
});

/** Shopify's CDN sizes on request: a phone needs nothing like the 2048 original */
export function sized(url: string, width = PIECE_WIDTH): string {
  return `${url}${url.includes('?') ? '&' : '?'}width=${width}`;
}

/** A photo's words for whoever cannot see it, from Shopify, in the house's voice: no dashes ("Infinity Hoodie in Apricot, front view") */
export function altOf(text: string | null | undefined, fallback: string): string {
  return (text || fallback).replace(/\s*[\u2014\u2013]\s*/g, ', ').trim();
}
