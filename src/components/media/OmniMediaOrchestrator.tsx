'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUnifiedMedia } from '@/contexts/UnifiedMediaContext';
import MediaHubModal from './MediaHubModal';
import VideoPlayerModal from './VideoPlayerModal';
import MomentsGalleryView from './MomentsGalleryView';
import MomentsCameraModal from './MomentsCameraModal';
import AlbumDetailView from './AlbumDetailView';

export default function OmniMediaOrchestrator() {
  const { modalStack, closeAll, currentModal } = useUnifiedMedia();

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack.length > 0) {
        closeAll();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [modalStack.length, closeAll]);

  // Prevent body scroll when modals open
  useEffect(() => {
    if (modalStack.length > 0) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalStack.length]);

  return (
    <>
      {/* Shared backdrop */}
      <AnimatePresence>
        {modalStack.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm"
            onClick={closeAll}
          />
        )}
      </AnimatePresence>

      {/* Modal stack - only render current modal */}
      <AnimatePresence mode="wait">
        {currentModal?.type === 'hub' && (
          <MediaHubModal key="hub" />
        )}
        {currentModal?.type === 'video-player' && currentModal.videoId && (
          <VideoPlayerModal
            key={`video-${currentModal.videoId}`}
            videoId={currentModal.videoId}
          />
        )}
        {currentModal?.type === 'moments-gallery' && currentModal.galleryId && (
          <MomentsGalleryView
            key={`gallery-${currentModal.galleryId}`}
            galleryId={currentModal.galleryId}
          />
        )}
        {currentModal?.type === 'moments-camera' && (
          <MomentsCameraModal
            key={`camera-${currentModal.galleryId || 'new'}`}
            galleryId={currentModal.galleryId}
          />
        )}
        {currentModal?.type === 'album-detail' && currentModal.albumId && (
          <AlbumDetailView
            key={`album-${currentModal.albumId}`}
            albumId={currentModal.albumId}
          />
        )}
      </AnimatePresence>
    </>
  );
}
