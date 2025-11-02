'use client';

import React, { useEffect, useState } from 'react';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

export default function SeekBar() {
  const { state, seekTo, audioRef } = useMusicPlayer();
  const [bufferedPct, setBufferedPct] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => {
      if (!audio.duration || audio.buffered.length === 0) {
        setBufferedPct(0);
        return;
      }
      try {
        const end = audio.buffered.end(audio.buffered.length - 1);
        setBufferedPct(Math.min(100, (end / (audio.duration || 1)) * 100));
      } catch {
        setBufferedPct(0);
      }
    };
    const int = setInterval(update, 500);
    audio.addEventListener('progress', update);
    return () => {
      clearInterval(int);
      audio.removeEventListener('progress', update);
    };
  }, [audioRef.current]);

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!state.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekTo(percent * state.duration);
  };

  const playedPct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div className="w-full">
      <div className="relative h-2 bg-[#502d26]/40 rounded-full cursor-pointer" onClick={onClick} aria-label="Seek bar" role="slider" aria-valuemin={0} aria-valuemax={Math.floor(state.duration || 0)} aria-valuenow={Math.floor(state.currentTime)}>
        <div className="absolute top-0 left-0 h-full bg-[#b2a491]/30 rounded-full" style={{ width: `${bufferedPct}%` }} />
        <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#843c2d] to-[#a0472f] rounded-full transition-all duration-300" style={{ width: `${playedPct}%` }} />
        <div className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-[#ede8df] rounded-full shadow-lg transition-all duration-300" style={{ left: `calc(${playedPct}% - 8px)` }} />
      </div>
      <div className="flex justify-between mt-2 text-xs text-[#b2a491]">
        <span>{formatTime(state.currentTime)}</span>
        <span>{formatTime(state.duration)}</span>
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
