'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { AnimatePresence } from 'framer-motion';
import MiniBar from '@/components/player/MiniBar';
import ExpandedView from '@/components/player/ExpandedView';
import QueueDrawer from '@/components/player/QueueDrawer';
import Toasts from '@/components/player/Toasts';

export default function PlayerRoot() {
  const { state, togglePlayPause, nextTrack, previousTrack, seekTo, setVolume, toggleMute } = useMusicPlayer();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

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

  // Optionally surface state.error via the Toasts component API in the future.

  if (!state.currentTrack) return null;

  return (
    <>
      <MiniBar
        isLoading={state.isLoading}
        isPlaying={state.isPlaying}
        track={state.currentTrack}
        album={state.currentAlbum}
        currentTime={state.currentTime}
        duration={state.duration}
        error={state.error}
        onRetry={() => {
          // Simple retry logic: re-trigger play on current track if error present
          if (state.currentTrack) {
            togglePlayPause(); // pause if playing
            setTimeout(() => {
              togglePlayPause(); // attempt play again
            }, 150);
          }
        }}
        onPlayPause={togglePlayPause}
        onNext={nextTrack}
        onPrev={previousTrack}
        onOpenExpanded={() => setIsExpanded(true)}
        onToggleQueue={() => setIsQueueOpen((v) => !v)}
      />

      <AnimatePresence>
        {isExpanded && (
          <ExpandedView
            key="expanded"
            isOpen={isExpanded}
            onClose={() => setIsExpanded(false)}
            onOpenQueue={() => setIsQueueOpen(true)}
          />
        )}
      </AnimatePresence>

      <QueueDrawer isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />

      <Toasts />
    </>
  );
}
