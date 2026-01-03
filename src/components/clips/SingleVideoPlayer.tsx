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
 * SingleVideoPlayer - Fixed position video player that never scrolls
 *
 * This component solves Safari's autoplay issue by using a FIXED position video.
 * Safari auto-pauses videos that scroll out of viewport, but a fixed video
 * never leaves the viewport, so it can't be paused.
 *
 * Key features:
 * - Fixed position, covers the viewport
 * - Only ONE video element exists at a time
 * - Swaps src when activeIndex changes
 * - Preloads next clip for instant transitions
 * - Syncs with AudioContext for mute state
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

  const videoRef = useRef<HTMLVideoElement>(null);
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
  const nextNextClip = clips[activeIndex + 2];

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

  // Handle clip change - swap video source
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

      // Swap video source and reset to beginning
      v.src = videoUrl;
      v.currentTime = 0;
      v.load();

      // Start playback as soon as metadata is available (fastest possible)
      const handleLoadedMetadata = () => {
        if (!mountedRef.current || userPausedRef.current) return;
        attemptPlay(v);
      };

      v.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });

      return () => {
        v.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [activeIndex, activeClip, getVideoUrl, attemptPlay, onVideoReady]);

  // Preload next 2 clips using link preload (lighter than hidden video elements)
  useEffect(() => {
    const urls = [getVideoUrl(nextClip), getVideoUrl(nextNextClip)].filter(Boolean) as string[];
    const links: HTMLLinkElement[] = [];

    for (const url of urls) {
      // Check if link already exists
      if (document.querySelector(`link[href="${url}"]`)) continue;

      // Create preload link
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'video';
      link.href = url;
      document.head.appendChild(link);
      links.push(link);
    }

    return () => {
      // Remove preload links after a delay (browser may have cached them)
      setTimeout(() => {
        links.forEach(link => link.remove());
      }, 5000);
    };
  }, [nextClip, nextNextClip, getVideoUrl]);

  // Sync mute state
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.muted = isMuted;
    }
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
      // Signal that video is ready to show
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

      {/* Video - FIXED position, never scrolls */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover ${
          firstFrame ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
        }`}
        onEnded={handleEnded}
        playsInline
        preload="auto"
        poster={activeClip.poster ?? undefined}
        style={{
          touchAction: 'pan-y',
          transition: 'opacity 150ms ease-out, transform 150ms ease-out'
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
