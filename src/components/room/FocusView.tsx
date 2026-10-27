'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import RoomVideo from './RoomVideo';
import PlatformIcon from '@/components/linktree/PlatformIcon';
import { Symbol, useBrowserColour } from './RoomParts';
import { hearIt, hudOf, type Level } from '@/lib/levels';
import { onRoom } from '@/lib/room';
import type { LinkTreeItem } from '@/types/linktree';

/**
 * The focused view: the performances, one to a screen, each in its own room,
 * swiped through as in a feed (the room's colour goes with it). Opened by a
 * tap on the dancer on the main page; closed by its X, Escape, or the phone's
 * own back, into the room the visitor stopped in (RoomScreen).
 *
 * Only the performance on screen plays; the ones beside it hold their
 * streams, ready. Each wears the game's HUD, drawn by the site from the
 * Studio's data (RoomHud: the level, the song, the player, the progress), and
 * where to hear it at its foot.
 */
const TOP = 'calc(env(safe-area-inset-top) + 56px)';
const FOOT = 'calc(env(safe-area-inset-bottom) + 84px)';

export default function FocusView({
  levels,
  platforms,
  start,
  onClose,
}: {
  levels: Level[];
  platforms: LinkTreeItem[];
  start: number;
  onClose: (level: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(start);
  const activeRef = useRef(start);
  activeRef.current = active;
  const colour = levels[active]?.colour || '#2a0f0a';
  useBrowserColour(colour);

  // Open on the performance that was tapped
  useEffect(() => {
    const root = scroller.current;
    if (root) root.scrollTo({ top: start * root.clientHeight, behavior: 'instant' as ScrollBehavior });
  }, [start]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.performance));
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll('[data-performance]').forEach((el) => watcher.observe(el));
    return () => watcher.disconnect();
  }, [levels.length]);

  const out = useCallback(() => onClose(activeRef.current), [onClose]);

  // The phone's back comes out of the focused view, not off the page
  useEffect(() => {
    window.history.pushState({ focus: true }, '');
    const onBack = () => out();
    window.addEventListener('popstate', onBack);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.history.back();
      const root = scroller.current;
      if (!root || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      e.preventDefault();
      root.scrollBy({ top: (e.key === 'ArrowDown' ? 1 : -1) * root.clientHeight, behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onBack);
      window.removeEventListener('keydown', onKey);
    };
  }, [out]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The levels"
      className="room-fade fixed inset-0 z-[155] transition-colors duration-500"
      style={{ background: colour, color: onRoom(colour) } as CSSProperties}
    >
      <div ref={scroller} className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {levels.map((l, i) => {
          const title = `${l.label}: Mani Odubo dances ${l.song}${l.artist ? ` by ${l.artist}` : ''}`;
          const hear = hearIt(l, platforms);
          return (
            <section
              key={l.id}
              data-performance={i}
              aria-label={title}
              className="relative h-full snap-start snap-always"
              style={{ background: l.colour, color: onRoom(l.colour) }}
            >
              <RoomVideo
                hls={l.hls}
                poster={l.poster}
                title={title}
                active={i === active}
                near={Math.abs(i - active) <= 1}
                className="absolute inset-x-0"
                style={{ top: TOP, bottom: FOOT }}
                hud={hudOf(l)}
              />
              {/* where to hear it, at its foot */}
              <div className="absolute inset-x-0 flex items-center justify-end gap-3 px-5" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 18px)', height: 52 }}>
                {hear && (
                  <a
                    href={hear.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Hear it on ${hear.app}`}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-end gap-2 opacity-80 hover:opacity-100"
                  >
                    <Symbol name="sound" className="h-[18px] w-[18px]" />
                    <PlatformIcon platform={hear.platform} mono className="h-[18px] w-[18px]" />
                  </a>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Out: always an X, never a drag */}
      <button
        type="button"
        onClick={() => window.history.back()}
        aria-label="Back to the room"
        className="fixed right-3 flex h-11 w-11 items-center justify-center rounded-full transition-[opacity,transform] hover:opacity-70 active:scale-95"
        style={{ top: 'calc(env(safe-area-inset-top) + 6px)' }}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
