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
 * SingleVideoPlayer - Fixed position video player with hidden preload
 *
 * Architecture (based on TikTok's approach):
 * - Single stable video ref (no swapping, no stale closures)
 * - Hidden preload element that actually buffers next clip
 * - Immediate play() call (browser queues and starts ASAP)
 * - Poster shows until first frame renders
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

  // Single stable refs - no computed refs, no stale closures
  const videoRef = useRef<HTMLVideoElement>(null);
  const preloadRef = useRef<HTMLVideoElement>(null);

  const mountedRef = useRef(true);
  const userPausedRef = useRef(false);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const lastActiveIndexRef = useRef(-1);

  const [showPlayButton, setShowPlayButton] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);

  const activeClip = clips[activeIndex];
  const nextClip = clips[activeIndex + 1];

  // Get the video URL (prefer MP4 for simplicity, fallback to HLS)
  const getVideoUrl = useCallback((clip: ClipItem | undefined): string | null => {
    if (!clip) return null;
    if (clip.mp4Url) return clip.mp4Url;
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

    if (scrollDirection === 'backward') {
      const v = videoRef.current;
      if (v) {
        v.currentTime = 0;
        attemptPlay(v);
      }
      return;
    }

    // Auto-advance immediately
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

  // Handle clip change - load and play immediately
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeClip) return;

    const videoUrl = getVideoUrl(activeClip);
    if (!videoUrl) return;

    // Check if this is a new clip
    if (lastActiveIndexRef.current !== activeIndex) {
      lastActiveIndexRef.current = activeIndex;

      // Signal video not ready yet
      onVideoReady?.(false);

      // Reset state for new clip
      setFirstFrame(false);
      setShowPlayButton(false);
      setIsUserPaused(false);
      userPausedRef.current = false;

      // Set source and play immediately - don't wait for any events
      v.src = videoUrl;
      v.currentTime = 0;
      attemptPlay(v);
    }
  }, [activeIndex, activeClip, getVideoUrl, attemptPlay, onVideoReady]);

  // Preload next clip into hidden video element
  useEffect(() => {
    const p = preloadRef.current;
    const nextUrl = getVideoUrl(nextClip);
    if (!p || !nextUrl) return;

    // Only update if URL changed
    if (p.src !== nextUrl) {
      p.src = nextUrl;
      p.load(); // Actually buffer the video
    }
  }, [nextClip, getVideoUrl]);

  // Sync mute state
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = isMuted;
  }, [isMuted]);

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

  // First frame detection for poster fade
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
  }, [activeIndex, onVideoReady]);

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
  }, [attemptPlay]);

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
  }, [attemptPlay]);

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

      {/* Main video - single stable element */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover ${
          firstFrame ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
        }`}
        onEnded={handleEnded}
        playsInline
        preload="auto"
        style={{
          touchAction: 'pan-y',
          transition: 'opacity 150ms ease-out, transform 150ms ease-out'
        }}
      />

      {/* Hidden preload video - buffers next clip */}
      <video
        ref={preloadRef}
        preload="auto"
        muted
        playsInline
        style={{ display: 'none' }}
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
