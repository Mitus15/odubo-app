'use client';

import { useState, useRef, useEffect } from 'react';
import { Video } from '../app/media/types';

interface CloudflareStreamPlayerProps {
  video: Video;
  streamVideoId?: string; // Cloudflare Stream video ID
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  fillContainer?: boolean; // If true, player fills parent width/height
  frameless?: boolean; // If true, remove background/rounding wrappers
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onProgress?: (progress: number) => void;
}

export default function CloudflareStreamPlayer({
  video,
  streamVideoId,
  className = '',
  autoPlay = false,
  muted = false,
  controls = true,
  fillContainer = true,
  frameless = false,
  onTimeUpdate,
  onDurationChange,
  onProgress
}: CloudflareStreamPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(muted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [quality, setQuality] = useState('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [buffered, setBuffered] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Derive Cloudflare Stream ID from props or from the video URL
  const extractStreamIdFromUrl = (url?: string): string | null => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const isCfHost = /(?:^|\.)videodelivery\.net$/.test(u.hostname) || /cloudflarestream\.com$/.test(u.hostname) || /(?:^|\.)watch\.videodelivery\.net$/.test(u.hostname) || /(?:^|\.)iframe\.videodelivery\.net$/.test(u.hostname);
      if (!isCfHost) return null;
      const segments = u.pathname.split('/').filter(Boolean);
      if (segments.length === 0) return null;
      const candidate = segments[0];
      // Cloudflare Stream UIDs are typically 32+ chars, alphanumeric with optional dashes/underscores
      if (/^[A-Za-z0-9_-]{24,}$/.test(candidate)) return candidate;
      return null;
    } catch {
      return null;
    }
  };

  const effectiveStreamVideoId = streamVideoId || extractStreamIdFromUrl(video.url);

  // Use Cloudflare Stream if we have a valid ID; otherwise fall back to direct URL
  const videoSource = effectiveStreamVideoId 
    ? `https://iframe.videodelivery.net/${effectiveStreamVideoId}`
    : video.url;

  const isStreamVideo = !!effectiveStreamVideoId;

  // Hint the browser to establish early connections to Cloudflare Stream
  useEffect(() => {
    if (!isStreamVideo) return;
    const addPreconnect = (href: string) => {
      const existing = document.querySelector(`link[rel="preconnect"][href="${href}"]`);
      if (existing) return;
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = href;
      link.crossOrigin = '';
      document.head.appendChild(link);
    };
    addPreconnect('https://videodelivery.net');
    addPreconnect('https://iframe.videodelivery.net');
    // Safety: stop showing spinner if iframe takes too long to load
    const safety = setTimeout(() => setIsLoading(false), 10000);
    return () => clearTimeout(safety);
  }, [isStreamVideo]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      const current = videoElement.currentTime;
      setCurrentTime(current);
      onTimeUpdate?.(current);
    };

    const handleDurationChange = () => {
      const dur = videoElement.duration;
      setDuration(dur);
      onDurationChange?.(dur);
    };

    const handleProgress = () => {
      if (videoElement.buffered.length > 0) {
        const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
        const bufferedPercent = (bufferedEnd / videoElement.duration) * 100;
        setBuffered(bufferedPercent);
      }
    };

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(videoElement.volume);
      setIsMuted(videoElement.muted);
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('durationchange', handleDurationChange);
    videoElement.addEventListener('progress', handleProgress);
    videoElement.addEventListener('loadstart', handleLoadStart);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('volumechange', handleVolumeChange);

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('durationchange', handleDurationChange);
      videoElement.removeEventListener('progress', handleProgress);
      videoElement.removeEventListener('loadstart', handleLoadStart);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [onTimeUpdate, onDurationChange]);

  const togglePlay = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isPlaying) {
      videoElement.pause();
    } else {
      videoElement.play();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const videoElement = videoRef.current;
    if (!videoElement || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    videoElement.currentTime = newTime;
  };

  const handleVolumeChange = (newVolume: number) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    setVolume(newVolume);
    videoElement.volume = newVolume;
    if (newVolume === 0) {
      setIsMuted(true);
      videoElement.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      videoElement.muted = false;
    }
  };

  const toggleMute = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const newMuted = !isMuted;
    setIsMuted(newMuted);
    videoElement.muted = newMuted;
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const skipTime = (seconds: number) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    videoElement.currentTime = newTime;
  };

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isFullscreen) {
        setShowControls(false);
      }
    }, 3000);
  };

  const handleMouseLeave = () => {
    if (isPlaying && !isFullscreen) {
      setShowControls(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipTime(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipTime(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, volume, isMuted, duration, currentTime]);

  if (isStreamVideo) {
    // Render Cloudflare Stream iframe player
    return (
      <div 
        ref={containerRef}
        className={`${frameless ? 'absolute inset-0' : 'relative bg-black overflow-hidden group rounded-lg'} ${className}`}
        style={fillContainer ? undefined : { aspectRatio: '16/9' }}
      >
        <iframe
          src={`https://iframe.videodelivery.net/${effectiveStreamVideoId}?preload=metadata&poster=${encodeURIComponent(video.poster_url || '')}&controls=${controls ? 1 : 0}&autoplay=${autoPlay ? 1 : 0}&muted=${muted ? 1 : 0}&video-fit=cover`}
          className="w-full h-full border-0"
          allow="accelerometer; gyroscope; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          title={video.title}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setIsLoading(false)}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none" aria-busy="true">
            <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>
    );
  }

  // Render custom HTML5 video player for direct URLs
  return (
    <div 
      ref={containerRef}
      className={`${frameless ? 'absolute inset-0' : 'relative bg-black overflow-hidden group rounded-lg'} ${className}`}
      style={fillContainer ? undefined : { aspectRatio: '16/9' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        poster={video.poster_url}
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        controls={false}
      >
        <source src={video.url} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="animate-spin w-12 h-12 border-3 border-white border-t-transparent rounded-full"></div>
        </div>
      )}

      {/* Play Button Overlay - only show when controls are disabled to avoid duplicate buttons */}
      {!isPlaying && !isLoading && !controls && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer transition-opacity"
          onClick={togglePlay}
        >
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      )}

      {/* Controls */}
      {controls && (
        <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-all duration-300 ${
          showControls || !isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
        }`}>
          <div className="px-4 py-3 space-y-3">
            {/* Progress Bar */}
            <div className="relative">
              <div 
                className="h-1.5 bg-white/20 rounded-full cursor-pointer group/progress hover:h-2 transition-all"
                onClick={handleSeek}
              >
                {/* Buffered Progress */}
                <div 
                  className="absolute inset-0 bg-white/30 rounded-full transition-all"
                  style={{ width: `${buffered}%` }}
                />
                {/* Current Progress */}
                <div 
                  className="absolute inset-0 bg-[#843c2d] rounded-full transition-all"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg" />
                </div>
              </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between">
              {/* Left Controls */}
              <div className="flex items-center space-x-2 flex-1">
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-[#843c2d] transition-colors p-2 hover:bg-white/10 rounded-full"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>

                {/* Skip Controls */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => skipTime(-10)}
                    className="text-white/80 hover:text-[#843c2d] transition-colors p-1.5 hover:bg-white/10 rounded-full"
                    aria-label="Skip back 10 seconds"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                    </svg>
                  </button>

                  <button
                    onClick={() => skipTime(10)}
                    className="text-white/80 hover:text-[#843c2d] transition-colors p-1.5 hover:bg-white/10 rounded-full"
                    aria-label="Skip forward 10 seconds"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                    </svg>
                  </button>
                </div>

                {/* Volume Control */}
                <div className="flex items-center space-x-2 group/volume">
                  <button
                    onClick={toggleMute}
                    className="text-white/80 hover:text-[#843c2d] transition-colors p-1.5 hover:bg-white/10 rounded-full"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                      </svg>
                    ) : volume < 0.5 ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                      </svg>
                    )}
                  </button>
                  
                  <div className="w-0 overflow-hidden group-hover/volume:w-16 transition-all duration-200">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                      aria-label="Volume"
                    />
                  </div>
                </div>

                {/* Time Display */}
                <div className="text-white text-sm font-mono tabular-nums hidden sm:block">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center space-x-1">
                {/* Quality Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    className="text-white/80 hover:text-[#843c2d] transition-colors p-1.5 hover:bg-white/10 rounded-full"
                    aria-label="Video quality"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
                    </svg>
                  </button>
                  
                  {showQualityMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-sm rounded-lg p-1 min-w-[100px] border border-white/10 z-50">
                      {['Auto', '1080p', '720p', '480p', '360p'].map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setQuality(q.toLowerCase());
                            setShowQualityMenu(false);
                          }}
                          className={`block w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                            quality === q.toLowerCase() 
                              ? 'text-[#843c2d] bg-white/10' 
                              : 'text-white hover:bg-white/10'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="text-white/80 hover:text-[#843c2d] transition-colors p-1.5 hover:bg-white/10 rounded-full"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Styles */}
      <style jsx>{`
        .slider {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          outline: none;
        }
        
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid #843c2d;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease;
        }

        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
        }
        
        .slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid #843c2d;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease;
        }

        .slider::-moz-range-thumb:hover {
          transform: scale(1.1);
        }

        .slider::-webkit-slider-track {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
        }

        .slider::-moz-range-track {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          border: none;
        }
      `}</style>
    </div>
  );
}
