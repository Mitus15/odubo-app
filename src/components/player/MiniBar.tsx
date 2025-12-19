'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Track, Album } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

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

export default function MiniBar({
  isLoading,
  isPlaying,
  track,
  album,
  currentTime,
  duration,
  error,
  onPlayPause,
  onNext,
  onPrev,
  onOpenExpanded,
  onToggleQueue,
  onRetry,
}: MiniBarProps) {
  const { audioRef } = useMusicPlayer();
  const progressRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const audioEl = audioRef.current;
  const actualPlaying = audioEl ? !audioEl.paused && audioEl.currentTime > 0 : isPlaying;

  // Scrubbing
  const handleScrub = useCallback((clientX: number) => {
    if (!progressRef.current || duration <= 0 || !audioRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  }, [duration, audioRef]);

  const onScrubStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsScrubbing(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    handleScrub(clientX);
  };

  useEffect(() => {
    if (!isScrubbing) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      handleScrub(clientX);
    };
    const onEnd = () => setIsScrubbing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isScrubbing, handleScrub]);

  // Play/Pause with direct audio control
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      if (!isPlaying) onPlayPause();
    } else {
      audio.pause();
      if (isPlaying) onPlayPause();
    }
  }, [audioRef, isPlaying, onPlayPause]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="glass-blur-strong border-t border-[#502d26]/30">
        {/* Progress bar */}
        <div
          ref={progressRef}
          onMouseDown={onScrubStart}
          onTouchStart={onScrubStart}
          className="h-1 bg-[#302927] cursor-pointer group"
        >
          <div
            className="h-full bg-[#843c2d] relative transition-[width] duration-100"
            style={{ width: `${progressPct}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-[#ede8df] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Content */}
        <div className="flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-3">
          {/* Artwork */}
          <button
            onClick={onOpenExpanded}
            className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[#302927]"
          >
            {album?.cover_art_url ? (
              <Image
                src={album.cover_art_url}
                alt={album.title || 'Album'}
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-5 h-5 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5l-10.5 3v10.553m0-10.553v10.553" />
                </svg>
              </div>
            )}
            {isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </button>

          {/* Track info */}
          <button onClick={onOpenExpanded} className="flex-1 min-w-0 text-left">
            <p className="text-sm text-[#ede8df] font-medium truncate">{track.title}</p>
            <p className="text-xs text-[#726d6c] truncate">{album?.artist_name}</p>
          </button>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              className="w-10 h-10 flex items-center justify-center text-[#b2a491] hover:text-[#ede8df] transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>

            <button
              onClick={handlePlayPause}
              disabled={isLoading}
              className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-[#ede8df] text-[#302927] hover:bg-[#ede8df]/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-[#302927] border-t-transparent rounded-full animate-spin" />
              ) : actualPlaying ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            <button
              onClick={onNext}
              className="w-10 h-10 flex items-center justify-center text-[#b2a491] hover:text-[#ede8df] transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>

            <button
              onClick={onToggleQueue}
              className="hidden sm:flex w-10 h-10 items-center justify-center text-[#b2a491] hover:text-[#ede8df] transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Safe area */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
