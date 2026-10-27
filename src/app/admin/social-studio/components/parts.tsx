'use client';

import { PLATFORM_LABEL, PLATFORM_SHORT, platformState, type QueuePost } from '@/lib/social/postQueue';

/**
 * The small pieces every Studio view shares: a post's marks per app, its
 * thumbnail edged in the song's colour, and how a time reads.
 */

const SIGN = { posted: '✓', scheduled: '◷', drafted: '◷', failed: '!', todo: '○' } as const;

/** One mark per planned app: ✓ out, ◷ waiting in the app (scheduled or in drafts), ! refused, ○ still to post. */
export function Marks({ post, className = '' }: { post: QueuePost; className?: string }) {
  return (
    <span className={`inline-flex gap-2 font-mono text-[11px] tabular-nums ${className}`}>
      {post.platforms.map((p) => {
        const state = platformState(post, p);
        const tone =
          state.kind === 'posted' ? 'text-[var(--ok)]' : state.kind === 'failed' ? 'text-[var(--warn)]' : 'text-[var(--text-muted)]';
        return (
          <span key={p} className={tone} title={`${PLATFORM_LABEL[p] || p}: ${state.kind}`}>
            {PLATFORM_SHORT[p] || p} {SIGN[state.kind]}
          </span>
        );
      })}
    </span>
  );
}

/** A 9:16 thumbnail on the song's colour, so a missing image still says which song. */
export function Thumb({ src, colour, className = '' }: { src?: string; colour: string; className?: string }) {
  return (
    <span className={`block aspect-[9/16] overflow-hidden flex-shrink-0 ${className}`} style={{ background: colour }}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
      )}
    </span>
  );
}

export function SongDot({ colour }: { colour: string }) {
  return <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-[var(--rule)]" style={{ background: colour }} />;
}

/** The device's own day for a time: his phone's. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  if (dayKey(iso) === dayKey(now.toISOString())) return `Today · ${date}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (dayKey(iso) === dayKey(tomorrow.toISOString())) return `Tomorrow · ${date}`;
  return date;
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function countLabel(n?: number): string {
  if (n === undefined) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}
