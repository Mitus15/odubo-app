"use client";

import { memo } from 'react';
import Image from 'next/image';
import VinylMiniPlayer from '../player/VinylMiniPlayer';
import ClipFlip from '@/components/clips/ClipFlip';
import type { ClipItem } from '@/types/clips';

interface PosterCardProps {
  clip: ClipItem;
  active: boolean;
  videoReady?: boolean; // Only fade when video is actually ready
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
function PosterCard({ clip, active, videoReady = false }: PosterCardProps) {
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

      {/* Bottom-left: the film flip (Loop Soul clips) above the vinyl, in one
          column so the two can never overlap. The column sits 12px above the
          feed's title panel (ClipsFeed's GlassPanel: 48px tall on this same
          safe-area bottom), and the flip stops 88px short of the right edge,
          clear of the logo button's 56px column. Visible, and tappable, only
          while this clip is active. */}
      <div
        className={`absolute left-4 z-20 flex flex-col items-start gap-3 transition-opacity duration-200 ${
          active ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 16px) + 60px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {clip.card?.flip && (
          <ClipFlip
            card={clip.card}
            chapter={clip.filmChapter}
            style={{ maxWidth: 'min(calc(100vw - 104px), 28rem)' }}
          />
        )}
        <VinylMiniPlayer />
      </div>

    </div>
  );
}

// Custom comparison function: only re-render when meaningful props change
function arePropsEqual(prevProps: PosterCardProps, nextProps: PosterCardProps): boolean {
  return (
    prevProps.clip.id === nextProps.clip.id &&
    prevProps.active === nextProps.active &&
    prevProps.videoReady === nextProps.videoReady
  );
}

export default memo(PosterCard, arePropsEqual);
