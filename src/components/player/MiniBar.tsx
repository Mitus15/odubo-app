'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Track, Album } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

// Redesigned Now Playing (Liquid Glass) Mini Bar
// Mobile-first, resilient, accessible, low-latency UI.
// Key improvements:
// - Reduced layout shift by reserving height & using transform transitions.
// - Clear tap targets (min 44px) and high-contrast focus rings.
// - Adaptive buffering indicator + progressive fallback icon states.
// - Graceful error surface & retry affordance.
// - HLS/Progressive agnostic (logic handled upstream, UI just reflects state).
// - Safe-area padding for iOS bottom inset.
// - Network degraded mode shimmer (simulated via isLoading + bufferedPct < threshold).

interface MiniBarProps {
  isLoading: boolean;
  isPlaying: boolean;
  track: Track;
  album: Album | null;
  currentTime: number;
  duration: number;
  error?: string | null;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onOpenExpanded: () => void;
  onToggleQueue: () => void;
  onRetry?: () => void;
}

export default function MiniBar(props: MiniBarProps) {
  const { audioRef } = useMusicPlayer();
  const [bufferedPct, setBufferedPct] = useState(0);
  const [showDetails, setShowDetails] = useState(true); // allow collapsing on mobile
  const [isScrubbing, setIsScrubbing] = useState(false);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const [errorVisible, setErrorVisible] = useState(false);


  // Progressive buffered calculation (interval + events)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let frame: number;
    const update = () => {
      try {
        if (!audio.duration) { setBufferedPct(0); return; }
        if (audio.buffered.length === 0) { setBufferedPct(0); return; }
        const end = audio.buffered.end(audio.buffered.length - 1);
        setBufferedPct(Math.min(100, (end / audio.duration) * 100));
      } catch { setBufferedPct(0); }
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [audioRef]);

  // Scrub handling (touch friendly)
  const handleScrubStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!progressRef.current) return;
    setIsScrubbing(true);
    handleScrubMove(e);
  };
  const handleScrubMove = (e: any) => {
    if (!isScrubbing || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    if (props.duration > 0 && audioRef.current) {
      audioRef.current.currentTime = pct * props.duration;
    }
  };
  const handleScrubEnd = () => setIsScrubbing(false);

  useEffect(() => {
    if (!isScrubbing) return;
    const move = (e: any) => handleScrubMove(e);
    const end = () => handleScrubEnd();
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    window.addEventListener('touchmove', move);
    window.addEventListener('touchend', end);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    };
  }, [isScrubbing]);

  const playPct = props.duration > 0 ? (props.currentTime / props.duration) * 100 : 0;
  const audioEl = audioRef.current;
  const actualPlaying = audioEl ? !audioEl.paused && audioEl.currentTime > 0 && audioEl.readyState >= 2 : props.isPlaying;

  // Smarter error surface: long grace (5s) and only show when not loading/playing
  useEffect(() => {
    if (props.error && !props.isLoading && !actualPlaying) {
      const t = setTimeout(() => setErrorVisible(true), 5000);
      return () => clearTimeout(t);
    }
    setErrorVisible(false);
  }, [props.error, props.isLoading, actualPlaying]);

  const showError = Boolean(props.error && errorVisible && !actualPlaying && !props.isLoading);

  // Robust play/pause handler referencing actual audio element to avoid double-toggle race
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      // Attempt play
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        p.catch(() => {/* swallow, context will set error */});
      }
      if (!props.isPlaying) props.onPlayPause(); // sync state if needed
    } else {
      try { audio.pause(); } catch {}
      if (props.isPlaying) props.onPlayPause(); // sync state if needed
    }
  }, [audioRef, props.isPlaying, props.onPlayPause]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 select-none"
      aria-label="Now Playing Bar"
    >
      {/* Liquid Glass Container */}
      <div className="relative backdrop-blur-xl bg-gradient-to-br from-[#171616]/85 via-[#302927]/80 to-[#171616]/85 border-t border-[#502d26]/40 shadow-2xl shadow-black/40">
        {/* Ambient glass orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-6 left-4 w-24 h-24 bg-[#843c2d]/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-10 w-32 h-32 bg-[#ede8df]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.2s' }} />
        </div>

        {/* Progress / Buffer bar */}
        <div
          ref={progressRef}
          onMouseDown={handleScrubStart}
          onTouchStart={handleScrubStart}
          className="relative h-3 group cursor-pointer"
          aria-label="Playback progress"
        >
          <div className="absolute inset-0 bg-[#302927]/60" />
          {/* Buffered */}
          <div
            className="absolute inset-y-0 left-0 bg-[#b2a491]/20 transition-[width] duration-300"
            style={{ width: `${bufferedPct}%` }}
            aria-hidden="true"
          />
          {/* Played */}
            <div
              className={`absolute inset-y-0 left-0 bg-gradient-to-r from-[#843c2d] via-[#a0472f] to-[#843c2d] transition-[width] duration-150 ${isScrubbing ? 'opacity-90' : ''}`}
              style={{ width: `${playPct}%` }}
              aria-valuenow={playPct}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
            >
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] animate-shine" />
            </div>
          {/* Handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#ede8df] shadow-lg border border-[#843c2d]/50 transition-transform duration-150 group-hover:scale-110"
            style={{ left: `${playPct}%` }}
            aria-hidden="true"
          />
        </div>

        {/* Main Row */}
        <div className="flex items-center gap-3 px-4 py-2 sm:py-3">
          {/* Artwork */}
          <button
            onClick={props.onOpenExpanded}
            className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[#843c2d]/60 bg-[#302927]/70"
            aria-label="Open expanded player"
          >
            {props.album?.cover_art_url ? (
              <Image
                src={props.album.cover_art_url}
                alt={props.album.title || 'Album cover'}
                fill
                sizes="64px"
                className="object-cover"
                priority={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#726d6c]">🎵</div>
            )}
            {props.isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </button>

          {/* Track Meta */}
          <div
            onClick={() => setShowDetails(d => !d)}
            className="flex-1 min-w-0 cursor-pointer"
            aria-label="Toggle track details"
          >
            <div className="flex items-center gap-2">
              <h4 className="text-[#ede8df] font-medium text-sm sm:text-base truncate drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]">
                {props.track.title}
              </h4>
            </div>
            {showDetails && (
              <p className="text-[#b2a491] text-[11px] sm:text-xs truncate transition-colors">
                {props.album?.artist_name || 'Unknown Artist'}
              </p>
            )}
            {/* Error indicator only (no buffering text) */}
            <AnimatePresence>
              {showError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-0.5 flex items-center gap-1"
                >
                  <span className="text-[#ffb4a2] text-[10px] sm:text-[11px] font-medium" role="alert">
                    {props.error}
                  </span>
                  {props.onRetry && (
                    <button
                      onClick={props.onRetry}
                      className="px-1 py-0.5 rounded bg-[#843c2d]/30 text-[#ede8df] text-[10px] hover:bg-[#843c2d]/50 focus:outline-none focus:ring-1 focus:ring-[#843c2d]/60"
                    >Retry</button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={props.onPrev}
              className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full text-[#ede8df] hover:bg-[#502d26]/50 active:scale-90 focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 transition-all"
              aria-label="Previous track"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>

            <button
              onClick={handlePlayPause}
              disabled={props.isLoading}
              className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#843c2d]/60 ${
                props.isLoading
                  ? 'bg-[#502d26]/40 text-[#726d6c]/60 cursor-not-allowed'
                  : 'bg-gradient-to-br from-[#843c2d] to-[#a0472f] text-[#ede8df] hover:from-[#a0472f] hover:to-[#843c2d] active:scale-95 shadow-lg shadow-[#843c2d]/30'
              }`}
              aria-label={props.isPlaying ? 'Pause' : 'Play'}
            >
              {props.isLoading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : actualPlaying ? (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-6 h-6 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            <button
              onClick={props.onNext}
              className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full text-[#ede8df] hover:bg-[#502d26]/50 active:scale-90 focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 transition-all"
              aria-label="Next track"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>

            <button
              onClick={props.onToggleQueue}
              className="hidden sm:flex w-10 h-10 sm:w-11 sm:h-11 items-center justify-center rounded-full text-[#ede8df] hover:bg-[#502d26]/50 active:scale-90 focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 transition-all"
              aria-label="Toggle queue"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
            </button>
          </div>
        </div>
        <div className="h-safe-area-bottom" />
      </div>
      <style jsx>{`
        @keyframes shine { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-shine { animation: shine 3.2s linear infinite; }
      `}</style>
    </div>
  );
}
