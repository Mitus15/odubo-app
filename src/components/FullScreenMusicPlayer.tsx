'use client';

import React, { useState, useEffect } from 'react';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import dynamic from 'next/dynamic';

// Lazy load StemPlayer to keep initial bundle small
const StemPlayerWrapper = dynamic(() => import('./StemPlayer'), { ssr: false });

interface FullScreenMusicPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FullScreenMusicPlayer({ isOpen, onClose }: FullScreenMusicPlayerProps) {
  const {
    state,
    togglePlayPause,
    nextTrack,
    previousTrack,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
  } = useMusicPlayer();

  const [isDragging, setIsDragging] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showStemMixer, setShowStemMixer] = useState(false);

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle progress bar interaction
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * state.duration;
    seekTo(newTime);
  };

  // Handle volume control
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!state.currentTrack) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Full Screen Player */}
      <div 
        className={`fixed inset-0 z-50 transition-transform duration-500 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="h-full bg-gradient-to-br from-[#1a1512] via-[#0f0d0b] to-[#1a1512] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 pt-8">
            <button
              onClick={onClose}
              className="p-3 rounded-full bg-black/20 text-[#ede8df] hover:bg-black/30 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            <div className="text-center">
              <h3 className="text-[#ede8df] font-medium">Now Playing</h3>
              <p className="text-[#b2a491] text-sm">from</p>
              {state.currentAlbum && (
                <p className="text-[#b2a491] text-sm">{state.currentAlbum.title}</p>
              )}
            </div>

            <div></div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-2 sm:py-8 lg:py-4">
            {/* Album Art */}
            <div className="relative mb-3 sm:mb-8 lg:mb-6">
              <div className="w-full max-w-72 sm:max-w-sm md:max-w-md lg:max-w-80 xl:max-w-96 mx-auto aspect-square rounded-2xl overflow-hidden shadow-2xl">
                {state.currentAlbum?.cover_art_url ? (
                  <img
                    src={state.currentAlbum.cover_art_url}
                    alt={state.currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#843c2d] to-[#502d26] flex items-center justify-center">
                    <svg className="w-24 h-24 text-[#ede8df]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Loading overlay */}
              {state.isLoading && (
                <div className="absolute inset-0 bg-black/20 rounded-2xl flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-[#ede8df] border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            {/* Track Info */}
            <div className="text-center mb-3 sm:mb-8 lg:mb-4">
              <h1 className="text-xl sm:text-3xl lg:text-2xl xl:text-3xl font-bold text-[#ede8df] mb-1 sm:mb-2 line-clamp-2">
                {state.currentTrack.title}
              </h1>
              <p className="text-base sm:text-xl lg:text-lg xl:text-xl text-[#b2a491] mb-1">
                {state.currentAlbum?.artist_name || 'Unknown Artist'}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md lg:max-w-lg mb-2 sm:mb-4 lg:mb-3">
              <div
                className="relative h-2 bg-[#502d26]/50 rounded-full cursor-pointer"
                onClick={handleProgressClick}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#843c2d] to-[#b85d47] rounded-full transition-all duration-200"
                  style={{
                    width: state.duration > 0 ? `${(state.currentTime / state.duration) * 100}%` : '0%'
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#ede8df] rounded-full shadow-lg transition-all duration-200"
                  style={{
                    left: state.duration > 0 ? `calc(${(state.currentTime / state.duration) * 100}% - 8px)` : '0px'
                  }}
                />
              </div>
            </div>

            {/* Time Display */}
            <div className="flex justify-between w-full max-w-md lg:max-w-lg mb-3 sm:mb-8 lg:mb-5 text-[#b2a491] text-sm">
              <span>{formatTime(state.currentTime)}</span>
              <span>{formatTime(state.duration)}</span>
            </div>

            {/* Main Controls */}
            <div className="flex items-center justify-center gap-3 sm:gap-6 lg:gap-5 mb-4 sm:mb-8 lg:mb-4 w-full max-w-sm lg:max-w-md mx-auto">
              {/* Shuffle */}
              <button
                onClick={toggleShuffle}
                className={`p-3 rounded-full transition-colors ${
                  state.isShuffled 
                    ? 'bg-[#843c2d] text-[#ede8df]' 
                    : 'bg-black/20 text-[#b2a491] hover:text-[#ede8df]'
                }`}
                title="Shuffle"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <polyline points="16 3 21 3 21 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="4" y1="20" x2="21" y2="3" strokeWidth="2" strokeLinecap="round" />
                  <polyline points="21 16 21 21 16 21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="15" y1="15" x2="4" y2="4" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>

              {/* Previous */}
              <button
                onClick={previousTrack}
                className="p-4 rounded-full bg-black/20 text-[#ede8df] hover:bg-black/30 transition-colors"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                </svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                className="p-6 rounded-full bg-[#ede8df] text-[#302927] hover:bg-[#d4c9b8] transition-colors shadow-lg"
              >
                {state.isPlaying ? (
                  <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Next */}
              <button
                onClick={nextTrack}
                className="p-4 rounded-full bg-black/20 text-[#ede8df] hover:bg-black/30 transition-colors"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                </svg>
              </button>

              {/* Repeat */}
              <button
                onClick={cycleRepeatMode}
                className={`p-3 rounded-full transition-colors relative ${
                  state.repeatMode !== 'none' 
                    ? 'bg-[#843c2d] text-[#ede8df]' 
                    : 'bg-black/20 text-[#b2a491] hover:text-[#ede8df]'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {state.repeatMode === 'one' && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#ede8df] text-[#302927] text-xs rounded-full flex items-center justify-center font-bold">
                    1
                  </span>
                )}
              </button>
              {/* Stem Mixer */}
              {state.currentTrack?.vocal_stem_url && state.currentTrack?.drum_stem_url && state.currentTrack?.bass_stem_url && state.currentTrack?.other_stem_url && (
                <button
                  onClick={() => setShowStemMixer(true)}
                  className="p-3 rounded-full bg-black/20 text-[#b2a491] hover:text-[#ede8df] transition-colors"
                  title="Stem Mixer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h4v7H3zM9 3h4v14H9zM15 7h6v10h-6z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Secondary Controls */}
            <div className="flex items-center gap-4 sm:gap-6 w-full max-w-md lg:max-w-lg">
              {/* Mute Button (volume slider removed) */}
              <div className="flex items-center gap-3 flex-1">
                <button onClick={toggleMute} className="text-[#b2a491] hover:text-[#ede8df] transition-colors" title="Toggle mute">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {state.isMuted || state.volume === 0 ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    )}
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Queue Modal */}
          {showQueue && (
            <div className="absolute inset-0 bg-black/80 flex items-end justify-center p-4">
              <div className="bg-gradient-to-br from-[#302927] to-[#171616] rounded-t-2xl w-full max-w-md max-h-96 overflow-hidden">
                <div className="p-4 border-b border-[#502d26]/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[#ede8df] font-medium">Queue</h3>
                    <button
                      onClick={() => setShowQueue(false)}
                      className="text-[#b2a491] hover:text-[#ede8df] transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto max-h-64">
                  {state.queue.map((track, index) => (
                    <div
                      key={track.id}
                      className={`p-3 border-b border-[#502d26]/20 ${
                        index === state.currentIndex ? 'bg-[#843c2d]/20' : 'hover:bg-[#502d26]/20'
                      } transition-colors`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-[#b2a491] text-sm w-6">
                          {index === state.currentIndex ? '♪' : index + 1}
                        </div>
                        <div className="flex-1">
                          <div className={`${index === state.currentIndex ? 'text-[#ede8df]' : 'text-[#b2a491]'} text-sm font-medium`}>
                            {track.title}
                          </div>
                          <div className="text-[#726d6c] text-xs">
                            {state.currentAlbum?.artist_name || 'Unknown Artist'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Stem Mixer Modal */}
          {showStemMixer && state.currentTrack && (
            <div className="absolute inset-0 flex items-center justify-center z-60">
              <div className="absolute inset-0 bg-black/70" onClick={() => setShowStemMixer(false)} />
              <div className="relative w-full max-w-3xl p-4">
                {/* Lazy load StemPlayer to keep bundle small */}
                <React.Suspense fallback={<div className="text-[#b2a491]">Loading stem mixer…</div>}>
                  <StemPlayerWrapper track={state.currentTrack} onClose={() => setShowStemMixer(false)} />
                </React.Suspense>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </>
  );
}
