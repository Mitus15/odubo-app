"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import VideoLibraryClientWrapper from './VideoLibraryClientWrapper';
import MusicLibraryClientWrapper from '../music/MusicLibraryClientWrapper';
import type { Album } from '@/types/music';

type Video = {
  id: number;
  title: string;
  description: string;
  url: string;
  poster_url?: string;
  thumbnail?: string;
  duration?: string;
  category?: string;
  type?: string;
  mood?: string;
  credits?: string;
  created_at: string;
};

export default function MediaHubClient({ videos, albums }: { videos: Video[]; albums: Album[] }) {
  const tabs: Array<{ key: 'videos' | 'music'; label: string }> = useMemo(
    () => [
      { key: 'videos', label: 'Video' },
      { key: 'music', label: 'Music' },
    ],
    []
  );

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const initialTab = (() => {
    const tabParam = searchParams.get('tab');
    return tabParam === 'music' || tabParam === 'videos' ? tabParam : 'videos';
  })();

  const [active, setActive] = useState<'videos' | 'music'>(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'music' || tabParam === 'videos') {
      setActive(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'videos' | 'music') => {
    setActive(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center gap-2 bg-[#120f0f]/80 border border-[#2b1b18]/60 rounded-2xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl w-full max-w-md mx-auto">
        {tabs.map(tab => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#a44e3a] via-[#843c2d] to-[#52241d] text-[#f8f2ea] shadow-[0_10px_32px_rgba(132,60,45,0.45)] border border-[#c58a70]/40'
                  : 'text-[#c7b8a8] hover:text-[#f8f2ea] hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 relative rounded-2xl border border-[#2b1b18]/50 bg-gradient-to-br from-[#0e0b0b]/80 via-[#120f0f]/70 to-[#1a0f0c]/80 backdrop-blur-2xl shadow-[0_16px_60px_rgba(0,0,0,0.55)]">
        {active === 'videos' ? (
          <VideoLibraryClientWrapper videos={videos} />
        ) : (
          <MusicLibraryClientWrapper albums={albums} />
        )}
      </div>
    </div>
  );
}