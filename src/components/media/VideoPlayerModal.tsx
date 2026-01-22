'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useOmniMedia, type VideoDetail } from '@/contexts/UnifiedMediaContext';
import { useAudio } from '@/contexts/AudioContext';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';
import { attachHls, type HlsHandle } from '@/lib/hlsPlayer';

interface VideoPlayerModalProps {
  videoId: number;
}

export default function VideoPlayerModal({ videoId }: VideoPlayerModalProps) {
  const { goBack, closeAll, getCachedVideo, cacheVideo, modalStack } = useOmniMedia();
  const { setVideoPlaying } = useAudio();
  const analytics = useAnalyticsSafe();

  const [video, setVideo] = useState<VideoDetail | null>(getCachedVideo(videoId) || null);
  const hasTrackedOpenRef = useRef(false);
  const progressMilestonesRef = useRef<Set<number>>(new Set());
  const [loading, setLoading] = useState(!video);
  const [error, setError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<HlsHandle | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasBackStack = modalStack.length > 1;

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Fetch video details
  useEffect(() => {
    if (video) return;

    const fetchVideo = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/videos/${videoId}`);
        if (!res.ok) throw new Error('Failed to load video');
        const data = await res.json() as { video: any };

        const v = data.video;
        const detail: VideoDetail = {
          id: v.id,
          uid: v.uid,
          title: v.title,
          description: v.description,
          poster_url: v.poster_url,
          thumbnail: v.thumbnail,
          duration: v.duration || '',
          duration_seconds: v.duration_seconds || 0,
          url: v.url,
          category: v.category,
        };

        setVideo(detail);
        cacheVideo(videoId, detail);
      } catch (e: any) {
        setError(e?.message || 'Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [videoId, video, cacheVideo]);

  // Track video open when video is loaded
  useEffect(() => {
    if (video && !hasTrackedOpenRef.current) {
      analytics?.trackVideoOpen(videoId, video.title);
      hasTrackedOpenRef.current = true;
      progressMilestonesRef.current.clear();
    }
  }, [video, videoId, analytics]);

  // Track video progress milestones (25%, 50%, 75%, 100%)
  useEffect(() => {
    if (!duration || duration <= 0) return;

    const percentage = Math.round((currentTime / duration) * 100);
    const milestones = [25, 50, 75, 100];

    for (const milestone of milestones) {
      if (percentage >= milestone && !progressMilestonesRef.current.has(milestone)) {
        progressMilestonesRef.current.add(milestone);
        analytics?.trackVideoProgress(videoId, milestone, Math.round(currentTime));
      }
    }
  }, [currentTime, duration, videoId, analytics]);

  // Setup video playback
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !video?.uid) return;

    // Reset video error when video changes
    setVideoError(null);

    // Use videodelivery.net (Cloudflare Stream public playback domain)
    // This works for all Cloudflare Stream accounts
    const hlsUrl = `https://videodelivery.net/${video.uid}/manifest/video.m3u8`;

    // Event handlers
    const handlePlay = () => {
      setIsPlaying(true);
      setVideoPlaying(true);
      showControlsTemporarily();
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      setVideoPlaying(false);
      setShowControls(true);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setVideoPlaying(false);
      setShowControls(true);
    };

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(v.currentTime);
      }
    };

    const handleDurationChange = () => {
      setDuration(v.duration || 0);
    };

    const handleProgress = () => {
      if (v.buffered.length > 0) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
    };

    const handleError = () => {
      console.error('Video playback error:', v.error);
      setVideoError('Video unavailable or failed to load');
    };

    const handleWaiting = () => {
      // Video is buffering
    };

    const handleCanPlay = () => {
      setVideoError(null);
    };

    v.addEventListener('play', handlePlay);
    v.addEventListener('pause', handlePause);
    v.addEventListener('ended', handleEnded);
    v.addEventListener('timeupdate', handleTimeUpdate);
    v.addEventListener('durationchange', handleDurationChange);
    v.addEventListener('progress', handleProgress);
    v.addEventListener('error', handleError);
    v.addEventListener('waiting', handleWaiting);
    v.addEventListener('canplay', handleCanPlay);

    // Try to attach HLS
    let mounted = true;
    
    attachHls(v, hlsUrl, false)
      .then(h => {
        if (!mounted) return;
        hlsRef.current = h;
        // Don't auto-play - wait for user interaction
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('HLS attachment failed:', err);
        // Try native playback as fallback
        v.src = hlsUrl;
        v.load();
      });

    return () => {
      mounted = false;
      v.removeEventListener('play', handlePlay);
      v.removeEventListener('pause', handlePause);
      v.removeEventListener('ended', handleEnded);
      v.removeEventListener('timeupdate', handleTimeUpdate);
      v.removeEventListener('durationchange', handleDurationChange);
      v.removeEventListener('progress', handleProgress);
      v.removeEventListener('error', handleError);
      v.removeEventListener('waiting', handleWaiting);
      v.removeEventListener('canplay', handleCanPlay);
      setVideoPlaying(false);
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [video?.uid, setVideoPlaying, showControlsTemporarily, isSeeking]);

  // Play/Pause toggle
  const handlePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      v.play().catch((err) => {
        console.error('Play failed:', err);
      });
    } else {
      v.pause();
    }
  }, []);

  // Seek
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    
    const time = parseFloat(e.target.value);
    v.currentTime = time;
    setCurrentTime(time);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (hasBackStack) {
      goBack();
    } else {
      closeAll();
    }
  }, [hasBackStack, goBack, closeAll]);

  // Format time
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Get poster URL
  const posterUrl = video?.poster_url || video?.thumbnail ||
    (video?.uid ? `https://videodelivery.net/${video.uid}/thumbnails/thumbnail.jpg` : undefined);

  // Progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[120] flex flex-col bg-black"
      onClick={showControlsTemporarily}
    >
      {/* Liquid Glass Background Effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full bg-gradient-to-br from-[#843c2d]/10 to-transparent blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full bg-gradient-to-tl from-[#502d26]/10 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ 
          y: showControls || !isPlaying ? 0 : -60, 
          opacity: showControls || !isPlaying ? 1 : 0 
        }}
        transition={{ duration: 0.3 }}
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-30"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors rounded-full glass-surface"
          aria-label={hasBackStack ? 'Back' : 'Close'}
        >
          {hasBackStack ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>

        <h1 className="text-sm font-medium text-white/90 truncate max-w-[50%] text-center px-4">
          {video?.title || ''}
        </h1>

        <button
          onClick={toggleFullscreen}
          className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors rounded-full glass-surface"
          aria-label="Toggle fullscreen"
        >
          {isFullscreen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
        </button>
      </motion.header>

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full glass-surface flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/20 border-t-[#843c2d] rounded-full animate-spin" />
            </div>
            <p className="text-white/50 text-sm">Loading video...</p>
          </div>
        </div>
      )}

      {/* API Error State */}
      {error && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 rounded-full glass-surface flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-white/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-white/60 text-sm mb-4">{error}</p>
          <button
            onClick={handleClose}
            className="px-6 py-3 rounded-full glass-surface text-white hover:bg-white/10 transition-colors text-sm font-medium"
          >
            {hasBackStack ? 'Go Back' : 'Close'}
          </button>
        </div>
      )}

      {/* Video Player */}
      {!loading && !error && video && (
        <div className="flex-1 flex items-center justify-center relative">
          {/* Video Element */}
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            poster={posterUrl}
            playsInline
            preload="metadata"
            onClick={handlePlayPause}
          />

          {/* Video Error Overlay */}
          {videoError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
              <div className="w-24 h-24 rounded-full glass-surface flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-white/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                </svg>
              </div>
              <p className="text-white/70 text-lg font-medium mb-2">Video Unavailable</p>
              <p className="text-white/40 text-sm mb-6 text-center px-8 max-w-md">
                This video may have been removed or is temporarily unavailable.
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-3 rounded-full text-white font-medium transition-all hover:scale-105"
                style={{ 
                  background: 'linear-gradient(135deg, rgb(132, 60, 45) 0%, rgb(168, 82, 64) 100%)',
                }}
              >
                {hasBackStack ? 'Go Back' : 'Close'}
              </button>
            </div>
          )}

          {/* Large Play Button (when paused) */}
          {!isPlaying && !videoError && (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={handlePlayPause}
              className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity"
              aria-label="Play video"
            >
              <div 
                className="w-20 h-20 flex items-center justify-center rounded-full shadow-2xl transition-transform hover:scale-110"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(132, 60, 45, 0.9) 0%, rgba(168, 82, 64, 0.9) 100%)',
                  boxShadow: '0 8px 32px rgba(132, 60, 45, 0.4)'
                }}
              >
                <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </motion.button>
          )}

          {/* Bottom Controls */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ 
              y: showControls || !isPlaying ? 0 : 80, 
              opacity: showControls || !isPlaying ? 1 : 0 
            }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-0 left-0 right-0 z-20"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
          >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />
            
            <div className="relative px-4 pb-2">
              {/* Progress Bar */}
              <div className="relative h-1 mb-3 group cursor-pointer">
                {/* Background track */}
                <div className="absolute inset-0 rounded-full bg-white/20" />
                
                {/* Buffered progress */}
                <div 
                  className="absolute inset-y-0 left-0 rounded-full bg-white/30 transition-all"
                  style={{ width: `${bufferedProgress}%` }}
                />
                
                {/* Played progress */}
                <div 
                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                  style={{ 
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, rgb(132, 60, 45), rgb(168, 82, 64))'
                  }}
                />
                
                {/* Scrubber dot */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `calc(${progress}% - 6px)` }}
                />
                
                {/* Hidden range input for seeking */}
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  onMouseDown={() => setIsSeeking(true)}
                  onMouseUp={() => setIsSeeking(false)}
                  onTouchStart={() => setIsSeeking(true)}
                  onTouchEnd={() => setIsSeeking(false)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              {/* Controls row */}
              <div className="flex items-center justify-between">
                {/* Left - Time */}
                <div className="flex items-center gap-2 text-xs text-white/70 tabular-nums min-w-[90px]">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-white/40">/</span>
                  <span>{formatTime(duration)}</span>
                </div>

                {/* Center - Play controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePlayPause}
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                    style={{ 
                      background: 'linear-gradient(135deg, rgb(132, 60, 45) 0%, rgb(168, 82, 64) 100%)',
                    }}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Right - Fullscreen */}
                <div className="min-w-[90px] flex justify-end">
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
                    aria-label="Fullscreen"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Video info */}
              {video.title && !isFullscreen && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <h2 className="text-white text-lg font-semibold">{video.title}</h2>
                  {video.category && (
                    <p className="text-white/50 text-xs uppercase tracking-wide mt-1">{video.category}</p>
                  )}
                  {video.description && (
                    <p className="text-white/60 text-sm mt-2 line-clamp-2">{video.description}</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
