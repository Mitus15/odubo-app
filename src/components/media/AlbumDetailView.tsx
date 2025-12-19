'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useUnifiedMedia } from '@/contexts/UnifiedMediaContext';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import type { Track, Album } from '@/types/music';

interface AlbumDetailViewProps {
  albumId: string;
}

// Format seconds to MM:SS
function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds <= 0 || !Number.isFinite(seconds)) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AlbumDetailView({ albumId }: AlbumDetailViewProps) {
  const { goBack, closeAll } = useUnifiedMedia();
  const {
    state,
    playAlbum,
    playFromQueue,
    togglePlayPause,
    nextTrack,
    previousTrack,
    toggleShuffle,
    cycleRepeatMode,
    addToQueue,
  } = useMusicPlayer();

  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch album data
  useEffect(() => {
    const fetchAlbum = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/albums/${albumId}`);
        if (!res.ok) throw new Error('Failed to load album');
        const data = await res.json() as { album: any };

        const fullAlbum = data.album;
        setAlbum({
          id: fullAlbum.id,
          title: fullAlbum.title,
          artist_name: fullAlbum.artist_name,
          cover_art_url: fullAlbum.cover_art_url,
          release_type: fullAlbum.release_type || 'album',
          release_date: fullAlbum.release_date || '',
          record_label: fullAlbum.record_label || '',
          genre: fullAlbum.genre || '',
          explicit_content: Boolean(fullAlbum.explicit_content),
          featured: Boolean(fullAlbum.featured),
          created_at: fullAlbum.created_at || '',
          updated_at: fullAlbum.updated_at || '',
        });
        setTracks(fullAlbum.tracks || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load album');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlbum();
  }, [albumId]);

  // Play entire album
  const handlePlayAll = useCallback(() => {
    if (!album || tracks.length === 0) return;
    playAlbum(album, tracks, 0);
  }, [album, tracks, playAlbum]);

  // Play specific track
  const handlePlayTrack = useCallback((index: number) => {
    if (!album || tracks.length === 0) return;

    if (state.currentAlbum?.id === album.id && state.queue.length === tracks.length) {
      playFromQueue(index);
    } else {
      playAlbum(album, tracks, index);
    }
  }, [album, tracks, state.currentAlbum, state.queue, playAlbum, playFromQueue]);

  // Add track to queue
  const handleAddToQueue = useCallback((track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue([track]);
  }, [addToQueue]);

  // Check if track is currently playing
  const isCurrentTrack = (trackId: string | number) => {
    return state.currentTrack?.id === trackId;
  };

  // Calculate total duration
  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const totalMinutes = Math.floor(totalDuration / 60);

  // Brand accent color - warm maroon/terracotta
  const accentColor = 'rgb(132, 60, 45)'; // --brand maroon
  const accentColorBright = 'rgb(168, 82, 64)'; // lighter for hover

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[110] flex flex-col overflow-hidden"
    >
      {/* Liquid Glass Background */}
      <div className="absolute inset-0">
        {/* Base gradient - warm tones */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1512] via-[#0f0d0c] to-black" />
        
        {/* Floating liquid glass orbs */}
        <div className="absolute top-20 -left-20 w-64 h-64 rounded-full bg-gradient-to-br from-[#843c2d]/20 to-transparent blur-3xl opacity-60 liquid-float" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-gradient-to-bl from-[#502d26]/20 to-transparent blur-3xl opacity-50 liquid-wave" />
        <div className="absolute bottom-1/4 left-1/4 w-48 h-48 rounded-full bg-gradient-to-tr from-[#ede8df]/5 to-transparent blur-2xl opacity-40 liquid-pulse" />
        
        {/* Noise texture overlay */}
        <div className="absolute inset-0 noise-subtle" />
      </div>

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3 z-10"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={goBack}
          className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/5"
          aria-label="Back"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <button
          onClick={closeAll}
          className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/5"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Scrollable Content */}
      <div
        className="relative flex-1 overflow-y-auto overscroll-contain z-10"
        style={{
          paddingBottom: state.currentTrack ? 'calc(env(safe-area-inset-bottom, 0px) + 100px)' : 'env(safe-area-inset-bottom, 0px)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Loading State */}
        {isLoading && (
          <div className="p-8 flex flex-col items-center gap-6">
            <div className="w-56 h-56 rounded-xl glass-surface animate-pulse" />
            <div className="space-y-3 w-full max-w-[200px]">
              <div className="h-5 rounded glass-surface animate-pulse" />
              <div className="h-4 rounded glass-surface animate-pulse w-3/4 mx-auto" />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center">
            <div className="w-16 h-16 rounded-full glass-surface flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-white/50 text-sm mb-4">{error}</p>
            <button
              onClick={goBack}
              className="px-5 py-2.5 rounded-full glass-surface text-white hover:bg-white/10 transition-colors text-sm"
            >
              Go Back
            </button>
          </div>
        )}

        {/* Album Content */}
        {!isLoading && !error && album && (
          <>
            {/* Album Header Section */}
            <div className="px-6 pt-2 pb-8 flex flex-col items-center">
              {/* Cover Art with liquid glass effect */}
              <div className="relative mb-6 group">
                {/* Glow effect behind album */}
                <div className="absolute inset-0 blur-3xl opacity-50 scale-90 group-hover:opacity-70 transition-opacity duration-500">
                  {album.cover_art_url && (
                    <Image
                      src={album.cover_art_url}
                      alt=""
                      fill
                      sizes="240px"
                      className="object-cover rounded-xl"
                    />
                  )}
                </div>
                
                {/* Main album cover */}
                <div className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                  {album.cover_art_url ? (
                    <Image
                      src={album.cover_art_url}
                      alt={album.title}
                      fill
                      sizes="240px"
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full glass-surface flex items-center justify-center">
                      <svg className="w-20 h-20 text-white/10" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Liquid glass overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </div>

              {/* Title & Artist */}
              <h1 className="text-2xl font-bold text-white text-center mb-1 px-4 tracking-tight">
                {album.title}
              </h1>
              <p className="text-[15px] text-[#ede8df]/70 font-medium">{album.artist_name}</p>

              {/* Meta info */}
              <p className="text-[13px] text-white/40 mt-2">
                {album.release_type && <span className="capitalize">{album.release_type}</span>}
                {album.release_date && <span> · {new Date(album.release_date).getFullYear()}</span>}
                {totalMinutes > 0 && <span> · {totalMinutes} min</span>}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-6 mt-6">
                {/* Shuffle */}
                <button
                  onClick={toggleShuffle}
                  className={`p-3 rounded-full transition-all duration-200 ${
                    state.isShuffled 
                      ? 'text-[#843c2d] bg-[#843c2d]/20' 
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                  aria-label={state.isShuffled ? 'Disable shuffle' : 'Enable shuffle'}
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                  </svg>
                </button>

                {/* Play Button - Brand accent */}
                <button
                  onClick={handlePlayAll}
                  className="w-14 h-14 rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-lg shadow-[#843c2d]/30"
                  style={{ 
                    background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColorBright} 100%)`,
                  }}
                  aria-label="Play"
                >
                  <svg className="w-7 h-7 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>

                {/* Repeat */}
                <button
                  onClick={cycleRepeatMode}
                  className={`p-3 rounded-full transition-all duration-200 ${
                    state.repeatMode !== 'none' 
                      ? 'text-[#843c2d] bg-[#843c2d]/20' 
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                  aria-label={`Repeat: ${state.repeatMode}`}
                >
                  {state.repeatMode === 'one' ? (
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Track List */}
            <div className="px-4 pb-6">
              {tracks.map((track, index) => {
                const isCurrent = isCurrentTrack(track.id);
                const isPlaying = isCurrent && state.isPlaying;
                const hasExplicit = Boolean(track.explicit_content);

                return (
                  <div
                    key={track.id}
                    onClick={() => handlePlayTrack(index)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer group ${
                      isCurrent 
                        ? 'glass-surface bg-[#843c2d]/10 ring-1 ring-[#843c2d]/20' 
                        : 'hover:bg-white/5'
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePlayTrack(index); }}
                  >
                    {/* Track number / playing indicator */}
                    <div className="w-8 flex items-center justify-center flex-shrink-0">
                      {isPlaying ? (
                        <div className="flex gap-[3px] items-end h-4">
                          <div className="w-[3px] bg-[#843c2d] rounded-sm animate-[eq_0.5s_ease_infinite_alternate]" style={{ height: '40%' }} />
                          <div className="w-[3px] bg-[#843c2d] rounded-sm animate-[eq_0.5s_ease_0.2s_infinite_alternate]" style={{ height: '100%' }} />
                          <div className="w-[3px] bg-[#843c2d] rounded-sm animate-[eq_0.5s_ease_0.4s_infinite_alternate]" style={{ height: '60%' }} />
                        </div>
                      ) : (
                        <>
                          <span className={`text-sm group-hover:hidden ${isCurrent ? 'text-[#843c2d]' : 'text-white/40'}`}>
                            {index + 1}
                          </span>
                          <svg className="w-4 h-4 text-white hidden group-hover:block" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </>
                      )}
                    </div>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[15px] font-medium truncate ${isCurrent ? 'text-[#ede8df]' : 'text-white'}`}>
                        {track.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {hasExplicit && (
                          <span className="inline-flex items-center justify-center w-4 h-4 bg-white/15 rounded text-[9px] font-bold text-white/60">
                            E
                          </span>
                        )}
                        <span className="text-[13px] text-white/45 truncate">{album.artist_name}</span>
                      </div>
                    </div>

                    {/* Duration & Add button */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm text-white/35 tabular-nums">
                        {formatDuration(track.duration)}
                      </span>
                      <button
                        onClick={(e) => handleAddToQueue(track, e)}
                        className="p-2 text-white/0 group-hover:text-white/40 hover:!text-white transition-colors rounded-full hover:bg-white/5"
                        aria-label="Add to queue"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Album info footer */}
            <div className="px-6 pb-8 text-[13px] text-white/25">
              <p>{album.release_date && new Date(album.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              {album.record_label && <p className="mt-1">© {album.record_label}</p>}
            </div>
          </>
        )}
      </div>

      {/* Now Playing Bar - Liquid Glass Style */}
      <AnimatePresence>
        {state.currentTrack && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 z-20"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="mx-3 mb-3 rounded-2xl glass-surface overflow-hidden">
              {/* Progress bar */}
              <div className="h-1 bg-white/5 relative">
                <div 
                  className="absolute left-0 top-0 h-full transition-all duration-300"
                  style={{ 
                    width: `${state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0}%`,
                    background: `linear-gradient(90deg, ${accentColor}, ${accentColorBright})`
                  }}
                />
              </div>
              
              <div className="p-3 flex items-center gap-3">
                {/* Album art */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/20 flex-shrink-0 ring-1 ring-white/5">
                  {state.currentAlbum?.cover_art_url ? (
                    <Image
                      src={state.currentAlbum.cover_art_url}
                      alt=""
                      width={48}
                      height={48}
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white/20" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{state.currentTrack.title}</p>
                  <p className="text-xs text-white/45 truncate">{state.currentAlbum?.artist_name}</p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={previousTrack}
                    className="p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/5"
                    aria-label="Previous"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                    </svg>
                  </button>

                  <button
                    onClick={togglePlayPause}
                    className="w-9 h-9 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                    style={{ 
                      background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColorBright} 100%)`,
                    }}
                    aria-label={state.isPlaying ? 'Pause' : 'Play'}
                  >
                    {state.isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : state.isPlaying ? (
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={nextTrack}
                    className="p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/5"
                    aria-label="Next"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EQ Animation keyframes */}
      <style jsx global>{`
        @keyframes eq {
          0% { height: 30%; }
          100% { height: 100%; }
        }
      `}</style>
    </motion.div>
  );
}
