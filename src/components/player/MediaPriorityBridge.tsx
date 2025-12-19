'use client';

import { useEffect, useRef } from 'react';
import { useAudio } from '@/contexts/AudioContext';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

/**
 * MediaPriorityBridge - Connects AudioContext and MusicPlayerContext
 *
 * Implements media priority rules:
 * - Music playing → clips muted (but can browse)
 * - User unmutes clips → music pauses
 * - Video plays → music pauses, clips muted
 *
 * This component renders nothing - it just wires up the contexts.
 */
export default function MediaPriorityBridge() {
  const {
    setMusicPlaying,
    registerMusicPauseCallback,
  } = useAudio();

  const {
    state: musicState,
    togglePlayPause: musicTogglePlayPause,
  } = useMusicPlayer();

  // Track previous music playing state to detect changes
  const prevMusicPlayingRef = useRef(musicState.isPlaying);

  // Sync music playing state to AudioContext
  useEffect(() => {
    const wasPlaying = prevMusicPlayingRef.current;
    const isNowPlaying = musicState.isPlaying && !!musicState.currentTrack;

    // Only update if state actually changed
    if (wasPlaying !== isNowPlaying) {
      setMusicPlaying(isNowPlaying);
      prevMusicPlayingRef.current = isNowPlaying;
    }
  }, [musicState.isPlaying, musicState.currentTrack, setMusicPlaying]);

  // Register callback for AudioContext to pause music
  useEffect(() => {
    const pauseMusic = () => {
      // Only pause if actually playing
      if (musicState.isPlaying) {
        musicTogglePlayPause();
      }
    };

    registerMusicPauseCallback(pauseMusic);
  }, [musicState.isPlaying, musicTogglePlayPause, registerMusicPauseCallback]);

  // This component renders nothing
  return null;
}
