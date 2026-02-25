"use client";

import { memo } from 'react';
import Image from 'next/image';
import VinylMiniPlayer from '../player/VinylMiniPlayer';
import type { ClipItem } from '@/types/clips';

interface PosterCardProps {
  clip: ClipItem;
  active: boolean;
  videoReady?: boolean; // Only fade when video is actually ready
  onTitleTap?: () => void;
}

/**
 * PosterCard - Lightweight poster-only card for the scrolling feed
 *
 * This component displays only the poster image and clip metadata.
 * The actual video playback is handled by SingleVideoPlayer which is fixed.
 *
 * This separation allows:
 * - Smooth scrolling without video elements
 * - Safari can't pause what isn't in the scroll container
 * - Less memory usage (no video elements per clip)
 *
 * Wrapped with React.memo to prevent re-renders during scroll
 * when props haven't meaningfully changed.
 */
function PosterCard({ clip, active, videoReady = false, onTitleTap }: PosterCardProps) {
  // Only become transparent when video is actually ready to show
  const shouldReveal = active && videoReady;

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none ${
        shouldReveal ? 'bg-transparent' : 'bg-black'
      }`}
      style={{
        touchAction: 'pan-y',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        transition: 'background-color 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      }}
    >
      {/* Poster image - only fades when video is ready */}
      {clip.poster && (
        <Image
          src={clip.poster}
          alt=""
          fill
          sizes="100vw"
          priority={active}
          draggable={false}
          className={`object-cover pointer-events-none ${
            shouldReveal ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ transition: 'opacity 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
        />
      )}

      {/* Gradient overlay - fades with poster */}
      <div
        className={`absolute inset-x-0 bottom-0 h-48 pointer-events-none ${
          shouldReveal ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)',
          transition: 'opacity 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}
      />

      {/* Bottom-left: Title & info - only visible when this clip is active */}
      <div
        className={`absolute left-4 z-20 pointer-events-auto transition-opacity duration-200 ${
          active ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ bottom: 'calc(max(env(safe-area-inset-bottom, 16px), 16px) + 24px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <VinylMiniPlayer className="mb-3" />

        <div className="max-w-[260px]">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTitleTap?.(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-left active:scale-95 transition-all"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <h3 className="text-sm font-semibold text-white truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {clip.parentTitle || clip.title}
            </h3>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 opacity-40">
              <path d="M4.5 2.5L7.5 6L4.5 9.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}

// Custom comparison function: only re-render when meaningful props change
function arePropsEqual(prevProps: PosterCardProps, nextProps: PosterCardProps): boolean {
  return (
    prevProps.clip.id === nextProps.clip.id &&
    prevProps.active === nextProps.active &&
    prevProps.videoReady === nextProps.videoReady &&
    prevProps.onTitleTap === nextProps.onTitleTap
  );
}

export default memo(PosterCard, arePropsEqual);
