"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AudioContextType {
  isMuted: boolean;
  volume: number;
  setIsMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [isMuted, setIsMutedState] = useState<boolean>(true);
  const [volume, setVolumeState] = useState<number>(1);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const savedMuted = localStorage.getItem('clips:isMuted');
      const savedVolume = localStorage.getItem('clips:volume');
      
      if (savedMuted !== null) {
        setIsMutedState(savedMuted === 'true');
      }
      if (savedVolume !== null) {
        const vol = parseFloat(savedVolume);
        if (!isNaN(vol) && vol >= 0 && vol <= 1) {
          setVolumeState(vol);
        }
      }
    } catch (e) {
      console.warn('Failed to load audio settings from localStorage', e);
    }
    setIsInitialized(true);
  }, []);

  // Persist to localStorage whenever values change
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('clips:isMuted', String(isMuted));
    } catch (e) {
      console.warn('Failed to save mute state to localStorage', e);
    }
  }, [isMuted, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('clips:volume', String(volume));
    } catch (e) {
      console.warn('Failed to save volume to localStorage', e);
    }
  }, [volume, isInitialized]);

  const setIsMuted = (muted: boolean) => {
    setIsMutedState(muted);
  };

  const setVolume = (vol: number) => {
    const clampedVol = Math.max(0, Math.min(1, vol));
    setVolumeState(clampedVol);
  };

  const toggleMute = () => {
    setIsMutedState(prev => !prev);
  };

  return (
    <AudioContext.Provider value={{ isMuted, volume, setIsMuted, setVolume, toggleMute }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
