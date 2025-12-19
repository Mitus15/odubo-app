'use client';

import { useEffect, useState } from 'react';

interface FilmGrainProps {
  opacity?: number;
  animate?: boolean;
  zIndex?: number;
}

/**
 * Film Grain Effect using CSS animation
 * Pure CSS implementation for consistent cross-browser support
 */
export default function FilmGrain({
  opacity = 0.035,
  animate = true,
  zIndex = 50
}: FilmGrainProps) {
  const [isReady, setIsReady] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    motionQuery.addEventListener('change', handleChange);
    setIsReady(true);
    
    return () => motionQuery.removeEventListener('change', handleChange);
  }, []);

  if (!isReady || prefersReducedMotion) {
    // Return static noise for reduced motion or SSR
    return (
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex,
          opacity: opacity * 1.5,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex,
          opacity,
          mixBlendMode: 'overlay',
        }}
        aria-hidden="true"
      >
        {/* Animated grain layer */}
        <div 
          className={animate ? 'grain-animate' : ''}
          style={{
            position: 'absolute',
            inset: '-200%',
            width: '400%',
            height: '400%',
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
          }}
        />
      </div>
      
      {/* Inject animation keyframes */}
      <style jsx global>{`
        @keyframes grain-shift {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-2%, -2%); }
          20% { transform: translate(1%, 3%); }
          30% { transform: translate(-3%, 1%); }
          40% { transform: translate(3%, -1%); }
          50% { transform: translate(-1%, 2%); }
          60% { transform: translate(2%, -3%); }
          70% { transform: translate(-2%, 3%); }
          80% { transform: translate(3%, 1%); }
          90% { transform: translate(1%, -2%); }
        }
        
        .grain-animate {
          animation: grain-shift 0.5s steps(10) infinite;
        }
      `}</style>
    </>
  );
}
