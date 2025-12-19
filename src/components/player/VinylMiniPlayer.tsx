'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

interface VinylMiniPlayerProps {
  className?: string;
}

/**
 * VinylMiniPlayer - Instagram/TikTok-style spinning disc for clip overlays
 *
 * Shows current playing track as a spinning vinyl disc when music is active.
 * Tapping opens the full MusicPlayerModal.
 */
export default function VinylMiniPlayer({ className = '' }: VinylMiniPlayerProps) {
  const { state, togglePlayPause, openPlayerModal } = useMusicPlayer();

  const { currentTrack, currentAlbum, isPlaying, isLoading } = state;

  // Don't render if no track is playing
  if (!currentTrack) return null;

  const handleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    openPlayerModal();
  };

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePlayPause();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`flex items-center gap-3 ${className}`}
      >
        {/* Spinning Vinyl Disc */}
        <button
          onClick={handleTap}
          className="relative flex-shrink-0 group"
          aria-label="Open music player"
        >
          {/* Vinyl base (black ring) */}
          <motion.div
            animate={{ rotate: isPlaying ? 360 : 0 }}
            transition={{
              duration: 3,
              ease: 'linear',
              repeat: isPlaying ? Infinity : 0,
            }}
            className="relative w-12 h-12"
          >
            {/* Outer vinyl ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#1a1a1a] via-[#0d0d0d] to-[#1a1a1a] shadow-lg">
              {/* Vinyl grooves effect */}
              <div
                className="absolute inset-0 rounded-full opacity-40"
                style={{
                  background: `repeating-radial-gradient(
                    circle at center,
                    transparent 0px,
                    transparent 2px,
                    rgba(60, 60, 60, 0.3) 2px,
                    rgba(60, 60, 60, 0.3) 3px
                  )`,
                }}
              />

              {/* Vinyl shine highlight */}
              <div
                className="absolute inset-0 rounded-full opacity-20"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%, transparent 100%)',
                }}
              />
            </div>

            {/* Center label (album art) */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full overflow-hidden bg-[#302927] shadow-inner">
                {currentAlbum?.cover_art_url ? (
                  <Image
                    src={currentAlbum.cover_art_url}
                    alt=""
                    width={24}
                    height={24}
                    className="object-cover w-full h-full"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#843c2d] to-[#6d3224]">
                    <div className="w-1.5 h-1.5 rounded-full bg-black/40" />
                  </div>
                )}
              </div>
            </div>

            {/* Center spindle hole */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-black" />
            </div>
          </motion.div>

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Hover play/pause indicator */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </button>

        {/* Track info */}
        <button
          onClick={handleTap}
          className="flex flex-col items-start min-w-0 text-left"
        >
          <div className="flex items-center gap-1.5 max-w-[140px]">
            {/* Music note icon */}
            <svg className="w-3 h-3 text-white/60 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <span className="text-xs font-medium text-white truncate">
              {currentTrack.title}
            </span>
          </div>
          <span className="text-[10px] text-white/60 truncate max-w-[140px]">
            {currentAlbum?.artist_name || 'Unknown Artist'}
          </span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
