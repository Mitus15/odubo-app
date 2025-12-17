'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { Album } from '@/types/music';

interface ForYouSectionProps {
  albums: Album[];
  type: 'music' | 'video';
}

export default function ForYouSection({ albums, type }: ForYouSectionProps) {
  const { state, playTrack } = useMusicPlayer();
  const { listenHistory } = state;

  // Get recently played albums (unique, max 6)
  const recentlyPlayed = useMemo(() => {
    if (type !== 'music' || listenHistory.length === 0) return [];

    const albumIds = new Set<number>();
    const recent: Album[] = [];

    for (const entry of listenHistory) {
      if (entry.album && !albumIds.has(entry.album.id)) {
        albumIds.add(entry.album.id);
        recent.push(entry.album);
        if (recent.length >= 6) break;
      }
    }
    return recent;
  }, [listenHistory, type]);

  // Get suggestions (albums not in recently played)
  const suggestions = useMemo(() => {
    const recentIds = new Set(recentlyPlayed.map(a => a.id));
    return albums.filter(a => !recentIds.has(a.id)).slice(0, 6);
  }, [albums, recentlyPlayed]);

  // Don't render if no content to show
  if (type === 'music' && recentlyPlayed.length === 0 && suggestions.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-6 px-4 pb-4">
      {/* Recently Played */}
      {type === 'music' && recentlyPlayed.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#843c2d] to-[#502d26]" />
            <h2 className="text-sm font-semibold text-[#ede8df] uppercase tracking-wider">
              Recently Played
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {recentlyPlayed.map((album) => (
              <Link
                key={album.id}
                href={`/music/albums/${album.id}`}
                className="flex-shrink-0 w-28 group"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-[#252221] mb-2 shadow-lg shadow-black/20">
                  {album.cover_art_url ? (
                    <Image
                      src={album.cover_art_url}
                      alt={album.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="112px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-[#502d26]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5l-10.5 3v10.553" />
                      </svg>
                    </div>
                  )}
                  {/* Play overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-[#ede8df] flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#302927] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[#ede8df] font-medium truncate">{album.title}</p>
                <p className="text-[10px] text-[#726d6c] truncate">{album.artist_name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Suggested For You */}
      {suggestions.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#9a4535] to-[#6d3224]" />
            <h2 className="text-sm font-semibold text-[#ede8df] uppercase tracking-wider">
              {type === 'music' ? 'Explore' : 'Recommended'}
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {suggestions.map((album) => (
              <Link
                key={album.id}
                href={`/music/albums/${album.id}`}
                className="flex-shrink-0 w-28 group"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-[#252221] mb-2 shadow-lg shadow-black/20">
                  {album.cover_art_url ? (
                    <Image
                      src={album.cover_art_url}
                      alt={album.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="112px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-[#502d26]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5l-10.5 3v10.553" />
                      </svg>
                    </div>
                  )}
                  {/* New badge for recent content */}
                  {album.created_at && isRecent(album.created_at) && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#843c2d] text-[8px] uppercase tracking-wider text-[#ede8df] font-medium">
                      New
                    </div>
                  )}
                </div>
                <p className="text-xs text-[#ede8df] font-medium truncate">{album.title}</p>
                <p className="text-[10px] text-[#726d6c] truncate">{album.artist_name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Coming Soon - placeholder for video recommendations */}
      {type === 'video' && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#843c2d] to-[#502d26]" />
            <h2 className="text-sm font-semibold text-[#ede8df] uppercase tracking-wider">
              For You
            </h2>
          </div>
          <div className="p-6 rounded-2xl glass-surface border border-[#502d26]/30 text-center">
            <svg className="w-10 h-10 mx-auto mb-3 text-[#502d26]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
            <p className="text-sm text-[#b2a491]">Personalized recommendations coming soon</p>
            <p className="text-xs text-[#726d6c] mt-1">We&apos;ll learn your taste as you watch</p>
          </div>
        </section>
      )}
    </div>
  );
}

// Helper: check if content is from the last 30 days
function isRecent(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 30;
}
