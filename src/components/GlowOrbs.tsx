"use client";
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * Decorative animated glow orbs using GSAP.
 * Absolutely positions two blurred gradient blobs and animates them subtly.
 */
export default function GlowOrbs() {
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el1 = ref1.current;
    const el2 = ref2.current;
    if (!el1 || !el2) return;

    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(el1, { x: 60, y: -40, scale: 1.15, duration: 8, ease: 'sine.inOut' }, 0)
      .to(el2, { x: -50, y: 30, scale: 0.9, duration: 10, ease: 'sine.inOut' }, 0);

    return () => { tl.kill(); };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        ref={ref1}
        className="absolute -top-24 -left-24 w-[36rem] h-[36rem] rounded-full blur-3xl opacity-30"
        style={{ background: 'radial-gradient(circle at 30% 30%, rgba(0,255,224,0.6), transparent 60%)' }}
      />
      <div
        ref={ref2}
        className="absolute -bottom-24 -right-24 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-25"
        style={{ background: 'radial-gradient(circle at 70% 70%, rgba(255,120,200,0.5), transparent 60%)' }}
      />
    </div>
  );
}
