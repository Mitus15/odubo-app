'use client';

import { useRef, useCallback, useEffect } from 'react';
import type { TetrisEngine } from './TetrisEngine';

interface TouchControlsProps {
  engineRef: React.MutableRefObject<TetrisEngine | null>;
}

const SWIPE_THRESHOLD = 20; // px minimum to trigger swipe
const TAP_MAX_DISTANCE = 10; // px max movement to count as tap
const TAP_MAX_DURATION = 200; // ms max hold to count as tap
const REPEAT_INTERVAL = 80; // ms for held horizontal moves

/**
 * TouchControls — Transparent overlay for mobile gesture input
 *
 * - Tap = rotate
 * - Swipe left/right = move piece
 * - Swipe down = soft drop
 * - Swipe up = hard drop
 * - Hold horizontal = repeated moves
 *
 * Uses e.preventDefault() on touchstart/touchmove to prevent scroll leaking
 * to the clips feed underneath.
 */
export default function TouchControls({ engineRef }: TouchControlsProps) {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasSwiped = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const clearRepeat = useCallback(() => {
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  }, []);

  // Use native event listeners for non-passive touch handling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault(); // Block scroll propagation to clips
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      hasSwiped.current = false;
      clearRepeat();
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // Block scroll propagation to clips
      if (!touchStartRef.current) return;
      const engine = engineRef.current;
      if (!engine || engine.gameOver) return;

      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Only trigger once per swipe direction
      if (hasSwiped.current) return;

      // Horizontal swipe
      if (absDx > SWIPE_THRESHOLD && absDx > absDy * 1.2) {
        hasSwiped.current = true;
        const moveDir = dx > 0 ? 'right' : 'left';

        if (moveDir === 'right') {
          engine.moveRight();
        } else {
          engine.moveLeft();
        }

        // Start repeat for held horizontal swipe
        repeatTimerRef.current = setInterval(() => {
          const eng = engineRef.current;
          if (!eng || eng.gameOver) { clearRepeat(); return; }
          if (moveDir === 'right') eng.moveRight();
          else eng.moveLeft();
        }, REPEAT_INTERVAL);
      }

      // Vertical swipe down (soft drop)
      if (absDy > SWIPE_THRESHOLD && absDy > absDx * 1.2 && dy > 0) {
        hasSwiped.current = true;
        engine.moveDown();

        // Repeat soft drop
        repeatTimerRef.current = setInterval(() => {
          const eng = engineRef.current;
          if (!eng || eng.gameOver) { clearRepeat(); return; }
          eng.moveDown();
        }, REPEAT_INTERVAL);
      }

      // Vertical swipe up (hard drop) — immediate, no repeat
      if (absDy > SWIPE_THRESHOLD && absDy > absDx * 1.2 && dy < 0) {
        hasSwiped.current = true;
        engine.hardDrop();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      clearRepeat();

      if (!touchStartRef.current) return;
      const engine = engineRef.current;
      if (!engine || engine.gameOver) return;

      // If no swipe detected, check for tap
      if (!hasSwiped.current) {
        const touch = e.changedTouches[0];
        const dx = Math.abs(touch.clientX - touchStartRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartRef.current.y);
        const duration = Date.now() - touchStartRef.current.time;

        if (dx < TAP_MAX_DISTANCE && dy < TAP_MAX_DISTANCE && duration < TAP_MAX_DURATION) {
          engine.rotate();
        }
      }

      touchStartRef.current = null;
    };

    // CRITICAL: { passive: false } so preventDefault works
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      clearRepeat();
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [engineRef, clearRepeat]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10"
      style={{
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    />
  );
}
