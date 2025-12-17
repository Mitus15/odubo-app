'use client';

import { useEffect, useRef } from 'react';

interface FilmGrainProps {
  opacity?: number;
  animate?: boolean;
  zIndex?: number;
}

export default function FilmGrain({
  opacity = 0.035,
  animate = true,
  zIndex = 50
}: FilmGrainProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const grainedRef = useRef<boolean>(false);

  useEffect(() => {
    // Only run on client and only once
    if (typeof window === 'undefined' || grainedRef.current) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const initGrain = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const grainedModule = await import('grained');
        const grained = grainedModule.default || grainedModule;

        if (containerRef.current && !grainedRef.current) {
          grained(containerRef.current, {
            animate: animate,
            patternWidth: 150,
            patternHeight: 150,
            grainOpacity: opacity,
            grainDensity: 1.2,
            grainWidth: 1,
            grainHeight: 1,
          });
          grainedRef.current = true;
        }
      } catch (error) {
        // Silently fail - grain is a nice-to-have
        console.warn('FilmGrain: Could not initialize grained.js', error);
      }
    };

    initGrain();
  }, [opacity, animate]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex,
        mixBlendMode: 'overlay',
      }}
      aria-hidden="true"
    />
  );
}
