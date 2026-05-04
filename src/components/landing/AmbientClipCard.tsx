'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { ClipItem } from '@/types/clips';

interface AmbientClipCardProps {
  clip: ClipItem;
  index: number;
  isNearViewport?: boolean;
}

export default function AmbientClipCard({ 
  clip, 
  index, 
  isNearViewport = false 
}: AmbientClipCardProps) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Determine if this clip should load video based on viewport proximity
  const shouldPlayVideo = isNearViewport;

  useEffect(() => {
    if (!clip.poster) {
      setAspectRatio(9 / 16);
      return;
    }
    const img = document.createElement('img');
    img.onload = () => {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
    };
    img.onerror = () => {
      setAspectRatio(9 / 16);
    };
    img.src = clip.poster;
  }, [clip.poster]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Cleanup previous observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }

    // Only attempt to play video if we're near viewport and have a video URL
    const videoUrl = clip.mp4Url || clip.hlsUrl;
    if (shouldPlayVideo && videoUrl) {
      // Load and play video
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      video.preload = 'metadata'; // Only load metadata initially
      
      const playVideo = () => {
        video.play().then(() => {
          setIsPlaying(true);
          setHasLoaded(true);
        }).catch((err) => {
          console.warn('Failed to play ambient clip video:', err);
          // Fallback to poster on play failure
          setHasLoaded(true);
        });
      };

      // Wait for metadata to load before playing
      if (video.readyState >= 2) {
        // HAVE_CURRENT_STATE or higher
        playVideo();
      } else {
        video.onloadedmetadata = playVideo;
      }

      // Setup resize observer for dynamic sizing
      resizeObserverRef.current = new ResizeObserver(() => {
        // Force aspect ratio recalculation if needed
        if (clip.poster && !aspectRatio) {
          const img = new Image();
          img.onload = () => setAspectRatio(img.width / img.height);
          img.src = clip.poster;
        }
      });
      
      if (video.parentElement) {
        resizeObserverRef.current.observe(video.parentElement);
      }
    } else {
      // Not near viewport or no video URL - just show poster
      video.src = '';
      setIsPlaying(false);
      // Poster will show by default
      setHasLoaded(true);
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [clip, index, isNearViewport, shouldPlayVideo, aspectRatio]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const aspectStyle = aspectRatio ? { aspectRatio: `${aspectRatio}` } : { aspectRatio: '9/16' };

  return (
    <div 
      className="relative overflow-hidden rounded-xl"
      style={aspectStyle}
      // Subtle ambient animation - very slow float
      style={{
        ...aspectStyle,
        transform: `translate3d(0, ${Math.sin(index * 0.1 + Date.now() * 0.000005) * 0.5}px, 0)`,
        transition: 'transform 0.1s linear'
      }}
    >
      {shouldPlayVideo && isNearViewport ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          loop
          preload="none"
        />
      ) : null}
      
      {clip.poster && (
        <Image
          src={clip.poster}
          alt={clip.title}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 20vw"
          className={`object-cover transition-opacity duration-800 ${hasLoaded && !isNearViewport ? 'opacity-80' : 'opacity-100'} ${isPlaying && isNearViewport ? 'opacity-0' : 'opacity-100'}`}
          priority={false}
          loading="lazy"
        />
      )}
      
      {/* Subtle ambient enhancements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Vignette */}
        <div className="absolute inset-0 bg-radial-gradient(from-center, from-black/0, via-black/30, to-black/50)" />
        {/* Soft glow */}
        <div className="absolute inset-0 -z-10 blur-3xl opacity-0" 
          style={{
            background: `radial-gradient(circle at center, transparent 0%, rgba(255, 255, 255, 0.02) 70%)`,
            opacity: isNearViewport && isPlaying ? 0.3 : 0
          }}
        />
      </div>
      
      {/* Duration overlay (only visible on hover/focus for ambient clips) */}
      {isNearViewport && clip.duration && (
        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white/80 text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {formatDuration(clip.duration)}
        </div>
      )}
    </div>
  );
}