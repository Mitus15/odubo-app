'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ClipsFeed from '@/components/clips/ClipsFeed';
import SingleVideoPlayer from '@/components/clips/SingleVideoPlayer';
import TracksFeed from '@/components/music/TracksFeed';
import ClipsErrorBoundary from '@/components/clips/ClipsErrorBoundary';
import ExpandableLogoMenu from '@/components/clips/ExpandableLogoMenu';
import ConnectButton from '@/components/navigation/ConnectButton';
import FilmGrain from '@/components/ui/FilmGrain';
import Image from 'next/image';
import { useAudio } from '@/contexts/AudioContext';
import { useStore } from '@/contexts/StoreContext';
import { useUnifiedMedia } from '@/contexts/UnifiedMediaContext';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { usePageAnalytics } from '@/hooks/usePageAnalytics';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';
import type { ClipItem } from '@/types/clips';
import type { Track, Album } from '@/types/music';

// Modal types that can be opened via URL
export type DefaultModal = 'store' | 'moments' | 'media' | 'links' | null;

interface VerseOfTheDay {
  text: string;
  reference: string;
  error: string | null;
}

interface HomePageClientProps {
  verseOfTheDay: VerseOfTheDay;
  homepageMode?: 'clips' | 'music';
  initialClipId?: number | null;
  initialClips?: ClipItem[];
  defaultModal?: DefaultModal;
}

export default function HomePageClient({
  verseOfTheDay,
  homepageMode = 'clips',
  initialClipId,
  initialClips,
  defaultModal
}: HomePageClientProps) {
  // No header - content goes edge to edge
  const HEADER_HEIGHT = 0;
  // Intro stays until user dismisses (no auto-collapse timer)

  const router = useRouter();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [navHeight, setNavHeight] = useState<number>(HEADER_HEIGHT);

  // First visit detection for B.A.A.D brand entrance
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem('baad_welcomed')) {
        setIsFirstVisit(true);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  // Mark first visit complete (must be defined before effects that use it)
  const markWelcomed = useCallback(() => {
    try {
      localStorage.setItem('baad_welcomed', 'true');
      setIsFirstVisit(false);
    } catch {
      // localStorage not available
    }
  }, []);

  // Verse overlay states - skip intro if opening a modal
  const [phase, setPhase] = useState<'intro' | 'collapsed' | 'expanded'>(defaultModal ? 'collapsed' : 'intro');
  const [hasInteracted, setHasInteracted] = useState(!!defaultModal);

  // Active content for global menu (clips or tracks)
  const [activeClip, setActiveClip] = useState<ClipItem | null>(null);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [activeAlbum, setActiveAlbum] = useState<Album | null>(null);

  // Clips data for SingleVideoPlayer (only used in clips mode)
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<'forward' | 'backward' | null>(null);

  // LinkTree modal state (for /links route)
  const [linkTreeOpen, setLinkTreeOpen] = useState(false);

  // Audio state
  const { isMuted, toggleMute: toggleClipsMute } = useAudio();

  // Music player state
  const { state: musicPlayerState, toggleMute: toggleMusicMute } = useMusicPlayer();

  // Unified mute handler - works for both clips and music modes
  const handleMuteToggle = useCallback(() => {
    if (homepageMode === 'music') {
      toggleMusicMute();
    } else {
      toggleClipsMute();
    }
  }, [homepageMode, toggleMusicMute, toggleClipsMute]);

  // Get current mute state based on mode
  const currentMuted = homepageMode === 'music' ? musicPlayerState.isMuted : isMuted;

  // Modal contexts
  const { openStore, view: storeView, closeStore } = useStore();
  const { openHub, modalStack, closeAll: closeMedia } = useUnifiedMedia();

  // Page analytics tracking
  const pageTitle = homepageMode === 'clips' ? 'Clips' : 'Music';
  usePageAnalytics({
    title: defaultModal
      ? `${defaultModal.charAt(0).toUpperCase() + defaultModal.slice(1)} | Odubo Studio`
      : `${pageTitle} | Odubo Studio`
  });

  // Clip intelligence analytics (only for clips mode)
  const analytics = useAnalyticsSafe();

  // Clip milestone callback
  const handleWatchMilestone = useCallback((
    clipId: number,
    milestone: number,
    watchSeconds: number,
    durationSeconds: number
  ) => {
    analytics?.trackClipMilestone(clipId, milestone, watchSeconds, durationSeconds);
  }, [analytics]);

  // Clip completion callback
  const handleWatchComplete = useCallback((
    clipId: number,
    watchPercent: number,
    watchSeconds: number,
    durationSeconds: number
  ) => {
    analytics?.trackClipComplete(clipId, watchPercent, watchSeconds, durationSeconds, false);
  }, [analytics]);

  // Auto-open modal based on defaultModal prop
  useEffect(() => {
    if (!defaultModal) return;

    const timer = setTimeout(() => {
      switch (defaultModal) {
        case 'store':
          openStore();
          break;
        case 'moments':
          // Redirect to moments subdomain instead of opening modal
          const isProduction = window.location.hostname.includes('odubo.studio');
          if (isProduction) {
            window.location.href = 'https://moments.odubo.studio';
          } else {
            window.location.href = '/moments';
          }
          break;
        case 'media':
          openHub('videos');
          break;
        case 'links':
          setLinkTreeOpen(true);
          break;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [defaultModal, openStore, openHub]);

  // Navigate back to / when modal closes (only if opened via URL)
  useEffect(() => {
    if (!defaultModal) return;

    const storeIsClosed = storeView === 'closed';
    const mediaIsClosed = modalStack.length === 0;
    const linksIsClosed = !linkTreeOpen;

    if (storeIsClosed && mediaIsClosed && linksIsClosed) {
      router.replace('/', { scroll: false });
    }
  }, [defaultModal, storeView, modalStack.length, linkTreeOpen, router]);

  // Ref to hold feed's scrollToNext function
  const scrollToNextRef = useRef<(() => void) | null>(null);

  // Handle clips data from ClipsFeed
  const handleClipsReady = useCallback((newClips: ClipItem[], newActiveIndex: number) => {
    setClips(newClips);
    setActiveIndex(newActiveIndex);
  }, []);

  // Handle auto-advance to next clip
  const handleAdvanceToNext = useCallback(() => {
    scrollToNextRef.current?.();
  }, []);

  // Handle active track change (music mode)
  const handleActiveTrackChange = useCallback((track: Track | null, album: Album | null) => {
    setActiveTrack(track);
    setActiveAlbum(album);
  }, []);

  // Clock update
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Intro stays until user dismisses (tap backdrop or "Enter the Studio" button)

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

  // "Enter the Studio" button handler (first visit only)
  const handleEnterStudio = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setHasInteracted(true);
    setPhase('collapsed');
    markWelcomed();
  }, [markWelcomed]);

  // Collapse when tapping content area (only if expanded)
  const handleBackdropClick = useCallback(() => {
    if (phase === 'expanded') {
      setPhase('collapsed');
    }
    if (phase === 'intro' && !hasInteracted) {
      setHasInteracted(true);
      setPhase('collapsed');
      if (isFirstVisit) markWelcomed();
    }
  }, [phase, hasInteracted, isFirstVisit, markWelcomed]);

  const isShowingVerse = phase === 'intro' || phase === 'expanded';

  // Hide fixed buttons (mute, verse, master, connect) when any full-screen overlay is open
  const anyOverlayOpen = storeView !== 'closed' || modalStack.length > 0 || linkTreeOpen;

  return (
    <div className="relative bg-black text-[#ede8df]" style={{ minHeight: '100dvh' }}>
      {/* Animated film grain overlay */}
      <FilmGrain opacity={0.03} />

      {/* Content viewport wrapped in error boundary */}
      <ClipsErrorBoundary>
        {/* CLIPS MODE */}
        {homepageMode === 'clips' && (
          <>
            {/* SingleVideoPlayer - FIXED position, plays the active video */}
            {clips.length > 0 && (
              <SingleVideoPlayer
                clips={clips}
                activeIndex={activeIndex}
                onVideoReady={setVideoReady}
                scrollDirection={scrollDirection}
                onAdvanceToNext={handleAdvanceToNext}
                onWatchMilestone={handleWatchMilestone}
                onWatchComplete={handleWatchComplete}
              />
            )}

            {/* Clips scroll layer */}
            <div
              className="fixed inset-0 lg:left-20 xl:left-64 bg-transparent z-20"
              style={{ overscrollBehavior: 'none' }}
              onClick={handleBackdropClick}
            >
              <ClipsFeed
                navHeight={0}
                initialClipId={initialClipId}
                initialClips={initialClips}
                onActiveClipChange={setActiveClip}
                onClipsReady={handleClipsReady}
                onScrollDirectionChange={setScrollDirection}
                videoReady={videoReady}
                scrollToNextRef={scrollToNextRef}
              />
            </div>
          </>
        )}

        {/* MUSIC MODE */}
        {homepageMode === 'music' && (
          <div
            className="fixed inset-0 lg:left-20 xl:left-64 bg-black z-20"
            style={{ overscrollBehavior: 'none' }}
            onClick={handleBackdropClick}
          >
            <TracksFeed
              navHeight={0}
              onActiveTrackChange={handleActiveTrackChange}
              scrollToNextRef={scrollToNextRef}
            />
          </div>
        )}
      </ClipsErrorBoundary>

      {/* Mute Button - Top right, hidden when overlays are open */}
      {!anyOverlayOpen && <button
        onClick={handleMuteToggle}
        className="fixed z-40 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white shadow-lg active:scale-90 transition-transform right-4 md:right-16"
        style={{
          top: 'max(env(safe-area-inset-top, 12px), 12px)',
          width: 44,
          height: 44,
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
        aria-label={currentMuted ? 'Unmute' : 'Mute'}
      >
        {currentMuted ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>}

      {/* Word Button - Single transforming button, hidden when overlays are open */}
      <AnimatePresence mode="wait">
        {phase !== 'intro' && !anyOverlayOpen && (
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
              {/* B.A.A.D Brand Entrance (first visit only, intro phase only) */}
              {isFirstVisit && phase === 'intro' && (
                <>
                  {/* Brand lockup */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <Image
                      src="/brand-logos/baad@odubo.png"
                      alt="B.A.A.D @ Odubo.Studio"
                      width={180}
                      height={180}
                      className="mx-auto drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]"
                      priority
                    />
                  </motion.div>

                  {/* Tagline */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 0.5 }}
                    className="text-[0.7rem] md:text-xs uppercase text-[#ede8df]/70 font-light"
                    style={{ letterSpacing: '0.2em' }}
                  >
                    Bold Authentic Aesthetic Dreams
                  </motion.p>

                  {/* Terracotta divider */}
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 1.5, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="w-16 h-px bg-[#843c2d]/60"
                    style={{ originX: 0.5 }}
                  />
                </>
              )}

              {/* Verse text */}
              <motion.blockquote
                className="text-[1.15rem] md:text-[1.4rem] leading-[1.7] font-light text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]"
                {...(isFirstVisit && phase === 'intro' ? {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  transition: { delay: 1.5, duration: 0.5 }
                } : {})}
              >
                &ldquo;{verseOfTheDay.text}&rdquo;
              </motion.blockquote>

              {/* Reference */}
              {verseOfTheDay.reference && (
                <motion.p
                  className="text-xs font-medium uppercase tracking-[0.15em] text-white/60"
                  {...(isFirstVisit && phase === 'intro' ? {
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    transition: { delay: 2, duration: 0.4 }
                  } : {})}
                >
                  — {verseOfTheDay.reference}
                </motion.p>
              )}

              {/* Clock */}
              <motion.div
                className="rounded-lg px-3 py-1.5 bg-white/5 backdrop-blur-sm border border-white/10 text-white/50 font-mono text-[0.5rem] md:text-[0.55rem]"
                {...(isFirstVisit && phase === 'intro' ? {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  transition: { delay: 2, duration: 0.4 }
                } : {})}
              >
                <span style={{ letterSpacing: '0.08em' }}>
                  {currentTime ? formatTime(currentTime) : '— — : — — : — — . — — —'}
                </span>
              </motion.div>

              {/* First visit: "Enter the Studio" button */}
              {isFirstVisit && phase === 'intro' && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.5, duration: 0.4 }}
                  onClick={handleEnterStudio}
                  className="mt-2 px-8 py-3 rounded-full bg-[#843c2d]/80 backdrop-blur-sm border border-[#843c2d]/40 text-[#ede8df] text-sm uppercase tracking-[0.15em] hover:bg-[#843c2d] active:scale-95 transition-all"
                  style={{ fontFamily: 'Baskerville, "Times New Roman", Times, Georgia, serif' }}
                >
                  Enter the Studio
                </motion.button>
              )}

              {/* Return visit: Tap hint during intro */}
              {!isFirstVisit && phase === 'intro' && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 }}
                  className="text-[10px] text-white/40 uppercase tracking-widest"
                >
                  Tap anywhere to browse
                </motion.p>
              )}

              {/* First visit: subtle hint below button */}
              {isFirstVisit && phase === 'intro' && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 3.5, duration: 0.5 }}
                  className="text-[0.6rem] text-[#b2a491]/50 uppercase"
                  style={{ letterSpacing: '0.15em' }}
                >
                  Music · Fashion · Moments
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

      {/* Master button - hidden when any overlay is open */}
      {!anyOverlayOpen && (
        <div className="md:hidden">
          <ExpandableLogoMenu
            clipId={homepageMode === 'clips' ? activeClip?.id : undefined}
          />
        </div>
      )}

      {/* Connect button - top-right, under mute button. Auto-trigger waits for welcome dismissal. */}
      <ConnectButton
        externalOpen={linkTreeOpen}
        onExternalOpenHandled={() => setLinkTreeOpen(false)}
        suppressAutoTrigger={phase === 'intro'}
      />
    </div>
  );
}
