'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ClipsFeed from '@/components/clips/ClipsFeed';
import ExpandableLogoMenu from '@/components/clips/ExpandableLogoMenu';
import FilmGrain from '@/components/ui/FilmGrain';
import { useAudio } from '@/contexts/AudioContext';
import type { ClipItem } from '@/types/clips';

interface VerseOfTheDay {
  text: string;
  reference: string;
  error: string | null;
}

interface HomePageClientProps {
  verseOfTheDay: VerseOfTheDay;
  initialClipId?: number | null;
}

export default function HomePageClient({ verseOfTheDay, initialClipId }: HomePageClientProps) {
  // No header - clips go edge to edge
  const HEADER_HEIGHT = 0;
  const INTRO_DURATION = 4000; // Show verse for 4 seconds before collapsing

  const { isMuted, toggleMute, armAudio } = useAudio();

  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [navHeight, setNavHeight] = useState<number>(HEADER_HEIGHT);

  // Verse overlay states
  const [phase, setPhase] = useState<'intro' | 'collapsed' | 'expanded'>('intro');
  const [hasInteracted, setHasInteracted] = useState(false);

  // Active clip for global menu
  const [activeClip, setActiveClip] = useState<ClipItem | null>(null);

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    armAudio();
    toggleMute();
  }, [armAudio, toggleMute]);

  // Clock update
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-collapse after intro
  useEffect(() => {
    if (phase === 'intro') {
      const timer = setTimeout(() => {
        setPhase('collapsed');
      }, INTRO_DURATION);
      return () => clearTimeout(timer);
    }
  }, [phase]);

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

    return () => {
      window.removeEventListener('resize', updateNavHeight);
      window.removeEventListener('orientationchange', updateNavHeight);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Toggle expanded/collapsed
  const handlePillClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setHasInteracted(true);
    setPhase(p => p === 'expanded' ? 'collapsed' : 'expanded');
  }, []);

  // Collapse when tapping video area (only if expanded)
  const handleBackdropClick = useCallback(() => {
    if (phase === 'expanded') {
      setPhase('collapsed');
    }
    // Also collapse intro early on first interaction
    if (phase === 'intro' && !hasInteracted) {
      setHasInteracted(true);
      setPhase('collapsed');
    }
  }, [phase, hasInteracted]);

  const isShowingVerse = phase === 'intro' || phase === 'expanded';

  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 bg-black text-[#ede8df]"
      style={{
        overflow: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Animated film grain overlay */}
      <FilmGrain opacity={0.03} />

      {/* Clips layer - edge to edge, offset for sidebar on desktop */}
      <div
        className="absolute top-0 left-0 right-0 bottom-0 lg:left-20 xl:left-64 bg-black"
        style={{
          overscrollBehavior: 'none',
        }}
        onClick={handleBackdropClick}
      >
        <ClipsFeed navHeight={0} initialClipId={initialClipId} onActiveClipChange={setActiveClip} />
      </div>

      {/* Word Button - Single transforming button (left on mobile, right on desktop) */}
      <AnimatePresence mode="wait">
        {phase !== 'intro' && (
          <motion.button
            key={phase}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onClick={handlePillClick}
            className="fixed z-40 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white shadow-lg active:scale-90 transition-transform left-4 md:left-auto md:right-4"
            style={{
              top: 'max(env(safe-area-inset-top, 12px), 12px)',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              width: 44,
              height: 44,
            }}
            aria-label={phase === 'expanded' ? 'Close verse' : 'Show verse'}
          >
            {phase === 'expanded' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mute Button - Persistent, right side on mobile */}
      <button
        onClick={handleMuteToggle}
        className="fixed z-40 right-4 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white shadow-lg active:scale-90 transition-transform"
        style={{
          top: 'max(env(safe-area-inset-top, 12px), 12px)',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          width: 44,
          height: 44,
        }}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>

      {/* Full Verse Overlay (intro & expanded states) */}
      <AnimatePresence>
        {isShowingVerse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 lg:left-20 xl:left-64 flex items-center justify-center px-6 bg-black/60 backdrop-blur-sm"
            style={{ top: 0, zIndex: 35 }}
            onClick={handleBackdropClick}
          >
            <motion.div
              className="w-full max-w-2xl flex flex-col items-center gap-5 text-center"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Verse text */}
              <blockquote className="text-[1.15rem] md:text-[1.4rem] leading-[1.7] font-light text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
                "{verseOfTheDay.text}"
              </blockquote>

              {/* Reference */}
              {verseOfTheDay.reference && (
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/60">
                  — {verseOfTheDay.reference}
                </p>
              )}

              {/* Clock */}
              <div className="rounded-lg px-3 py-1.5 bg-white/5 backdrop-blur-sm border border-white/10 text-white/50 font-mono text-[0.5rem] md:text-[0.55rem]">
                <span style={{ letterSpacing: '0.08em' }}>
                  {currentTime ? formatTime(currentTime) : '— — : — — : — — . — — —'}
                </span>
              </div>

              {/* Tap hint during intro */}
              {phase === 'intro' && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 }}
                  className="text-[10px] text-white/40 uppercase tracking-widest"
                >
                  Tap anywhere to browse
                </motion.p>
              )}

              {verseOfTheDay.error && (
                <p className="text-xs text-amber-200/60">
                  {verseOfTheDay.error}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global floating menu - draggable like iPhone Accessibility button */}
      {/* Hidden on desktop (md breakpoint and above) - mobile only */}
      <div className="md:hidden">
        <ExpandableLogoMenu
          clipId={activeClip?.id}
          clipTitle={activeClip?.title}
          clipArtist={activeClip?.artist}
        />
      </div>
    </div>
  );
}
