'use client';

import React from 'react';

interface AnimatedEQProps {
  color?: string;
  size?: number; // height in px
}

export default function AnimatedEQ({ color = '#ede8df', size = 12 }: AnimatedEQProps) {
  const barW = Math.max(2, Math.floor(size / 6));
  return (
    <span className="inline-flex items-end gap-[2px] align-middle" aria-hidden>
      <span className="eq-bar" style={{ width: barW, height: size * 0.5, backgroundColor: color }} />
      <span className="eq-bar eq-bar-mid" style={{ width: barW, height: size * 0.9, backgroundColor: color }} />
      <span className="eq-bar" style={{ width: barW, height: size * 0.65, backgroundColor: color }} />
      <style jsx>{`
        .eq-bar {
          display: inline-block;
          border-radius: 2px;
          opacity: 0.9;
          animation: eqBounce 900ms ease-in-out infinite;
        }
        .eq-bar-mid { animation-duration: 1100ms; }
        .eq-bar:nth-child(1) { animation-delay: 0ms; }
        .eq-bar:nth-child(2) { animation-delay: 120ms; }
        .eq-bar:nth-child(3) { animation-delay: 240ms; }
        @keyframes eqBounce {
          0%, 100% { transform: scaleY(0.7); opacity: 0.85; }
          50% { transform: scaleY(1.15); opacity: 1; }
        }
      `}</style>
    </span>
  );
}
