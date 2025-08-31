"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Track } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

interface StemPlayerProps {
  track: Track;
  onClose: () => void;
}

export default function StemPlayer({ track, onClose }: StemPlayerProps) {
  const { state, seekTo, togglePlayPause } = useMusicPlayer();

  const vocalsRef = useRef<HTMLAudioElement | null>(null);
  const drumsRef = useRef<HTMLAudioElement | null>(null);
  const bassRef = useRef<HTMLAudioElement | null>(null);
  const otherRef = useRef<HTMLAudioElement | null>(null);

  const [vocalsVol, setVocalsVol] = useState(1);
  const [drumsVol, setDrumsVol] = useState(1);
  const [bassVol, setBassVol] = useState(1);
  const [otherVol, setOtherVol] = useState(1);

  // Helper to safely set currentTime on all stems
  const syncStemsToTime = (time: number) => {
    [vocalsRef, drumsRef, bassRef, otherRef].forEach(ref => {
      const el = ref.current;
      if (!el || Number.isNaN(time)) return;
      // Only adjust if out of sync by > 0.25s to avoid thrashing
      if (Math.abs(el.currentTime - time) > 0.25) {
        try { el.currentTime = time; } catch (e) { /* ignore */ }
      }
    });
  };

  // Load stem URLs into audio elements
  useEffect(() => {
    if (vocalsRef.current && track.vocal_stem_url) vocalsRef.current.src = track.vocal_stem_url;
    if (drumsRef.current && track.drum_stem_url) drumsRef.current.src = track.drum_stem_url;
    if (bassRef.current && track.bass_stem_url) bassRef.current.src = track.bass_stem_url;
    if (otherRef.current && track.other_stem_url) otherRef.current.src = track.other_stem_url;

    // Set volumes
    if (vocalsRef.current) vocalsRef.current.volume = vocalsVol;
    if (drumsRef.current) drumsRef.current.volume = drumsVol;
    if (bassRef.current) bassRef.current.volume = bassVol;
    if (otherRef.current) otherRef.current.volume = otherVol;
  }, [track, vocalsVol, drumsVol, bassVol, otherVol]);

  // React to global play/pause and currentTime to keep stems in sync with main player
  useEffect(() => {
    // Sync playback position when currentTime updates
    syncStemsToTime(state.currentTime);
  }, [state.currentTime]);

  useEffect(() => {
    const playAll = async () => {
      try {
        const promises: Array<Promise<void>> = [];
        [vocalsRef, drumsRef, bassRef, otherRef].forEach(ref => {
          const el = ref.current;
          if (!el) return;
          el.volume = 1; // will be overwritten by individual states
          // Align currentTime before attempting to play
          try { el.currentTime = state.currentTime; } catch {}
          const p = el.play().then(() => {}).catch(() => {});
          promises.push(p);
        });
        await Promise.all(promises);
      } catch (e) {
        // play errors are fine to swallow (autoplay policy)
      }
    };

    const pauseAll = () => {
      [vocalsRef, drumsRef, bassRef, otherRef].forEach(ref => ref.current?.pause());
    };

    if (state.isPlaying) {
      playAll();
    } else {
      pauseAll();
    }
  }, [state.isPlaying]);

  // Local play/pause control that toggles the main player so global state remains authoritative
  const handlePlayPause = () => {
    togglePlayPause();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    seekTo(newTime);
    syncStemsToTime(newTime);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="bg-[#171616] rounded-2xl w-full max-w-3xl shadow-xl border border-[#302927] overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-[#302927]/40">
          <div>
            <h3 className="text-[#ede8df] font-medium">Stem Mixer</h3>
            <p className="text-[#b2a491] text-sm">Mix vocals, drums, bass and other instruments independently</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              className="px-3 py-2 bg-[#302927] text-[#b2a491] rounded-md"
            >
              {state.isPlaying ? 'Pause' : 'Play'}
            </button>
            <button onClick={onClose} className="px-3 py-2 bg-black/20 text-[#b2a491] rounded-md">Close</button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[#b2a491]">Position</div>
              <input
                type="range"
                min={0}
                max={state.duration || 1}
                step={0.01}
                value={Math.min(state.currentTime, state.duration || 0)}
                onChange={handleSeek}
                className="w-64"
              />
            </div>
            <div className="text-sm text-[#b2a491]">{Math.floor(state.currentTime)}s / {Math.floor(state.duration)}s</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-[#0f0d0b] rounded">
              <div className="flex items-center justify-between">
                <div className="text-[#ede8df] font-medium">Vocals</div>
                <div className="text-sm text-[#b2a491]">Source: {track.vocal_stem_url ? 'R2' : '—'}</div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input type="range" min={0} max={1} step={0.01} value={vocalsVol} onChange={e => { setVocalsVol(parseFloat(e.target.value)); if (vocalsRef.current) vocalsRef.current.volume = parseFloat(e.target.value); }} />
                <div className="text-sm text-[#b2a491]">{Math.round(vocalsVol * 100)}%</div>
              </div>
            </div>

            <div className="p-3 bg-[#0f0d0b] rounded">
              <div className="flex items-center justify-between">
                <div className="text-[#ede8df] font-medium">Drums</div>
                <div className="text-sm text-[#b2a491]">Source: {track.drum_stem_url ? 'R2' : '—'}</div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input type="range" min={0} max={1} step={0.01} value={drumsVol} onChange={e => { setDrumsVol(parseFloat(e.target.value)); if (drumsRef.current) drumsRef.current.volume = parseFloat(e.target.value); }} />
                <div className="text-sm text-[#b2a491]">{Math.round(drumsVol * 100)}%</div>
              </div>
            </div>

            <div className="p-3 bg-[#0f0d0b] rounded">
              <div className="flex items-center justify-between">
                <div className="text-[#ede8df] font-medium">Bass</div>
                <div className="text-sm text-[#b2a491]">Source: {track.bass_stem_url ? 'R2' : '—'}</div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input type="range" min={0} max={1} step={0.01} value={bassVol} onChange={e => { setBassVol(parseFloat(e.target.value)); if (bassRef.current) bassRef.current.volume = parseFloat(e.target.value); }} />
                <div className="text-sm text-[#b2a491]">{Math.round(bassVol * 100)}%</div>
              </div>
            </div>

            <div className="p-3 bg-[#0f0d0b] rounded">
              <div className="flex items-center justify-between">
                <div className="text-[#ede8df] font-medium">Other</div>
                <div className="text-sm text-[#b2a491]">Source: {track.other_stem_url ? 'R2' : '—'}</div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input type="range" min={0} max={1} step={0.01} value={otherVol} onChange={e => { setOtherVol(parseFloat(e.target.value)); if (otherRef.current) otherRef.current.volume = parseFloat(e.target.value); }} />
                <div className="text-sm text-[#b2a491]">{Math.round(otherVol * 100)}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden audio elements used for stems */}
        <div style={{ display: 'none' }}>
          <audio ref={vocalsRef} preload="auto" crossOrigin="anonymous" />
          <audio ref={drumsRef} preload="auto" crossOrigin="anonymous" />
          <audio ref={bassRef} preload="auto" crossOrigin="anonymous" />
          <audio ref={otherRef} preload="auto" crossOrigin="anonymous" />
        </div>
      </div>
    </div>
  );
}
