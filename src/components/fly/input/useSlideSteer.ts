'use client';

import { useEffect, type RefObject } from 'react';
import type { FlyRuntime } from '../runtime';

/** Metres he moves for a slow slide the full width of the screen. */
export const DEFAULT_SENSITIVITY = 14;

/**
 * A quick flick carries him further than a slow slide of the same length,
 * up to this many times, so crossing the sky takes one swipe while a slow
 * finger stays precise. Finger speeds in px per ms.
 */
const ACCEL_MAX = 2;
const ACCEL_FROM = 0.6;
const ACCEL_TO = 2.4;

/**
 * Steering by sliding, like a trackpad, in both directions: the finger's
 * movement moves him, not its position. Lift and touch anywhere to carry on,
 * so the thumb never has to sit on top of him. Mouse drags work the same way.
 * Both axes use the screen's width as the scale, so a centimetre of finger is
 * the same distance whichever way it goes.
 */
export function useSlideSteer(
  surface: RefObject<HTMLElement | null>,
  runtime: FlyRuntime,
  sensitivity: number,
  acceleration: boolean,
  onSlide?: () => void,
): void {
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    let pointer: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;

    const down = (event: PointerEvent) => {
      if (pointer !== null) return;
      pointer = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = event.timeStamp;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      const dt = Math.max(1, event.timeStamp - lastTime);
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = event.timeStamp;
      if (dx === 0 && dy === 0) return;
      let gain = 1;
      if (acceleration) {
        const speed = Math.hypot(dx, dy) / dt;
        const share = Math.min(1, Math.max(0, (speed - ACCEL_FROM) / (ACCEL_TO - ACCEL_FROM)));
        gain = 1 + (ACCEL_MAX - 1) * share;
      }
      const scale = (sensitivity * gain) / Math.max(1, element.clientWidth);
      // Down the screen is −y in the fall's space.
      runtime.engine.steer(dx * scale, -dy * scale);
      onSlide?.();
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId === pointer) pointer = null;
    };
    // In-app browsers scroll or bounce the page unless told not to. A menu's own
    // list (marked data-fly-scroll) is left to scroll; its pointercancel ends the slide.
    const hold = (event: TouchEvent) => {
      if ((event.target as Element | null)?.closest?.('[data-fly-scroll]')) return;
      event.preventDefault();
    };

    element.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    element.addEventListener('touchmove', hold, { passive: false });
    return () => {
      element.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      element.removeEventListener('touchmove', hold);
    };
  }, [surface, runtime, sensitivity, acceleration, onSlide]);
}
