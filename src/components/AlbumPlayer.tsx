'use client';

import { useState, useEffect } from 'react';
import { Album, Track } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

interface AlbumPlayerProps {
  album: Album;
  tracks: Track[];
}

export default function AlbumPlayer({ album, tracks }: AlbumPlayerProps) {
  const { state, playTrack, playAlbum, addToQueue, toggleShuffle, playFromQueue } = useMusicPlayer();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const playTrackFromAlbum = (track: Track, index: number) => {
    if (!track.audio_url) return;
    playTrack(track, album, tracks, index);
  };

  const playEntireAlbum = (startIndex = 0) => {
    const availableTracks = tracks.filter(track => track.audio_url);
    if (availableTracks.length === 0) return;
    playAlbum(album, availableTracks, startIndex);
  };

  const shuffleAndPlay = () => {
    const availableTracks = tracks.filter(track => track.audio_url);
    if (availableTracks.length === 0) return;
    const randomIndex = Math.floor(Math.random() * availableTracks.length);
    playAlbum(album, availableTracks, randomIndex);
    setTimeout(() => {
      if (!state.isShuffled) toggleShuffle();
    }, 150);
  };

  const addAlbumToQueue = () => {
    const availableTracks = tracks.filter(track => track.audio_url);
    if (availableTracks.length === 0) return;
    addToQueue(availableTracks);
  };

  const isCurrentTrack = (track: Track) => state.currentTrack?.id === track.id;
  const isTrackPlaying = (track: Track) => isCurrentTrack(track) && state.isPlaying;
  const hasAvailableTracks = tracks.filter(t => t.audio_url).length > 0;

  // Get upcoming tracks from the queue (next 5 after current)
  const upNextTracks = state.queue.slice(state.currentIndex + 1, state.currentIndex + 6);

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => playEntireAlbum()}
          disabled={!hasAvailableTracks}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
            hasAvailableTracks
              ? 'bg-[#ede8df] text-[#302927] hover:bg-[#ede8df]/90'
              : 'bg-[#302927] text-[#726d6c] cursor-not-allowed'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <span className="hidden sm:inline">Play</span>
        </button>

        <button
          onClick={shuffleAndPlay}
          disabled={!hasAvailableTracks}
          className={`p-2 rounded-lg transition-colors ${
            hasAvailableTracks
              ? 'text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927]'
              : 'text-[#726d6c] cursor-not-allowed'
          }`}
          title="Shuffle"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="4" y2="4" />
          </svg>
        </button>

        <button
          onClick={addAlbumToQueue}
          disabled={!hasAvailableTracks}
          className={`p-2 rounded-lg transition-colors ${
            hasAvailableTracks
              ? 'text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927]'
              : 'text-[#726d6c] cursor-not-allowed'
          }`}
          title="Add to queue"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/>
          </svg>
        </button>
      </div>

      {/* Track List */}
      <div className="rounded-xl border border-[#502d26]/20 overflow-hidden">
        {tracks.length > 0 ? (
          <div className="divide-y divide-[#502d26]/10">
            {tracks.map((track, index) => {
              const isDisabled = !track.audio_url;
              const isCurrent = isCurrentTrack(track);
              const isPlaying = isTrackPlaying(track);

              return (
                <div
                  key={track.id}
                  onClick={() => !isDisabled && playTrackFromAlbum(track, index)}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-[#302927]/30'
                  } ${isCurrent ? 'bg-[#843c2d]/10' : ''}`}
                >
                  {/* Track Number / Playing Indicator */}
                  <div className="w-6 text-center flex-shrink-0">
                    {isPlaying ? (
                      <div className="flex justify-center gap-0.5">
                        <span className="w-0.5 h-3 bg-[#843c2d] animate-pulse" />
                        <span className="w-0.5 h-3 bg-[#843c2d] animate-pulse" style={{ animationDelay: '0.1s' }} />
                        <span className="w-0.5 h-3 bg-[#843c2d] animate-pulse" style={{ animationDelay: '0.2s' }} />
                      </div>
                    ) : (
                      <span className={`text-xs ${isCurrent ? 'text-[#843c2d]' : 'text-[#726d6c]'}`}>
                        {track.track_number || index + 1}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <span className={`flex-1 text-sm truncate ${
                    isCurrent ? 'text-[#843c2d]' : 'text-[#ede8df]'
                  }`}>
                    {track.title}
                  </span>

                  {/* Explicit */}
                  {Boolean(track.explicit_content) && (
                    <span className="px-1 py-0.5 bg-[#502d26] text-[#ede8df] text-[10px] font-bold rounded">E</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="w-12 h-12 rounded-xl border border-[#502d26]/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5l-10.5 3v10.553m0-10.553v10.553" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Up Next Section */}
      {upNextTracks.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-[#843c2d] to-[#502d26]" />
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#b2a491]">
              Up Next
            </h3>
          </div>
          <div className="rounded-xl border border-[#502d26]/20 overflow-hidden">
            <div className="divide-y divide-[#502d26]/10">
              {upNextTracks.map((track, idx) => {
                const queueIndex = state.currentIndex + 1 + idx;
                return (
                  <div
                    key={`${track.id}-${queueIndex}`}
                    onClick={() => playFromQueue(queueIndex)}
                    className="group flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#302927]/30 transition-colors"
                  >
                    {/* Queue position */}
                    <span className="w-5 text-center text-[10px] text-[#726d6c] group-hover:hidden">
                      {idx + 1}
                    </span>
                    {/* Play icon on hover */}
                    <div className="w-5 hidden group-hover:flex items-center justify-center">
                      <svg className="w-3 h-3 text-[#843c2d]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#ede8df] truncate">{track.title}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
