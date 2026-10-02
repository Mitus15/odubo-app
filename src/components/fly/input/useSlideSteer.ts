'use client';

import { useEffect, type RefObject } from 'react';
import type { FlyRuntime } from '../runtime';

/** Metres he moves across for a slide the full width of the screen. */
export const DEFAULT_SENSITIVITY = 18;

/**
 * Steering by sliding, like a trackpad: the finger's movement moves him, not
 * its position. Lift and touch anywhere to carry on, so the thumb never has
 * to sit on top of him. Mouse drags work the same way on a desktop.
 */
export function useSlideSteer(
  surface: RefObject<HTMLElement | null>,
  runtime: FlyRuntime,
  sensitivity: number,
  onSlide?: () => void,
): void {
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    let pointer: number | null = null;
    let lastX = 0;

    const down = (event: PointerEvent) => {
      if (pointer !== null) return;
      pointer = event.pointerId;
      lastX = event.clientX;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      if (dx === 0) return;
      runtime.engine.steerBy((dx * sensitivity) / Math.max(1, element.clientWidth));
      onSlide?.();
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId === pointer) pointer = null;
    };
    // In-app browsers scroll or bounce the page unless told not to.
    const hold = (event: TouchEvent) => event.preventDefault();

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
  }, [surface, runtime, sensitivity, onSlide]);
}
