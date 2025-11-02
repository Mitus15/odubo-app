'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Track, Album } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import AnimatedEQ from './AnimatedEQ';

interface MiniBarProps {
  isLoading: boolean;
  isPlaying: boolean;
  track: Track;
  album: Album | null;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onOpenExpanded: () => void;
  onToggleQueue: () => void;
}

export default function MiniBar(props: MiniBarProps) {
  const { audioRef } = useMusicPlayer();
  const [bufferedPct, setBufferedPct] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => {
      if (!audio.duration || audio.buffered.length === 0) {
        setBufferedPct(0);
        return;
      }
      try {
        const end = audio.buffered.end(audio.buffered.length - 1);
        setBufferedPct(Math.min(100, (end / (audio.duration || 1)) * 100));
      } catch {
        setBufferedPct(0);
      }
    };
    const int = setInterval(update, 500);
    audio.addEventListener('progress', update);
    return () => {
      clearInterval(int);
      audio.removeEventListener('progress', update);
    };
  }, [audioRef.current]);

  const playPct = props.duration > 0 ? (props.currentTime / props.duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-[#302927]/95 to-[#171616]/95 backdrop-blur-md border-t border-[#502d26]/30 safe-area-bottom">
      {/* Buffered/Played bar with shine */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#502d26]/30 overflow-hidden">
        <div className="absolute top-0 left-0 h-full bg-[#b2a491]/25 transition-all" style={{ width: `${bufferedPct}%` }} />
        <div className="h-full bg-gradient-to-r from-[#843c2d] to-[#a0472f] transition-all duration-300 relative" style={{ width: `${playPct}%` }}>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)] animate-shine" />
        </div>
      </div>

      <div className="flex items-center px-4 py-3 gap-3">
        {/* Cover + Loading */}
        <button onClick={props.onOpenExpanded} className="relative w-12 h-12 rounded-lg overflow-hidden bg-[#302927] flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[#843c2d]/60">
          {props.album?.cover_art_url ? (
            <Image src={props.album.cover_art_url} alt={props.album.title || 'Album cover'} fill className="object-cover" sizes="48px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#726d6c]">
              <span className="text-lg">🎵</span>
            </div>
          )}
          {props.isLoading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </button>

        {/* Title/Artist */}
        <div onClick={props.onOpenExpanded} className="flex-1 min-w-0 cursor-pointer">
          <div className="flex items-center gap-2">
            <h4 className="text-[#ede8df] font-medium text-sm truncate drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]">{props.track.title}</h4>
            {!props.isLoading && props.isPlaying && <AnimatedEQ size={10} color="#ede8df" />}
          </div>
          <p className="text-[#b2a491] text-xs truncate">{props.album?.artist_name || 'Unknown Artist'}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={props.onPrev}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#ede8df] hover:bg-[#502d26]/40 active:bg-[#502d26]/60 transition-colors"
            title="Previous"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>

          <button
            onClick={props.onPlayPause}
            disabled={props.isLoading}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
              props.isLoading ? 'bg-[#502d26]/30 text-[#726d6c]/50 cursor-not-allowed' : 'bg-[#843c2d] text-[#ede8df] hover:bg-[#843c2d]/80 active:scale-95 shadow-lg shadow-[#843c2d]/20'
            }`}
            title={props.isPlaying ? 'Pause' : 'Play'}
          >
            {props.isLoading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : props.isPlaying ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          <button
            onClick={props.onNext}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#ede8df] hover:bg-[#502d26]/40 active:bg-[#502d26]/60 transition-colors"
            title="Next"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>

          <button onClick={props.onToggleQueue} className="w-8 h-8 flex items-center justify-center rounded-full text-[#ede8df] hover:bg-[#502d26]/40 active:bg-[#502d26]/60 transition-colors" title="Queue">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes shine { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-shine { animation: shine 2.8s linear infinite; }
      `}</style>
    </div>
  );
}
