'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

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

export interface Gallery {
  id: number;
  title: string;
  description?: string;
  code?: string;
  starts_at?: string;
  ends_at?: string;
  photo_count?: number;
  preview_photos?: Photo[];
}

export interface Photo {
  id: number;
  r2_url: string;
  thumbnail_url?: string;
  original_filename?: string;
  user_name?: string;
  created_at: string;
  media_type?: 'photo' | 'video';
  moderated?: number;
}

// Modal types
type ModalType =
  | 'hub'
  | 'video-player'
  | 'moments-gallery'
  | 'moments-camera'
  | 'album-detail';

// Three tabs
export type MediaTab = 'videos' | 'music' | 'moments';

interface ModalState {
  type: ModalType;
  videoId?: number;
  galleryId?: number;
  albumId?: string;
}

// Moments state
interface MomentsState {
  galleries: Gallery[];
  selectedGalleryId: number | null;
  photos: Photo[];
  lightboxIndex: number | null;
  isLoadingGalleries: boolean;
  isLoadingPhotos: boolean;
}

// ============================================================================
// Context Interface
// ============================================================================

interface UnifiedMediaContextValue {
  // Modal stack
  modalStack: ModalState[];
  currentModal: ModalState | null;

  // Hub actions
  openHub: (tab?: MediaTab) => void;
  goBack: () => void;
  closeAll: () => void;

  // Tab state
  activeTab: MediaTab;
  setActiveTab: (tab: MediaTab) => void;

  // Video actions
  openVideoPlayer: (videoId: number) => void;

  // Album actions
  openAlbumDetail: (albumId: string) => void;

  // Moments actions
  openMomentsGallery: (galleryId: number) => void;
  openMomentsCamera: (galleryId?: number) => void;
  openLightbox: (index: number) => void;
  closeLightbox: () => void;
  refreshGalleries: () => Promise<void>;
  refreshPhotos: (galleryId: number) => Promise<void>;

  // Video data
  videos: VideoCard[];
  setVideos: (videos: VideoCard[]) => void;
  videoCache: Map<number, VideoDetail>;
  cacheVideo: (id: number, video: VideoDetail) => void;
  getCachedVideo: (id: number) => VideoDetail | undefined;
  isLoadingVideos: boolean;
  setIsLoadingVideos: (loading: boolean) => void;

  // Album data
  albums: AlbumCard[];
  setAlbums: (albums: AlbumCard[]) => void;
  isLoadingAlbums: boolean;
  setIsLoadingAlbums: (loading: boolean) => void;

  // Moments data
  moments: MomentsState;
  setGalleries: (galleries: Gallery[]) => void;
  setPhotos: (photos: Photo[]) => void;
  setSelectedGalleryId: (id: number | null) => void;
}

// ============================================================================
// Context
// ============================================================================

const UnifiedMediaContext = createContext<UnifiedMediaContextValue | null>(null);

export function UnifiedMediaProvider({ children }: { children: ReactNode }) {
  // Modal stack state
  const [modalStack, setModalStack] = useState<ModalState[]>([]);

  // Tab state - default to music
  const [activeTab, setActiveTabState] = useState<MediaTab>('music');

  // Video data
  const [videos, setVideos] = useState<VideoCard[]>([]);
  const [videoCache, setVideoCache] = useState<Map<number, VideoDetail>>(new Map());
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);

  // Album data
  const [albums, setAlbums] = useState<AlbumCard[]>([]);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);

  // Moments data
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedGalleryId, setSelectedGalleryId] = useState<number | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isLoadingGalleries, setIsLoadingGalleries] = useState(false);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

  // ============================================================================
  // Modal Actions
  // ============================================================================

  const openHub = useCallback((tab?: MediaTab) => {
    if (tab) setActiveTabState(tab);
    setModalStack(prev => {
      // Don't duplicate if already on hub
      if (prev.length > 0 && prev[prev.length - 1].type === 'hub') {
        return prev;
      }
      // Fresh entry
      return [{ type: 'hub' }];
    });
  }, []);

  const openVideoPlayer = useCallback((videoId: number) => {
    setModalStack(prev => [...prev, { type: 'video-player', videoId }]);
  }, []);

  const openAlbumDetail = useCallback((albumId: string) => {
    setModalStack(prev => [...prev, { type: 'album-detail', albumId }]);
  }, []);

  const openMomentsGallery = useCallback((galleryId: number) => {
    setSelectedGalleryId(galleryId);
    setModalStack(prev => [...prev, { type: 'moments-gallery', galleryId }]);
  }, []);

  const openMomentsCamera = useCallback((galleryId?: number) => {
    if (galleryId) setSelectedGalleryId(galleryId);
    setModalStack(prev => [...prev, { type: 'moments-camera', galleryId }]);
  }, []);

  const goBack = useCallback(() => {
    setModalStack(prev => {
      const newStack = prev.slice(0, -1);
      // If we're leaving a gallery view, clear lightbox
      if (prev[prev.length - 1]?.type === 'moments-gallery') {
        setLightboxIndex(null);
      }
      return newStack;
    });
  }, []);

  const closeAll = useCallback(() => {
    setModalStack([]);
    setLightboxIndex(null);
  }, []);

  const currentModal = modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;

  // Tab action
  const setActiveTab = useCallback((tab: MediaTab) => {
    setActiveTabState(tab);
  }, []);

  // ============================================================================
  // Video Cache Actions
  // ============================================================================

  const cacheVideo = useCallback((id: number, video: VideoDetail) => {
    setVideoCache(prev => new Map(prev).set(id, video));
  }, []);

  const getCachedVideo = useCallback((id: number) => {
    return videoCache.get(id);
  }, [videoCache]);

  // ============================================================================
  // Lightbox Actions
  // ============================================================================

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  // ============================================================================
  // Moments Data Fetching
  // ============================================================================

  const refreshGalleries = useCallback(async () => {
    setIsLoadingGalleries(true);
    try {
      const res = await fetch('/api/moments/galleries/public?preview=true');
      if (res.ok) {
        const data = await res.json();
        setGalleries(data.galleries || []);
      }
    } catch (e) {
      console.error('Failed to fetch galleries:', e);
    } finally {
      setIsLoadingGalleries(false);
    }
  }, []);

  const refreshPhotos = useCallback(async (galleryId: number) => {
    setIsLoadingPhotos(true);
    try {
      const res = await fetch(`/api/moments/list?galleryId=${galleryId}`);
      if (res.ok) {
        const data = await res.json();
        // Filter out moderated photos (moderated=2 means hidden)
        const filtered = (data.photos || []).filter((p: Photo) => p.moderated !== 2);
        setPhotos(filtered);
      }
    } catch (e) {
      console.error('Failed to fetch photos:', e);
    } finally {
      setIsLoadingPhotos(false);
    }
  }, []);

  // ============================================================================
  // Moments State Object
  // ============================================================================

  const moments: MomentsState = {
    galleries,
    selectedGalleryId,
    photos,
    lightboxIndex,
    isLoadingGalleries,
    isLoadingPhotos,
  };

  // ============================================================================
  // Provider
  // ============================================================================

  return (
    <UnifiedMediaContext.Provider
      value={{
        // Modal stack
        modalStack,
        currentModal,
        openHub,
        goBack,
        closeAll,

        // Tab state
        activeTab,
        setActiveTab,

        // Video actions
        openVideoPlayer,

        // Album actions
        openAlbumDetail,

        // Moments actions
        openMomentsGallery,
        openMomentsCamera,
        openLightbox,
        closeLightbox,
        refreshGalleries,
        refreshPhotos,

        // Video data
        videos,
        setVideos,
        videoCache,
        cacheVideo,
        getCachedVideo,
        isLoadingVideos,
        setIsLoadingVideos,

        // Album data
        albums,
        setAlbums,
        isLoadingAlbums,
        setIsLoadingAlbums,

        // Moments data
        moments,
        setGalleries,
        setPhotos,
        setSelectedGalleryId,
      }}
    >
      {children}
    </UnifiedMediaContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useUnifiedMedia() {
  const context = useContext(UnifiedMediaContext);
  if (!context) {
    throw new Error('useUnifiedMedia must be used within a UnifiedMediaProvider');
  }
  return context;
}

// Alias for migration compatibility
export const useOmniMedia = useUnifiedMedia;
