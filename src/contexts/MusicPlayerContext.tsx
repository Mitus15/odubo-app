'use client';

import React, { createContext, useContext, useReducer, useRef, useEffect, useState, ReactNode } from 'react';
import { Track, Album } from '@/types/music';
import { 
  fetchTrackStreamInfo, 
  testAudioStream, 
  playAudioWithRetry,
  canPlayAudioFormat 
} from '@/lib/audioStreaming';

// Types for the music player context
export interface PlayerState {
  // Current playback
  currentTrack: Track | null;
  currentAlbum: Album | null;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  
  // Audio properties
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  
  // Queue and playback modes
  queue: Track[];
  originalQueue: Track[];
  currentIndex: number;
  isShuffled: boolean;
  repeatMode: 'none' | 'one' | 'all';
  // When shuffle + Repeat All are active, reshuffle the order at loop end
  reshuffleOnLoopEnd: boolean;
  // Shuffle management
  shuffledOrder: number[]; // indices referencing originalQueue
  shuffledPointer: number; // current position within shuffledOrder
  
  // Auto-play and library modes
  autoPlay: boolean;
  isLibraryShuffleMode: boolean;
  libraryTracks: Track[];
  
  // UI state
  isPlayerVisible: boolean;
  isQueueVisible: boolean;
  
  // Error handling
  error: string | null;
}

export type PlayerAction =
  | { type: 'PLAY_TRACK'; payload: { track: Track; album?: Album; queue?: Track[]; index?: number } }
  | { type: 'PLAY_ALBUM'; payload: { album: Album; tracks: Track[]; startIndex?: number } }
  | { type: 'PLAY_PAUSE' }
  | { type: 'STOP' }
  | { type: 'NEXT_TRACK' }
  | { type: 'PREVIOUS_TRACK' }
  | { type: 'SEEK'; payload: number }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'TOGGLE_SHUFFLE' }
  | { type: 'SET_REPEAT_MODE'; payload: 'none' | 'one' | 'all' }
  | { type: 'UPDATE_TIME'; payload: { currentTime: number; duration: number } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'TOGGLE_PLAYER_VISIBILITY' }
  | { type: 'TOGGLE_QUEUE_VISIBILITY' }
  | { type: 'ADD_TO_QUEUE'; payload: Track[] }
  | { type: 'REMOVE_FROM_QUEUE'; payload: number }
  | { type: 'REORDER_QUEUE'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'CLEAR_QUEUE' }
  | { type: 'PLAY_FROM_QUEUE'; payload: number }
  | { type: 'SET_AUTO_PLAY'; payload: boolean }
  | { type: 'SET_LIBRARY_TRACKS'; payload: Track[] }
  | { type: 'ENTER_LIBRARY_SHUFFLE_MODE' }
  | { type: 'EXIT_LIBRARY_SHUFFLE_MODE' }
  | { type: 'TOGGLE_RESHUFFLE_ON_LOOP_END' };

const initialState: PlayerState = {
  currentTrack: null,
  currentAlbum: null,
  isPlaying: false,
  isPaused: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  queue: [],
  originalQueue: [],
  currentIndex: -1,
  isShuffled: false,
  repeatMode: 'none',
  reshuffleOnLoopEnd: true,
  shuffledOrder: [],
  shuffledPointer: -1,
  autoPlay: true, // Enable autoplay by default
  isLibraryShuffleMode: false,
  libraryTracks: [],
  isPlayerVisible: false,
  isQueueVisible: false,
  error: null,
};

// Utility function to shuffle array
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const playerReducer = (state: PlayerState, action: PlayerAction): PlayerState => {
  switch (action.type) {
    case 'PLAY_TRACK': {
      const { track, album, queue, index } = action.payload;
      const newQueue = queue || [track];
      const trackIndex = index !== undefined ? index : newQueue.findIndex(t => t.id === track.id);
      // When playing a specific track, regenerate shuffledOrder relative to original order if shuffled
      let shuffledOrder = state.shuffledOrder;
      let shuffledPointer = state.shuffledPointer;
      if (state.isShuffled) {
        const baseOrder = newQueue.map((_, i) => i).filter(i => i !== trackIndex);
        for (let i = baseOrder.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [baseOrder[i], baseOrder[j]] = [baseOrder[j], baseOrder[i]];
        }
        shuffledOrder = [trackIndex, ...baseOrder];
        shuffledPointer = 0;
      }
      
      return {
        ...state,
        currentTrack: track,
        currentAlbum: album || state.currentAlbum,
        queue: newQueue,
        originalQueue: state.isShuffled ? state.originalQueue : newQueue,
        currentIndex: trackIndex,
        isPlaying: true,
        isPaused: false,
        isLoading: true,
        isPlayerVisible: true,
        isLibraryShuffleMode: false, // Exit library mode when playing specific track
        error: null,
        shuffledOrder,
        shuffledPointer,
      };
    }
    
    case 'PLAY_ALBUM': {
      const { album, tracks, startIndex = 0 } = action.payload;
      const currentTrack = tracks[startIndex];
      
      return {
        ...state,
        currentTrack,
        currentAlbum: album,
        queue: tracks,
        originalQueue: tracks,
        currentIndex: startIndex,
        isPlaying: true,
        isPaused: false,
        isLoading: true,
        isPlayerVisible: true,
        isLibraryShuffleMode: false, // Exit library mode when playing album
        error: null,
      };
    }
    
    case 'PLAY_PAUSE': {
      if (!state.currentTrack) return state;
      
      return {
        ...state,
        isPlaying: !state.isPlaying,
        isPaused: state.isPlaying,
      };
    }
    
    case 'STOP': {
      return {
        ...state,
        isPlaying: false,
        isPaused: true,
        currentTime: 0,
      };
    }
    
    case 'NEXT_TRACK': {
      if (state.queue.length === 0) return state;
      // Handle shuffled order
      if (state.isShuffled && state.shuffledOrder.length > 0) {
        let pointer = state.shuffledPointer + 1;
        if (pointer >= state.shuffledOrder.length) {
          if (state.repeatMode === 'all') {
            // If reshuffleOnLoopEnd enabled, rebuild physical queue keeping current track then reshuffling remainder
            if (state.reshuffleOnLoopEnd) {
              const currentIdx = state.currentIndex;
              const currentTrack = state.queue[currentIdx];
              const remainderOriginal = state.originalQueue.filter(t => t.id !== currentTrack?.id);
              const reshuffledRemainder = shuffleArray(remainderOriginal);
              const newQueue = currentTrack ? [currentTrack, ...reshuffledRemainder] : reshuffledRemainder;
              return {
                ...state,
                queue: newQueue,
                currentTrack,
                currentIndex: 0,
                shuffledOrder: newQueue.map((_, i) => i),
                shuffledPointer: 0,
                isLoading: true,
                currentTime: 0,
              };
            } else {
              // Legacy behavior: reshuffle order indices only
              const currentIdx = state.currentIndex;
              const base = state.originalQueue.map((_, i) => i).filter(i => i !== currentIdx);
              for (let i = base.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [base[i], base[j]] = [base[j], base[i]];
              }
              pointer = 0;
              const newOrder = [currentIdx, ...base];
              return {
                ...state,
                shuffledOrder: newOrder,
                shuffledPointer: 0,
                currentTrack: state.queue[currentIdx],
                currentIndex: currentIdx,
                isLoading: true,
                currentTime: 0,
              };
            }
          } else {
            // End reached
            if (state.autoPlay && state.libraryTracks.length > 0) {
              const availableLibraryTracks = state.libraryTracks.filter(
                track => track.audio_url && track.id !== state.currentTrack?.id
              );
              if (availableLibraryTracks.length > 0) {
                const randomTrack = availableLibraryTracks[Math.floor(Math.random() * availableLibraryTracks.length)];
                return {
                  ...state,
                  currentTrack: randomTrack,
                  currentAlbum: null,
                  queue: [randomTrack],
                  currentIndex: 0,
                  isLibraryShuffleMode: true,
                  isLoading: true,
                  currentTime: 0,
                };
              }
            }
            return { ...state, isPlaying: false, isPaused: true };
          }
        }
        const nextIndex = state.shuffledOrder[pointer];
        const nextTrack = state.queue[nextIndex];
        if (!nextTrack) return state;
        return {
          ...state,
          currentTrack: nextTrack,
          currentIndex: nextIndex,
          shuffledPointer: pointer,
          isLoading: true,
          currentTime: 0,
          isLibraryShuffleMode: false,
          isPlaying: true,
          isPaused: false,
          error: null,
        };
      }

      let nextIndex = state.currentIndex + 1;
      if (state.repeatMode === 'all' && nextIndex >= state.queue.length) nextIndex = 0;
      if (nextIndex >= state.queue.length) {
        if (state.autoPlay && state.libraryTracks.length > 0) {
          const availableLibraryTracks = state.libraryTracks.filter(
            track => track.audio_url && track.id !== state.currentTrack?.id
          );
          if (availableLibraryTracks.length > 0) {
            const randomTrack = availableLibraryTracks[Math.floor(Math.random() * availableLibraryTracks.length)];
            return {
              ...state,
              currentTrack: randomTrack,
              currentAlbum: null,
              queue: [randomTrack],
              currentIndex: 0,
              isLibraryShuffleMode: true,
              isLoading: true,
              currentTime: 0,
            };
          }
        }
        return { ...state, isPlaying: false, isPaused: true };
      }
      const nextTrack = state.queue[nextIndex];
      if (!nextTrack) return state;
      return {
        ...state,
        currentTrack: nextTrack,
        currentIndex: nextIndex,
        isLoading: true,
        currentTime: 0,
        isLibraryShuffleMode: false,
        isPlaying: true,
        isPaused: false,
        error: null,
      };
    }
    
    case 'PREVIOUS_TRACK': {
      if (state.queue.length === 0) return state;
      
      // If we're more than 3 seconds into the song, restart current track
      if (state.currentTime > 3) {
        return {
          ...state,
          currentTime: 0,
          isLoading: true,
        };
      }
      if (state.isShuffled && state.shuffledOrder.length > 0) {
        let pointer = state.shuffledPointer - 1;
        if (pointer < 0) {
          if (state.repeatMode === 'all') {
            pointer = state.shuffledOrder.length - 1;
          } else {
            return state;
          }
        }
        const prevIndex = state.shuffledOrder[pointer];
        const prevTrack = state.queue[prevIndex];
        if (!prevTrack) return state;
        return {
          ...state,
          currentTrack: prevTrack,
          currentIndex: prevIndex,
          shuffledPointer: pointer,
          isLoading: true,
          currentTime: 0,
          isPlaying: true,
          isPaused: false,
          error: null,
        };
      }
      let prevIndex = state.currentIndex - 1;
      if (prevIndex < 0) {
        if (state.repeatMode === 'all') prevIndex = state.queue.length - 1; else return state;
      }
      const prevTrack = state.queue[prevIndex];
      if (!prevTrack) return state;
      return {
        ...state,
        currentTrack: prevTrack,
        currentIndex: prevIndex,
        isLoading: true,
        currentTime: 0,
        isPlaying: true,
        isPaused: false,
        error: null,
      };
    }
    
    case 'SEEK': {
      return {
        ...state,
        currentTime: action.payload,
      };
    }
    
    case 'SET_VOLUME': {
      return {
        ...state,
        volume: action.payload,
        isMuted: action.payload === 0,
      };
    }
    
    case 'TOGGLE_MUTE': {
      return {
        ...state,
        isMuted: !state.isMuted,
      };
    }
    
    case 'TOGGLE_SHUFFLE': {
      const newShuffled = !state.isShuffled;

      // Ensure we have an originalQueue snapshot to restore later
      const baseOriginal = state.originalQueue.length > 0 ? state.originalQueue : state.queue;

      if (newShuffled) {
        // Shuffle the queue (excluding current track) and rebuild queue with current track at front
        const currentIdx = state.currentIndex >= 0 ? state.currentIndex : 0;
        const currentTrack = state.queue[currentIdx] || state.currentTrack;
        const remainder = state.queue.filter((_, i) => i !== currentIdx);
        const shuffledRemainder = shuffleArray(remainder);
        const newQueue = currentTrack ? [currentTrack, ...shuffledRemainder] : shuffledRemainder;

        return {
          ...state,
          isShuffled: true,
          queue: newQueue,
          originalQueue: baseOriginal, // preserve original order for restoration
          currentIndex: 0, // current track now at position 0
          shuffledOrder: newQueue.map((_, i) => i), // trivial order (already shuffled physically)
          shuffledPointer: 0,
        };
      } else {
        // Restore original queue order while keeping currentTrack index aligned
        const currentTrack = state.currentTrack;
        const restoredQueue = baseOriginal;
        const restoredIndex = currentTrack ? restoredQueue.findIndex(t => t.id === currentTrack.id) : 0;
        return {
            ...state,
            isShuffled: false,
            queue: restoredQueue,
            currentIndex: restoredIndex >= 0 ? restoredIndex : 0,
            shuffledOrder: [],
            shuffledPointer: -1,
        };
      }
    }
    case 'TOGGLE_RESHUFFLE_ON_LOOP_END': {
      return {
        ...state,
        reshuffleOnLoopEnd: !state.reshuffleOnLoopEnd,
      };
    }
    
    case 'SET_REPEAT_MODE': {
      return {
        ...state,
        repeatMode: action.payload,
      };
    }
    
    case 'UPDATE_TIME': {
      return {
        ...state,
        currentTime: action.payload.currentTime,
        duration: action.payload.duration,
        isLoading: false,
      };
    }
    
    case 'SET_LOADING': {
      return {
        ...state,
        isLoading: action.payload,
      };
    }
    
    case 'SET_ERROR': {
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isPlaying: action.payload ? false : state.isPlaying,
      };
    }
    
    case 'TOGGLE_PLAYER_VISIBILITY': {
      return {
        ...state,
        isPlayerVisible: !state.isPlayerVisible,
      };
    }
    
    case 'TOGGLE_QUEUE_VISIBILITY': {
      return {
        ...state,
        isQueueVisible: !state.isQueueVisible,
      };
    }
    
    case 'ADD_TO_QUEUE': {
      // Always update originalQueue as the canonical unshuffled order (dedup by id at append time)
      const appended = action.payload.filter(t => !state.originalQueue.some(o => o.id === t.id));
      const newOriginal = [...state.originalQueue, ...appended];
      return {
        ...state,
        queue: [...state.queue, ...appended],
        originalQueue: newOriginal,
      };
    }
    
    case 'REMOVE_FROM_QUEUE': {
      const indexToRemove = action.payload;
      const newQueue = state.queue.filter((_, index) => index !== indexToRemove);
      const removedTrack = state.queue[indexToRemove];
      // Remove by id (so unshuffling won't resurrect it later)
      const newOriginalQueue = removedTrack
        ? state.originalQueue.filter(t => t.id !== removedTrack.id)
        : state.originalQueue;
      
      // Adjust current index if necessary
      let newCurrentIndex = state.currentIndex;
      if (indexToRemove < state.currentIndex) {
        newCurrentIndex = state.currentIndex - 1;
      } else if (indexToRemove === state.currentIndex) {
        // If we're removing the current track, stop playback
        return {
          ...state,
          queue: newQueue,
          currentTrack: null,
          isPlaying: false,
          isPaused: true,
          currentIndex: -1,
        };
      }
      
      return {
        ...state,
        queue: newQueue,
        originalQueue: newOriginalQueue,
        currentIndex: newCurrentIndex,
      };
    }
    
    case 'REORDER_QUEUE': {
      const { fromIndex, toIndex } = action.payload;
      const newQueue = [...state.queue];
      const [movedTrack] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, movedTrack);
      
      // Adjust current index
      let newCurrentIndex = state.currentIndex;
      if (fromIndex === state.currentIndex) {
        newCurrentIndex = toIndex;
      } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
        newCurrentIndex = state.currentIndex - 1;
      } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
        newCurrentIndex = state.currentIndex + 1;
      }

      // Keep originalQueue in sync to avoid shuffle mismatch after manual reorder.
      const newOriginalQueue = state.originalQueue.length === state.queue.length
        ? (() => {
            const clone = [...state.originalQueue];
            // Map track ids to original positions; reorder by newQueue order.
            return newQueue.map(t => clone.find(ct => ct.id === t.id) || t);
          })()
        : state.originalQueue;

      return {
        ...state,
        queue: newQueue,
        originalQueue: newOriginalQueue,
        currentIndex: newCurrentIndex,
      };
    }
    
    case 'CLEAR_QUEUE': {
      return {
        ...state,
        queue: [],
        originalQueue: [],
        currentTrack: null,
        currentIndex: -1,
        isPlaying: false,
        isPaused: true,
      };
    }
    
    case 'PLAY_FROM_QUEUE': {
      const trackIndex = action.payload;
      const track = state.queue[trackIndex];
      
      if (!track) return state;
      
      return {
        ...state,
        currentTrack: track,
        currentIndex: trackIndex,
        isPlaying: true,
        isPaused: false,
        isLoading: true,
        currentTime: 0,
        isLibraryShuffleMode: false, // Exit library mode when playing from queue
      };
    }
    
    case 'SET_AUTO_PLAY': {
      return {
        ...state,
        autoPlay: action.payload,
      };
    }
    
    case 'SET_LIBRARY_TRACKS': {
      return {
        ...state,
        libraryTracks: action.payload,
      };
    }
    
    case 'ENTER_LIBRARY_SHUFFLE_MODE': {
      if (state.libraryTracks.length === 0) return state;
      
      const availableLibraryTracks = state.libraryTracks.filter(
        track => track.audio_url && track.id !== state.currentTrack?.id
      );
      
      if (availableLibraryTracks.length === 0) return state;
      
      const randomTrack = availableLibraryTracks[Math.floor(Math.random() * availableLibraryTracks.length)];
      
      return {
        ...state,
        currentTrack: randomTrack,
        currentAlbum: null,
        queue: [randomTrack],
        currentIndex: 0,
        isLibraryShuffleMode: true,
        isPlaying: true,
        isLoading: true,
        currentTime: 0,
      };
    }
    
    case 'EXIT_LIBRARY_SHUFFLE_MODE': {
      return {
        ...state,
        isLibraryShuffleMode: false,
      };
    }
    
    default:
      return state;
  }
};

interface MusicPlayerContextType {
  state: PlayerState;
  dispatch: React.Dispatch<PlayerAction>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  
  // Convenience methods
  playTrack: (track: Track, album?: Album, queue?: Track[], index?: number) => void;
  playAlbum: (album: Album, tracks: Track[], startIndex?: number) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  toggleReshuffleOnLoopEnd: () => void;
  addToQueue: (tracks: Track[]) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  playFromQueue: (index: number) => void;
  clearQueue: () => void;
  
  // Auto-play and library methods
  setAutoPlay: (enabled: boolean) => void;
  loadLibraryTracks: () => Promise<void>;
  enterLibraryShuffleMode: () => void;
  exitLibraryShuffleMode: () => void;
  
  // Utility methods
  testAudioUrl: (url: string) => Promise<boolean>;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null);

export const useMusicPlayer = () => {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
  }
  return context;
};

interface MusicPlayerProviderProps {
  children: ReactNode;
}

export const MusicPlayerProvider: React.FC<MusicPlayerProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<any>(null);
  const advancingRef = useRef(false);
  const playRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playRetryCountRef = useRef(0);



  // Global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection in MusicPlayer:', event.reason);
      event.preventDefault(); // Prevent page reload
      dispatch({ type: 'SET_ERROR', payload: 'An unexpected error occurred' });
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  const [userInteracted, setUserInteracted] = useState(false);

  // Enable audio playback on first user interaction
  useEffect(() => {
    const enableAudio = () => {
      if (!userInteracted) {
        setUserInteracted(true);
        console.log('User interaction detected, audio playback enabled');
      }
    };

    // Listen for any user interaction
    document.addEventListener('click', enableAudio);
    document.addEventListener('touchstart', enableAudio);
    document.addEventListener('keydown', enableAudio);

    return () => {
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
      document.removeEventListener('keydown', enableAudio);
    };
  }, [userInteracted]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      dispatch({
        type: 'UPDATE_TIME',
        payload: {
          currentTime: audio.currentTime,
          duration: audio.duration || 0,
        },
      });
    };

    const handleEnded = () => {
      // Repeat one: restart current track immediately
      if (state.repeatMode === 'one' && state.currentTrack) {
        audio.currentTime = 0;
        // Force play again (will trigger play listener)
        const p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(err => console.warn('Repeat-one replay blocked:', err));
        }
        return;
      }

      // In library shuffle mode, get another random track
      if (state.isLibraryShuffleMode && state.autoPlay && state.libraryTracks.length > 0) {
        const availableLibraryTracks = state.libraryTracks.filter(
          track => track.audio_url && track.id !== state.currentTrack?.id
        );
        
        if (availableLibraryTracks.length > 0) {
          const randomTrack = availableLibraryTracks[Math.floor(Math.random() * availableLibraryTracks.length)];
          // mark advancing so pause handlers ignore transient pauses
          advancingRef.current = true;
          try { audio.pause(); } catch {}
          try { audio.currentTime = 0; } catch {}
          try { audio.src = ''; } catch {}
          dispatch({ 
            type: 'PLAY_TRACK', 
            payload: { 
              track: randomTrack, 
              queue: [randomTrack], 
              index: 0 
            } 
          });
          return;
        }
      }
      
      // Normal next track behavior - mark advancing to avoid pause race
      advancingRef.current = true;
      try { audio.pause(); } catch {}
      try { audio.currentTime = 0; } catch {}
      try { audio.src = ''; } catch {}
      dispatch({ type: 'NEXT_TRACK' });
    };

    const handlePlay = () => {
      // Clear advancing flag when playback begins
      advancingRef.current = false;
      dispatch({ type: 'SET_LOADING', payload: false });
    };

    const handlePlaying = () => {
      // When media is actually rendering frames, ensure loading is cleared
      advancingRef.current = false;
      dispatch({ type: 'SET_LOADING', payload: false });
    };

    const handlePause = () => {
      // If we are advancing to next track, don't toggle play state
      if (advancingRef.current) return;
      // If audio element paused but state still says playing, flip state
      if (state.isPlaying) {
        dispatch({ type: 'PLAY_PAUSE' });
      }
    };

    const handleLoadStart = () => {
      dispatch({ type: 'SET_LOADING', payload: true });
    };

    const handleCanPlay = async () => {
      // Clear advancing flag when new audio can play
      advancingRef.current = false;
      dispatch({ type: 'SET_LOADING', payload: false });
      // If user intended to play, ensure we kick playback now
      try {
        if (state.isPlaying && audio.paused) {
          // prefer to play now that we can
          await playAudioWithRetry(audio);
        }
      } catch (err) {
        console.warn('Error attempting play on canplay:', err);
      }
    };

    const handleLoadedMetadata = async () => {
      // Update duration as soon as it's known
      dispatch({
        type: 'UPDATE_TIME',
        payload: { currentTime: audio.currentTime, duration: audio.duration || 0 },
      });
      // Some browsers fire loadedmetadata before canplay and require an explicit play()
      try {
        if (state.isPlaying && audio.paused) {
          await playAudioWithRetry(audio);
        }
      } catch (err) {
        console.warn('Error attempting play on loadedmetadata:', err);
      }
    };

    const handleWaiting = () => {
      // Buffering started or stalled
      dispatch({ type: 'SET_LOADING', payload: true });
    };

    const handleError = () => {
      const error = audio.error;
      let errorMessage = 'Failed to load audio';
      
      if (error) {
        switch (error.code) {
          case error.MEDIA_ERR_ABORTED:
            errorMessage = 'Audio loading aborted';
            break;
          case error.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading audio';
            break;
          case error.MEDIA_ERR_DECODE:
            errorMessage = 'Audio format not supported';
            break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Audio source not supported';
            break;
        }
      }
      
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
    };
  }, [state.isPlaying, state.isLibraryShuffleMode, state.autoPlay, state.libraryTracks, state.currentTrack?.id]);

  // Update audio element when track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !state.currentTrack?.id) return;

    // Enhanced play function using utilities
    const attemptPlay = async () => {
      try {
        const playSuccess = await playAudioWithRetry(audio);
        if (playSuccess) {
          console.log('Audio playback started successfully');
          dispatch({ type: 'SET_ERROR', payload: null }); // Clear any previous errors
        } else {
          dispatch({ type: 'SET_ERROR', payload: 'Failed to start audio playback' });
        }
      } catch (error: any) {
        console.error('Audio play error:', error);
        
        let errorMessage = 'Failed to play audio';
        
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Audio playback blocked by browser. Please interact with the page first.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Audio format not supported by browser';
        } else if (error.name === 'AbortError') {
          errorMessage = 'Audio playback was aborted';
        }
        
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
      }
    };

    const handleLoadError = (event: Event) => {
      const currentSrc = (audio as any).currentSrc || audio.src;
      console.error('Failed to load audio source:', currentSrc);
      console.error('Original audio_url:', state.currentTrack?.audio_url);
      console.error('Audio element error event:', event);
      console.error('Audio element error:', audio.error);
      if (audio.error) {
        console.error('Audio error code:', audio.error.code);
        console.error('Audio error message:', audio.error.message);
      }
      // Fallbacks are handled below in strategy switchers; if we reach here without a switch, set an error
      dispatch({ type: 'SET_ERROR', payload: 'Audio stream could not be loaded' });
    };

    const handleCanPlay = async () => {
      try {
        console.log('Audio can play:', state.currentTrack?.title);
        dispatch({ type: 'SET_LOADING', payload: false });
        
        // Auto-play if the player is in playing state
        if (state.isPlaying && audio.paused) {
          await attemptPlay();
        }
      } catch (error) {
        console.error('Error in handleCanPlay:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Error during audio setup' });
      }
    };

    // Only load new audio if the track actually changed (not just play/pause)
    const expectedSrc = `/api/tracks/${state.currentTrack.id}/stream`;
    const needsNewAudio = !audio.src || !audio.src.includes(`/api/tracks/${state.currentTrack.id}/stream`);
    
    if (needsNewAudio) {
      console.log('Loading new audio track:', state.currentTrack.title, 'Expected:', expectedSrc);
      
      // Enhanced audio loading with robust error handling
      const loadAudio = async () => {
        if (!state.currentTrack?.id) {
          console.error('Missing track ID for audio loading:', state.currentTrack);
          dispatch({ type: 'SET_ERROR', payload: 'Track ID is missing' });
          return;
        }
        
        const trackId = state.currentTrack.id;
        console.log(`Loading audio for track: ${state.currentTrack.title} (ID: ${trackId})`);
        
        dispatch({ type: 'SET_LOADING', payload: true });
        
        try {
          // Fetch fresh track stream info
          console.log('Fetching stream info for track:', trackId);
          const streamInfo = await fetchTrackStreamInfo(trackId);
          if (!streamInfo) {
            console.error('No stream info returned for track:', trackId);
            dispatch({ type: 'SET_ERROR', payload: 'Failed to get track information' });
            return;
          }
          
          console.log('Track stream info received:', streamInfo);
          
          // If status is not ready, continue but warn – rely on actual stream accessibility
          if (streamInfo.audio_status !== 'ready') {
            console.warn(`Audio status is ${streamInfo.audio_status}, proceeding to test stream accessibility`);
          }

          // Test stream accessibility
          console.log('Testing stream accessibility:', streamInfo.streamUrl);
          const isAccessible = await testAudioStream(streamInfo.streamUrl);
          console.log('Stream accessibility result:', isAccessible);
          if (!isAccessible) {
            console.error('Stream not accessible:', streamInfo.streamUrl);
            const statusMsg = streamInfo.audio_status && streamInfo.audio_status !== 'ready' 
              ? ` (status: ${streamInfo.audio_status})` 
              : '';
            dispatch({ type: 'SET_ERROR', payload: `Audio stream is not accessible${statusMsg}` });
            return;
          }
          
          // Check format support
          if (!canPlayAudioFormat(streamInfo.audio_url)) {
            dispatch({ type: 'SET_ERROR', payload: 'Audio format not supported by browser' });
            return;
          }
          
          // Clean up previous event listeners
          audio.removeEventListener('error', handleLoadError);
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('loadstart', handleLoadStart);
          audio.removeEventListener('progress', handleProgress);
          
          // Set up audio element for streaming
          audio.crossOrigin = 'anonymous';
          audio.preload = 'metadata';

          // Loading strategies and fallback sequencing
          const hlsUrl = streamInfo.hlsUrl;
          let usedStrategy: 'none' | 'hlsjs' | 'native' | 'progressive' = 'none';

          const detachAudioListeners = () => {
            audio.removeEventListener('error', handleLoadError);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('loadstart', handleLoadStart);
            audio.removeEventListener('progress', handleProgress);
          };

          const tryProgressive = () => {
            usedStrategy = 'progressive';
            detachAudioListeners();
            audio.src = streamInfo.streamUrl;
            audio.addEventListener('error', handleLoadError);
            audio.addEventListener('canplay', handleCanPlay);
            audio.addEventListener('loadstart', handleLoadStart);
            audio.addEventListener('progress', handleProgress);
            console.log(`Loading audio progressively: ${streamInfo.streamUrl}`);
            audio.load();
          };

          const tryNativeHls = () => {
            if (!hlsUrl) { tryProgressive(); return; }
            usedStrategy = 'native';
            detachAudioListeners();
            audio.src = hlsUrl;
            audio.addEventListener('error', async (evt) => {
              // If native failed, attempt hls.js if available, else progressive
              console.warn('Native HLS error, attempting hls.js or progressive');
              detachAudioListeners();
              try {
                const HlsModule = await import('hls.js');
                const Hls = HlsModule.default as any;
                if (Hls && Hls.isSupported()) {
                  tryHlsJs();
                  return;
                }
              } catch {}
              tryProgressive();
              // still pass through to general handler for logging
              handleLoadError(evt);
            }, { once: true });
            audio.addEventListener('canplay', handleCanPlay);
            audio.addEventListener('loadstart', handleLoadStart);
            audio.addEventListener('progress', handleProgress);
            console.log(`Loading audio via native HLS: ${hlsUrl}`);
            audio.load();
          };

          const tryHlsJs = async () => {
            if (!hlsUrl) { tryProgressive(); return; }
            usedStrategy = 'hlsjs';
            detachAudioListeners();
            try {
              const HlsModule = await import('hls.js');
              const Hls: any = HlsModule.default;
              if (Hls && Hls.isSupported()) {
                if (hlsRef.current) {
                  try { hlsRef.current.destroy(); } catch {}
                  hlsRef.current = null;
                }
                const hls = new Hls({ enableWorker: true, backBufferLength: 30 });
                hlsRef.current = hls;
                hls.on(Hls.Events.ERROR, (_evt: any, data: any) => {
                  console.warn('HLS.js error:', data);
                  if (data?.fatal) {
                    try { hls.destroy(); } catch {}
                    hlsRef.current = null;
                    // fall back to progressive if fatal
                    tryProgressive();
                  }
                });
                hls.loadSource(hlsUrl);
                hls.attachMedia(audio);

                // Attach listeners on the audio element as well
                audio.addEventListener('error', handleLoadError);
                audio.addEventListener('canplay', handleCanPlay);
                audio.addEventListener('loadstart', handleLoadStart);
                audio.addEventListener('progress', handleProgress);
                console.log(`Loading audio via hls.js: ${hlsUrl}`);
              } else {
                tryNativeHls();
              }
            } catch (e) {
              console.warn('Failed to initialize hls.js, trying native/progressive', e);
              tryNativeHls();
            }
          };

          // Prefer hls.js when supported; otherwise try native (Safari), else progressive
          if (hlsUrl) {
            try {
              const HlsModule = await import('hls.js');
              const Hls = HlsModule.default as any;
              if (Hls && Hls.isSupported()) {
                await tryHlsJs();
              } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
                tryNativeHls();
              } else {
                tryProgressive();
              }
            } catch {
              // If import fails (e.g., network), try native then progressive
              if (audio.canPlayType('application/vnd.apple.mpegurl')) {
                tryNativeHls();
              } else {
                tryProgressive();
              }
            }
          } else {
            tryProgressive();
          }
          
          // Auto-play will be handled by the canplay event if needed
          
        } catch (error) {
          console.error('Audio loading error:', error);
          dispatch({ type: 'SET_ERROR', payload: 'Audio loading failed' });
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      };
      
      // Additional event handlers
      const handleLoadStart = () => {
        console.log('Audio loading started for:', state.currentTrack?.title);
        dispatch({ type: 'SET_LOADING', payload: true });
      };
      
      const handleProgress = () => {
        if (audio.buffered.length > 0) {
          const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
          const duration = audio.duration || 0;
          const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
          console.log(`Audio buffered: ${bufferedPercent.toFixed(1)}% for ${state.currentTrack?.title}`);
        }
      };
      
      loadAudio();
      
      // Cleanup function
      return () => {
        audio.removeEventListener('error', handleLoadError);
        audio.removeEventListener('canplay', handleCanPlay);
        if (hlsRef.current) {
          try { hlsRef.current.destroy(); } catch {}
          hlsRef.current = null;
        }
      };
    }
  }, [state.currentTrack?.id]);

  // Handle play/pause state changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (state.isPlaying && !state.isLoading) {
      const attemptPlay = async () => {
        try {
          // Check if audio source is loaded
          if (audio.readyState < 2) {
            console.log('Audio not ready, waiting briefly before retrying play');
            // escalate preload to encourage buffering
            try { audio.preload = 'auto'; } catch {}
            // set a short retry if not already scheduled
            if (playRetryTimeoutRef.current) clearTimeout(playRetryTimeoutRef.current);
            if (playRetryCountRef.current < 3) {
              playRetryCountRef.current += 1;
              playRetryTimeoutRef.current = setTimeout(() => {
                // re-invoke play path if still intended to play
                if (audio.readyState >= 2 && state.isPlaying) {
                  audio.play().catch(err => console.warn('Deferred play failed:', err));
                }
              }, 800 * playRetryCountRef.current);
            }
            return;
          }
          

          
          await audio.play();
          console.log('Audio playback resumed successfully');
        } catch (error: any) {
          console.error('Error playing audio:', error);
          let errorMessage = 'Failed to play audio';
          
          if (error.name === 'NotAllowedError') {
            errorMessage = 'Audio playback blocked. Click to enable sound.';
          } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Audio format not supported';
          } else if (error.name === 'AbortError') {
            errorMessage = 'Audio playback aborted';
          }
          
          dispatch({ type: 'SET_ERROR', payload: errorMessage });
          dispatch({ type: 'PLAY_PAUSE' }); // Stop playback
        }
      };
      
      attemptPlay();
    } else if (!state.isPlaying && !audio.paused) {
      audio.pause();
    }

    return () => {
      // clear any pending retry when deps change
      if (playRetryTimeoutRef.current) {
        clearTimeout(playRetryTimeoutRef.current);
        playRetryTimeoutRef.current = null;
      }
      playRetryCountRef.current = 0;
    };
  }, [state.isPlaying, state.isLoading]);

  // Handle volume changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = state.isMuted ? 0 : state.volume;
  }, [state.volume, state.isMuted]);

  // Handle seek changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Only seek if the difference is significant (more than 1 second)
    if (Math.abs(audio.currentTime - state.currentTime) > 1) {
      audio.currentTime = state.currentTime;
    }
  }, [state.currentTime]);

  // Convenience methods
  const playTrack = (track: Track, album?: Album, queue?: Track[], index?: number) => {
    const audio = audioRef.current;
    if (audio) {
      advancingRef.current = true;
      try { audio.pause(); } catch {}
      try { audio.currentTime = 0; } catch {}
      try { audio.src = ''; } catch {}
    }
    dispatch({ type: 'PLAY_TRACK', payload: { track, album, queue, index } });
  };

  const playAlbum = (album: Album, tracks: Track[], startIndex?: number) => {
    const audio = audioRef.current;
    if (audio) {
      advancingRef.current = true;
      try { audio.pause(); } catch {}
      try { audio.currentTime = 0; } catch {}
      try { audio.src = ''; } catch {}
    }
    dispatch({ type: 'PLAY_ALBUM', payload: { album, tracks, startIndex } });
  };

  const togglePlayPause = () => {
    dispatch({ type: 'PLAY_PAUSE' });
  };

  const nextTrack = () => {
    const audio = audioRef.current;
    if (audio) {
      advancingRef.current = true;
      try { audio.pause(); } catch {}
      try { audio.currentTime = 0; } catch {}
      try { audio.src = ''; } catch {}
    }
    dispatch({ type: 'NEXT_TRACK' });
  };

  const previousTrack = () => {
    const audio = audioRef.current;
    if (audio) {
      advancingRef.current = true;
      try { audio.pause(); } catch {}
      try { audio.currentTime = 0; } catch {}
      try { audio.src = ''; } catch {}
    }
    dispatch({ type: 'PREVIOUS_TRACK' });
  };

  const seekTo = (time: number) => {
    dispatch({ type: 'SEEK', payload: time });
  };

  const setVolume = (volume: number) => {
    dispatch({ type: 'SET_VOLUME', payload: volume });
  };

  const toggleMute = () => {
    dispatch({ type: 'TOGGLE_MUTE' });
  };

  const toggleShuffle = () => {
    dispatch({ type: 'TOGGLE_SHUFFLE' });
  };

  const cycleRepeatMode = () => {
    const modes: Array<'none' | 'one' | 'all'> = ['none', 'one', 'all'];
    const currentIndex = modes.indexOf(state.repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    dispatch({ type: 'SET_REPEAT_MODE', payload: nextMode });
  };

  const toggleReshuffleOnLoopEnd = () => {
    dispatch({ type: 'TOGGLE_RESHUFFLE_ON_LOOP_END' });
  };

  const addToQueue = (tracks: Track[]) => {
    dispatch({ type: 'ADD_TO_QUEUE', payload: tracks });
  };

  const removeFromQueue = (index: number) => {
    dispatch({ type: 'REMOVE_FROM_QUEUE', payload: index });
  };

  const reorderQueue = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= state.queue.length || toIndex >= state.queue.length) return;
    dispatch({ type: 'REORDER_QUEUE', payload: { fromIndex, toIndex } });
  };

  const playFromQueue = (index: number) => {
    const audio = audioRef.current;
    if (audio) {
      advancingRef.current = true;
      try { audio.pause(); } catch {}
      try { audio.currentTime = 0; } catch {}
      try { audio.src = ''; } catch {}
    }
    dispatch({ type: 'PLAY_FROM_QUEUE', payload: index });
  };

  const clearQueue = () => {
    dispatch({ type: 'CLEAR_QUEUE' });
  };

  // Auto-play and library methods
  const setAutoPlay = (enabled: boolean) => {
    dispatch({ type: 'SET_AUTO_PLAY', payload: enabled });
  };

  const loadLibraryTracks = async () => {
    try {
      const response = await fetch('/api/tracks');
      
      if (response.ok) {
        const data = await response.json();
        
        // Ensure we have an array
        if (Array.isArray(data)) {
          // Only include tracks with audio_url
          const availableTracks = data.filter((track: Track) => track.audio_url);
          dispatch({ type: 'SET_LIBRARY_TRACKS', payload: availableTracks });
        }
      }
    } catch (error) {
      console.error('Failed to load library tracks:', error);
    }
  };

  const enterLibraryShuffleMode = () => {
    dispatch({ type: 'ENTER_LIBRARY_SHUFFLE_MODE' });
  };

  const exitLibraryShuffleMode = () => {
    dispatch({ type: 'EXIT_LIBRARY_SHUFFLE_MODE' });
  };

  // Test audio URL accessibility with enhanced checking
  const testAudioUrl = async (url: string): Promise<boolean> => {
    try {
      // For streaming URLs, test with HEAD request
      if (url.includes('/api/tracks/') && url.includes('/stream')) {
        const response = await fetch(url, { 
          method: 'HEAD',
          cache: 'no-cache'
        });
        console.log(`Stream URL test result for ${url}:`, response.status);
        return response.ok;
      }
      
      // For direct URLs, use the test API endpoint  
      const response = await fetch('/api/test-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        console.error('Test API response not ok:', response.status);
        return false;
      }
      
      const result = await response.json() as { accessible?: boolean };
      console.log('Audio URL test result:', result);
      
      return result.accessible === true;
    } catch (error) {
      console.error('Error testing audio URL:', error);
      return false;
    }
  };

  // Load library tracks on mount
  useEffect(() => {
    loadLibraryTracks();
  }, []);

  const contextValue: MusicPlayerContextType = {
    state,
    dispatch,
    audioRef,
    playTrack,
    playAlbum,
    togglePlayPause,
    nextTrack,
    previousTrack,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    toggleReshuffleOnLoopEnd,
    addToQueue,
    removeFromQueue,
  reorderQueue,
    playFromQueue,
    clearQueue,
    setAutoPlay,
    loadLibraryTracks,
    enterLibraryShuffleMode,
    exitLibraryShuffleMode,
    testAudioUrl,
  };

  return (
    <MusicPlayerContext.Provider value={contextValue}>
      {children}
      <audio 
        ref={audioRef} 
        preload="metadata" 
        crossOrigin="anonymous"
        playsInline
      />
    </MusicPlayerContext.Provider>
  );
};
