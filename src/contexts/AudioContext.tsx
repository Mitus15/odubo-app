"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';

/**
 * Unified Audio State Management with Media Priority
 *
 * Consolidates all audio state and implements media priority system:
 * - Single audio source at a time
 * - Music playing → clips muted but can browse
 * - User unmutes clips → music stops
 * - Video plays → everything else stops
 *
 * Storage key: odubo:audio
 */

type ActiveMediaSource = 'idle' | 'clips' | 'music' | 'video';

interface AudioState {
  isMuted: boolean;
  volume: number;
  hasUserPreference: boolean;  // User explicitly set mute/unmute
  isArmed: boolean;            // User has interacted, enabling unmuted autoplay
  activeMediaSource: ActiveMediaSource;
  isMusicPlaying: boolean;     // True when music player is active
}

// Callback types for cross-context coordination
type MusicPauseCallback = () => void;
type VideoStopCallback = () => void;

interface AudioContextType extends AudioState {
  setIsMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  armAudio: () => void;
  syncFromVideo: (actualMuted: boolean) => void;
  // Media priority methods
  setMusicPlaying: (playing: boolean) => void;
  setVideoPlaying: (playing: boolean) => void;
  registerMusicPauseCallback: (cb: MusicPauseCallback) => void;
  registerVideoStopCallback: (cb: VideoStopCallback) => void;
  requestClipAudio: () => boolean; // Returns true if clips can play unmuted
}

const STORAGE_KEY = 'odubo:audio';
const SESSION_KEY = 'odubo:audioArmed';

// In-memory flag to ensure THIS tab specifically has received a gesture
// (sessionStorage can be duplicated when opening new tabs)
let tabArmedInMemory = false;

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

  // In-memory flag takes precedence - ensures THIS tab had a gesture
  if (tabArmedInMemory) return true;

  try {
    // Check sessionStorage (for page refreshes within same tab)
    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
      // Note: Don't set tabArmedInMemory here - require fresh gesture after tab duplication
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

  // Always update in-memory flag first
  tabArmedInMemory = armed;

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

  // Media priority state
  const [activeMediaSource, setActiveMediaSource] = useState<ActiveMediaSource>('idle');
  const [isMusicPlaying, setIsMusicPlayingState] = useState<boolean>(false);

  // Callbacks for cross-context coordination
  const musicPauseCallbackRef = useRef<MusicPauseCallback | null>(null);
  const videoStopCallbackRef = useRef<VideoStopCallback | null>(null);

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
    const newMuted = !isMuted;

    // If unmuting clips while music is playing, pause music first
    if (!newMuted && isMusicPlaying && musicPauseCallbackRef.current) {
      musicPauseCallbackRef.current();
      setIsMusicPlayingState(false);
      setActiveMediaSource('clips');
    }

    // If unmuting clips while video is playing, stop video first
    if (!newMuted && activeMediaSource === 'video' && videoStopCallbackRef.current) {
      videoStopCallbackRef.current();
      setActiveMediaSource('clips');
    }

    setIsMutedState(newMuted);
    setHasUserPreference(true);
    setIsArmed(true); // Toggle implies interaction

    // Update active media source
    if (!newMuted) {
      setActiveMediaSource('clips');
    } else if (activeMediaSource === 'clips') {
      setActiveMediaSource('idle');
    }
  }, [isMuted, isMusicPlaying, activeMediaSource]);

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

  // ============================================================================
  // Media Priority Methods
  // ============================================================================

  /**
   * Called when music player starts/stops playing.
   * When music plays, clips should be muted.
   */
  const setMusicPlaying = useCallback((playing: boolean) => {
    setIsMusicPlayingState(playing);
    if (playing) {
      setActiveMediaSource('music');
      // Mute clips when music starts (but don't set user preference)
      setIsMutedState(true);
    } else if (activeMediaSource === 'music') {
      setActiveMediaSource('idle');
    }
  }, [activeMediaSource]);

  /**
   * Called when video player starts/stops playing.
   * When video plays, everything else stops.
   */
  const setVideoPlaying = useCallback((playing: boolean) => {
    if (playing) {
      setActiveMediaSource('video');
      // Pause music if playing
      if (isMusicPlaying && musicPauseCallbackRef.current) {
        musicPauseCallbackRef.current();
      }
      // Mute clips
      setIsMutedState(true);
    } else if (activeMediaSource === 'video') {
      setActiveMediaSource('idle');
    }
  }, [activeMediaSource, isMusicPlaying]);

  /**
   * Register callback to pause music (called from MusicPlayerContext).
   */
  const registerMusicPauseCallback = useCallback((cb: MusicPauseCallback) => {
    musicPauseCallbackRef.current = cb;
  }, []);

  /**
   * Register callback to stop video (called from video player).
   */
  const registerVideoStopCallback = useCallback((cb: VideoStopCallback) => {
    videoStopCallbackRef.current = cb;
  }, []);

  /**
   * Request to unmute clips. Returns true if allowed.
   * If music is playing, this will pause music first.
   */
  const requestClipAudio = useCallback((): boolean => {
    // If music is playing, pause it
    if (isMusicPlaying && musicPauseCallbackRef.current) {
      musicPauseCallbackRef.current();
      setIsMusicPlayingState(false);
    }
    // If video is playing, stop it
    if (activeMediaSource === 'video' && videoStopCallbackRef.current) {
      videoStopCallbackRef.current();
    }
    // Switch to clips
    setActiveMediaSource('clips');
    return true;
  }, [isMusicPlaying, activeMediaSource]);

  return (
    <AudioContext.Provider
      value={{
        isMuted,
        volume,
        hasUserPreference,
        isArmed,
        activeMediaSource,
        isMusicPlaying,
        setIsMuted,
        setVolume,
        toggleMute,
        armAudio,
        syncFromVideo,
        setMusicPlaying,
        setVideoPlaying,
        registerMusicPauseCallback,
        registerVideoStopCallback,
        requestClipAudio,
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
