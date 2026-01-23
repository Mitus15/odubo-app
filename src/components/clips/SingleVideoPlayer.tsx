"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
  // Clip intelligence callbacks
  onWatchMilestone?: (clipId: number, milestone: number, watchSeconds: number, durationSeconds: number) => void;
  onWatchComplete?: (clipId: number, watchPercent: number, watchSeconds: number, durationSeconds: number) => void;
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
  onWatchMilestone,
  onWatchComplete,
}: SingleVideoPlayerProps) {
  const router = useRouter();
  const { isMuted, armAudio, syncFromVideo, hasUserPreference } = useAudio();

  // Single stable refs - no computed refs, no stale closures
  const videoRef = useRef<HTMLVideoElement>(null);
  const preloadRef = useRef<HTMLVideoElement>(null);

  const mountedRef = useRef(true);
  const userPausedRef = useRef(false);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const lastActiveIndexRef = useRef(-1);
  // Milestone tracking - which milestones have been reached for current clip
  const milestonesReachedRef = useRef<Set<number>>(new Set());

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
    // Fire completion event with 100% watch
    const v = videoRef.current;
    if (v && activeClip && v.duration) {
      onWatchComplete?.(activeClip.id, 100, v.duration, v.duration);
    }

    onEnded?.();

    if (scrollDirection === 'backward') {
      if (v) {
        v.currentTime = 0;
        // Reset milestones for replay
        milestonesReachedRef.current.clear();
        attemptPlay(v);
      }
      return;
    }

    // Auto-advance immediately
    if (mountedRef.current && onAdvanceToNext) {
      onAdvanceToNext();
    }
  }, [onEnded, scrollDirection, onAdvanceToNext, attemptPlay, activeClip, onWatchComplete]);

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
      // Reset milestones for new clip
      milestonesReachedRef.current.clear();

      // Set source and play immediately - don't wait for any events
      v.src = videoUrl;
      v.currentTime = 0;
      attemptPlay(v);
    }
  }, [activeIndex, activeClip, getVideoUrl, attemptPlay, onVideoReady]);

  // Milestone tracking via timeupdate
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeClip) return;

    const handleTimeUpdate = () => {
      if (!v.duration || v.duration === 0) return;

      const percent = (v.currentTime / v.duration) * 100;
      const milestones = [25, 50, 75];

      for (const milestone of milestones) {
        if (percent >= milestone && !milestonesReachedRef.current.has(milestone)) {
          milestonesReachedRef.current.add(milestone);
          onWatchMilestone?.(activeClip.id, milestone, v.currentTime, v.duration);
        }
      }
    };

    v.addEventListener('timeupdate', handleTimeUpdate);
    return () => v.removeEventListener('timeupdate', handleTimeUpdate);
  }, [activeClip, onWatchMilestone]);

  // Preload next clip into hidden video element
  // DEFERRED: Only start after first frame renders (after LCP)
  useEffect(() => {
    // Wait until first frame is rendered to avoid blocking LCP
    if (!firstFrame) return;

    const p = preloadRef.current;
    const nextUrl = getVideoUrl(nextClip);
    if (!p || !nextUrl) return;

    // Small delay to ensure LCP is captured before starting preload
    const timeoutId = setTimeout(() => {
      if (p.src !== nextUrl) {
        p.src = nextUrl;
        p.load(); // Actually buffer the video
      }
    }, 100);

    // Cleanup: release resources on unmount
    return () => {
      clearTimeout(timeoutId);
      if (p) {
        p.src = '';
        p.load(); // Flush any buffered data
      }
    };
  }, [nextClip, getVideoUrl, firstFrame]);

  // Sync mute state
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = isMuted;
  }, [isMuted]);

  // Buffering detection - only show spinner after 500ms delay to prevent flash
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    let bufferTimeout: ReturnType<typeof setTimeout> | null = null;

    const onWaiting = () => {
      // Only show spinner if buffering for more than 500ms
      bufferTimeout = setTimeout(() => setIsBuffering(true), 500);
    };
    const onPlaying = () => {
      if (bufferTimeout) clearTimeout(bufferTimeout);
      setIsBuffering(false);
    };
    const onCanPlay = () => {
      if (bufferTimeout) clearTimeout(bufferTimeout);
      setIsBuffering(false);
    };

    v.addEventListener('waiting', onWaiting);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('canplaythrough', onCanPlay);

    return () => {
      if (bufferTimeout) clearTimeout(bufferTimeout);
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

  // Watchdog: rescue stalled playback with exponential backoff
  useEffect(() => {
    const BACKOFF_INTERVALS = [500, 1000, 2000, 4000, 8000];
    let backoffIndex = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleWatchdog = () => {
      if (!mountedRef.current) return;

      const delay = BACKOFF_INTERVALS[Math.min(backoffIndex, BACKOFF_INTERVALS.length - 1)];
      timeoutId = setTimeout(async () => {
        // Skip if conditions not met
        if (!mountedRef.current || userPausedRef.current) {
          scheduleWatchdog();
          return;
        }
        if (document.hidden || !navigator.onLine) {
          scheduleWatchdog();
          return;
        }

        const v = videoRef.current;
        if (v && v.src && v.paused && !v.ended) {
          const success = await attemptPlay(v);
          if (success) {
            // Reset backoff on success
            backoffIndex = 0;
          } else {
            // Increase backoff on failure
            backoffIndex = Math.min(backoffIndex + 1, BACKOFF_INTERVALS.length - 1);
          }
        } else {
          // Video is playing or ended, reset backoff
          backoffIndex = 0;
        }

        scheduleWatchdog();
      }, delay);
    };

    scheduleWatchdog();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
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
        <Image
          src={activeClip.poster}
          alt=""
          fill
          sizes="100vw"
          priority
          draggable={false}
          className={`object-cover pointer-events-none ${
            firstFrame ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ transition: 'opacity 150ms ease-out' }}
        />
      )}

      {/* Main video - single stable element, pointer-events-none so clicks go to parent */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${
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

      {/* Watch Full Video button - Gateway Drug metric */}
      {activeClip.parentId && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Track the conversion event (non-blocking)
            fetch('/api/analytics/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: 'anon', // Will be replaced by analytics context
                events: [{
                  type: 'full_video_click',
                  path: `/clips/${activeClip.id}`,
                  timestamp: Date.now(),
                  metadata: {
                    clipId: activeClip.id,
                    parentVideoId: activeClip.parentId,
                    clipTitle: activeClip.title,
                  },
                }],
              }),
            }).catch(() => {}); // Fire and forget
            // Navigate to parent video
            router.push(`/media/${activeClip.parentId}`);
          }}
          className="absolute bottom-24 right-4 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-sm font-medium pointer-events-auto hover:bg-white/25 active:scale-95 transition-all z-30"
          aria-label="Watch full video"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 4h16v12H4V4zm2 2v8h12V6H6zm8 10v4h6v-2h-4v-2h-2z" />
          </svg>
          <span>Full Video</span>
        </button>
      )}
    </div>
  );
}
