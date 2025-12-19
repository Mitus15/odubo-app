'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useUnifiedMedia, type VideoCard, type AlbumCard, type MediaTab } from '@/contexts/UnifiedMediaContext';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import MomentsTabView from './MomentsTabView';

// Format seconds to MM:SS or HH:MM:SS
function formatDuration(seconds: number | string | null | undefined): string {
  if (seconds == null) return '';
  const secs = typeof seconds === 'string' ? parseInt(seconds, 10) : Math.floor(seconds);
  if (isNaN(secs) || secs <= 0) return '';

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MediaHubModal() {
  const {
    videos,
    setVideos,
    albums,
    setAlbums,
    activeTab,
    setActiveTab,
    openVideoPlayer,
    openAlbumDetail,
    closeAll,
    isLoadingVideos,
    setIsLoadingVideos,
    isLoadingAlbums,
    setIsLoadingAlbums,
  } = useUnifiedMedia();

  const { state: playerState } = useMusicPlayer();
  const { currentAlbum, isPlaying } = playerState;

  const [videoError, setVideoError] = useState<string | null>(null);
  const [albumError, setAlbumError] = useState<string | null>(null);

  // Fetch videos on mount if not already loaded
  useEffect(() => {
    if (videos.length > 0 || isLoadingVideos) return;

    const fetchVideos = async () => {
      setIsLoadingVideos(true);
      setVideoError(null);

      try {
        // Filter for live videos only (not clips)
        const res = await fetch('/api/videos?publication_status=live&limit=50');
        if (!res.ok) throw new Error('Failed to load videos');
        const data = await res.json();

        // Filter out clips (type !== 'clip') and map
        const mapped: VideoCard[] = (data.videos || [])
          .filter((v: any) => v.type !== 'clip')
          .map((v: any) => ({
            id: v.id,
            uid: v.uid,
            title: v.title,
            poster_url: v.poster_url || v.thumbnail_url,
            thumbnail: v.thumbnail,
            duration: formatDuration(v.duration_seconds || v.duration),
            duration_seconds: v.duration_seconds || 0,
          }));

        setVideos(mapped);
      } catch (e: any) {
        setVideoError(e?.message || 'Failed to load videos');
      } finally {
        setIsLoadingVideos(false);
      }
    };

    fetchVideos();
  }, [videos.length, isLoadingVideos, setVideos, setIsLoadingVideos]);

  // Fetch albums on mount if not already loaded
  useEffect(() => {
    if (albums.length > 0 || isLoadingAlbums) return;

    const fetchAlbums = async () => {
      setIsLoadingAlbums(true);
      setAlbumError(null);

      try {
        const res = await fetch('/api/albums?limit=50');
        if (!res.ok) throw new Error('Failed to load albums');
        const data = await res.json();

        const mapped: AlbumCard[] = (data.albums || []).map((a: any) => ({
          id: a.id,
          title: a.title,
          artist_name: a.artist_name,
          cover_art_url: a.cover_art_url,
          release_type: a.release_type,
          track_count: a.track_count,
        }));

        setAlbums(mapped);
      } catch (e: any) {
        setAlbumError(e?.message || 'Failed to load albums');
      } finally {
        setIsLoadingAlbums(false);
      }
    };

    fetchAlbums();
  }, [albums.length, isLoadingAlbums, setAlbums, setIsLoadingAlbums]);

  // Handle album tap - navigate to album detail view
  const handleAlbumTap = (album: AlbumCard) => {
    openAlbumDetail(album.id);
  };

  const isCurrentAlbum = (albumId: string) => currentAlbum?.id === albumId;

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[110] flex flex-col bg-gradient-to-br from-[#1a1714] via-[#0f0d0c] to-[#1a1714]"
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b border-white/10"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={closeAll}
          className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
          aria-label="Close"
          style={{ touchAction: 'manipulation' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Tab switcher - 3 tabs */}
        <div className="flex gap-1 bg-white/5 rounded-full p-1">
          {(['videos', 'music', 'moments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === tab
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
              style={{ touchAction: 'manipulation' }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Spacer to balance layout */}
        <div className="w-10 h-10" />
      </header>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <>
            {isLoadingVideos && (
              <div className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="aspect-video bg-white/5 rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            )}

            {videoError && !isLoadingVideos && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center">
                <p className="text-white/50 text-sm mb-4">{videoError}</p>
                <button
                  onClick={() => {
                    setVideos([]);
                    setVideoError(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-colors text-sm"
                >
                  Retry
                </button>
              </div>
            )}

            {!isLoadingVideos && !videoError && videos.length > 0 && (
              <div className="p-3 grid grid-cols-2 gap-2">
                {videos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => openVideoPlayer(video.id)}
                    className="group relative aspect-video bg-black rounded-lg overflow-hidden focus:outline-none"
                    style={{ touchAction: 'manipulation' }}
                  >
                    {/* Thumbnail */}
                    {(video.poster_url || video.thumbnail) ? (
                      <img
                        src={video.poster_url || video.thumbnail || ''}
                        alt={video.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        draggable={false}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
                        <svg className="w-8 h-8 text-white/20" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    )}

                    {/* Duration badge */}
                    {video.duration && (
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white/90 font-medium">
                        {video.duration}
                      </span>
                    )}

                    {/* Gradient overlay with title */}
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-white text-xs font-medium truncate">{video.title}</p>
                    </div>

                    {/* Play indicator on hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!isLoadingVideos && !videoError && videos.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <p className="text-white/30 text-xs uppercase tracking-widest">No videos available</p>
              </div>
            )}
          </>
        )}

        {/* Music Tab */}
        {activeTab === 'music' && (
          <>
            {isLoadingAlbums && (
              <div className="p-3">
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="aspect-square bg-white/5 rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            )}

            {albumError && !isLoadingAlbums && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center">
                <p className="text-white/50 text-sm mb-4">{albumError}</p>
                <button
                  onClick={() => {
                    setAlbums([]);
                    setAlbumError(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-colors text-sm"
                >
                  Retry
                </button>
              </div>
            )}

            {!isLoadingAlbums && !albumError && albums.length > 0 && (
              <div className="p-3 grid grid-cols-2 gap-3">
                {albums.map((album) => (
                  <button
                    key={album.id}
                    onClick={() => handleAlbumTap(album)}
                    className="group relative aspect-square bg-black rounded-lg overflow-hidden focus:outline-none"
                    style={{ touchAction: 'manipulation' }}
                  >
                    {/* Cover art */}
                    {album.cover_art_url ? (
                      <img
                        src={album.cover_art_url}
                        alt={album.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        draggable={false}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
                        <svg className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                    )}

                    {/* Now playing indicator */}
                    {isCurrentAlbum(album.id) && (
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-full">
                        {isPlaying ? (
                          <>
                            <div className="flex gap-[2px] items-end h-3">
                              <div className="w-[3px] bg-emerald-400 rounded-full animate-pulse" style={{ height: '60%' }} />
                              <div className="w-[3px] bg-emerald-400 rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} />
                              <div className="w-[3px] bg-emerald-400 rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} />
                            </div>
                            <span className="text-[10px] text-emerald-400 font-medium">Playing</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-white/70 font-medium">Paused</span>
                        )}
                      </div>
                    )}

                    {/* Gradient overlay with info */}
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                      <p className="text-white text-sm font-semibold truncate">{album.title}</p>
                      <p className="text-white/60 text-xs truncate">{album.artist_name}</p>
                    </div>

                    {/* Play indicator on hover (when not already playing) */}
                    {!isCurrentAlbum(album.id) && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="p-4 rounded-full bg-white/20 backdrop-blur-sm">
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {!isLoadingAlbums && !albumError && albums.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <p className="text-white/30 text-xs uppercase tracking-widest">No albums available</p>
              </div>
            )}
          </>
        )}

        {/* Moments Tab */}
        {activeTab === 'moments' && <MomentsTabView />}
      </div>
    </motion.div>
  );
}
