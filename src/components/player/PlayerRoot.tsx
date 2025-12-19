'use client';

import React, { useEffect } from 'react';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import MusicPlayerModal from '@/components/player/MusicPlayerModal';
import Toasts from '@/components/player/Toasts';

/**
 * PlayerRoot - Global music player root component
 *
 * Handles:
 * - Media Session API integration (for OS-level controls)
 * - Keyboard shortcuts (space, arrows, M for mute)
 * - MusicPlayerModal (opened via VinylMiniPlayer)
 * - Toast notifications
 */
export default function PlayerRoot() {
  const { state, togglePlayPause, nextTrack, previousTrack, seekTo, toggleMute } = useMusicPlayer();

  // Media Session integration
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!state.currentTrack) return;

    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: state.currentTrack.title,
      artist: state.currentAlbum?.artist_name || 'Unknown Artist',
      album: state.currentAlbum?.title || 'Odubo',
      artwork: state.currentAlbum?.cover_art_url
        ? [
            { src: state.currentAlbum.cover_art_url, sizes: '512x512', type: 'image/png' },
          ]
        : [],
    });

    navigator.mediaSession.setActionHandler?.('play', () => togglePlayPause());
    navigator.mediaSession.setActionHandler?.('pause', () => togglePlayPause());
    navigator.mediaSession.setActionHandler?.('previoustrack', () => previousTrack());
    navigator.mediaSession.setActionHandler?.('nexttrack', () => nextTrack());
    navigator.mediaSession.setActionHandler?.('seekto', (e: any) => {
      if (typeof e.seekTime === 'number') seekTo(e.seekTime);
    });
    navigator.mediaSession.setActionHandler?.('seekbackward', () => seekTo(Math.max(0, state.currentTime - 10)));
    navigator.mediaSession.setActionHandler?.('seekforward', () => {
      if (state.duration) seekTo(Math.min(state.duration, state.currentTime + 10));
    });
  }, [state.currentTrack?.id, state.currentTime, state.duration]);

  // Keyboard shortcuts (space, arrows, M for mute)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (isTyping) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekTo(Math.max(0, state.currentTime - 5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (state.duration) seekTo(Math.min(state.duration, state.currentTime + 5));
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.currentTime, state.duration]);

  // MusicPlayerModal and Toasts always render (modal controls its own visibility)
  return (
    <>
      <MusicPlayerModal />
      <Toasts />
    </>
  );
}
