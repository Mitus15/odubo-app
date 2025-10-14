import { queryDatabase } from '@/lib/db';
import VideoLibraryClientWrapper from './VideoLibraryClientWrapper';

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
      ORDER BY created_at DESC
    `);
    return videos || [];
  } catch (error) {
    console.error('Error fetching videos:', error);
    // Return empty array to show empty state instead of breaking
    return [];
  }
}

export default async function MediaPage() {
  const videos = await getVideos();

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden p-4">
        <VideoLibraryClientWrapper videos={videos} />
      </div>
    </div>
  );
}
