"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ClipItem } from '@/types/clips';
import { attachHls, type HlsHandle } from '@/lib/hlsPlayer';
import { prefetchFirstSegment } from '@/lib/hlsPrefetch';
import { getDeviceInfo, getScrollBehavior } from '@/lib/deviceInfo';
import { useAudio } from '@/contexts/AudioContext';
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
  const { isMuted, armAudio, syncFromVideo, toggleMute } = useAudio();

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsHandle | null>(null);
  const mountedRef = useRef(true);
  const userPausedRef = useRef(false);

  const [firstFrame, setFirstFrame] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);

  // Play video with autoplay policy handling
  const attemptPlay = useCallback(async (v: HTMLVideoElement, isUserTap = false): Promise<boolean> => {
    if (!mountedRef.current || !v) return false;
    if (!v.paused && !v.ended) return true;

    const tryPlay = async (muted: boolean): Promise<boolean> => {
      try {
        v.muted = muted;
        await v.play();
        userPausedRef.current = false;
        setShowPlayButton(false);
        setIsUserPaused(false);
        if (muted && !isMuted) syncFromVideo(true);
        return true;
      } catch {
        return false;
      }
    };

    if (await tryPlay(isMuted)) return true;
    if (!isMuted && await tryPlay(true)) return true;

    if (!isUserTap) {
      for (let i = 0; i < 2; i++) {
        await new Promise(r => setTimeout(r, 200 * (i + 1)));
        if (!mountedRef.current) return false;
        if (await tryPlay(true)) return true;
      }
    }

    setShowPlayButton(true);
    return false;
  }, [isMuted, syncFromVideo]);

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
      setTimeout(() => setShowPauseIcon(false), 150); // Match exit animation duration
    }
  }, [active, armAudio, attemptPlay]);

  // Mute toggle - context is single source of truth, useEffect syncs to video
  const handleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    armAudio();
    toggleMute();
  }, [armAudio, toggleMute]);

  // Play button click
  const handlePlayButton = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    armAudio();
    userPausedRef.current = false;
    setIsUserPaused(false);
    setShowPlayButton(false);
    if (videoRef.current) attemptPlay(videoRef.current, true);
  }, [armAudio, attemptPlay]);

  // Video ended
  const handleEnded = useCallback(() => {
    onEnded();
    if (currentIndex === lastAutoScrollIndex) {
      const v = videoRef.current;
      if (v) { v.currentTime = 0; attemptPlay(v); }
      return;
    }
    onAutoScroll(currentIndex);
    const section = videoRef.current?.closest('section');
    const next = section?.nextElementSibling as HTMLElement;
    if (next) next.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
  }, [currentIndex, lastAutoScrollIndex, onAutoScroll, onEnded, attemptPlay]);

  // Mount tracking
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // HLS attachment
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if ((active || shouldPreload) && !hlsRef.current) {
      attachHls(v, clip.hlsUrl, shouldPreload && !active).then(h => {
        hlsRef.current = h;
      });
    }
  }, [clip.hlsUrl, active, shouldPreload]);

  // Playback control
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (active) {
      userPausedRef.current = false;
      setIsUserPaused(false);
      setShowPlayButton(false);
      v.muted = isMuted;

      const timer = setTimeout(() => {
        // Respect user pause even during initial play attempt
        if (mountedRef.current && active && !userPausedRef.current) attemptPlay(v);
      }, 100);

      const watchdog = setInterval(() => {
        if (!mountedRef.current) return;
        // Only auto-resume if not user-paused and not in background
        if (v.paused && !v.ended && !userPausedRef.current && !document.hidden) {
          attemptPlay(v, false);
        }
      }, 1000);

      return () => { clearTimeout(timer); clearInterval(watchdog); };
    } else {
      v.pause();
    }
  }, [active, isMuted, attemptPlay]);

  // Cleanup HLS
  useEffect(() => {
    if (active || shouldPreload) return;
    const v = videoRef.current;
    if (!v) return;

    const { isMobile } = getDeviceInfo();
    const timer = setTimeout(() => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      v.removeAttribute('src');
      v.load();
      setFirstFrame(false);
    }, isMobile ? 500 : 1000);

    return () => clearTimeout(timer);
  }, [active, shouldPreload]);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current && active) videoRef.current.muted = isMuted;
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

  // Prefetch
  useEffect(() => {
    if (shouldPreload) prefetchFirstSegment(clip.hlsUrl);
  }, [shouldPreload, clip.hlsUrl]);

  // First frame detection
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

  // Reset on clip change
  useEffect(() => { setFirstFrame(false); }, [clip.id]);

  const showPlayOverlay = showPlayButton || (isUserPaused && active && !showPauseIcon);

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-black select-none"
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

      {/* Video */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
          firstFrame ? 'opacity-100' : 'opacity-0'
        }`}
        onEnded={handleEnded}
        playsInline
        muted={isMuted}
        poster={clip.poster ?? undefined}
        style={{ touchAction: 'pan-y' }}
      />

      {/* Gradient overlay for text readability */}
      <div
        className="absolute inset-x-0 bottom-0 h-48 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)'
        }}
      />

      {/* Play button overlay - shown when autoplay fails or user paused */}
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

      {/* Buffering spinner - hidden when play button is visible */}
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


      {/* Top-right: Mute button */}
      {active && (
        <div
          className="absolute right-4 z-20"
          style={{ top: 'max(env(safe-area-inset-top, 16px), 16px)' }}
          onClick={(e) => e.stopPropagation()} // Prevent clip pause when tapping button area
        >
          {/* Mute button */}
          <button
            onClick={handleMute}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm active:scale-95 transition-transform"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            style={{ touchAction: 'manipulation' }}
          >
            {isMuted ? (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Bottom-left: Title & Artist info box */}
      <div
        className="absolute left-4 z-20 pointer-events-auto"
        style={{ bottom: 'max(env(safe-area-inset-bottom, 16px), 16px)' }}
        onClick={(e) => e.stopPropagation()} // Prevent clip pause when tapping info area
      >
        {/* Vinyl Mini Player - shows when music is playing */}
        <VinylMiniPlayer className="mb-3" />

        {/* Info container - no background, text shadows for legibility */}
        <div className="max-w-[240px]">
          {/* Shoppable indicator */}
          {clip.productHandle && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <span className="text-[9px] font-medium text-emerald-400 uppercase tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Shop</span>
            </div>
          )}
          <h3 className="text-sm font-semibold text-white truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {clip.title}
          </h3>
          <p className="text-xs text-white/80 truncate mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
            {clip.artist}
          </p>
        </div>
      </div>
    </div>
  );
}
