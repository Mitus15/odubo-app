import { Suspense } from 'react';
import { queryDatabase } from '@/lib/db';
import MediaHubClient from './MediaHubClient';
import type { Album } from '@/types/music';
import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Media',
  description: 'Watch exclusive videos, listen to albums, and explore the full Odubo media library.',
  path: '/media',
});

export const revalidate = 300; // 5 minutes

interface Video {
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
}

async function getVideos(): Promise<Video[]> {
  try {
    const videos = await queryDatabase(`
      SELECT * FROM videos
      WHERE is_public = 1
        AND status = 'published'
        AND publication_status = 'live'
        AND type != 'clip'
      ORDER BY created_at DESC
    `);
    return videos || [];
  } catch (error) {
    console.error('Error fetching videos:', error);
    // Return empty array to show empty state instead of breaking
    return [];
  }
}

async function getAlbums(): Promise<Album[]> {
  try {
    const albums = await queryDatabase('SELECT * FROM albums ORDER BY created_at DESC');
    return albums || [];
  } catch (error) {
    console.error('Error fetching albums:', error);
    return [];
  }
}

export default async function MediaPage() {
  const [videos, albums] = await Promise.all([getVideos(), getAlbums()]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927]">
      {/* Ambient light effects */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#843c2d]/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#b2a491]/6 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-[#502d26]/10 rounded-full blur-[60px]" />
      </div>

      <div className="relative z-10 flex-1 min-h-0 overflow-hidden p-4">
        <MediaHubClient videos={videos} albums={albums} />
      </div>
    </div>
  );
}
