'use client';

import { useState, useEffect } from 'react';
import ClipsFeed from '@/components/clips/ClipsFeed';
import { AudioProvider } from '@/contexts/AudioContext';

interface VerseOfTheDay {
  text: string;
  reference: string;
  error: string | null;
}

interface HomePageClientProps {
  verseOfTheDay: VerseOfTheDay;
}

export default function HomePageClient({ verseOfTheDay }: HomePageClientProps) {
  const HEADER_HEIGHT = 56;
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [navHeight, setNavHeight] = useState<number>(HEADER_HEIGHT);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);

  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    const parts = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'shortGeneric'
    }).formatToParts(date);

    const map: Record<string, string> = {};
    parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    return `${map.weekday} ${map.month} ${map.day} ${map.hour}:${map.minute}:${map.second}.${milliseconds}`;
  };

  useEffect(() => {
    const updateNavHeight = () => {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--app-nav-height');
        const px = parseInt(v || `${HEADER_HEIGHT}`, 10);
        setNavHeight(Number.isFinite(px) ? px : HEADER_HEIGHT);
      } catch {
        setNavHeight(HEADER_HEIGHT);
      }
    };

    updateNavHeight();
    window.addEventListener('resize', updateNavHeight);
    window.addEventListener('orientationchange', updateNavHeight);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Service workers are now registered globally in ServiceWorkerRegistration component

    return () => {
      window.removeEventListener('resize', updateNavHeight);
      window.removeEventListener('orientationchange', updateNavHeight);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <AudioProvider>
      <div className="relative bg-black text-[#ede8df] min-h-[100svh]">
        {/* Overlay toggle button (top-right) */}
        <div
          className="fixed right-4 z-30 pointer-events-none"
          style={{ top: navHeight + 12 }}
        >
          <button
            onClick={() => setShowOverlay(v => !v)}
            className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/12 border border-white/20 text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl hover:bg-white/18 active:scale-95 transition-all"
            aria-pressed={showOverlay}
            aria-label={showOverlay ? 'Hide proverb overlay' : 'Show proverb overlay'}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5h14v10H7l-2 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-[0.08em]">{showOverlay ? 'Hide' : 'Show'}</span>
          </button>
        </div>

        {/* Clips layer */}
        <div
          style={{ position: 'fixed', top: navHeight, left: 0, right: 0, bottom: 0, backgroundColor: '#000', overflow: 'hidden' }}
          className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        >
          <ClipsFeed navHeight={navHeight} />
        </div>

        {/* Verse + Clock overlay */}
        <div
          className={`pointer-events-none fixed left-0 right-0 flex items-center justify-center px-6 transition-all duration-300 ease-out ${showOverlay ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}
          style={{ top: navHeight, bottom: 0 }}
        >
          <div className="w-full max-w-3xl flex flex-col items-center gap-4 text-center">
            <blockquote className="glass-text text-[1.25rem] md:text-[1.5rem] leading-relaxed drop-shadow-[0_8px_26px_rgba(0,0,0,0.65)]">
              “{verseOfTheDay.text}”
            </blockquote>

            <div
              className="relative rounded-lg px-3 py-1.5 backdrop-blur-xl border border-white/12 text-white/80 font-mono text-[0.52rem] md:text-[0.6rem] shadow-[0_10px_40px_rgba(0,0,0,0.45)]"
              style={{
                background: 'linear-gradient(120deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025))',
                mixBlendMode: 'screen'
              }}
            >
              <div className="absolute inset-0 bg-white/4" />
              <span className="relative" style={{ letterSpacing: '0.06em' }}>
                {currentTime ? formatTime(currentTime) : '— — : — — : — — . — — —'}
              </span>
            </div>

            {verseOfTheDay.error && (
              <p className="text-xs text-amber-100/80 drop-shadow-[0_4px_20px_rgba(0,0,0,0.45)]">
                {verseOfTheDay.error}
              </p>
            )}
          </div>
        </div>
      </div>
    </AudioProvider>
  );
}
