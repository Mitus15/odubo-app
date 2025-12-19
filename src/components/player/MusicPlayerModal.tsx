'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, PanInfo, useMotionValue, animate } from 'framer-motion';
import Image from 'next/image';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

/**
 * MusicPlayerModal - Full-featured music player modal
 *
 * Opens when vinyl player is tapped. Provides complete playback controls:
 * - Large album art
 * - Track info (title, artist, album)
 * - Progress bar with scrubbing
 * - Play/pause, skip, rewind
 * - Volume control
 * - Shuffle/repeat toggles
 * - Queue view
 */
export default function MusicPlayerModal() {
  const {
    state,
    togglePlayPause,
    nextTrack,
    previousTrack,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    closePlayerModal,
    playFromQueue,
    removeFromQueue,
  } = useMusicPlayer();

  const {
    currentTrack,
    currentAlbum,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffled,
    repeatMode,
    queue,
    currentIndex,
    isPlayerModalOpen,
  } = state;

  const [showQueue, setShowQueue] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  // Swipe gesture for track skip
  const swipeX = useMotionValue(0);

  const handleHorizontalSwipe = useCallback((info: PanInfo) => {
    const threshold = 80;
    const velocityThreshold = 300;

    if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      nextTrack();
    } else if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      previousTrack();
    }

    // Spring back to center
    animate(swipeX, 0, { type: 'spring', stiffness: 500, damping: 35 });
  }, [nextTrack, previousTrack, swipeX]);

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle progress bar click/drag
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    seekTo(percent * duration);
  }, [duration, seekTo]);

  const handleProgressDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isScrubbing || !progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    setScrubTime(percent * duration);
  }, [isScrubbing, duration]);

  const handleProgressMouseDown = useCallback(() => {
    setIsScrubbing(true);
    setScrubTime(currentTime);
  }, [currentTime]);

  const handleProgressMouseUp = useCallback(() => {
    if (isScrubbing) {
      seekTo(scrubTime);
      setIsScrubbing(false);
    }
  }, [isScrubbing, scrubTime, seekTo]);

  // Global mouse up handler for scrubbing
  useEffect(() => {
    if (!isScrubbing) return;

    const handleGlobalMouseUp = () => {
      if (isScrubbing) {
        seekTo(scrubTime);
        setIsScrubbing(false);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isScrubbing, scrubTime, seekTo]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPlayerModalOpen) {
        closePlayerModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isPlayerModalOpen, closePlayerModal]);

  // Handle swipe down to close
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      closePlayerModal();
    }
  };

  const displayTime = isScrubbing ? scrubTime : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  // Get upcoming tracks in queue
  const upNextTracks = queue.slice(currentIndex + 1, currentIndex + 6);

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      {isPlayerModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-end justify-center"
          onClick={closePlayerModal}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 glass-modal-backdrop"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg glass-blur-ultra rounded-t-3xl overflow-hidden"
            style={{ maxHeight: '90vh' }}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Close Button */}
            <button
              onClick={closePlayerModal}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Close player"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Main Content */}
            <div className="px-6 pb-8 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 60px)' }}>
              {/* Album Art with horizontal swipe for track skip */}
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => handleHorizontalSwipe(info)}
                style={{ x: swipeX }}
                className="flex justify-center mb-6 cursor-grab active:cursor-grabbing touch-pan-y"
              >
                <motion.div
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{
                    duration: 20,
                    ease: 'linear',
                    repeat: isPlaying ? Infinity : 0,
                  }}
                  className="relative w-64 h-64 rounded-full shadow-2xl overflow-hidden"
                >
                  {/* Vinyl background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] via-[#0d0d0d] to-[#1a1a1a]">
                    {/* Vinyl grooves */}
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{
                        background: `repeating-radial-gradient(
                          circle at center,
                          transparent 0px,
                          transparent 4px,
                          rgba(60, 60, 60, 0.4) 4px,
                          rgba(60, 60, 60, 0.4) 6px
                        )`,
                      }}
                    />
                  </div>

                  {/* Center album art */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full overflow-hidden shadow-inner">
                      {currentAlbum?.cover_art_url ? (
                        <Image
                          src={currentAlbum.cover_art_url}
                          alt={currentAlbum.title || 'Album art'}
                          width={128}
                          height={128}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#843c2d] to-[#6d3224]">
                          <svg className="w-12 h-12 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Center spindle */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3 h-3 rounded-full bg-[#1a1a1a] shadow-inner" />
                  </div>
                </motion.div>
              </motion.div>

              {/* Swipe hint */}
              <p className="text-center text-[10px] text-white/30 mb-4">
                Swipe left/right to skip tracks
              </p>

              {/* Track Info */}
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-white truncate mb-1">
                  {currentTrack.title}
                </h2>
                <p className="text-sm text-white/60 truncate">
                  {currentAlbum?.artist_name || 'Unknown Artist'}
                  {currentAlbum?.title && ` • ${currentAlbum.title}`}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div
                  ref={progressRef}
                  className="relative h-2 bg-white/10 rounded-full cursor-pointer overflow-hidden"
                  onClick={handleProgressClick}
                  onMouseDown={handleProgressMouseDown}
                  onMouseMove={handleProgressDrag}
                  onMouseUp={handleProgressMouseUp}
                >
                  {/* Progress fill */}
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-white rounded-full"
                    style={{ width: `${progress}%` }}
                    transition={{ duration: isScrubbing ? 0 : 0.1 }}
                  />

                  {/* Scrubber handle */}
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg"
                    style={{ left: `calc(${progress}% - 8px)` }}
                    transition={{ duration: isScrubbing ? 0 : 0.1 }}
                  />
                </div>

                {/* Time labels */}
                <div className="flex justify-between mt-2 text-xs text-white/50">
                  <span>{formatTime(displayTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Main Controls - Enlarged for better touch targets */}
              <div className="flex items-center justify-center gap-8 mb-8">
                {/* Shuffle */}
                <button
                  onClick={toggleShuffle}
                  className={`p-3 rounded-full transition-colors active:scale-90 ${isShuffled ? 'text-[#c9a55c]' : 'text-white/60 hover:text-white'}`}
                  aria-label={isShuffled ? 'Disable shuffle' : 'Enable shuffle'}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                  </svg>
                </button>

                {/* Previous */}
                <button
                  onClick={previousTrack}
                  className="p-4 text-white/80 hover:text-white transition-colors active:scale-90"
                  aria-label="Previous track"
                >
                  <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
                  </svg>
                </button>

                {/* Play/Pause */}
                <button
                  onClick={togglePlayPause}
                  disabled={isLoading}
                  className="w-20 h-20 flex items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50 active:scale-95"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isLoading ? (
                    <div className="w-8 h-8 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-9 h-9 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* Next */}
                <button
                  onClick={nextTrack}
                  className="p-4 text-white/80 hover:text-white transition-colors active:scale-90"
                  aria-label="Next track"
                >
                  <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                  </svg>
                </button>

                {/* Repeat */}
                <button
                  onClick={cycleRepeatMode}
                  className={`p-3 rounded-full transition-colors active:scale-90 ${repeatMode !== 'none' ? 'text-[#c9a55c]' : 'text-white/60 hover:text-white'}`}
                  aria-label={`Repeat: ${repeatMode}`}
                >
                  {repeatMode === 'one' ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-3 mb-6 px-4">
                <button
                  onClick={toggleMute}
                  className="text-white/60 hover:text-white transition-colors"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="flex-1 h-1 appearance-none bg-white/20 rounded-full cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                    [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
                />
              </div>

              {/* Queue Toggle - Enhanced with glass effect */}
              <button
                onClick={() => setShowQueue(!showQueue)}
                className="w-full flex items-center justify-between px-4 py-4 rounded-xl glass-surface border border-white/10 hover:border-white/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10">
                    <svg className="w-5 h-5 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium text-white/90">Up Next</span>
                    <p className="text-xs text-white/50">{queue.length - currentIndex - 1} tracks remaining</p>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-white/50 transition-transform ${showQueue ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Queue List */}
              <AnimatePresence>
                {showQueue && upNextTracks.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-1">
                      {upNextTracks.map((track, idx) => (
                        <div
                          key={`${track.id}-${idx}`}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                        >
                          <span className="text-xs text-white/30 w-5 text-center">
                            {currentIndex + idx + 2}
                          </span>
                          <button
                            onClick={() => playFromQueue(currentIndex + idx + 1)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className="text-sm text-white/80 truncate">{track.title}</p>
                          </button>
                          <button
                            onClick={() => removeFromQueue(currentIndex + idx + 1)}
                            className="p-1 text-white/30 hover:text-white/60 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove from queue"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {showQueue && upNextTracks.length === 0 && (
                <div className="mt-3 px-4 py-6 text-center">
                  <p className="text-sm text-white/40">No more tracks in queue</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
