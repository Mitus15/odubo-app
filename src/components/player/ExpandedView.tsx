'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import SeekBar from '@/components/player/SeekBar';
import TrackActions from '@/components/player/TrackActions';
import AnimatedEQ from '@/components/player/AnimatedEQ';

interface ExpandedViewProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQueue: () => void;
}

export default function ExpandedView({ isOpen, onClose, onOpenQueue }: ExpandedViewProps) {
  const { state, togglePlayPause, nextTrack, previousTrack, toggleShuffle, cycleRepeatMode, toggleMute } = useMusicPlayer();

  if (!isOpen || !state.currentTrack) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 text-[#ede8df]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Ambient artful background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-16 bg-[radial-gradient(60%_60%_at_50%_10%,#302927_0%,transparent_60%),radial-gradient(40%_40%_at_80%_80%,#171616_0%,transparent_70%)]" />
        <div className="absolute inset-0 opacity-70 bg-[conic-gradient(from_180deg_at_50%_50%,#302927_0%,#843c2d_25%,#171616_50%,#a0472f_75%,#302927_100%)] animate-gradientShift mix-blend-plus-lighter" />
        <div className="absolute inset-0 backdrop-blur-[2px]" />
      </div>
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6">
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#302927]/50 text-[#ede8df] hover:bg-[#502d26]/60 transition-colors" aria-label="Close player">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
        </button>
        <div className="text-center">
          <h3 className="text-sm font-medium">Playing from</h3>
          <p className="text-xs text-[#b2a491]">{state.currentAlbum?.title || 'Queue'}</p>
        </div>
        <button onClick={onOpenQueue} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#302927]/50 text-[#ede8df] hover:bg-[#502d26]/60 transition-colors" aria-label="Open queue">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
        </button>
      </div>

      {/* Artwork */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-3xl overflow-hidden bg-[#302927]/80 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] mb-8 ring-1 ring-[#b2a491]/10">
          {/* Decorative glow rings */}
          <div className="pointer-events-none absolute -inset-6 rounded-[36px] bg-[radial-gradient(closest-side,#843c2d33,transparent),radial-gradient(closest-side,#a0472f22,transparent)] blur-xl" />
          {state.currentAlbum?.cover_art_url ? (
            <Image src={state.currentAlbum.cover_art_url} alt={state.currentAlbum.title || 'Album cover'} fill className="object-cover" sizes="320px" priority />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#726d6c]">
              <span className="text-6xl">🎵</span>
            </div>
          )}
          {/* Shine overlay */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.06)_30%,transparent_60%)]" />
          {state.isLoading && (
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-4 border-[#ede8df33] border-t-[#843c2d] animate-spin" />
                <div className="absolute inset-0 rounded-full animate-pulseRing" />
              </div>
            </div>
          )}
        </div>

        {/* Track details */}
        <div className="text-center mb-6 max-w-md">
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold truncate drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]">{state.currentTrack.title}</h1>
            {!state.isLoading && state.isPlaying && <AnimatedEQ color="#ede8df" />}
          </div>
          <p className="text-lg text-[#b2a491] truncate">{state.currentAlbum?.artist_name || 'Unknown Artist'}</p>
          {state.currentAlbum?.title && (
            <p className="text-sm text-[#726d6c] mt-1 truncate">{state.currentAlbum.title}</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 mb-8">
          <button onClick={toggleShuffle} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${state.isShuffled ? 'bg-[#843c2d] text-[#ede8df]' : 'bg-[#302927]/50 text-[#726d6c] hover:text-[#ede8df] hover:bg-[#502d26]/60'}`} aria-pressed={state.isShuffled} aria-label="Shuffle">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.5 3.5L20 2M20 2l-1.5 1.5M20 2v5M3 7h4l2 2m-2 2l-2 2H3M21.5 20.5L20 22M20 22l-1.5-1.5M20 22v-5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 14l6-6M14 10l6 6"/></svg>
          </button>
          <button onClick={previousTrack} className="w-14 h-14 flex items-center justify-center rounded-full bg-[#302927]/50 text-[#ede8df] hover:bg-[#502d26]/60 hover:scale-105 transition-all" aria-label="Previous track">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          <button onClick={togglePlayPause} disabled={state.isLoading} className={`relative w-20 h-20 flex items-center justify-center rounded-full transition-all shadow-2xl ${state.isLoading ? 'bg-[#502d26]/30 text-[#726d6c]/50 cursor-not-allowed' : 'bg-gradient-to-br from-[#843c2d] to-[#a0472f] text-[#ede8df] hover:from-[#843c2d]/90 hover:to-[#a0472f]/90 hover:scale-105 active:scale-95'}`} aria-label={state.isPlaying ? 'Pause' : 'Play'}>
            {!state.isLoading && state.isPlaying && <span className="absolute inset-0 rounded-full animate-softPulse shadow-[0_0_0_0_rgba(168,71,47,0.45)]" />}
            {state.isLoading ? (
              <div className="w-8 h-8 border-3 border-current border-t-transparent rounded-full animate-spin" />
            ) : state.isPlaying ? (
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg className="w-8 h-8 ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          <button onClick={nextTrack} className="w-14 h-14 flex items-center justify-center rounded-full bg-[#302927]/50 text-[#ede8df] hover:bg-[#502d26]/60 hover:scale-105 transition-all" aria-label="Next track">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
          <button onClick={cycleRepeatMode} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${state.repeatMode !== 'none' ? 'bg-[#843c2d] text-[#ede8df]' : 'bg-[#302927]/50 text-[#726d6c] hover:text-[#ede8df] hover:bg-[#502d26]/60'}`} aria-label={`Repeat ${state.repeatMode}`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
          </button>
        </div>

        {/* SeekBar + actions */}
        <div className="w-full max-w-md">
          <SeekBar />
          <div className="mt-4 flex items-center justify-between">
            <TrackActions />
            <button onClick={toggleMute} className="text-[#b2a491] hover:text-[#ede8df] transition-colors" aria-label="Toggle mute">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Local styles for artful animation */}
      <style jsx>{`
        @keyframes gradientShift {
          0% { transform: rotate(0deg) scale(1.1); opacity: 0.5; }
          50% { transform: rotate(30deg) scale(1.12); opacity: 0.7; }
          100% { transform: rotate(0deg) scale(1.1); opacity: 0.5; }
        }
        .animate-gradientShift { animation: gradientShift 14s ease-in-out infinite; }
        @keyframes softPulse {
          0% { box-shadow: 0 0 0 0 rgba(168,71,47,0.45); }
          70% { box-shadow: 0 0 0 18px rgba(168,71,47,0); }
          100% { box-shadow: 0 0 0 0 rgba(168,71,47,0); }
        }
        .animate-softPulse { animation: softPulse 2.2s ease-out infinite; }
        @keyframes pulseRing {
          0% { box-shadow: 0 0 0 0 rgba(237,232,223,0.25); }
          100% { box-shadow: 0 0 0 20px rgba(237,232,223,0); }
        }
        .animate-pulseRing { animation: pulseRing 1.2s ease-out infinite; }
      `}</style>
    </motion.div>
  );
}
