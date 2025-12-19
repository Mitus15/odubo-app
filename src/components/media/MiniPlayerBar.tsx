'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useOmniMedia } from '@/contexts/UnifiedMediaContext';

export default function MiniPlayerBar() {
  const { currentTrack, currentAlbum, isPlaying, togglePlayPause, currentTime, duration } = useMusicPlayer();
  const { openHub, modalStack } = useOmniMedia();

  // Don't show if no track or if media modal is open
  const shouldShow = currentTrack && modalStack.length === 0;

  // Progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleBarClick = () => {
    openHub('music');
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className="fixed bottom-0 left-0 right-0 z-[90] bg-black/90 backdrop-blur-xl border-t border-white/10"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10">
            <motion.div
              className="h-full bg-white/60"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>

          {/* Content */}
          <button
            onClick={handleBarClick}
            className="w-full flex items-center gap-3 p-3 pr-2 text-left"
            style={{ touchAction: 'manipulation' }}
          >
            {/* Album art */}
            <div className="w-12 h-12 rounded-md overflow-hidden bg-white/10 flex-shrink-0">
              {currentAlbum?.cover_art_url ? (
                <img
                  src={currentAlbum.cover_art_url}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              )}
            </div>

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {currentTrack.title}
              </p>
              <p className="text-white/50 text-xs truncate">
                {currentAlbum?.artist_name || 'Unknown Artist'}
              </p>
            </div>

            {/* Play/Pause button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              style={{ touchAction: 'manipulation' }}
            >
              {isPlaying ? (
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
