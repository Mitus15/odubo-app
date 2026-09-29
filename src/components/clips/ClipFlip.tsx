import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { ClipFilmCard } from '@/types/clips';

interface ClipFlipProps {
  card: ClipFilmCard;
  /** The film chapter's slug. The flip opens /loop/<chapter>; without one it is words only. */
  chapter?: string | null;
  className?: string;
  style?: CSSProperties;
}

/**
 * The flip on a Loop Soul film clip: the owner's line over a hairline, with the
 * verse it flips set small underneath. Tapping it opens the clip's chapter,
 * which does the selling. A film clip carries no product of its own.
 *
 * Text over video, never a card. Legibility comes from the clip-*-glass text
 * shadows in globals.css, and the hairline carries its own dark halo, so no
 * panel is ever drawn behind the words. Those glass classes are unlayered CSS
 * and outrank Tailwind utilities, which is why the reference's tracking and
 * weight are set inline.
 *
 * The link does not prefetch: in the feed it would compete with the next
 * clip's first video segment, and the first frame comes first.
 */
export default function ClipFlip({ card, chapter, className = '', style }: ClipFlipProps) {
  if (!card.flip) return null;

  const words = (
    <>
      <span className="line-clamp-3 text-[17px] leading-snug clip-title-glass">{card.flip}</span>
      <span aria-hidden="true" className="mt-2 block h-px bg-white/50 shadow-[0_0_3px_rgba(0,0,0,0.8)]" />
      <span
        className="mt-1.5 flex items-center justify-between gap-4 text-[10px] uppercase clip-subtitle-glass"
        style={{ letterSpacing: '0.2em', fontWeight: 600 }}
      >
        <span>{card.verseRef}</span>
        {chapter ? <span aria-hidden="true">→</span> : null}
      </span>
    </>
  );

  if (!chapter) {
    return (
      <div className={`block ${className}`} style={style}>
        {words}
      </div>
    );
  }

  return (
    <Link
      href={`/loop/${encodeURIComponent(chapter)}`}
      prefetch={false}
      draggable={false}
      className={`block min-h-[44px] py-1 ${className}`}
      style={style}
    >
      {words}
    </Link>
  );
}
