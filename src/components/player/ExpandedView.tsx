"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";

interface ExpandedViewProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQueue: () => void;
}

// Design goals:
// - Mirror liquid glass aesthetic of MiniBar but with elevated depth, breathing space, and gesture support.
// - Remove noisy / novelty elements (EQ waveform etc.) for a calm, premium feel.
// - Prioritize thumb reach zones on mobile (bottom cluster) and cinematic artwork focus.
// - Provide subtle kinetic animations (parallax, fade, scale) without jank.
// - Resilient: defer error messaging to MiniBar; this view focuses on interaction and context.

export default function ExpandedView({ isOpen, onClose, onOpenQueue }: ExpandedViewProps) {
  const {
    state,
    togglePlayPause,
    nextTrack,
    previousTrack,
    toggleShuffle,
    cycleRepeatMode,
    toggleReshuffleOnLoopEnd,
    seekTo,
    audioRef,
  } = useMusicPlayer();

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Basic swipe-down to close (mobile)
  const onPointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    setIsDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || dragStartY.current == null || !surfaceRef.current) return;
    const delta = e.clientY - dragStartY.current;
    if (delta > 0) {
      surfaceRef.current.style.transform = `translateY(${delta}px)`;
      surfaceRef.current.style.opacity = `${Math.max(0.4, 1 - delta / 600)}`;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging || dragStartY.current == null || !surfaceRef.current) return;
    const delta = e.clientY - dragStartY.current;
    surfaceRef.current.style.transform = "";
    surfaceRef.current.style.opacity = "";
    setIsDragging(false);
    dragStartY.current = null;
    if (delta > 140) onClose();
  };

  // Time helpers
  const formatTime = useCallback((secs: number | null | undefined) => {
    if (!secs || secs <= 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, []);

  const progressPct = state.duration ? (state.currentTime / state.duration) * 100 : 0;
  const audioEl = audioRef?.current || null;
  const actualPlaying = audioEl ? (!audioEl.paused && audioEl.currentTime > 0 && audioEl.readyState >= 2) : state.isPlaying;

  // Robust play/pause handler that controls the audio element first (to avoid double-toggle races)
  const handlePlayPause = useCallback(() => {
    const audio = audioRef?.current;
    if (!audio) return;
    if (audio.paused) {
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        p.catch(() => { /* error handled upstream */ });
      }
      if (!state.isPlaying) togglePlayPause();
    } else {
      try { audio.pause(); } catch {}
      if (state.isPlaying) togglePlayPause();
    }
  }, [audioRef, state.isPlaying, togglePlayPause]);

  const onScrub = (clientX: number) => {
    if (!surfaceRef.current || !state.duration) return;
    const bar = surfaceRef.current.querySelector<HTMLDivElement>(".ev-progress-bar");
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seekTo(pct * state.duration);
  };

  const onProgressPointerDown = (e: React.PointerEvent) => {
    onScrub(e.clientX);
  };
  const onProgressTouch = (e: React.TouchEvent) => {
    if (e.touches[0]) onScrub(e.touches[0].clientX);
  };

  if (!isOpen || !state.currentTrack) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Layered ambient backdrop */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#171616] via-[#302927] to-[#171616]" />
            <div className="absolute inset-0 mix-blend-soft-light opacity-70 bg-[radial-gradient(circle_at_30%_40%,#843c2d33,transparent_60%),radial-gradient(circle_at_70%_60%,#a0472f22,transparent_65%)]" />
            <div className="absolute inset-0 backdrop-blur-sm" />
          </div>

          {/* Content surface */}
          <motion.div
            ref={surfaceRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="relative flex flex-col h-dvh text-[#ede8df]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 md:px-8 md:pt-8">
              <button
                onClick={onClose}
                aria-label="Close expanded player"
                className="w-11 h-11 rounded-full bg-[#302927]/60 hover:bg-[#502d26]/70 active:scale-90 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#843c2d]/60"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-[#b2a491]">Playing From</p>
                <p className="text-sm font-medium truncate max-w-[160px] md:max-w-[240px]">{state.currentAlbum?.title || "Queue"}</p>
              </div>
              <button
                onClick={onOpenQueue}
                aria-label="Open queue"
                className="w-11 h-11 rounded-full bg-[#302927]/60 hover:bg-[#502d26]/70 active:scale-90 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#843c2d]/60"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
              </button>
            </div>

            {/* Artwork focus */}
            <div className="flex-1 flex flex-col items-center justify-center px-5 md:px-12">
              <motion.div
                className="relative rounded-[2.2rem] overflow-hidden bg-[#302927]/70 shadow-2xl shadow-black/60 ring-1 ring-[#b2a491]/10"
                style={{ width: 'min(80vw, 26rem)', height: 'min(80vw, 26rem)', maxHeight: '52vh' }}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 140, damping: 18 }}
              >
                <div className="absolute -inset-6 pointer-events-none rounded-[2.8rem] bg-[radial-gradient(closest-side,#843c2d3d,transparent),radial-gradient(closest-side,#a0472f28,transparent)] blur-2xl" />
                {state.currentAlbum?.cover_art_url ? (
                  <Image
                    src={state.currentAlbum.cover_art_url}
                    alt={state.currentAlbum.title || "Album cover"}
                    fill
                    sizes="(max-width: 768px) 80vw, 52vh"
                    priority
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#726d6c]">
                    <span className="text-7xl">🎵</span>
                  </div>
                )}
                {state.isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-[#ede8df33] border-t-[#843c2d] rounded-full animate-spin" />
                      <div className="absolute inset-0 rounded-full animate-pulse-ring" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.07)_30%,transparent_70%)]" />
              </motion.div>

              {/* Textual info */}
              <div className="mt-6 text-center max-w-lg w-full">
                <h1 className="text-[clamp(1.25rem,3.8vw,1.9rem)] md:text-3xl font-semibold tracking-tight truncate drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]">
                  {state.currentTrack.title}
                </h1>
                <p className="text-[#b2a491] text-[clamp(0.95rem,3.2vw,1.2rem)] md:text-xl mt-0.5 truncate">
                  {state.currentAlbum?.artist_name || "Unknown Artist"}
                </p>
                {state.currentAlbum?.title && (
                  <p className="text-[#726d6c] text-[clamp(0.8rem,2.8vw,1rem)] md:text-base mt-0.5 truncate">
                    {state.currentAlbum.title}
                  </p>
                )}
              </div>

              {/* Progress & times */}
              <div className="mt-6 w-full max-w-[min(92vw,44rem)]">
                <div
                  className="ev-progress-bar relative h-[clamp(12px,1.6vh,16px)] rounded-full overflow-hidden cursor-pointer"
                  onPointerDown={onProgressPointerDown}
                  onTouchStart={onProgressTouch}
                  aria-label="Seek bar"
                >
                  <div className="absolute inset-0 bg-[#302927]/70" />
                  <div
                    className="absolute inset-y-0 left-0 bg-[#b2a491]/25 transition-[width] duration-300"
                    style={{ width: `${Math.min(100, progressPct + 15)}%` }}
                    aria-hidden="true"
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#843c2d] via-[#a0472f] to-[#843c2d] transition-[width] duration-150"
                    style={{ width: `${progressPct}%` }}
                    role="progressbar"
                    aria-valuenow={progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] animate-shimmer" />
                  </div>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[clamp(18px,2.4vh,22px)] h-[clamp(18px,2.4vh,22px)] rounded-full bg-[#ede8df] border border-[#843c2d]/50 shadow-lg"
                    style={{ left: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[clamp(10px,1.6vh,12px)] text-[#b2a491] mt-2 font-medium">
                  <span>{formatTime(state.currentTime)}</span>
                  <span>{formatTime(state.duration)}</span>
                </div>
              </div>

              {/* Control cluster */}
              <div className="mt-8 mb-6 flex items-center justify-center gap-[clamp(18px,3.8vw,32px)]">
                <button
                  onClick={toggleShuffle}
                  aria-label="Toggle shuffle"
                  aria-pressed={state.isShuffled}
                  className={`relative w-[clamp(44px,9.5vw,56px)] h-[clamp(44px,9.5vw,56px)] rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 ${state.isShuffled ? "bg-[#843c2d] text-[#ede8df]" : "bg-[#302927]/60 text-[#726d6c] hover:text-[#ede8df] hover:bg-[#502d26]/70"}`}
                >
                  {/* Clean shuffle icon */}
                  <svg
                    className="w-[clamp(18px,4.2vw,22px)] h-[clamp(18px,4.2vw,22px)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="16 3 21 3 21 8" />
                    <line x1="4" y1="20" x2="21" y2="3" />
                    <polyline points="21 16 21 21 16 21" />
                    <line x1="15" y1="15" x2="4" y2="4" />
                  </svg>
                  {state.isShuffled && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ede8df] text-[#302927] text-[10px] font-semibold flex items-center justify-center shadow">⇄</span>
                  )}
                </button>
                <button
                  onClick={previousTrack}
                  aria-label="Previous track"
                  className="w-[clamp(50px,11vw,60px)] h-[clamp(50px,11vw,60px)] rounded-full flex items-center justify-center bg-[#302927]/60 text-[#ede8df] hover:bg-[#502d26]/70 active:scale-90 transition-all focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50"
                >
                  <svg className="w-[clamp(20px,4.8vw,24px)] h-[clamp(20px,4.8vw,24px)]" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
                </button>
                <button
                  onClick={handlePlayPause}
                  disabled={state.isLoading}
                  aria-label={actualPlaying ? "Pause" : "Play"}
                  className={`relative w-[clamp(68px,16vw,88px)] h-[clamp(68px,16vw,88px)] rounded-full flex items-center justify-center transition-all shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#843c2d]/60 ${state.isLoading ? "bg-[#502d26]/40 text-[#726d6c]/60 cursor-not-allowed" : "bg-gradient-to-br from-[#843c2d] to-[#a0472f] text-[#ede8df] hover:scale-105 active:scale-95"}`}
                >
                  {state.isLoading ? (
                    <div className="w-[clamp(22px,5vw,28px)] h-[clamp(22px,5vw,28px)] border-4 border-current border-t-transparent rounded-full animate-spin" />
                  ) : actualPlaying ? (
                    <svg className="w-[clamp(24px,6vw,30px)] h-[clamp(24px,6vw,30px)]" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  ) : (
                    <svg className="w-[clamp(24px,6vw,30px)] h-[clamp(24px,6vw,30px)] ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  )}
                </button>
                <button
                  onClick={nextTrack}
                  aria-label="Next track"
                  className="w-[clamp(50px,11vw,60px)] h-[clamp(50px,11vw,60px)] rounded-full flex items-center justify-center bg-[#302927]/60 text-[#ede8df] hover:bg-[#502d26]/70 active:scale-90 transition-all focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50"
                >
                  <svg className="w-[clamp(20px,4.8vw,24px)] h-[clamp(20px,4.8vw,24px)]" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                </button>
                <button
                  onClick={cycleRepeatMode}
                  aria-label={`Repeat mode: ${state.repeatMode}`}
                  className={`w-[clamp(44px,9.5vw,56px)] h-[clamp(44px,9.5vw,56px)] rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 ${state.repeatMode !== "none" ? "bg-[#843c2d] text-[#ede8df]" : "bg-[#302927]/60 text-[#726d6c] hover:text-[#ede8df] hover:bg-[#502d26]/70"}`}
                >
                  <svg className="w-[clamp(18px,4.2vw,22px)] h-[clamp(18px,4.2vw,22px)]" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
                </button>
                {state.repeatMode === 'all' && state.isShuffled && (
                  <button
                    onClick={toggleReshuffleOnLoopEnd}
                    aria-label="Toggle reshuffle at loop end"
                    className={`w-[clamp(44px,9.5vw,56px)] h-[clamp(44px,9.5vw,56px)] rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 ${state.reshuffleOnLoopEnd ? 'bg-[#843c2d] text-[#ede8df]' : 'bg-[#302927]/60 text-[#726d6c] hover:text-[#ede8df] hover:bg-[#502d26]/70'}`}
                  >
                    <svg className="w-[clamp(18px,4.2vw,22px)] h-[clamp(18px,4.2vw,22px)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 5h7l2 3-2 3H3" />
                      <path d="M21 19h-7l-2-3 2-3h7" />
                      <path d="M3 5l2-2 2 2" />
                      <path d="M21 19l-2 2-2-2" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Secondary actions (none retained; mute removed) */}
            </div>

            {/* Safe-area spacer */}
            <div className="h-safe-area-bottom" />
          </motion.div>

          {/* Local styles */}
          <style jsx>{`
            @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
            .animate-shimmer { animation: shimmer 3.2s linear infinite; }
            @keyframes pulseRing { 0% { box-shadow: 0 0 0 0 rgba(237,232,223,0.25); } 100% { box-shadow: 0 0 0 24px rgba(237,232,223,0); } }
            .animate-pulse-ring { animation: pulseRing 1.4s ease-out infinite; }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
