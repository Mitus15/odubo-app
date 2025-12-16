import { queryDatabase } from '@/lib/db';
import MediaHubClient from './MediaHubClient';
import { Album } from '@/types/music';

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
    // Show all public videos (excluding clips which have their own section)
    const videos = await queryDatabase(`
      SELECT * FROM videos
      WHERE is_public = 1 
        AND (type IS NULL OR type != 'clip')
      ORDER BY created_at DESC
    `);
    return videos || [];
  } catch (error) {
    console.error('Error fetching videos:', error);
    return [];
  }
}

async function getAlbums(): Promise<Album[]> {
  try {
    const albums = await queryDatabase(`
      SELECT 
        a.*,
        COUNT(t.id) as total_tracks,
        SUM(t.duration) as total_duration
      FROM albums a
      LEFT JOIN tracks t ON a.id = t.album_id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `);
    return albums || [];
  } catch (error) {
    console.error('Error fetching albums:', error);
    return [];
  }
}

export default async function MediaPage() {
  const [videos, albums] = await Promise.all([getVideos(), getAlbums()]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden p-4 pb-6">
        <MediaHubClient videos={videos} albums={albums} />
      </div>
    </div>
  );
}
