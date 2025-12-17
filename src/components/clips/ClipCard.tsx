"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ClipItem } from '@/types/clips';
import { attachHls, type HlsHandle } from '@/lib/hlsPlayer';
import { prefetchFirstSegment } from '@/lib/hlsPrefetch';
import { getDeviceInfo, getScrollBehavior } from '@/lib/deviceInfo';
import { useAudio } from '@/contexts/AudioContext';
import { useOmniShop } from '@/contexts/OmniShopContext';

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
  const { openMaison, openCart } = useOmniShop();

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
      setTimeout(() => setShowPauseIcon(false), 250);
    }
  }, [active, armAudio, attemptPlay]);

  // Mute toggle
  const handleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    armAudio();
    toggleMute();
    if (videoRef.current) videoRef.current.muted = !isMuted;
  }, [armAudio, toggleMute, isMuted]);

  // Shop button - always opens Maison store
  const handleShop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    openMaison();
  }, [openMaison]);

  // Cart button
  const handleCart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    openCart();
  }, [openCart]);

  // Share button
  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?clip=${clip.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: clip.title, text: `${clip.title} • ${clip.artist}`, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {}
  }, [clip]);

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
        if (mountedRef.current && active) attemptPlay(v);
      }, 100);

      const watchdog = setInterval(() => {
        if (!mountedRef.current) return;
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

      {/* Buffering spinner */}
      <AnimatePresence>
        {active && isBuffering && !showPlayButton && (
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


      {/* Top right buttons: Cart above Mute */}
      {active && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
          {/* Cart button */}
          <button
            onClick={handleCart}
            className="p-2.5 rounded-full bg-black/30 backdrop-blur-sm text-white/90 hover:bg-black/50 active:scale-95 transition-all"
            aria-label="Open cart"
            style={{ touchAction: 'manipulation', minWidth: 44, minHeight: 44 }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </button>

          {/* Mute button */}
          <button
            onClick={handleMute}
            className="p-2.5 rounded-full bg-black/30 backdrop-blur-sm text-white/90 hover:bg-black/50 active:scale-95 transition-all"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            style={{ touchAction: 'manipulation', minWidth: 44, minHeight: 44 }}
          >
            {isMuted ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Bottom overlay container */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 pointer-events-none"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
          paddingLeft: 16,
          paddingRight: 16
        }}
      >
        <div className="flex items-end justify-between gap-4">
          {/* Left side: Title & Artist */}
          <div className="flex-1 min-w-0 pointer-events-auto pb-1">
            {/* Shoppable indicator */}
            {clip.productHandle && (
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <span className="text-[10px] font-medium text-emerald-400/80 uppercase tracking-wider">Shop</span>
              </div>
            )}
            <h3 className="text-base font-semibold text-white truncate drop-shadow-lg">
              {clip.title}
            </h3>
            <p className="text-sm text-white/70 truncate drop-shadow-md mt-0.5">
              {clip.artist}
            </p>
          </div>

          {/* Right side: Action buttons */}
          <div className="flex flex-col gap-3 items-center pointer-events-auto pb-1">
            {/* Shop button - Baad icon in brand color with shape-hugging glow */}
            <button
              onClick={handleShop}
              className="p-2 active:scale-90 transition-transform"
              aria-label="Open shop"
              style={{
                touchAction: 'manipulation',
                minWidth: 48,
                minHeight: 48,
              }}
            >
              <img
                src="/brand-logos/baad-icon.svg"
                alt="Shop"
                className="w-12 h-12"
                style={{
                  filter: 'brightness(0) saturate(100%) invert(24%) sepia(60%) saturate(900%) hue-rotate(340deg) brightness(95%) drop-shadow(0 0 2px rgba(132, 60, 45, 0.6)) drop-shadow(0 0 6px rgba(132, 60, 45, 0.3))',
                }}
                draggable={false}
              />
            </button>
            <button
              onClick={handleShare}
              className="p-3 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 text-white/80 shadow-lg active:scale-95 transition-all"
              aria-label="Share clip"
              style={{ touchAction: 'manipulation', minWidth: 48, minHeight: 48 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
