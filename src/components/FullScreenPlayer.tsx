'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

interface FullScreenPlayerProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function FullScreenPlayer({ isVisible, onClose }: FullScreenPlayerProps) {
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
    playFromQueue,
    removeFromQueue,
  } = useMusicPlayer();

  const [showQueue, setShowQueue] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Close player with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);

  if (!isVisible || !state.currentTrack) return null;

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!state.duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * state.duration;
    seekTo(newTime);
  };

  const getRepeatIcon = () => {
    switch (state.repeatMode) {
      case 'one':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/>
          </svg>
        );
      case 'all':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
          </svg>
        );
    }
  };

  const progressPercentage = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] text-[#ede8df] overflow-hidden">
      {/* Background with blur effect */}
      <div className="absolute inset-0">
        {state.currentAlbum?.cover_art_url && (
          <div className="relative w-full h-full">
            <Image
              src={state.currentAlbum.cover_art_url}
              alt="Background"
              fill
              className="object-cover opacity-20 blur-3xl scale-110"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-[#302927]/80 via-[#171616]/90 to-[#302927]/80" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#302927]/50 text-[#ede8df] hover:bg-[#502d26]/60 transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
            </svg>
          </button>

          <div className="text-center">
            <h3 className="text-sm font-medium text-[#ede8df]">Playing from</h3>
            <p className="text-xs text-[#b2a491]">{state.currentAlbum?.title || 'Queue'}</p>
          </div>

          <button
            onClick={() => setShowQueue(!showQueue)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#302927]/50 text-[#ede8df] hover:bg-[#502d26]/60 transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
            </svg>
          </button>
        </div>

        {!showQueue ? (
          // Player View
          <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12">
            {/* Album Art */}
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-2xl overflow-hidden bg-[#302927] shadow-2xl mb-8 sm:mb-12">
              {state.currentAlbum?.cover_art_url ? (
                <Image
                  src={state.currentAlbum.cover_art_url}
                  alt={state.currentAlbum.title || 'Album cover'}
                  fill
                  className="object-cover"
                  sizes="320px"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#726d6c]">
                  <span className="text-6xl">🎵</span>
                </div>
              )}
              
              {/* Loading overlay */}
              {state.isLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Track Info */}
            <div className="text-center mb-8 sm:mb-12 max-w-md">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#ede8df] mb-2 truncate">
                {state.currentTrack.title}
              </h1>
              <p className="text-lg text-[#b2a491] truncate">
                {state.currentAlbum?.artist_name || 'Unknown Artist'}
              </p>
              {state.currentAlbum?.title && (
                <p className="text-sm text-[#726d6c] mt-1 truncate">
                  {state.currentAlbum.title}
                </p>
              )}
              {state.error && (
                <p className="text-red-400 text-sm mt-2">⚠️ {state.error}</p>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md mb-6">
              <div 
                className="relative h-2 bg-[#502d26]/40 rounded-full cursor-pointer"
                onClick={handleSeek}
              >
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#843c2d] to-[#a0472f] rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
                <div 
                  className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-[#ede8df] rounded-full shadow-lg transition-all duration-300"
                  style={{ left: `calc(${progressPercentage}% - 8px)` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-[#b2a491]">
                <span>{formatTime(state.currentTime)}</span>
                <span>{formatTime(state.duration)}</span>
              </div>
            </div>

            {/* Main Controls */}
            <div className="flex items-center justify-center space-x-6 sm:space-x-8 mb-8">
              {/* Shuffle */}
              <button
                onClick={toggleShuffle}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
                  state.isShuffled 
                    ? 'bg-[#843c2d] text-[#ede8df]' 
                    : 'bg-[#302927]/50 text-[#726d6c] hover:text-[#ede8df] hover:bg-[#502d26]/60'
                }`}
                title="Shuffle"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.5 3.5L20 2M20 2l-1.5 1.5M20 2v5M3 7h4l2 2m-2 2l-2 2H3M21.5 20.5L20 22M20 22l-1.5-1.5M20 22v-5"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 14l6-6M14 10l6 6"/>
                </svg>
              </button>

              {/* Previous */}
              <button
                onClick={previousTrack}
                disabled={state.queue.length <= 1}
                className={`w-14 h-14 flex items-center justify-center rounded-full transition-all ${
                  state.queue.length <= 1
                    ? 'bg-[#302927]/30 text-[#726d6c]/50 cursor-not-allowed'
                    : 'bg-[#302927]/50 text-[#ede8df] hover:bg-[#502d26]/60 hover:scale-105'
                }`}
                title="Previous track"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                </svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                disabled={!state.currentTrack || state.error !== null}
                className={`w-20 h-20 flex items-center justify-center rounded-full transition-all shadow-2xl ${
                  !state.currentTrack || state.error !== null
                    ? 'bg-[#502d26]/30 text-[#726d6c]/50 cursor-not-allowed'
                    : 'bg-gradient-to-br from-[#843c2d] to-[#a0472f] text-[#ede8df] hover:from-[#843c2d]/90 hover:to-[#a0472f]/90 hover:scale-105 active:scale-95'
                }`}
                title={state.isPlaying ? 'Pause' : 'Play'}
              >
                {state.isLoading ? (
                  <div className="w-8 h-8 border-3 border-current border-t-transparent rounded-full animate-spin" />
                ) : state.isPlaying ? (
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                ) : (
                  <svg className="w-8 h-8 ml-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>

              {/* Next */}
              <button
                onClick={nextTrack}
                disabled={state.queue.length <= 1 && state.repeatMode === 'none'}
                className={`w-14 h-14 flex items-center justify-center rounded-full transition-all ${
                  state.queue.length <= 1 && state.repeatMode === 'none'
                    ? 'bg-[#302927]/30 text-[#726d6c]/50 cursor-not-allowed'
                    : 'bg-[#302927]/50 text-[#ede8df] hover:bg-[#502d26]/60 hover:scale-105'
                }`}
                title="Next track"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                </svg>
              </button>

              {/* Repeat */}
              <button
                onClick={cycleRepeatMode}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
                  state.repeatMode !== 'none'
                    ? 'bg-[#843c2d] text-[#ede8df]'
                    : 'bg-[#302927]/50 text-[#726d6c] hover:text-[#ede8df] hover:bg-[#502d26]/60'
                }`}
                title={`Repeat: ${state.repeatMode}`}
              >
                {getRepeatIcon()}
              </button>
            </div>

            {/* Secondary Controls (volume slider removed) */}
            <div className="flex items-center justify-center space-x-4">
              {/* Mute Button */}
              <div className="relative">
                <button
                  onClick={toggleMute}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-[#302927]/50 text-[#ede8df] hover:bg-[#502d26]/60 transition-colors"
                  title="Toggle mute"
                >
                  {state.isMuted || state.volume === 0 ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    </svg>
                  ) : state.volume < 0.5 ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Queue View
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#502d26]/40">
              <h2 className="text-xl font-bold text-[#ede8df]">Queue</h2>
              <p className="text-sm text-[#b2a491]">{state.queue.length} songs</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {state.queue.map((track, index) => {
                const isCurrentTrack = index === state.currentIndex;
                
                return (
                  <div
                    key={`${track.id}-${index}`}
                    className={`flex items-center space-x-4 px-6 py-3 hover:bg-[#302927]/30 transition-colors ${
                      isCurrentTrack ? 'bg-[#843c2d]/20 border-l-4 border-[#843c2d]' : ''
                    }`}
                  >
                    <div className="w-8 text-center">
                      {isCurrentTrack ? (
                        <div className="w-4 h-4 bg-[#843c2d] rounded-full mx-auto" />
                      ) : (
                        <span className="text-[#726d6c] text-sm">{index + 1}</span>
                      )}
                    </div>

                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => playFromQueue(index)}
                    >
                      <h4 className={`font-medium truncate ${
                        isCurrentTrack ? 'text-[#843c2d]' : 'text-[#ede8df]'
                      }`}>
                        {track.title}
                      </h4>
                      <p className="text-[#b2a491] text-sm truncate">
                        {state.currentAlbum?.artist_name || 'Unknown Artist'}
                      </p>
                    </div>

                    <div className="text-[#726d6c] text-sm">
                      {formatTime(track.duration || 0)}
                    </div>

                    {!isCurrentTrack && (
                      <button
                        onClick={() => removeFromQueue(index)}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-[#726d6c] hover:text-red-400 hover:bg-[#302927]/50 transition-colors"
                        title="Remove from queue"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
