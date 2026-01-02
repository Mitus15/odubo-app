"use client";

import { useOmniShop } from '@/contexts/OmniShopContext';
import VinylMiniPlayer from '../player/VinylMiniPlayer';
import type { ClipItem } from '@/types/clips';

interface PosterCardProps {
  clip: ClipItem;
  active: boolean;
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
 */
export default function PosterCard({ clip, active }: PosterCardProps) {
  const { storeAccessible } = useOmniShop();

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none transition-colors duration-300 ${
        active ? 'bg-transparent' : 'bg-black'
      }`}
      style={{ touchAction: 'pan-y', WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      {/* Poster image - always visible in scroll layer */}
      {clip.poster && (
        <img
          src={clip.poster}
          alt=""
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300 ${
            active ? 'opacity-0' : 'opacity-100'
          }`}
          loading="lazy"
        />
      )}

      {/* Gradient overlay - hide when active to reveal video */}
      <div
        className={`absolute inset-x-0 bottom-0 h-48 pointer-events-none transition-opacity duration-300 ${
          active ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)'
        }}
      />

      {/* Bottom-left: Title & info */}
      <div
        className="absolute left-4 z-20 pointer-events-auto"
        style={{ bottom: 'calc(max(env(safe-area-inset-bottom, 16px), 16px) + 24px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <VinylMiniPlayer className="mb-3" />

        <div className="max-w-[240px]">
          {clip.productHandle && (
            <div className="flex items-center gap-1.5 mb-1">
              {storeAccessible ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  <span className="text-[9px] font-medium text-emerald-400 uppercase tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Shop</span>
                </>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
              )}
            </div>
          )}
          <h3 className="text-sm font-semibold text-white truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {clip.title}
          </h3>
        </div>
      </div>
    </div>
  );
}
