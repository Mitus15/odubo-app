"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ClipItem } from '@/types/clips';
import { attachHls, type HlsHandle } from '@/lib/hlsPlayer';
import { prefetchFirstSegment } from '@/lib/hlsPrefetch';
import { getDeviceInfo } from '@/lib/deviceInfo';
import { useAudio } from '@/contexts/AudioContext';
import { useOmniShop } from '@/contexts/OmniShopContext';
import VinylMiniPlayer from '../player/VinylMiniPlayer';

interface ClipCardProps {
  clip: ClipItem;
  active: boolean;
  shouldPreload?: boolean;
  onEnded: () => void;
  currentIndex: number;
  lastAutoScrollIndex: number;
  onAutoScroll: (index: number) => void;
}

export default function ClipCard({
  clip,
  active,
  shouldPreload = false,
  onEnded,
  currentIndex,
  lastAutoScrollIndex,
  onAutoScroll,
}: ClipCardProps) {
  const { isMuted, armAudio, syncFromVideo, hasUserPreference } = useAudio();
  const { storeAccessible } = useOmniShop();

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsHandle | null>(null);
  const mountedRef = useRef(true);
  const userPausedRef = useRef(false);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const isMutedRef = useRef(isMuted);
  const hasUserPreferenceRef = useRef(hasUserPreference);

  const [firstFrame, setFirstFrame] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Keep refs in sync with state (avoids stale closures in callbacks)
  isMutedRef.current = isMuted;
  hasUserPreferenceRef.current = hasUserPreference;

  // Core play function - handles all browser autoplay policies
  // Uses refs to avoid dependency on changing state
  const attemptPlay = useCallback(async (v: HTMLVideoElement, isUserTap = false): Promise<boolean> => {
    if (!mountedRef.current || !v) return false;

    // Already playing? Success.
    if (!v.paused && !v.ended) return true;

    // Wait for any pending play() to resolve first to avoid "interrupted" error
    if (playPromiseRef.current) {
      try {
        await playPromiseRef.current;
      } catch {
        // Previous play failed, that's fine
      }
      playPromiseRef.current = null;
    }

    // Check again after await - state may have changed
    if (!mountedRef.current) return false;
    if (!v.paused && !v.ended) return true;

    const tryPlay = async (muted: boolean): Promise<boolean> => {
      try {
        v.muted = muted;
        const promise = v.play();
        playPromiseRef.current = promise;
        await promise;
        playPromiseRef.current = null;

        if (!mountedRef.current) return false;

        userPausedRef.current = false;
        setShowPlayButton(false);
        setIsUserPaused(false);
        return true;
      } catch (err: any) {
        playPromiseRef.current = null;

        // "Interrupted" error means another play/pause happened - not a failure
        if (err?.name === 'AbortError' || err?.message?.includes('interrupted')) {
          // Check if video is now playing (interruption succeeded)
          return !v.paused && !v.ended;
        }
        return false;
      }
    };

    // Try with user's current mute preference
    const currentMuted = isMutedRef.current;
    if (await tryPlay(currentMuted)) return true;

    // If unmuted failed and no explicit user preference, try muted (browser policy)
    if (!currentMuted && !hasUserPreferenceRef.current) {
      if (await tryPlay(true)) {
        syncFromVideo(true);
        return true;
      }
    }

    // For non-user-initiated plays, retry a couple times
    if (!isUserTap && mountedRef.current) {
      for (let i = 0; i < 2; i++) {
        await new Promise(r => setTimeout(r, 150 * (i + 1)));
        if (!mountedRef.current || userPausedRef.current) return false;
        if (await tryPlay(isMutedRef.current)) return true;
      }
    }

    // All attempts failed - show play button
    if (mountedRef.current) {
      setShowPlayButton(true);
    }
    return false;
  }, [syncFromVideo]); // Only syncFromVideo - everything else via refs

  // Tap to play/pause
  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v || !active) return;

    armAudio();

    if (v.paused) {
      userPausedRef.current = false;
      setIsUserPaused(false);
      setShowPlayButton(false);
      attemptPlay(v, true);
    } else {
      userPausedRef.current = true;
      setIsUserPaused(true);
      v.pause();
      setShowPauseIcon(true);
      setTimeout(() => setShowPauseIcon(false), 150);
    }
  }, [active, armAudio, attemptPlay]);

  // Play button click
  const handlePlayButton = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    armAudio();
    userPausedRef.current = false;
    setIsUserPaused(false);
    setShowPlayButton(false);
    if (videoRef.current) attemptPlay(videoRef.current, true);
  }, [armAudio, attemptPlay]);

  // Video ended handler
  const handleEnded = useCallback(() => {
    onEnded();
    if (currentIndex === lastAutoScrollIndex) {
      const v = videoRef.current;
      if (v) {
        v.currentTime = 0;
        attemptPlay(v);
      }
      return;
    }
    onAutoScroll(currentIndex);
    const section = videoRef.current?.closest('section');
    const next = section?.nextElementSibling as HTMLElement;
    if (next) {
      setIsTransitioning(true);
      setTimeout(() => {
        next.scrollIntoView({ behavior: 'auto', block: 'start' });
        setTimeout(() => setIsTransitioning(false), 50);
      }, 200);
    }
  }, [currentIndex, lastAutoScrollIndex, onAutoScroll, onEnded, attemptPlay]);

  // Mount tracking and cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      playPromiseRef.current = null;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // HLS attachment
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!active && !shouldPreload) return;

    let cancelled = false;

    const attach = async () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const h = await attachHls(v, clip.hlsUrl, shouldPreload && !active);
      if (!cancelled && h) {
        hlsRef.current = h;
      }
    };

    attach();

    return () => {
      cancelled = true;
    };
  }, [clip.hlsUrl, active, shouldPreload]);

  // Store attemptPlay in ref for use in effects
  const attemptPlayRef = useRef(attemptPlay);
  attemptPlayRef.current = attemptPlay;

  // Main playback control effect
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (!active) {
      v.pause();
      return;
    }

    // Reset state when becoming active
    userPausedRef.current = false;
    setIsUserPaused(false);
    setShowPlayButton(false);

    let cancelled = false;

    // Wait for video to be ready, then play
    const attemptWhenReady = async () => {
      const maxWait = 3000;
      const interval = 50;
      let waited = 0;

      while (waited < maxWait && !cancelled) {
        if (!mountedRef.current) return;

        const hasSource = v.src || v.currentSrc;
        const isReady = v.readyState >= 1;

        if (hasSource && isReady) break;

        await new Promise(r => setTimeout(r, interval));
        waited += interval;
      }

      if (!cancelled && mountedRef.current && !userPausedRef.current) {
        attemptPlayRef.current(v);
      }
    };

    attemptWhenReady();

    // Watchdog: rescue stalled playback every second
    const watchdog = setInterval(() => {
      if (!mountedRef.current || cancelled || userPausedRef.current) return;
      if (document.hidden) return; // Don't fight visibility API

      const hasSource = v.src || v.currentSrc;
      if (hasSource && v.paused && !v.ended) {
        attemptPlayRef.current(v);
      }
    }, 1000);

    // Visibility change: resume when tab becomes visible
    const handleVisibility = () => {
      if (document.hidden) return;
      if (!mountedRef.current || cancelled || userPausedRef.current) return;

      const hasSource = v.src || v.currentSrc;
      if (hasSource && v.paused && !v.ended) {
        // Small delay to let browser settle
        setTimeout(() => {
          if (mountedRef.current && !userPausedRef.current) {
            attemptPlayRef.current(v);
          }
        }, 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(watchdog);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [active]);

  // Cleanup HLS when not needed
  useEffect(() => {
    if (active || shouldPreload) return;
    const v = videoRef.current;
    if (!v) return;

    const { isMobile } = getDeviceInfo();
    const timer = setTimeout(() => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      v.removeAttribute('src');
      v.load();
      setFirstFrame(false);
    }, isMobile ? 500 : 1000);

    return () => clearTimeout(timer);
  }, [active, shouldPreload]);

  // Sync mute state to video element (via ref, not React prop)
  useEffect(() => {
    const v = videoRef.current;
    if (v && active) {
      v.muted = isMuted;
    }
  }, [isMuted, active]);

  // Buffering detection
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => setIsBuffering(false);

    v.addEventListener('waiting', onWaiting);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('canplaythrough', onCanPlay);

    return () => {
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('canplaythrough', onCanPlay);
    };
  }, []);

  // Prefetch next clip
  useEffect(() => {
    if (shouldPreload) prefetchFirstSegment(clip.hlsUrl);
  }, [shouldPreload, clip.hlsUrl]);

  // First frame detection for poster fade
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !active) return;

    const mark = () => setFirstFrame(true);
    const onPlaying = () => {
      if ('requestVideoFrameCallback' in v) {
        (v as any).requestVideoFrameCallback(mark);
      } else {
        requestAnimationFrame(mark);
      }
    };

    v.addEventListener('playing', onPlaying, { once: true });
    return () => v.removeEventListener('playing', onPlaying);
  }, [active]);

  // Reset first frame on clip change
  useEffect(() => { setFirstFrame(false); }, [clip.id]);

  const showPlayOverlay = showPlayButton || (isUserPaused && active && !showPauseIcon);

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-black select-none ${
        isTransitioning ? 'clip-card-transitioning' : ''
      }`}
      onClick={handleTap}
      style={{ touchAction: 'pan-y', WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      {/* Poster */}
      {clip.poster && (
        <img
          src={clip.poster}
          alt=""
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 pointer-events-none ${
            firstFrame ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}

      {/* Video - NO muted prop, controlled via ref only */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
          firstFrame ? 'opacity-100' : 'opacity-0'
        }`}
        onEnded={handleEnded}
        playsInline
        preload="auto"
        poster={clip.poster ?? undefined}
        style={{ touchAction: 'pan-y' }}
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-x-0 bottom-0 h-48 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)'
        }}
      />

      {/* Play button overlay */}
      <AnimatePresence>
        {showPlayOverlay && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <button
              onClick={handlePlayButton}
              className="p-5 rounded-full bg-black/50 backdrop-blur-sm pointer-events-auto active:scale-95 transition-transform"
              aria-label="Play video"
            >
              <svg className="w-12 h-12 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buffering spinner */}
      <AnimatePresence>
        {active && isBuffering && !showPlayOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause icon flash */}
      <AnimatePresence>
        {showPauseIcon && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <div className="p-4 rounded-full bg-black/50 backdrop-blur-sm">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom-left: Title & info */}
      <div
        className="absolute left-4 z-20 pointer-events-auto"
        style={{ bottom: 'calc(max(env(safe-area-inset-bottom, 16px), 16px) + 24px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <VinylMiniPlayer className="mb-3" />

        <div className="max-w-[240px]">
          {clip.productHandle && (
            <div className="flex items-center gap-1.5 mb-1">
              {storeAccessible ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  <span className="text-[9px] font-medium text-emerald-400 uppercase tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Shop</span>
                </>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
              )}
            </div>
          )}
          <h3 className="text-sm font-semibold text-white truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {clip.title}
          </h3>
        </div>
      </div>
    </div>
  );
}
