import { queryDatabase } from '@/lib/db';
import MusicLibraryClientWrapper from './MusicLibraryClientWrapper';
import { Album } from '@/types/music';

export const revalidate = 300; // 5 minutes

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
    return albums;
  } catch (error) {
    console.error('Error fetching albums:', error);
    return [];
  }
}

export default async function MusicPage() {
  const albums = await getAlbums();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
      <div className="relative z-10 flex-1 overflow-hidden">
        {/* Removed test audio player in production */}
        <div className="h-full pt-3 sm:pt-4">
          <MusicLibraryClientWrapper albums={albums} />
        </div>
      </div>
    </div>
  );
}
