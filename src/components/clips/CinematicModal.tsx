"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { ClipItem } from '@/types/clips';

interface CinematicModalProps {
  clip: ClipItem | null;
  allClips: ClipItem[];
  onClose: () => void;
  onNavigate: (clip: ClipItem) => void;
}

export default function CinematicModal({ clip, allClips, onClose, onNavigate }: CinematicModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentIndex = clip ? allClips.findIndex(c => c.id === clip.id) : -1;
  const prevClip = currentIndex > 0 ? allClips[currentIndex - 1] : null;
  const nextClip = currentIndex < allClips.length - 1 ? allClips[currentIndex + 1] : null;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && prevClip) onNavigate(prevClip);
      if (e.key === 'ArrowRight' && nextClip) onNavigate(nextClip);
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose, onNavigate, prevClip, nextClip]);

  // Auto-play on mount/clip change
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clip) return;

    const videoUrl = clip.mp4Url || clip.hlsUrl;
    if (!videoUrl) return;

    video.src = videoUrl;
    video.muted = true;
    video.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      setIsPlaying(false);
    });

    return () => {
      video.pause();
      video.src = '';
    };
  }, [clip]);

  // Progress tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!clip) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center cinematic-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onMouseMove={handleMouseMove}
        onClick={togglePlay}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 glass-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Close button */}
        <motion.button
          className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ delay: 0.1 }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>

        {/* Navigation arrows */}
        {prevClip && (
          <motion.button
            className="absolute left-4 z-50 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); onNavigate(prevClip); }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ delay: 0.15 }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>
        )}

        {nextClip && (
          <motion.button
            className="absolute right-4 z-50 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); onNavigate(nextClip); }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: 0.15 }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>
        )}

        {/* Video container */}
        <motion.div
          className="relative w-full max-w-3xl mx-4"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Video */}
          <div className="relative aspect-[9/16] max-h-[85vh] mx-auto rounded-2xl overflow-hidden bg-black shadow-2xl">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              onClick={togglePlay}
            />

            {/* Poster fallback */}
            {clip.poster && (
              <Image
                src={clip.poster}
                alt=""
                fill
                className="object-cover pointer-events-none"
                style={{ opacity: isPlaying ? 0 : 1, transition: 'opacity 0.3s' }}
                priority
              />
            )}

            {/* Controls overlay */}
            <motion.div
              className="absolute inset-0 flex flex-col justify-between"
              initial={{ opacity: 1 }}
              animate={{ opacity: showControls ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Top gradient */}
              <div className="h-24 bg-gradient-to-b from-black/60 to-transparent" />

              {/* Center play/pause */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: isPlaying ? 0.8 : 1, opacity: isPlaying ? 0 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {!isPlaying && (
                    <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                      <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Bottom controls */}
              <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6">
                {/* Progress bar */}
                <div className="w-full h-1 bg-white/20 rounded-full mb-4 cursor-pointer group">
                  <div
                    className="h-full bg-white rounded-full relative group-hover:h-1.5 transition-all"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Info row */}
                <div className="flex items-end justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-white font-semibold text-lg clip-title-glass mb-1">
                      {clip.title}
                    </h2>
                    {(clip.artist || clip.parentTitle) && (
                      <p className="text-white/60 text-sm clip-subtitle-glass">
                        {clip.artist || clip.parentTitle}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={toggleMute}
                      className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    </button>

                    {clip.productHandle && (
                      <a
                        href={`/store?product=${clip.productHandle}`}
                        onClick={(e) => e.stopPropagation()}
                        className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>

                {/* Time display */}
                <div className="flex items-center justify-between mt-2 text-white/40 text-xs font-mono">
                  <span>{formatTime(videoRef.current?.currentTime || 0)}</span>
                  <span>{formatTime(videoRef.current?.duration || clip.duration || 0)}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
