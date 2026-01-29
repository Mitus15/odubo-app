"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Track, Album } from '@/types/music';
import { useAudio } from '@/contexts/AudioContext';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import TrackCard from './TrackCard';

interface TrackWithAlbum extends Track {
  album?: Album | null;
  uniqueKey: string;
}

interface TracksFeedProps {
  navHeight: number;
  onActiveTrackChange?: (track: Track | null, album: Album | null) => void;
  onTracksReady?: (tracks: TrackWithAlbum[], activeIndex: number) => void;
  scrollToNextRef?: MutableRefObject<(() => void) | null>;
}

/**
 * TracksFeed - Vertical swipe feed for album/track showcase
 *
 * This component handles:
 * - Fetching tracks from the API
 * - Managing the vertical scroll/swipe
 * - Detecting which track is active via IntersectionObserver
 * - Playing music via MusicPlayerContext
 */
export default function TracksFeed({
  navHeight,
  onActiveTrackChange,
  onTracksReady,
  scrollToNextRef,
}: TracksFeedProps) {
  const { armAudio } = useAudio();
  const { state: playerState, playTrack, togglePlayPause } = useMusicPlayer();

  const [tracks, setTracks] = useState<TrackWithAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const keyCounterRef = useRef(0);
  const initializedRef = useRef(false);

  // Fetch tracks with their albums
  const fetchTracks = useCallback(async (): Promise<boolean> => {
    if (initializedRef.current) return false;
    initializedRef.current = true;

    setLoading(true);
    setError('');
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // Fetch all tracks
      const tracksRes = await fetch('/api/tracks', {
        headers: { Accept: 'application/json' },
        signal: ctrl.signal,
        cache: 'no-store',
      });

      const tracksData = await tracksRes.json().catch(() => ({})) as { tracks?: Track[]; error?: string };
      if (!tracksRes.ok) throw new Error(tracksData?.error || 'Failed to load tracks');

      const tracksList: Track[] = tracksData?.tracks || [];

      // Fetch all albums to get cover art
      const albumsRes = await fetch('/api/albums', {
        headers: { Accept: 'application/json' },
        signal: ctrl.signal,
        cache: 'no-store',
      });

      const albumsData = await albumsRes.json().catch(() => ({})) as { albums?: Album[]; error?: string };
      const albumsList: Album[] = albumsData?.albums || [];

      // Create album lookup map
      const albumMap = new Map<string, Album>();
      albumsList.forEach((album) => {
        albumMap.set(album.id, album);
      });

      // Filter tracks with audio and map with albums
      const playableTracks = tracksList
        .filter((t) => t.audio_url || t.audio_status === 'ready')
        .map((track) => ({
          ...track,
          album: track.album_id ? albumMap.get(track.album_id) || null : null,
          uniqueKey: `${keyCounterRef.current++}-${track.id}`,
        }));

      if (playableTracks.length === 0) {
        setError('No playable tracks found');
        setLoading(false);
        return false;
      }

      // Shuffle tracks for variety
      const shuffled = [...playableTracks].sort(() => Math.random() - 0.5);

      setTracks(shuffled);
      setActiveIndex(0);
      setLoading(false);

      return true;
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        const msg = e?.message || String(e);
        if (!navigator.onLine || msg.includes('network') || msg.includes('fetch')) {
          setError('Connection lost. Check your internet and try again.');
        } else {
          setError(msg);
        }
      }
      setLoading(false);
      return false;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTracks();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchTracks]);

  // Active track detection using IntersectionObserver
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !tracks.length) return;

    const visibilityMap = new Map<number, number>();

    const updateActiveFromVisibility = () => {
      if (visibilityMap.size === 0) return;

      let bestIndex = -1;
      let bestRatio = 0;

      visibilityMap.forEach((ratio, index) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestIndex = index;
        }
      });

      if (bestIndex >= 0 && bestRatio >= 0.5) {
        if (bestIndex !== activeIndex) {
          setActiveIndex(bestIndex);
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = parseInt(entry.target.getAttribute('data-track-index') || '-1', 10);
          if (index >= 0) {
            if (entry.isIntersecting) {
              visibilityMap.set(index, entry.intersectionRatio);
            } else {
              visibilityMap.delete(index);
            }
          }
        });
        updateActiveFromVisibility();
      },
      {
        root: root,
        threshold: [0.5, 0.7, 0.9],
      }
    );

    const sections = root.querySelectorAll('[data-track-index]');
    sections.forEach((section) => observer.observe(section));

    return () => {
      observer.disconnect();
    };
  }, [tracks, activeIndex]);

  // Notify parent of active track change
  useEffect(() => {
    if (!onActiveTrackChange || tracks.length === 0) return;
    const activeTrack = tracks[activeIndex];
    onActiveTrackChange(activeTrack || null, activeTrack?.album || null);
  }, [activeIndex, tracks, onActiveTrackChange]);

  // Notify parent when tracks are ready
  useEffect(() => {
    if (!onTracksReady || !tracks.length) return;
    onTracksReady(tracks, activeIndex);
  }, [tracks, activeIndex, onTracksReady]);

  // Play handler - play the active track
  const handlePlay = useCallback(
    (track: TrackWithAlbum) => {
      armAudio();

      const isCurrentTrack = playerState.currentTrack?.id === track.id;

      if (isCurrentTrack) {
        // Toggle play/pause for current track
        togglePlayPause();
      } else {
        // Play new track with the full queue
        const queue = tracks.map((t) => {
          // Strip the uniqueKey to match Track type
          const { uniqueKey, album, ...rest } = t;
          return rest as Track;
        });
        const index = tracks.findIndex((t) => t.id === track.id);
        playTrack(track as Track, track.album || undefined, queue, index >= 0 ? index : 0);
      }
    },
    [armAudio, playerState.currentTrack?.id, togglePlayPause, playTrack, tracks]
  );

  // Scroll to next track
  const scrollToNextTrack = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const nextIndex = activeIndex + 1;
    if (nextIndex >= tracks.length) {
      // Loop back to beginning
      const firstSection = root.querySelector('[data-track-index="0"]');
      if (firstSection) {
        firstSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    const nextSection = root.querySelector(`[data-track-index="${nextIndex}"]`);
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeIndex, tracks.length]);

  // Expose scrollToNextTrack to parent via ref
  useEffect(() => {
    if (scrollToNextRef) {
      scrollToNextRef.current = scrollToNextTrack;
    }
    return () => {
      if (scrollToNextRef) {
        scrollToNextRef.current = null;
      }
    };
  }, [scrollToNextTrack, scrollToNextRef]);

  return (
    <div
      ref={rootRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden"
      style={{
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'none',
        touchAction: 'pan-y',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
      onClick={() => armAudio()}
    >
      {/* Loading state */}
      {loading && tracks.length === 0 && (
        <div className="flex items-center justify-center" style={{ height: '100dvh' }}>
          <div className="flex flex-col items-center gap-3 text-white/60">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <p className="text-sm">Loading music...</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && tracks.length === 0 && !error && (
        <div className="flex items-center justify-center" style={{ height: '100dvh' }}>
          <div className="flex flex-col items-center gap-3 text-white/60 text-center px-8">
            <svg className="w-16 h-16 text-white/20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <p className="text-lg font-medium text-white/80">No music yet</p>
            <p className="text-sm">Check back soon for new tracks</p>
          </div>
        </div>
      )}

      {/* Track cards - virtualized: only render activeIndex ± 2 */}
      {tracks.map((track, index) => {
        const distance = Math.abs(index - activeIndex);
        if (distance > 2) {
          // Render placeholder to maintain scroll position
          return (
            <div
              key={track.uniqueKey}
              data-track-index={index}
              style={{ height: '100dvh', scrollSnapAlign: 'start' }}
            />
          );
        }

        const isThisTrackPlaying =
          playerState.currentTrack?.id === track.id && playerState.isPlaying;

        return (
          <section
            key={track.uniqueKey}
            data-track-index={index}
            className="w-full flex items-center justify-center flex-shrink-0"
            style={{
              height: '100dvh',
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
              touchAction: 'pan-y',
            }}
          >
            <TrackCard
              track={track}
              album={track.album || null}
              active={index === activeIndex}
              isPlaying={isThisTrackPlaying}
              isLoading={
                playerState.currentTrack?.id === track.id && playerState.isLoading
              }
              onPlay={() => handlePlay(track)}
            />
          </section>
        );
      })}

      {/* Error state with retry */}
      {error && (
        <div className="mx-auto max-w-md my-4 p-4 rounded-xl border border-red-700/60 bg-red-900/30 text-red-200 text-sm text-center">
          <p className="mb-3">{error}</p>
          <button
            onClick={() => {
              setError('');
              initializedRef.current = false;
              fetchTracks();
            }}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
