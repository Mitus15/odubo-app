'use client';

import { useLayoutEffect } from 'react';

/**
 * A piece flies from one page to the next, the way the danceman flies into
 * the outro: the piece in the gear row becomes the piece on its own page, and
 * the hanger flies it back. The browser's own view transition does it (Safari
 * 18, Chrome): the page under it cross-fades in the same room colour, so only
 * the piece is seen to move. Where the browser has none, or the visitor asked
 * for less motion, the page simply changes.
 *
 *   fly(el, go)        the page leaving: names its piece, starts the flight, navigates
 *   useLanding(ref)    the page arriving: names its piece once it is drawn, and lets it land
 *
 * Both pages show the same photo at the same size (PieceOnFloor's PIECE_WIDTH),
 * so it is already in the cache when the piece lands.
 */

const NAME = 'piece';
/** A page slower than this to arrive comes in without the flight, rather than holding the screen */
const WAIT_MS = 1200;
/** How long a landing waits for its photo to be drawn */
const DRAW_MS = 180;

type Flight = { ready: Promise<void>; finished: Promise<void> };
type Flying = Document & { startViewTransition?: (update: () => Promise<void>) => Flight };

let landing: ((el: HTMLElement | null) => void) | null = null;

export function fly(from: HTMLElement | null, go: () => void) {
  const doc = document as Flying;
  if (!from || !doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    go();
    return;
  }
  from.style.setProperty('view-transition-name', NAME);
  let landed: HTMLElement | null = null;
  try {
    const flight = doc.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          // The leaving piece has been seen; the arriving one takes the name
          from.style.removeProperty('view-transition-name');
          const late = window.setTimeout(() => {
            landing = null;
            resolve();
          }, WAIT_MS);
          landing = (el) => {
            landing = null;
            window.clearTimeout(late);
            if (el) {
              el.style.setProperty('view-transition-name', NAME);
              landed = el;
            }
            resolve();
          };
          go();
        }),
    );
    // A flight the browser skips (a hidden tab, a resize) rejects `ready`: the page has changed all the same
    flight.ready.catch(() => {});
    flight.finished.catch(() => {}).finally(() => landed?.style.removeProperty('view-transition-name'));
  } catch {
    from.style.removeProperty('view-transition-name');
    go();
  }
}

/** On the page a piece flies to: once `find()` gives the piece, and its photo is drawn, it lands */
export function useLanding(find: () => HTMLElement | null | undefined, deps: unknown[] = []) {
  useLayoutEffect(() => {
    if (!landing) return;
    const el = find() || null;
    const photo = el?.querySelector('img');
    const drawn = photo && !(photo.complete && photo.naturalWidth) ? photo.decode().catch(() => {}) : Promise.resolve();
    Promise.race([drawn, new Promise((r) => window.setTimeout(r, DRAW_MS))]).then(() => landing?.(el));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

