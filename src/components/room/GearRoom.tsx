'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { GearLink, RoomShell, Symbol } from './RoomParts';
import { formatMoney } from '@/lib/store/money';
import { labelLockup, STORE_LABEL } from '@/lib/store/brands';
import { onRoom, ROOM_DARK } from '@/lib/room';
import type { ProductSummary } from '@/lib/store/types';
import type { PieceBounds, PieceLook } from '@/lib/store/pieceLook';

type GearPiece = ProductSummary & PieceLook;

/**
 * The gear in the rooms: every piece cut out (the store's photos are),
 * standing on the lacquer floor, its hem mirrored under it and a soft shadow
 * at its foot, each in a room of its own colour, taken from the piece itself
 * (lib/store/pieceLook): a wine jacket on a rose, a sand hoodie on ochre, a
 * black tee on the colour of its print. The room changes as the row moves.
 *
 *   the row                            one piece a swipe, the next at the edge
 *   the piece's name                   under it
 *   B.A.A.D Creative Wear / by Odubo   the label, small, under the name, as on
 *                                      the store's product page (the house is
 *                                      the danceman at the top; the label is
 *                                      never set beside him)
 *   the price, See it                  the room's one drawn shape
 *
 * At the top right, the grid symbol: all the gear at once (GearGrid), and a
 * single square to go back to one at a time.
 *
 * All of it one block, centred in what the browser leaves of the screen
 * (an in-app browser's bars, Safari's, a phone on its side), the row a share
 * of that height, so nothing waits at an edge.
 *
 * The row is left alone while a finger moves it: no piece changes size or
 * fades as it goes, nothing in it re-renders. Only the name and the room's
 * colour follow, from the scroll position, once a frame at most.
 */
export default function GearRoom({ pieces }: { pieces: GearPiece[] }) {
  const row = useRef<HTMLUListElement>(null);
  const [front, setFront] = useState(0);
  const frontRef = useRef(0);
  frontRef.current = front;
  /** One piece at a time, or all of them at once */
  const [view, setView] = useState<'row' | 'grid'>('row');
  const lockup = labelLockup(STORE_LABEL);

  useEffect(() => {
    const el = row.current;
    if (!el || view !== 'row') return;
    // Back from the grid: the row opens on the piece in front, instantly
    const slide = el.firstElementChild as HTMLElement | null;
    if (slide) el.scrollTo({ left: frontRef.current * slide.offsetWidth, behavior: 'instant' as ScrollBehavior });
    let frame = 0;
    const read = () => {
      frame = 0;
      const first = el.firstElementChild as HTMLElement | null;
      if (!first) return;
      const i = Math.round(el.scrollLeft / first.offsetWidth);
      setFront(Math.max(0, Math.min(pieces.length - 1, i)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [pieces.length, view]);

  const step = useCallback(
    (by: number) => {
      const el = row.current;
      const slide = el?.firstElementChild as HTMLElement | null;
      if (!el || !slide) return;
      el.scrollTo({ left: Math.max(0, Math.min(pieces.length - 1, front + by)) * slide.offsetWidth, behavior: 'smooth' });
    },
    [front, pieces.length],
  );

  /** From the grid, into a piece's own room */
  const pick = useCallback((i: number) => {
    setFront(i);
    setView('row');
  }, []);

  const piece = pieces[front];
  const colour = piece?.room || ROOM_DARK;
  const on = onRoom(colour);

  const toggle = (
    <button
      type="button"
      onClick={() => setView((v) => (v === 'row' ? 'grid' : 'row'))}
      aria-label={view === 'row' ? 'All the gear at once' : 'One piece at a time'}
      title={view === 'row' ? 'All the gear' : 'One at a time'}
      className="flex h-11 w-11 items-center justify-center transition-[opacity,transform] hover:opacity-70 active:scale-95"
    >
      <Symbol name={view === 'row' ? 'levels' : 'one'} className="h-6 w-6" />
    </button>
  );

  return (
    <RoomShell colour={colour} on={on} corner={toggle}>
      {view === 'grid' ? (
        <GearGrid pieces={pieces} onPick={pick} />
      ) : (
        /* One block, centred in what the browser leaves of the screen; on a screen too short for it, it scrolls */
        <div
          className="room-fade flex min-h-[calc(100%-var(--room-top))] flex-col justify-center py-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}
        >
          <Row rowRef={row} pieces={pieces} />

          {/* The piece in front, under it on the floor. Its name always has two lines' room, so nothing below it moves */}
          <div className="mt-3 px-5 text-center" aria-live="polite">
            {piece && (
              <>
                <h1 className="room-display flex h-[1.9em] items-end justify-center text-[clamp(20px,5.8vw,34px)] uppercase leading-[0.95]">
                  <span key={piece.id} className="room-fade line-clamp-2 [text-wrap:balance]">
                    {piece.title}
                  </span>
                </h1>
                {/* The label under the piece's name, as the store's product page has it */}
                <p className="mt-2 text-[10px] uppercase tracking-[0.22em] opacity-80">
                  {lockup.name}
                  {lockup.signature && <span className="mt-1 block text-[9px] normal-case tracking-[0.18em]">{lockup.signature}</span>}
                </p>
                <p key={`${piece.id}-price`} className="room-fade mt-3 text-[15px]">
                  {piece.available ? formatMoney(piece.price, piece.currency) : 'Sold out'}
                  <span className="room-eyebrow ml-3">
                    {front + 1} / {pieces.length}
                  </span>
                </p>
              </>
            )}
          </div>

          <div className="mt-5 flex items-center justify-center gap-3 px-4">
            <Arrow onClick={() => step(-1)} disabled={front === 0} label="The piece before" left />
            {piece && (
              <GearLink
                href={`/store/product/${piece.handle}`}
                className="flex min-h-[52px] w-full max-w-sm items-center justify-center rounded-full text-[15px] font-semibold tracking-wide transition-[transform,background-color,color] duration-500 active:scale-[0.98]"
                style={{ background: on, color: colour }}
              >
                See it
              </GearLink>
            )}
            <Arrow onClick={() => step(1)} disabled={front === pieces.length - 1} label="The next piece" />
          </div>
        </div>
      )}
    </RoomShell>
  );
}

/**
 * All the gear at once, the way Yeezy shows its range: every piece small and
 * the same size, standing in a quiet grid in the room the visitor is in, its
 * name under it in small caps and nothing else. A piece opens in its own room.
 */
function GearGrid({ pieces, onPick }: { pieces: GearPiece[]; onPick: (i: number) => void }) {
  return (
    <main className="room-fade mx-auto w-full max-w-5xl px-4 pb-10 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}>
      <h1 className="sr-only">Gear</h1>
      <ul className="grid grid-cols-3 gap-x-2 gap-y-7 sm:grid-cols-4 lg:grid-cols-6">
        {pieces.map((p, i) => (
          <li key={p.id}>
            <button type="button" onClick={() => onPick(i)} className="group block w-full text-center" aria-label={p.title}>
              <span className="block aspect-square [container-type:size]">
                <span className="flex h-full items-end justify-center pb-[8%] transition-transform duration-300 group-hover:-translate-y-1 group-active:scale-95">
                  <Cutout src={sized(p.image!.url, 360)} alt={p.image?.altText || p.title} bounds={p.bounds} size="min(80cqw, calc(80cqh * var(--ratio)))" eager={i < 9} />
                </span>
              </span>
              <span className="room-eyebrow mt-1 line-clamp-2 block px-1 !text-[10px] !leading-tight !tracking-[0.14em] !opacity-90">{p.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** The row on the floor. Memoised: the name and colour above it change as it moves; it does not. */
const Row = memo(function Row({ pieces, rowRef }: { pieces: GearPiece[]; rowRef: React.RefObject<HTMLUListElement | null> }) {
  return (
    <ul
      ref={rowRef}
      aria-label="The gear"
      className="gear-row mt-4 flex shrink-0 snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-[7vw] [scrollbar-width:none] sm:px-[30vw] lg:px-[36vw] [&::-webkit-scrollbar]:hidden"
    >
      {pieces.map((p, i) => (
        <li
          key={p.id}
          className="flex h-full w-[86vw] shrink-0 snap-center snap-always items-center justify-center [container-type:size] sm:w-[40vw] lg:w-[28vw]"
        >
          <GearLink href={`/store/product/${p.handle}`} className="block">
            <Piece src={sized(p.image!.url)} alt={p.image?.altText || p.title} bounds={p.bounds} eager={i < 2} />
          </GearLink>
        </li>
      ))}
    </ul>
  );
});

function Arrow({ onClick, disabled, label, left }: { onClick: () => void; disabled: boolean; label: string; left?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className="hidden h-11 w-11 shrink-0 items-center justify-center disabled:opacity-25 sm:flex">
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={left ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  );
}

/** How much of the piece the floor mirrors, from its hem down */
const REFLECTION = 0.22;

function cropOf(bounds: PieceBounds | null) {
  const b = bounds || { top: 0, bottom: 1, left: 0, right: 1, aspect: 1 };
  const w = b.right - b.left;
  const h = b.bottom - b.top;
  return {
    ratio: (w / h) * b.aspect || 1,
    style: { width: `${100 / w}%`, left: `${(-b.left / w) * 100}%`, top: `${(-b.top / h) * 100}%` },
  };
}

/** A photo cropped to what is visible in it, never tighter (the server read where that is, lib/store/pieceLook) */
function Cutout({ src, alt, bounds, size, eager }: { src: string; alt: string; bounds: PieceBounds | null; size: string; eager: boolean }) {
  const { ratio, style } = cropOf(bounds);
  return (
    <span className="relative block overflow-hidden" style={{ aspectRatio: ratio, width: size, ['--ratio' as string]: ratio } as React.CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} className="absolute max-w-none" style={style} />
    </span>
  );
}

/**
 * A piece standing on the floor: its photo cropped to what is visible in it,
 * never tighter, so no edge of it is cut and the floor meets its hem. Under
 * it, the hem mirrored in the lacquer, fading to nothing, and a soft shadow
 * where it stands; all of it inside its own height, so nothing below it is
 * ever clipped. A photo the server could not read stands uncropped.
 */
const Piece = memo(function Piece({ src, alt, bounds, eager }: { src: string; alt: string; bounds: PieceBounds | null; eager: boolean }) {
  const { ratio, style } = cropOf(bounds);
  const loading = eager ? 'eager' : 'lazy';
  return (
    <span className="relative flex flex-col" style={{ width: `min(100cqw, ${(66 * ratio).toFixed(2)}cqh)` }}>
      {/* where it stands */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 h-4 w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
        style={{ top: `${100 / (1 + REFLECTION)}%`, background: 'radial-gradient(closest-side, rgb(42 15 10 / 0.3), transparent)' }}
      />
      <span className="relative block w-full overflow-hidden" style={{ aspectRatio: ratio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading={loading} decoding="async" draggable={false} className="absolute max-w-none" style={style} />
      </span>
      {/* the hem, mirrored in the floor */}
      <span aria-hidden="true" className="floor-reflection relative block w-full overflow-hidden" style={{ aspectRatio: ratio / REFLECTION }}>
        <span className="absolute inset-x-0 top-0 block -scale-y-100" style={{ aspectRatio: ratio }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" loading={loading} decoding="async" draggable={false} className="absolute max-w-none" style={style} />
        </span>
      </span>
    </span>
  );
});

/** Shopify's CDN sizes on request: a phone needs nothing like the 2048 original */
function sized(url: string, width = 720): string {
  return `${url}${url.includes('?') ? '&' : '?'}width=${width}`;
}
