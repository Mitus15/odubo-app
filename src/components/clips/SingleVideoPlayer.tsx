"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ClipItem } from '@/types/clips';
import { useAudio } from '@/contexts/AudioContext';

interface SingleVideoPlayerProps {
  clips: ClipItem[];
  activeIndex: number;
  onEnded?: () => void;
  onVideoReady?: (ready: boolean) => void;
  scrollDirection?: 'forward' | 'backward' | null;
  onAdvanceToNext?: () => void;
}

/**
 * SingleVideoPlayer - Fixed position video player with dual-video preloading
 *
 * Uses TWO video elements for instant transitions:
 * - Primary: Currently playing
 * - Secondary: Preloading next clip in background
 * When advancing, we swap roles for instant playback.
 */
export default function SingleVideoPlayer({
  clips,
  activeIndex,
  onEnded,
  onVideoReady,
  scrollDirection = null,
  onAdvanceToNext,
}: SingleVideoPlayerProps) {
  const { isMuted, armAudio, syncFromVideo, hasUserPreference } = useAudio();

  // Dual video refs for instant swap
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [activeVideo, setActiveVideo] = useState<'A' | 'B'>('A');

  const mountedRef = useRef(true);
  const userPausedRef = useRef(false);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const lastActiveIndexRef = useRef(-1);
  const preloadedIndexRef = useRef<number>(-1);

  const [showPlayButton, setShowPlayButton] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);

  const activeClip = clips[activeIndex];
  const nextClip = clips[activeIndex + 1];

  // Get the active video element
  const videoRef = activeVideo === 'A' ? videoARef : videoBRef;
  const preloadRef = activeVideo === 'A' ? videoBRef : videoARef;

  // Get the video URL (prefer MP4 for simplicity, fallback to HLS)
  const getVideoUrl = useCallback((clip: ClipItem | undefined): string | null => {
    if (!clip) return null;
    // Prefer MP4 for native browser support and simpler playback
    if (clip.mp4Url) return clip.mp4Url;
    // Fallback to HLS
    return clip.hlsUrl || null;
  }, []);

  // Core play function - handles browser autoplay policies
  const attemptPlay = useCallback(async (v: HTMLVideoElement, isUserTap = false): Promise<boolean> => {
    if (!mountedRef.current || !v) return false;

    // Already playing? Success.
    if (!v.paused && !v.ended) return true;

    // Wait for any pending play() to resolve first
    if (playPromiseRef.current) {
      try {
        await playPromiseRef.current;
      } catch {
        // Previous play failed, that's fine
      }
      playPromiseRef.current = null;
    }

    // Check again after await
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

        // "Interrupted" error means another play/pause happened
        if (err?.name === 'AbortError' || err?.message?.includes('interrupted')) {
          return !v.paused && !v.ended;
        }
        return false;
      }
    };

    // Try with user's current mute preference
    if (await tryPlay(isMuted)) return true;

    // If unmuted failed and no explicit user preference, try muted
    if (!isMuted && !hasUserPreference) {
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
        if (await tryPlay(isMuted)) return true;
      }
    }

    // All attempts failed - show play button
    if (mountedRef.current) {
      setShowPlayButton(true);
    }
    return false;
  }, [isMuted, hasUserPreference, syncFromVideo]);

  // Tap to play/pause
  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;

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
  }, [armAudio, attemptPlay]);

  // Play button click
  const handlePlayButton = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    armAudio();
    userPausedRef.current = false;
    setIsUserPaused(false);
    setShowPlayButton(false);
    if (videoRef.current) attemptPlay(videoRef.current, true);
  }, [armAudio, attemptPlay]);

  // Video ended handler - auto-advance forward, loop backward
  const handleEnded = useCallback(() => {
    onEnded?.();

    // If scrolling backward (revisiting), loop the video
    if (scrollDirection === 'backward') {
      const v = videoRef.current;
      if (v) {
        v.currentTime = 0;
        attemptPlay(v);
      }
      return;
    }

    // Scrolling forward or neutral - auto-advance immediately
    if (mountedRef.current && onAdvanceToNext) {
      onAdvanceToNext();
    }
  }, [onEnded, scrollDirection, onAdvanceToNext, attemptPlay]);

  // Mount tracking
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      playPromiseRef.current = null;
    };
  }, []);

  // Handle clip change - use preloaded video if available, otherwise load fresh
  useEffect(() => {
    if (!activeClip) return;

    const videoUrl = getVideoUrl(activeClip);
    if (!videoUrl) return;

    // Check if this is a new clip
    if (lastActiveIndexRef.current !== activeIndex) {
      const prevIndex = lastActiveIndexRef.current;
      lastActiveIndexRef.current = activeIndex;

      // Signal video not ready yet
      onVideoReady?.(false);

      // Reset state for new clip
      setFirstFrame(false);
      setShowPlayButton(false);
      setIsUserPaused(false);
      userPausedRef.current = false;

      // Pause the currently playing video first
      const currentV = videoRef.current;
      if (currentV && !currentV.paused) {
        currentV.pause();
      }

      // Check if next clip is already preloaded in the secondary video
      const preloadV = preloadRef.current;
      const urlPart = videoUrl.split('/').pop() || '';
      const isPreloaded = preloadedIndexRef.current === activeIndex && preloadV?.src && preloadV.src.includes(urlPart);

      if (isPreloaded && preloadV) {
        // INSTANT SWAP: Use preloaded video
        preloadV.currentTime = 0;
        preloadV.muted = isMuted;
        setActiveVideo(prev => prev === 'A' ? 'B' : 'A');
        attemptPlay(preloadV);
      } else {
        // Load fresh into current video (reuse same element)
        if (currentV) {
          currentV.src = videoUrl;
          currentV.currentTime = 0;
          attemptPlay(currentV);
        }
      }
    }
  }, [activeIndex, activeClip, getVideoUrl, attemptPlay, onVideoReady, isMuted]);

  // Preload next clip into secondary video element
  useEffect(() => {
    const preloadV = preloadRef.current;
    const nextUrl = getVideoUrl(nextClip);
    const nextIndex = activeIndex + 1;

    if (!preloadV || !nextUrl || preloadedIndexRef.current === nextIndex) return;

    // Preload the next clip
    preloadV.src = nextUrl;
    preloadV.muted = true;
    preloadV.preload = 'auto';
    preloadV.load();
    preloadedIndexRef.current = nextIndex;
  }, [activeIndex, nextClip, getVideoUrl]);

  // Sync mute state to active video
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = isMuted;
  }, [isMuted, activeVideo]);

  // Buffering detection - re-bind when active video changes
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
  }, [activeVideo]);

  // First frame detection for poster fade - re-bind on video swap
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const mark = () => {
      setFirstFrame(true);
      onVideoReady?.(true);
    };

    const onPlaying = () => {
      if ('requestVideoFrameCallback' in v) {
        (v as any).requestVideoFrameCallback(mark);
      } else {
        requestAnimationFrame(mark);
      }
    };

    v.addEventListener('playing', onPlaying, { once: true });
    return () => v.removeEventListener('playing', onPlaying);
  }, [activeIndex, activeVideo, onVideoReady]);

  // Visibility change: resume when tab becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) return;
      if (!mountedRef.current || userPausedRef.current) return;

      const v = videoRef.current;
      if (v && v.src && v.paused && !v.ended) {
        setTimeout(() => {
          if (mountedRef.current && !userPausedRef.current) {
            attemptPlay(v);
          }
        }, 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [attemptPlay, activeVideo]);

  // Watchdog: rescue stalled playback
  useEffect(() => {
    const watchdog = setInterval(() => {
      if (!mountedRef.current || userPausedRef.current) return;
      if (document.hidden) return;

      const v = videoRef.current;
      if (v && v.src && v.paused && !v.ended) {
        attemptPlay(v);
      }
    }, 1000);

    return () => clearInterval(watchdog);
  }, [attemptPlay, activeVideo]);

  const showPlayOverlay = showPlayButton || (isUserPaused && !showPauseIcon);

  if (!activeClip) return null;

  return (
    <div
      className="fixed inset-0 lg:left-20 xl:left-64 overflow-hidden bg-black select-none z-10"
      onClick={handleTap}
      style={{ touchAction: 'pan-y', WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      {/* Poster - shows until first frame renders */}
      {activeClip.poster && (
        <img
          src={activeClip.poster}
          alt=""
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${
            firstFrame ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ transition: 'opacity 150ms ease-out' }}
        />
      )}

      {/* Video A */}
      <video
        ref={videoARef}
        className={`absolute inset-0 w-full h-full object-cover ${
          activeVideo === 'A'
            ? (firstFrame ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]')
            : 'opacity-0 pointer-events-none'
        }`}
        onEnded={activeVideo === 'A' ? handleEnded : undefined}
        playsInline
        preload="auto"
        style={{
          touchAction: 'pan-y',
          transition: 'opacity 150ms ease-out, transform 150ms ease-out',
          zIndex: activeVideo === 'A' ? 1 : 0
        }}
      />

      {/* Video B (preload / swap target) */}
      <video
        ref={videoBRef}
        className={`absolute inset-0 w-full h-full object-cover ${
          activeVideo === 'B'
            ? (firstFrame ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]')
            : 'opacity-0 pointer-events-none'
        }`}
        onEnded={activeVideo === 'B' ? handleEnded : undefined}
        playsInline
        preload="auto"
        style={{
          touchAction: 'pan-y',
          transition: 'opacity 150ms ease-out, transform 150ms ease-out',
          zIndex: activeVideo === 'B' ? 1 : 0
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
        {isBuffering && !showPlayOverlay && (
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
    </div>
  );
}
