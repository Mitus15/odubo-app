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
  mode?: string; // 'event' | 'product' | 'music' | 'video' | 'app_update'
  productHandle?: string;
  productPrice?: string;
  productCtaText?: string;
};

export default function FeaturedInteractive({ config }: { config: FeaturedConfig }) {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const momentsLabel = config.momentsButtonLabel || 'Moments';

  // Countdown timer for product mode
  useEffect(() => {
    if (config.mode === 'product' && config.date) {
      setCurrentTime(new Date());
      const interval = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(interval);
    }
  }, [config.mode, config.date]);

  // Check if product is pre-order (release date in future)
  const isPreOrder = useMemo(() => {
    if (config.mode !== 'product' || !config.date) return false;
    try {
      const releaseDate = new Date(config.date);
      return releaseDate > new Date();
    } catch {
      return false;
    }
  }, [config.mode, config.date]);

  // Format countdown time
  const formatCountdown = (targetDate: Date) => {
    if (!currentTime) return '';
    const diff = targetDate.getTime() - currentTime.getTime();
    if (diff <= 0) return 'Available Now';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    
    return parts.join(' ');
  };

  async function handleMomentsClick() {
    try {
      setLaunching(true);
      
      // Check if we should use subdomain (production) or path (dev)
      const isProduction = window.location.hostname.includes('odubo.studio');
      
      if (config.momentsTargetPath) {
        // If there's a specific target path (like /moments/rsvp/123)
        if (isProduction) {
          // Convert /moments/xyz to moments.odubo.studio/xyz
          const momentsPath = config.momentsTargetPath.replace(/^\/moments/, '');
          window.location.href = `https://moments.odubo.studio${momentsPath}`;
        } else {
          router.push(config.momentsTargetPath);
        }
        return;
      }
      
      // Fallback: redirect to moments subdomain root
      if (isProduction) {
        window.location.href = 'https://moments.odubo.studio';
      } else {
        router.push('/moments');
      }
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

      {/* Content without card background */}
      <div className="mx-auto max-w-xl md:max-w-2xl px-4">
        <div className="relative px-5 sm:px-8 py-6 sm:py-8">
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
            
            {/* Event mode: subtitle and venue */}
            {config.mode === 'event' && (config.subtitle || config.venue || config.date) && (
              <div className="mt-3 opacity-95" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
                {config.subtitle || ''}
                {(config.venue || config.date || config.time) && (
                  <div className="mt-1 text-sm opacity-90" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.55)' }}>
                    {[config.date, config.time, config.venue].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            )}
            
            {/* Product mode: countdown timer if pre-order */}
            {config.mode === 'product' && isPreOrder && config.date && currentTime && (
              <div className="mt-4">
                <div className="text-xs tracking-[0.2em] uppercase text-white/60 mb-1">Releases In</div>
                <div 
                  className="text-4xl md:text-5xl font-bold tracking-tight tabular-nums"
                  style={{ 
                    transform: 'scaleY(2.5)',
                    transformOrigin: 'center',
                    textShadow: '0 2px 12px rgba(0,0,0,0.65), 0 0 24px rgba(255,255,255,0.18)'
                  }}
                >
                  {formatCountdown(new Date(config.date))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Column layout: input above Moments, then links below */}
          <div className="mt-8 flex flex-col items-stretch gap-3 md:gap-4">
            {/* Product Mode: Price + Shop button */}
            {config.mode === 'product' && config.productHandle && (
              <>
                {config.productPrice && (
                  <div className="text-3xl md:text-4xl font-bold tracking-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                    {config.productPrice}
                  </div>
                )}
                <motion.a
                  href={`/store/product/${config.productHandle}`}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.04, filter: 'brightness(1.2)' }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
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
                  <span className="relative z-10">{isPreOrder ? 'Pre-order' : 'Shop Now'}</span>
                  <span aria-hidden className="pointer-events-none absolute -inset-0.5 rounded-full opacity-40 blur-md" style={{ background: 'radial-gradient(60% 50% at 50% 50%, rgba(0,255,224,0.35), transparent)' }} />
                </motion.a>
              </>
            )}

            {/* Event Mode: Moments button */}
            {config.mode === 'event' && (
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
            )}

            {/* Custom links in a single vertical column - Event mode only */}
            {config.mode === 'event' && (config.extraLinks || []).map((l, i) => (
              <GlowButton key={i} label={l.label} href={l.href} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
