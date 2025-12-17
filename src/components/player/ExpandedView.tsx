'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

interface ExpandedViewProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQueue: () => void;
}

export default function ExpandedView({ isOpen, onClose, onOpenQueue }: ExpandedViewProps) {
  const {
    state,
    togglePlayPause,
    nextTrack,
    previousTrack,
    toggleShuffle,
    cycleRepeatMode,
    seekTo,
    audioRef,
  } = useMusicPlayer();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Swipe down to close
  const onPointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    setIsDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = Math.max(0, e.clientY - dragStartY.current);
    setDragY(delta);
  };

  const onPointerUp = () => {
    if (dragY > 120) onClose();
    setDragY(0);
    setIsDragging(false);
  };

  // Format time
  const formatTime = (secs: number) => {
    if (!secs || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progressPct = state.duration ? (state.currentTime / state.duration) * 100 : 0;
  const audioEl = audioRef?.current;
  const actualPlaying = audioEl ? !audioEl.paused && audioEl.currentTime > 0 : state.isPlaying;

  // Play/Pause with direct audio control
  const handlePlayPause = useCallback(() => {
    const audio = audioRef?.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      if (!state.isPlaying) togglePlayPause();
    } else {
      audio.pause();
      if (state.isPlaying) togglePlayPause();
    }
  }, [audioRef, state.isPlaying, togglePlayPause]);

  // Seek
  const onSeek = (e: React.PointerEvent | React.TouchEvent) => {
    const bar = (e.target as HTMLElement).closest('.progress-bar');
    if (!bar || !state.duration) return;
    const rect = bar.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seekTo(pct * state.duration);
  };

  if (!isOpen || !state.currentTrack) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Background */}
      <div className="absolute inset-0 bg-[#171616]" />

      {/* Content */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative h-full flex flex-col text-[#ede8df] transition-transform"
        style={{ transform: `translateY(${dragY}px)`, opacity: 1 - dragY / 400 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-[#726d6c] hover:text-[#ede8df] transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <button
            onClick={onOpenQueue}
            className="w-10 h-10 flex items-center justify-center text-[#726d6c] hover:text-[#ede8df] transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
            </svg>
          </button>
        </div>

        {/* Artwork */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12">
          <div
            className="relative rounded-2xl overflow-hidden bg-[#302927] shadow-2xl"
            style={{ width: 'min(80vw, 320px)', height: 'min(80vw, 320px)' }}
          >
            {state.currentAlbum?.cover_art_url ? (
              <Image
                src={state.currentAlbum.cover_art_url}
                alt={state.currentAlbum.title || 'Album'}
                fill
                priority
                className="object-cover"
                sizes="320px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-20 h-20 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5l-10.5 3v10.553m0-10.553v10.553" />
                </svg>
              </div>
            )}
            {state.isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="w-12 h-12 border-3 border-[#ede8df]/30 border-t-[#843c2d] rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Track info */}
          <div className="mt-8 text-center w-full max-w-md">
            <h1 className="text-xl sm:text-2xl font-semibold truncate">{state.currentTrack.title}</h1>
            <p className="text-sm text-[#726d6c] mt-1 truncate">{state.currentAlbum?.artist_name}</p>
          </div>

          {/* Progress */}
          <div className="mt-8 w-full max-w-md">
            <div
              className="progress-bar h-1.5 bg-[#302927] rounded-full cursor-pointer"
              onPointerDown={onSeek}
              onTouchStart={onSeek}
            >
              <div
                className="h-full bg-[#843c2d] rounded-full relative"
                style={{ width: `${progressPct}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-[#ede8df] rounded-full shadow-lg" />
              </div>
            </div>
            <div className="flex justify-between text-xs text-[#726d6c] mt-2">
              <span>{formatTime(state.currentTime)}</span>
              <span>{formatTime(state.duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-8 flex items-center justify-center gap-6">
            <button
              onClick={toggleShuffle}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                state.isShuffled ? 'text-[#843c2d]' : 'text-[#726d6c] hover:text-[#ede8df]'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="4" y2="4" />
              </svg>
            </button>

            <button
              onClick={previousTrack}
              className="w-12 h-12 flex items-center justify-center text-[#ede8df]"
            >
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>

            <button
              onClick={handlePlayPause}
              disabled={state.isLoading}
              className="w-16 h-16 flex items-center justify-center rounded-full bg-[#ede8df] text-[#302927] hover:bg-[#ede8df]/90 transition-colors disabled:opacity-50"
            >
              {state.isLoading ? (
                <div className="w-6 h-6 border-2 border-[#302927] border-t-transparent rounded-full animate-spin" />
              ) : actualPlaying ? (
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-7 h-7 ml-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            <button
              onClick={nextTrack}
              className="w-12 h-12 flex items-center justify-center text-[#ede8df]"
            >
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>

            <button
              onClick={cycleRepeatMode}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                state.repeatMode !== 'none' ? 'text-[#843c2d]' : 'text-[#726d6c] hover:text-[#ede8df]'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
              </svg>
              {state.repeatMode === 'one' && (
                <span className="absolute text-[8px] font-bold">1</span>
              )}
            </button>
          </div>
        </div>

        {/* Safe area */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
