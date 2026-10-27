'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import FocusView from './FocusView';
import RoomVideo from './RoomVideo';
import SaveYourProgress from './SaveYourProgress';
import PlatformIcon from '@/components/linktree/PlatformIcon';
import { HouseName, NextRoom, Outro, Symbol, useBrowserColour } from './RoomParts';
import { hearIt } from '@/lib/levels';
import { ROOM_DARK, onRoom } from '@/lib/room';
import { houseFont } from '@/lib/brand/houseFont';
import type { RoomData } from './loadRoom';

/**
 * The home page and the bio link's landing: three pages, scrolled.
 *
 *   the room     a level (lib/room: the page takes the video's field colour,
 *                so the dancer stands in a colour that runs to the screen's
 *                edges): the newest, or the one the visitor came out of the
 *                focused view in
 *   the lock     the next room, its door shut, in its own colour (a colour
 *                only: no song, no day). Its page is kept for what comes
 *                when it is time (the game, perhaps)
 *   the outro    in the house's ink: the day's verse, where he is on the
 *                apps, the small print
 *
 * A tap on the dancer opens the focused view (FocusView): the performances
 * one to a screen, swiped through, with an X (or the phone's back) to come
 * out, into the room the visitor stopped in. No tab for every video: the
 * page is one room; the rest are inside.
 *
 * Over the page, in the writing colour of whatever is under it:
 *   the danceman                    the top (Odubo Studio, to search); one
 *                                   danceman only: as the outro comes up he
 *                                   flies down into its place, and back; and
 *                                   where to hear the level: a speaker, the
 *                                   app's own mark
 *   a grid · a record · a hanger    on the floor, three doors: Levels, Music,
 *                                   Gear, named for search and screen readers
 *   Save your progress              the one drawn shape, the one line of words
 *
 * Levels and Music carry the room along (?room=) and open in it; Gear's
 * rooms come from its pieces.
 */
/** globals.css .room: taller on a phone held upright, lower on a short screen */
const TOP = 'var(--room-top)';
const FLOOR = 'var(--room-floor)';
/** The pages: the room, the lock, the outro */
const LOCK = 1;
const OUTRO = 2;

export default function RoomScreen({ levels, nextRoom, verse, platforms, storeOpen, startAt }: RoomData & { startAt?: string }) {
  const page = useRef<HTMLDivElement>(null);
  const [here, setHere] = useState(Math.max(0, levels.findIndex((l) => l.id === startAt)));
  /** The focused view, open at a level, or closed */
  const [focus, setFocus] = useState<number | null>(null);

  const level = levels[here] || null;
  // Before anything is out, the page is the next room, locked
  const colour = level?.colour || nextRoom || ROOM_DARK;
  // The lock's page waits in the next room's colour; with nothing planned, in this room's
  const lockColour = nextRoom || colour;
  const colourAt = useCallback((i: number) => (i < LOCK ? colour : i < OUTRO ? lockColour : ROOM_DARK), [colour, lockColour]);
  const hear = level ? hearIt(level, platforms) : null;
  useBrowserColour(focus === null ? colour : ROOM_DARK);
  const room = level ? `?room=${level.id}` : '';
  const title = level ? `${level.label}: Mani Odubo dances ${level.song}${level.artist ? ` by ${level.artist}` : ''}` : '';

  // One danceman: the header's flies down into the outro's place as the outro comes up, and back as it goes
  const headerMark = useRef<HTMLSpanElement>(null);
  const outroMark = useRef<HTMLSpanElement>(null);
  // The top and the floor are each written in the colour of what is under them right now
  const [under, setUnder] = useState({ top: 0, floor: 0 });
  useEffect(() => {
    const root = page.current;
    const mark = headerMark.current;
    if (!root || !mark) return;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const h = root.clientHeight || 1;
      const at = (y: number) => Math.min(OUTRO, Math.max(0, Math.floor((root.scrollTop + y) / h)));
      const next = { top: at(28), floor: at(h - 90) };
      setUnder((u) => (u.top === next.top && u.floor === next.floor ? u : next));

      const target = outroMark.current;
      if (!target) return;
      const p = Math.min(1, Math.max(0, (root.scrollTop - (OUTRO - 1) * h) / h));
      if (p <= 0) {
        mark.style.transform = '';
        mark.style.color = '';
        return;
      }
      const e = p * p * (3 - 2 * p);
      mark.style.transform = '';
      const from = mark.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const scale = 1 + (to.height / from.height - 1) * e;
      const dy = (to.top - from.top) * e;
      mark.style.transform = `translate(${(to.left - from.left) * e}px, ${dy}px) scale(${scale})`;
      // He takes the colour of the room he is over: the room's writing above the outro's edge, sand once he crosses it
      const middle = from.top + dy + (from.height * scale) / 2;
      mark.style.color = onRoom(middle > OUTRO * h - root.scrollTop ? ROOM_DARK : lockColour);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    draw();
    return () => {
      root.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [colour, lockColour]);

  /** Out of the focused view: the page is set in the room the visitor stopped in, back at its top */
  const comeOut = useCallback((i: number) => {
    setFocus(null);
    setHere(i);
    page.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const topOn = onRoom(colourAt(under.top));
  const floorColour = colourAt(under.floor);
  const floorOn = onRoom(floorColour);

  return (
    <div
      className={`room ${houseFont.variable} fixed inset-0 z-[150] transition-colors duration-500`}
      style={{ background: colour, color: onRoom(colour), '--room': colour, '--on-room': onRoom(colour) } as CSSProperties}
    >
      <div ref={page} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <section aria-label={title || 'The next level, locked'} className="relative h-full snap-start snap-always transition-colors duration-500" style={{ background: colour }}>
          {level ? (
            <button
              type="button"
              onClick={() => setFocus(here)}
              aria-label={`Watch ${title}, and the other levels`}
              className="group absolute inset-x-0 block cursor-pointer"
              style={{ top: TOP, bottom: FLOOR }}
            >
              <RoomVideo key={level.id} hls={level.hls} poster={level.poster} title={title} active={focus === null} near className="absolute inset-0" tapToPause={false} />
              {/* the way in: the dancer is the door to the performances */}
              <span className="absolute bottom-2 right-4 flex h-10 w-10 items-center justify-center rounded-full opacity-70 transition-opacity group-hover:opacity-100">
                <Symbol name="expand" className="h-5 w-5" />
              </span>
            </button>
          ) : (
            <NextRoom top={TOP} floor={FLOOR} />
          )}
        </section>
        <section aria-label="The next level, locked" className="relative h-full snap-start snap-always" style={{ background: lockColour, color: onRoom(lockColour) }}>
          <NextRoom top={TOP} floor={FLOOR} />
        </section>
        <section aria-label="Odubo Studio" className="relative h-full snap-start snap-always" style={{ background: ROOM_DARK, color: onRoom(ROOM_DARK) }}>
          <Outro verse={verse} platforms={platforms} top={TOP} floor={FLOOR} markRef={outroMark} />
        </section>
      </div>

      {/* The top */}
      <header
        className="pointer-events-none fixed inset-x-0 top-0 flex items-center justify-between gap-3 px-4 transition-colors duration-200"
        style={{ paddingTop: 'env(safe-area-inset-top)', height: TOP, color: topOn }}
      >
        <span ref={headerMark} className="pointer-events-auto origin-top-left transition-colors duration-200 will-change-transform">
          <HouseName as="h1" />
        </span>
        {hear && under.top === 0 && (
          <a
            href={hear.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Hear it on ${hear.app}`}
            className="pointer-events-auto flex min-h-[44px] min-w-[44px] items-center justify-end gap-2 opacity-80 hover:opacity-100"
          >
            {/* the sound is there, not here: a speaker, and the app's own mark */}
            <Symbol name="sound" className="h-[18px] w-[18px]" />
            <PlatformIcon platform={hear.platform} mono className="h-[18px] w-[18px]" />
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        )}
      </header>

      {/* The floor */}
      <nav
        aria-label="The world"
        className="fixed inset-x-0 bottom-0 flex flex-col items-center gap-4 px-4 transition-colors duration-200 [@media(max-height:600px)]:gap-1"
        style={{ paddingBottom: 'var(--room-floor-gap)', color: floorOn }}
      >
        <div className="flex w-full max-w-[16rem] items-center justify-between">
          {levels.length > 0 && <Door href={`/levels${room}`} symbol="levels" label="Levels" />}
          <Door href={`/music${room}`} symbol="music" label="Music" />
          {storeOpen && <Door href="/gear" symbol="gear" label="Gear" />}
        </div>
        <SaveYourProgress colour={floorColour} on={floorOn} className="w-full max-w-sm" />
      </nav>

      {focus !== null && <FocusView levels={levels} platforms={platforms} start={focus} onClose={comeOut} />}
    </div>
  );
}

/** A door on the floor: its symbol, its name for search and screen readers */
function Door({ href, symbol, label }: { href: string; symbol: 'levels' | 'music' | 'gear'; label: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className="flex h-12 w-12 items-center justify-center transition-[opacity,transform] hover:opacity-70 active:scale-95">
      <Symbol name={symbol} className="h-7 w-7" />
    </Link>
  );
}
