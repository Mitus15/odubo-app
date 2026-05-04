'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import type { ClipItem } from '@/types/clips';

interface FocusedClipCardProps {
  clip: ClipItem;
  onClipClick: (clip: ClipItem) => void;
}

export default function FocusedClipCard({ 
  clip, 
  onClipClick 
}: FocusedClipCardProps) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

    const videoUrl = clip.mp4Url || clip.hlsUrl;
    
    if (isHovered && videoUrl) {
      // Load and play video on hover
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      
      const playVideo = () => {
        video.play().then(() => {
          setIsPlaying(true);
          setHasLoaded(true);
        }).catch(() => {
          // Failed to play, fallback to poster
          setHasLoaded(true);
        });
      };

      if (video.readyState >= 2) {
        playVideo();
      } else {
        video.onloadedmetadata = playVideo;
      }
    } else {
      // Not hovered - pause and reset
      video.pause();
      video.src = '';
      setIsPlaying(false);
      setHasLoaded(false);
    }

    return () => {
      video.pause();
      video.src = '';
    };
  }, [clip, isHovered]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const aspectStyle = aspectRatio ? { aspectRatio: `${aspectRatio}` } : { aspectRatio: '9/16' };

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl cursor-pointer group"
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ scale: 1.03 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={() => onClipClick(clip)}
    >
      <div className="relative overflow-hidden rounded-2xl" style={aspectStyle}>
        {clip.poster && (
          <Image
            src={clip.poster}
            alt={clip.title}
            fill
            sizes="(min-width: 1280px) 40vw, (min-width: 1024px) 50vw, 30vw"
            className={`object-cover transition-opacity duration-800 ${hasLoaded ? 'opacity-0' : 'opacity-100'} ${isPlaying && !hasLoaded ? 'opacity-100' : 'opacity-0'}`}
            priority
          />
        )}
        
        {isHovered && (clip.mp4Url || clip.hlsUrl) && (
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
            loop
          />
        )}
        
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        
        {/* Play button overlay */}
        {!isPlaying && isHovered && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </motion.div>
            </div>
          </div>
        )}
        
        {/* Info panel */}
        <div className="absolute inset-x-0 bottom-0 p-6 z-10 pointer-events-none">
          {clip.duration && (
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white/80 text-xs font-mono">
              {formatDuration(clip.duration)}
            </div>
          )}
          
          <h3 className="text-white font-bold text-xl leading-tight mb-2 line-clamp-2 clip-title-glass">
            {clip.title}
          </h3>
          {(clip.artist || clip.parentTitle) && (
            <p className="text-white/60 text-sm line-clamp-1 clip-subtitle-glass">
              {clip.artist || clip.parentTitle}
            </p>
          )}
          
          <div className="flex items-center gap-3 mt-4">
            {clip.viewCount !== undefined && clip.viewCount > 0 && (
              <span className="text-white/40 text-[10px]">
                {clip.viewCount > 999 ? `${(clip.viewCount / 1000).toFixed(1)}k` : clip.viewCount} views
              </span>
            )}
            {clip.productHandle && (
              <span className="text-white/40 text-[10px] flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                </svg>
                Shop
              </span>
            )}
          </div>
        </div>
        
        {/* Subtle ambient enhancements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 -z-10 blur-3xl opacity-0" 
            style={{
              background: `radial-gradient(circle at center, transparent 0%, rgba(255, 255, 255, 0.03) 70%)`,
              opacity: isHovered ? 0.4 : 0.2
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}