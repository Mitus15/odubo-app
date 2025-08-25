'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

interface NowPlayingBarProps {
  onOpenPlayer?: () => void;
}

export default function NowPlayingBar({ onOpenPlayer }: NowPlayingBarProps) {
  const { state, togglePlayPause, nextTrack, previousTrack } = useMusicPlayer();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!state.currentTrack) return null;

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-[#302927]/95 to-[#171616]/95 backdrop-blur-md border-t border-[#502d26]/30 safe-area-bottom">
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#502d26]/30">
        <div 
          className="h-full bg-gradient-to-r from-[#843c2d] to-[#a0472f] transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Main Bar */}
      <div className="flex items-center px-4 py-3 space-x-3">
        {/* Track Info */}
        <div 
          className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
          onClick={onOpenPlayer}
        >
          {/* Album Art */}
          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-[#302927] flex-shrink-0">
            {state.currentAlbum?.cover_art_url ? (
              <Image
                src={state.currentAlbum.cover_art_url}
                alt={state.currentAlbum.title || 'Album cover'}
                fill
                className="object-cover"
                sizes="48px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#726d6c]">
                <span className="text-lg">🎵</span>
              </div>
            )}
            
            {/* Loading indicator */}
            {state.isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Track Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="text-[#ede8df] font-medium text-sm truncate">
                {state.currentTrack.title}
              </h4>
              {state.error && (
                <span className="text-red-400 text-xs">⚠️</span>
              )}
            </div>
            <p className="text-[#b2a491] text-xs truncate">
              {state.currentAlbum?.artist_name || 'Unknown Artist'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Previous Track */}
          <button
            onClick={previousTrack}
            disabled={state.queue.length <= 1}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
              state.queue.length <= 1 
                ? 'text-[#726d6c]/50 cursor-not-allowed' 
                : 'text-[#ede8df] hover:bg-[#502d26]/40 active:bg-[#502d26]/60'
            }`}
            title="Previous track"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlayPause}
            disabled={!state.currentTrack || state.error !== null}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
              !state.currentTrack || state.error !== null
                ? 'bg-[#502d26]/30 text-[#726d6c]/50 cursor-not-allowed'
                : 'bg-[#843c2d] text-[#ede8df] hover:bg-[#843c2d]/80 active:scale-95 shadow-lg shadow-[#843c2d]/20'
            }`}
            title={state.isPlaying ? 'Pause' : 'Play'}
          >
            {state.isLoading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : state.isPlaying ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={nextTrack}
            disabled={state.queue.length <= 1 && state.repeatMode === 'none'}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
              state.queue.length <= 1 && state.repeatMode === 'none'
                ? 'text-[#726d6c]/50 cursor-not-allowed' 
                : 'text-[#ede8df] hover:bg-[#502d26]/40 active:bg-[#502d26]/60'
            }`}
            title="Next track"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>

        {/* Queue Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-8 h-8 flex items-center justify-center rounded-full text-[#ede8df] hover:bg-[#502d26]/40 active:bg-[#502d26]/60 transition-colors"
          title="Show queue"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
        </button>
      </div>

      {/* Time Display */}
      <div className="px-4 pb-2 flex justify-between text-xs text-[#b2a491]">
        <span>{formatTime(state.currentTime)}</span>
        <span>{formatTime(state.duration)}</span>
      </div>

      {/* Expanded Queue Preview */}
      {isExpanded && state.queue.length > 1 && (
        <div className="border-t border-[#502d26]/30 bg-[#171616]/50 max-h-48 overflow-y-auto">
          <div className="p-3">
            <h5 className="text-[#ede8df] font-medium text-sm mb-2">Up Next</h5>
            <div className="space-y-2">
              {state.queue.slice(state.currentIndex + 1, state.currentIndex + 4).map((track, index) => (
                <div key={track.id} className="flex items-center space-x-3 py-1">
                  <span className="text-[#726d6c] text-xs w-4 flex-shrink-0">
                    {state.currentIndex + index + 2}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#ede8df] text-xs truncate">{track.title}</p>
                    <p className="text-[#726d6c] text-xs truncate">
                      {state.currentAlbum?.artist_name || 'Unknown Artist'}
                    </p>
                  </div>
                </div>
              ))}
              {state.queue.length > state.currentIndex + 4 && (
                <div className="text-center py-2">
                  <button
                    onClick={onOpenPlayer}
                    className="text-[#843c2d] text-xs hover:text-[#a0472f] transition-colors"
                  >
                    View all {state.queue.length - state.currentIndex - 1} tracks
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}