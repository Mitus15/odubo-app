"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

/**
 * Unified Audio State Management
 *
 * Consolidates all audio state that was previously fragmented across:
 * - clips:isMuted (localStorage)
 * - clips:soundArmed (sessionStorage)
 * - clips:volume (localStorage)
 * - globalUserInteracted (module-level in ClipCard)
 * - hasUserMutePref (ClipsFeed state)
 *
 * Now uses single storage key: odubo:audio
 */

interface AudioState {
  isMuted: boolean;
  volume: number;
  hasUserPreference: boolean;  // User explicitly set mute/unmute
  isArmed: boolean;            // User has interacted, enabling unmuted autoplay
}

interface AudioContextType extends AudioState {
  setIsMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  armAudio: () => void;
  syncFromVideo: (actualMuted: boolean) => void;
}

const STORAGE_KEY = 'odubo:audio';
const SESSION_KEY = 'odubo:audioArmed';

// Legacy keys to migrate from
const LEGACY_KEYS = {
  muted: 'clips:isMuted',
  volume: 'clips:volume',
  armed: 'clips:soundArmed',
};

interface StoredAudioState {
  isMuted: boolean;
  volume: number;
  hasUserPreference: boolean;
}

function loadStoredState(): Partial<StoredAudioState> {
  if (typeof window === 'undefined') return {};

  try {
    // Try new unified key first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }

    // Migrate from legacy keys
    const legacyMuted = localStorage.getItem(LEGACY_KEYS.muted);
    const legacyVolume = localStorage.getItem(LEGACY_KEYS.volume);

    const migrated: Partial<StoredAudioState> = {};

    if (legacyMuted !== null) {
      migrated.isMuted = legacyMuted === 'true';
      migrated.hasUserPreference = true;
      // Clean up legacy key
      localStorage.removeItem(LEGACY_KEYS.muted);
    }

    if (legacyVolume !== null) {
      const vol = parseFloat(legacyVolume);
      if (!isNaN(vol) && vol >= 0 && vol <= 1) {
        migrated.volume = vol;
      }
      localStorage.removeItem(LEGACY_KEYS.volume);
    }

    return migrated;
  } catch {
    return {};
  }
}

function loadArmedState(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // Try new key first
    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
      return true;
    }

    // Migrate from legacy key
    if (sessionStorage.getItem(LEGACY_KEYS.armed) === 'true') {
      sessionStorage.removeItem(LEGACY_KEYS.armed);
      sessionStorage.setItem(SESSION_KEY, 'true');
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function saveStoredState(state: StoredAudioState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function saveArmedState(armed: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    if (armed) {
      sessionStorage.setItem(SESSION_KEY, 'true');
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {}
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: ReactNode }) {
  // Default to muted until user interacts (browser autoplay policy)
  const [isMuted, setIsMutedState] = useState<boolean>(true);
  const [volume, setVolumeState] = useState<number>(1);
  const [hasUserPreference, setHasUserPreference] = useState<boolean>(false);
  const [isArmed, setIsArmed] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Initialize from storage
  useEffect(() => {
    const stored = loadStoredState();
    const armed = loadArmedState();

    if (stored.isMuted !== undefined) {
      setIsMutedState(stored.isMuted);
    }
    if (stored.volume !== undefined) {
      setVolumeState(stored.volume);
    }
    if (stored.hasUserPreference !== undefined) {
      setHasUserPreference(stored.hasUserPreference);
    }

    setIsArmed(armed);
    setIsInitialized(true);
  }, []);

  // Persist state changes
  useEffect(() => {
    if (!isInitialized) return;
    saveStoredState({ isMuted, volume, hasUserPreference });
  }, [isMuted, volume, hasUserPreference, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    saveArmedState(isArmed);
  }, [isArmed, isInitialized]);

  // Listen for user interaction to arm audio (enables unmuted autoplay)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isArmed) return; // Already armed

    const armOnInteraction = () => {
      setIsArmed(true);
    };

    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(evt => {
      window.addEventListener(evt, armOnInteraction, { once: true, passive: true });
    });

    return () => {
      events.forEach(evt => {
        window.removeEventListener(evt, armOnInteraction);
      });
    };
  }, [isArmed]);

  const setIsMuted = useCallback((muted: boolean) => {
    setIsMutedState(muted);
    setHasUserPreference(true);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clampedVol = Math.max(0, Math.min(1, vol));
    setVolumeState(clampedVol);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMutedState(prev => !prev);
    setHasUserPreference(true);
    setIsArmed(true); // Toggle implies interaction
  }, []);

  /**
   * Call when user explicitly interacts with audio controls.
   * Arms the audio system for unmuted autoplay.
   */
  const armAudio = useCallback(() => {
    setIsArmed(true);
  }, []);

  /**
   * Sync state when browser forces a different mute state.
   * Only updates if user hasn't explicitly set a preference.
   */
  const syncFromVideo = useCallback((actualMuted: boolean) => {
    if (!hasUserPreference && actualMuted !== isMuted) {
      setIsMutedState(actualMuted);
    }
  }, [hasUserPreference, isMuted]);

  return (
    <AudioContext.Provider
      value={{
        isMuted,
        volume,
        hasUserPreference,
        isArmed,
        setIsMuted,
        setVolume,
        toggleMute,
        armAudio,
        syncFromVideo,
      }}
    >
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
