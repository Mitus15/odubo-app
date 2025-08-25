import { notFound } from 'next/navigation';
import { queryDatabase } from '@/lib/db';
import AlbumEditClient from '@/components/AlbumEditClient';

export const runtime = 'edge';

async function getAlbumWithTracks(albumId: string) {
  try {
    // Get album data
    const albums = await queryDatabase('SELECT * FROM albums WHERE id = ?', [albumId]);
    if (albums.length === 0) {
      return null;
    }

    // Get tracks with credits
    const tracks = await queryDatabase(`
      SELECT t.*, 
             GROUP_CONCAT(
               CASE WHEN tc.id IS NOT NULL 
               THEN json_object('id', tc.id, 'role', tc.role, 'name', tc.name, 'is_featured', tc.is_featured) 
               END
             ) as credits_json
      FROM tracks t
      LEFT JOIN track_credits tc ON t.id = tc.track_id
      WHERE t.album_id = ?
      GROUP BY t.id 
      ORDER BY t.track_number ASC
    `, [albumId]);

    // Parse credits JSON for each track
    const tracksWithCredits = tracks.map((track: any) => ({
      ...track,
      credits: track.credits_json ? 
        track.credits_json.split(',').map((creditStr: string) => {
          try {
            return JSON.parse(creditStr);
          } catch {
            return null;
          }
        }).filter(Boolean) : []
    }));

    return {
      album: albums[0],
      tracks: tracksWithCredits
    };
  } catch (error) {
    console.error('Error fetching album:', error);
    return null;
  }
}

export default async function AlbumEditPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const data = await getAlbumWithTracks(id);

  if (!data) {
    notFound();
  }

  return <AlbumEditClient album={data.album} tracks={data.tracks} />;
}
