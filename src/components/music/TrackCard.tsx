"use client";

import { memo, useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import type { Track, Album } from '@/types/music';

interface TrackCardProps {
  track: Track;
  album: Album | null;
  active: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  onPlay: () => void;
}

/**
 * TrackCard - Full-screen card for album showcase feed
 *
 * Displays album art as background with track info overlay.
 * Tap anywhere to play/pause. Shows flash status indicator.
 */
function TrackCard({ track, album, active, isPlaying, isLoading, onPlay }: TrackCardProps) {
  const coverArt = album?.cover_art_url;
  const [showStatus, setShowStatus] = useState(false);
  const [statusIcon, setStatusIcon] = useState<'play' | 'pause' | 'loading'>('play');

  // Handle tap to play/pause with flash indicator
  const handleTap = useCallback(() => {
    if (!active) return;

    // Determine what icon to show (opposite of current state since we're toggling)
    if (isLoading) {
      setStatusIcon('loading');
    } else {
      setStatusIcon(isPlaying ? 'pause' : 'play');
    }

    setShowStatus(true);
    onPlay();
  }, [active, isPlaying, isLoading, onPlay]);

  // Auto-hide status after showing
  useEffect(() => {
    if (showStatus) {
      const timer = setTimeout(() => setShowStatus(false), 800);
      return () => clearTimeout(timer);
    }
  }, [showStatus]);

  // Update status icon when loading state changes
  useEffect(() => {
    if (isLoading && showStatus) {
      setStatusIcon('loading');
    }
  }, [isLoading, showStatus]);

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none bg-black"
      style={{
        touchAction: 'pan-y',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      onClick={handleTap}
    >
      {/* Album art background */}
      {coverArt && (
        <Image
          src={coverArt}
          alt=""
          fill
          sizes="100vw"
          priority={active}
          draggable={false}
          className="object-cover pointer-events-none"
          style={{
            filter: active ? 'brightness(0.6)' : 'brightness(0.4)',
            transition: 'filter 300ms ease',
          }}
        />
      )}

      {/* Fallback gradient if no cover art */}
      {!coverArt && (
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 50%, #1a1a1a 100%)',
          }}
        />
      )}

      {/* Bottom gradient overlay */}
      <div
        className="absolute inset-x-0 bottom-0 h-72 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)',
        }}
      />

      {/* Top gradient overlay */}
      <div
        className="absolute inset-x-0 top-0 h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)',
        }}
      />

      {/* Flash status indicator - appears on tap then fades */}
      <AnimatePresence>
        {showStatus && active && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
          >
            <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl">
              {statusIcon === 'loading' ? (
                <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : statusIcon === 'play' ? (
                <svg className="w-10 h-10 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom-left: Track info */}
      <div
        className={`absolute left-4 z-20 pointer-events-none transition-opacity duration-300 ${
          active ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ bottom: 'calc(max(env(safe-area-inset-bottom, 16px), 16px) + 24px)' }}
      >
        {/* Album art thumbnail */}
        {coverArt && (
          <div className="w-16 h-16 rounded-lg overflow-hidden shadow-lg mb-4 border border-white/10">
            <Image
              src={coverArt}
              alt=""
              width={64}
              height={64}
              className="object-cover w-full h-full"
              draggable={false}
            />
          </div>
        )}

        {/* Track title */}
        <h3 className="text-lg font-semibold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] max-w-[280px] truncate">
          {track.title}
        </h3>

        {/* Artist name */}
        <p className="text-sm text-white/70 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mt-1">
          {album?.artist_name || 'Mani Odubo'}
        </p>

        {/* Album title */}
        {album?.title && (
          <p className="text-xs text-white/50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mt-0.5">
            {album.title}
          </p>
        )}

        {/* Duration */}
        {track.duration_formatted && (
          <p className="text-xs text-white/40 mt-2 font-mono">
            {track.duration_formatted}
          </p>
        )}
      </div>

      {/* Playing indicator */}
      {active && isPlaying && (
        <div className="absolute bottom-4 right-4 z-20">
          <div className="flex items-end gap-0.5 h-4">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="w-1 bg-white rounded-full"
                animate={{
                  height: ['4px', '16px', '4px'],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Custom comparison function: only re-render when meaningful props change
function arePropsEqual(prevProps: TrackCardProps, nextProps: TrackCardProps): boolean {
  return (
    prevProps.track.id === nextProps.track.id &&
    prevProps.active === nextProps.active &&
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.isLoading === nextProps.isLoading
  );
}

export default memo(TrackCard, arePropsEqual);
