"use client";

import { Suspense, useEffect, useState } from 'react';
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

function MediaHubClientInner({ videos, albums }: { videos: Video[]; albums: Album[] }) {
  const tabs = [
    { key: 'videos' as const, label: 'Video' },
    { key: 'music' as const, label: 'Music' },
  ];

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const initialTab = (() => {
    const tabParam = searchParams?.get('tab');
    return tabParam === 'music' || tabParam === 'videos' ? tabParam : 'videos';
  })();

  const [active, setActive] = useState<'videos' | 'music'>(initialTab);

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'music' || tabParam === 'videos') {
      setActive(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'videos' | 'music') => {
    setActive(tab);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex-shrink-0 px-4 py-4">
        <div className="inline-flex p-1 rounded-xl bg-[#1a1918]/80 border border-[#502d26]/30 backdrop-blur-sm">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                active === tab.key
                  ? 'bg-gradient-to-r from-[#843c2d] via-[#9a4535] to-[#6d3224] text-[#f8f2ea] shadow-lg shadow-[#843c2d]/25'
                  : 'text-[#b2a491] hover:text-[#ede8df] hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 relative">
        {active === 'videos' ? (
          <VideoLibraryClientWrapper videos={videos} />
        ) : (
          <MusicLibraryClientWrapper albums={albums} />
        )}
      </div>
    </div>
  );
}

export default function MediaHubClient({ videos, albums }: { videos: Video[]; albums: Album[] }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-[#502d26]/30 border-t-[#726d6c] rounded-full animate-spin" />
      </div>
    }>
      <MediaHubClientInner videos={videos} albums={albums} />
    </Suspense>
  );
}
