'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import PlatformIcon from '@/components/linktree/PlatformIcon';
import ContactModal from '@/components/store/ContactModal';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';
import { houseFont } from '@/lib/brand/houseFont';
import { ODUBO_MARK, ODUBO_MARK_ASPECT } from '@/lib/brand/marks';
import type { LinkTreeItem } from '@/types/linktree';

/**
 * The room's shared parts (lib/room): the room itself for a page set in it,
 * the outro, the marks, the small print.
 */

/**
 * The browser's own bars in the room's colour (theme-color: Safari's and
 * Chrome's toolbars on a phone take it), so the room runs past the page's
 * edge into the browser itself. The site's oxblood comes back on leaving.
 */
export function useBrowserColour(colour: string) {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const before = meta.content;
    meta.content = colour;
    return () => {
      meta.content = before;
    };
  }, [colour]);
}

/**
 * A page set in the room: the field over the whole window, in its colour,
 * writing in its writing colour. It covers the site's own chrome (the
 * layout's sidebar and player, z-150) and sits under the cookie banner
 * (z-160), which must stay answerable.
 */
export function RoomShell({
  colour,
  on,
  corner,
  children,
  scroll = true,
}: {
  colour: string;
  on: string;
  /** What sits at the top right: a symbol, a count; the page names itself to search in its own h1 */
  corner?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) {
  useBrowserColour(colour);
  return (
    <div
      className={`room ${houseFont.variable} fixed inset-0 z-[150] transition-colors duration-700 ${scroll ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'}`}
      style={{ background: colour, color: on, '--room': colour, '--on-room': on } as CSSProperties}
    >
      <header className="flex items-center justify-between gap-3 px-4" style={{ paddingTop: 'env(safe-area-inset-top)', height: 'var(--room-top)' }}>
        <Link href="/" className="flex min-h-[44px] items-center">
          <HouseName />
        </Link>
        {corner}
      </header>
      {children}
    </div>
  );
}

/**
 * The site's name at the top of every room: the danceman alone. The site is
 * Odubo Studio and says so to search and to screen readers; Mani is the one
 * dancing in it, not its name (his word, 2026-10-27).
 */
export function HouseName({ as: Tag = 'span' }: { as?: 'span' | 'h1' }) {
  return (
    <Tag className="flex items-center">
      <Mark src={ODUBO_MARK} aspect={ODUBO_MARK_ASPECT} height={30} label="Odubo Studio" />
    </Tag>
  );
}

/** A house mark worn in the room's writing colour: drawn through as a mask, named for whoever cannot see it */
export function Mark({ src, aspect, height, label, size }: { src: string; aspect: number; height: number; label: string; size?: string }) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className="block shrink-0 bg-current"
      style={{
        // a CSS length (size) scales with what holds it; a number of pixels does not
        height: size ?? height,
        width: size ? `calc(${size} * ${aspect})` : Math.round(height * aspect),
        WebkitMask: `url(${src}) center / contain no-repeat`,
        mask: `url(${src}) center / contain no-repeat`,
      }}
    />
  );
}

/** The danceman, in the room's writing colour */
export function Danceman({ height }: { height: number }) {
  return <Mark src={ODUBO_MARK} aspect={ODUBO_MARK_ASPECT} height={height} label="Odubo Studio" />;
}

/** The room's symbols, drawn in its writing colour; each says what it is to whoever cannot see it */
const ICONS = {
  /** Levels: the level select, a wall of rooms */
  levels: <><rect x="4" y="4" width="6.5" height="6.5" rx="0.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="0.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="0.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="0.5" /></>,
  /** Music: a record halfway out of its sleeve */
  music: <><rect x="1.8" y="4.5" width="11.2" height="15" rx="0.6" /><path d="M13 4.57 A7.5 7.5 0 0 1 13 19.43" /><path d="M13 9.7 A2.5 2.5 0 1 1 13 14.3" strokeOpacity="0.6" /><circle cx="14" cy="12" r="0.75" fill="currentColor" stroke="none" /></>,
  /** Gear: a hanger */
  gear: <><path d="M12 8.5V7.6a1.9 1.9 0 1 1 1.9 -1.9" strokeLinecap="round" /><path d="M12 8.5L3.2 15.1a1.2 1.2 0 0 0 .7 2.2h16.2a1.2 1.2 0 0 0 .7 -2.2z" strokeLinejoin="round" /></>,
  /** One at a time: a single piece */
  one: <rect x="6.5" y="4" width="11" height="16" rx="0.8" />,
  /** Locked */
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="1.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" strokeLinecap="round" /></>,
  /** Unlocked */
  unlocked: <><rect x="5" y="10.5" width="14" height="10" rx="1.5" /><path d="M8 10.5V7.5a4 4 0 0 1 7.7 -1.5" strokeLinecap="round" /></>,
  /** Open: into the performances */
  expand: <path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />,
  /** The sound */
  sound: <><path strokeLinejoin="round" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path strokeLinecap="round" d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /></>,
} as const;

export function Symbol({ name, className = 'h-6 w-6', label }: { name: keyof typeof ICONS; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {ICONS[name]}
    </svg>
  );
}

/** The last screen of the feed: the danceman, the day's verse, the marks, the small print */
export function Outro({
  verse,
  platforms,
  top,
  floor,
  markRef,
}: {
  verse: { text: string; reference: string } | null;
  platforms: LinkTreeItem[];
  top: string;
  floor: string;
  /** Where the header's danceman lands: the outro keeps his place and does not draw a second one */
  markRef?: React.Ref<HTMLSpanElement>;
}) {
  return (
    <div className="absolute inset-x-0 flex flex-col items-center justify-center gap-7 px-6 text-center" style={{ top, bottom: floor }}>
      {markRef ? (
        <span ref={markRef} aria-hidden="true" className="block" style={{ height: 84, width: Math.round(84 * ODUBO_MARK_ASPECT) }} />
      ) : (
        <Danceman height={84} />
      )}
      {verse?.text && (
        <figure className="max-w-[22rem]">
          <blockquote className="text-[14px] italic leading-relaxed opacity-85">&ldquo;{verse.text}&rdquo;</blockquote>
          {verse.reference && <figcaption className="room-eyebrow mt-2">{verse.reference}</figcaption>}
        </figure>
      )}
      <PlatformMarks links={platforms} />
      <SmallPrint />
    </div>
  );
}

/** The next room, its door shut: the lock alone, in the room's colour, and the save on the floor beneath it */
export function NextRoom({ top, floor }: { top: string; floor: string }) {
  return (
    <div className="absolute inset-x-0 flex items-center justify-center" style={{ top, bottom: floor }}>
      <Symbol name="lock" className="h-20 w-20" label="The next level, locked" />
    </div>
  );
}

/** One row of marks, where he is on the apps; each tap is counted for /admin/linktree */
export function PlatformMarks({ links, className = '' }: { links: LinkTreeItem[]; className?: string }) {
  if (!links.length) return null;
  return (
    <nav aria-label="Elsewhere" className={`flex flex-wrap items-center justify-center gap-1 ${className}`}>
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => fetch(`/api/linktree/${link.id}`, { method: 'POST', keepalive: true }).catch(() => {})}
          aria-label={link.title}
          title={link.title}
          className="flex h-11 w-11 items-center justify-center rounded-full opacity-80 transition-opacity hover:opacity-100 active:scale-95"
        >
          <PlatformIcon platform={link.platform ?? null} mono className="h-[22px] w-[22px]" />
        </a>
      ))}
    </nav>
  );
}

export function SmallPrint({ className = '' }: { className?: string }) {
  const [contactOpen, setContactOpen] = useState(false);
  return (
    <footer className={`flex flex-col items-center gap-1 text-[12px] ${className}`}>
      <div className="flex items-center gap-3 opacity-75">
        <button type="button" onClick={() => setContactOpen(true)} className="min-h-[44px] hover:opacity-100">
          Contact
        </button>
        <span aria-hidden="true">·</span>
        <Link href="/legal?tab=shipping" className="flex min-h-[44px] items-center hover:opacity-100">
          Shipping &amp; returns
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/legal?tab=privacy" className="flex min-h-[44px] items-center hover:opacity-100">
          Privacy
        </Link>
      </div>
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </footer>
  );
}

/** A link into the store, counted as a shop visit like every other way in */
export function GearLink({ href, className, style, children }: { href: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  const analytics = useAnalyticsSafe();
  return (
    <Link href={href} onClick={() => analytics?.trackShopVisit()} className={className} style={style}>
      {children}
    </Link>
  );
}

export function OutArrow({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}
