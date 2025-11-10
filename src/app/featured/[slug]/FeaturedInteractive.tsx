"use client";
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

// Lazy-load decorative GSAP orbs on client only
const GlowOrbs = dynamic(() => import('@/components/GlowOrbs'), { ssr: false });

export type FeaturedLink = { label: string; href: string };

export type FeaturedConfig = {
  slug: string;
  title: string;
  subtitle?: string;
  date?: string;
  time?: string;
  venue?: string;
  momentsLink?: string; // gated; revealed after RSVP
  momentsButtonLabel?: 'RSVP' | 'Moments';
  momentsTargetPath?: string; // precomputed SSR target path for moments button
  extraLinks?: FeaturedLink[]; // all custom buttons to display
  backgroundVideoUrl?: string; // optional, if absent show gradient
};

export default function FeaturedInteractive({ config }: { config: FeaturedConfig }) {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);
  const momentsLabel = config.momentsButtonLabel || 'Moments';

  async function handleMomentsClick() {
    try {
      setLaunching(true);
      if (config.momentsTargetPath) {
        router.push(config.momentsTargetPath);
        return;
      }
      // Fallback: use momentsLink if no target was precomputed
      const raw = config.momentsLink || '/moments';
      router.push(raw);
    } finally {
      setLaunching(false);
    }
  }

  const GlowButton = ({ label, href, disabled }: { label: string; href?: string; disabled?: boolean }) => (
    <motion.a
      href={disabled ? undefined : href}
      aria-disabled={disabled}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={disabled ? {} : { scale: 1.04, filter: 'brightness(1.2)' }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`relative w-full inline-flex items-center justify-center px-6 md:px-8 py-3 md:py-3.5 rounded-full text-sm md:text-base font-semibold tracking-wide select-none ${disabled ? 'pointer-events-none opacity-40 cursor-not-allowed' : ''}`}
      style={{
        background: disabled
          ? 'linear-gradient(180deg, rgba(200,200,200,0.10) 0%, rgba(200,200,200,0.04) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%)',
        border: disabled ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.25)',
        color: disabled ? 'rgba(237,232,223,0.55)' : '#ede8df',
        boxShadow: disabled
          ? 'inset 0 1px 0 rgba(255,255,255,0.12)'
          : '0 8px 30px rgba(16, 255, 238, 0.12), inset 0 1px 0 rgba(255,255,255,0.25)',
        WebkitBackdropFilter: 'blur(14px)',
        backdropFilter: 'blur(14px)'
      }}
    >
      <span className="relative z-10">
        {label}
      </span>
      {/* soft outer glow */}
      {!disabled && (
        <span aria-hidden className="pointer-events-none absolute -inset-0.5 rounded-full opacity-40 blur-md" style={{ background: 'radial-gradient(60% 50% at 50% 50%, rgba(0,255,224,0.35), transparent)' }} />
      )}
    </motion.a>
  );

  return (
    <div className="relative w-full text-center" style={{ color: 'var(--fg, #ede8df)' }}>
  {/* Ambient orbs removed per request to eliminate green box */}
  {/* <GlowOrbs /> */}

      {/* Frosted content card */}
      <div className="mx-auto max-w-xl md:max-w-2xl px-4">
        <div
          className="relative rounded-3xl border shadow-xl ring-1 ring-white/10 border-white/15 px-5 sm:px-8 py-6 sm:py-8 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.12) 100%)',
            WebkitBackdropFilter: 'blur(18px)',
            backdropFilter: 'blur(18px)'
          }}
        >
          {/* soft edge feather removed */}
          {/* <span aria-hidden className="pointer-events-none absolute -inset-px rounded-[28px] bg-white/5" style={{ maskImage: 'radial-gradient(120% 100% at 50% 50%, black 40%, transparent 100%)' }} /> */}

          {/* Title & subtitle with glow */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div className="mb-2 text-[10px] tracking-[0.2em] uppercase text-white/70">Featured</div>
            <h1
              className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(180deg, var(--fg, #ffffff) 0%, rgba(255,255,255,0.7) 100%)', textShadow: '0 2px 12px rgba(0,0,0,0.65), 0 0 24px rgba(255,255,255,0.18), 0 0 60px rgba(0,255,224,0.16)' }}
            >
              {config.title}
            </h1>
            {(config.subtitle || config.venue || config.date) && (
              <div className="mt-3 opacity-95" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
                {config.subtitle || ''}
                {(config.venue || config.date || config.time) && (
                  <div className="mt-1 text-sm opacity-90" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.55)' }}>
                    {[config.date, config.time, config.venue].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Column layout: input above Moments, then links below */}
          <div className="mt-8 flex flex-col items-stretch gap-3 md:gap-4">
            {/* Moments button (unlocked by default) */}
            <button
              type="button"
              onClick={handleMomentsClick}
              disabled={launching}
              className="relative w-full inline-flex items-center justify-center px-6 md:px-8 py-3 md:py-3.5 rounded-full text-sm md:text-base font-semibold tracking-wide select-none"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#ede8df',
                boxShadow: '0 8px 30px rgba(16, 255, 238, 0.12), inset 0 1px 0 rgba(255,255,255,0.25)',
                WebkitBackdropFilter: 'blur(14px)',
                backdropFilter: 'blur(14px)'
              }}
            >
              <span className="relative z-10">{launching ? 'Opening…' : momentsLabel}</span>
              <span aria-hidden className="pointer-events-none absolute -inset-0.5 rounded-full opacity-40 blur-md" style={{ background: 'radial-gradient(60% 50% at 50% 50%, rgba(0,255,224,0.35), transparent)' }} />
            </button>

            {/* Custom links in a single vertical column */}
            {(config.extraLinks || []).map((l, i) => (
              <GlowButton key={i} label={l.label} href={l.href} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
