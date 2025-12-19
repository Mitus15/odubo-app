'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// Types
export interface VideoCard {
  id: number;
  uid: string;
  title: string;
  poster_url: string | null;
  thumbnail: string | null;
  duration: string;
  duration_seconds: number;
}

export interface VideoDetail extends VideoCard {
  description: string | null;
  url: string;
  category: string | null;
}

export interface AlbumCard {
  id: string;
  title: string;
  artist_name: string;
  cover_art_url: string | null;
  release_type: string;
  track_count?: number;
}

type ModalType = 'hub' | 'video-player';
type MediaTab = 'videos' | 'music';

interface ModalState {
  type: ModalType;
  videoId?: number;
}

interface OmniMediaContextValue {
  // Modal stack
  modalStack: ModalState[];
  currentModal: ModalState | null;
  openHub: (tab?: MediaTab) => void;
  openVideoPlayer: (videoId: number) => void;
  goBack: () => void;
  closeAll: () => void;

  // Tab state
  activeTab: MediaTab;
  setActiveTab: (tab: MediaTab) => void;

  // Data cache
  videos: VideoCard[];
  setVideos: (videos: VideoCard[]) => void;
  albums: AlbumCard[];
  setAlbums: (albums: AlbumCard[]) => void;

  // Video detail cache
  videoCache: Map<number, VideoDetail>;
  cacheVideo: (id: number, video: VideoDetail) => void;
  getCachedVideo: (id: number) => VideoDetail | undefined;

  // Loading states
  isLoadingVideos: boolean;
  setIsLoadingVideos: (loading: boolean) => void;
  isLoadingAlbums: boolean;
  setIsLoadingAlbums: (loading: boolean) => void;
}

const OmniMediaContext = createContext<OmniMediaContextValue | null>(null);

export function OmniMediaProvider({ children }: { children: ReactNode }) {
  // Modal stack state
  const [modalStack, setModalStack] = useState<ModalState[]>([]);

  // Tab state
  const [activeTab, setActiveTabState] = useState<MediaTab>('music');

  // Data cache
  const [videos, setVideos] = useState<VideoCard[]>([]);
  const [albums, setAlbums] = useState<AlbumCard[]>([]);

  // Video detail cache
  const [videoCache, setVideoCache] = useState<Map<number, VideoDetail>>(new Map());

  // Loading states
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);

  // Modal actions
  const openHub = useCallback((tab?: MediaTab) => {
    if (tab) setActiveTabState(tab);
    setModalStack(prev => {
      // Don't duplicate if already on hub
      if (prev.length > 0 && prev[prev.length - 1].type === 'hub') {
        return prev;
      }
      // Replace stack with just hub (fresh entry)
      return [{ type: 'hub' }];
    });
  }, []);

  const openVideoPlayer = useCallback((videoId: number) => {
    setModalStack(prev => [...prev, { type: 'video-player', videoId }]);
  }, []);

  const goBack = useCallback(() => {
    setModalStack(prev => prev.slice(0, -1));
  }, []);

  const closeAll = useCallback(() => {
    setModalStack([]);
  }, []);

  const currentModal = modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;

  // Tab action with validation
  const setActiveTab = useCallback((tab: MediaTab) => {
    setActiveTabState(tab);
  }, []);

  // Video cache actions
  const cacheVideo = useCallback((id: number, video: VideoDetail) => {
    setVideoCache(prev => new Map(prev).set(id, video));
  }, []);

  const getCachedVideo = useCallback((id: number) => {
    return videoCache.get(id);
  }, [videoCache]);

  return (
    <OmniMediaContext.Provider
      value={{
        modalStack,
        currentModal,
        openHub,
        openVideoPlayer,
        goBack,
        closeAll,
        activeTab,
        setActiveTab,
        videos,
        setVideos,
        albums,
        setAlbums,
        videoCache,
        cacheVideo,
        getCachedVideo,
        isLoadingVideos,
        setIsLoadingVideos,
        isLoadingAlbums,
        setIsLoadingAlbums,
      }}
    >
      {children}
    </OmniMediaContext.Provider>
  );
}

export function useOmniMedia() {
  const context = useContext(OmniMediaContext);
  if (!context) {
    throw new Error('useOmniMedia must be used within an OmniMediaProvider');
  }
  return context;
}
