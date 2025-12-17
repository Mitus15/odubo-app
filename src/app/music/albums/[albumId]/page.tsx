import { notFound } from 'next/navigation';
import { queryDatabase } from '@/lib/db';
import { Album, Track } from '@/types/music';
import AlbumPlayer from '@/components/AlbumPlayer';
import Image from 'next/image';
import Link from 'next/link';

export const runtime = 'edge';

interface AlbumPageProps {
  params: Promise<{
    albumId: string;
  }>;
}

async function getAlbumData(albumId: string): Promise<{ album: Album; tracks: Track[] } | null> {
  try {
    const albumResult = await queryDatabase(
      'SELECT * FROM albums WHERE id = ?',
      [albumId]
    );

    if (!albumResult || albumResult.length === 0) {
      return null;
    }

    const tracksResult = await queryDatabase(`
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

    const tracks = tracksResult.map((track: any) => ({
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
      album: albumResult[0],
      tracks
    };
  } catch (error) {
    console.error('Error fetching album data:', error);
    return null;
  }
}

export default async function AlbumPage({ params }: AlbumPageProps) {
  const { albumId } = await params;
  const albumData = await getAlbumData(albumId);

  if (!albumData) {
    notFound();
  }

  const { album, tracks } = albumData;

  return (
    <div className="min-h-full bg-gradient-to-br from-[#171616] via-[#302927] to-[#171616]">
      {/* Back */}
      <div className="p-4">
        <Link
          href="/music"
          className="text-[#726d6c] hover:text-[#b2a491] transition-colors inline-block"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>

      <div className="px-4 pb-24">
        <div className="max-w-2xl mx-auto">
          {/* Album Header */}
          <div className="flex items-start gap-4 mb-6">
            {/* Cover */}
            <div className="w-28 h-28 sm:w-36 sm:h-36 flex-shrink-0 rounded-xl overflow-hidden border border-[#502d26]/20">
              {album.cover_art_url ? (
                <Image
                  src={album.cover_art_url}
                  alt={album.title}
                  width={144}
                  height={144}
                  className="w-full h-full object-cover"
                  priority
                />
              ) : (
                <div className="w-full h-full bg-[#1a1615] flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5l-10.5 3v10.553m0-10.553v10.553" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-2">
              <h1 className="text-xl sm:text-2xl font-semibold text-[#ede8df] line-clamp-2">
                {album.title}
              </h1>
              <p className="text-sm text-[#b2a491] mt-1">
                {album.artist_name}
              </p>
              {album.release_date && (
                <p className="text-xs text-[#726d6c] mt-2">
                  {new Date(album.release_date).getFullYear()}
                </p>
              )}
            </div>
          </div>

          {/* Player */}
          <AlbumPlayer album={album} tracks={tracks} />
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: AlbumPageProps) {
  const { albumId } = await params;
  const albumData = await getAlbumData(albumId);

  if (!albumData) {
    return {
      title: 'Album Not Found',
    };
  }

  const { album } = albumData;

  return {
    title: `${album.title} - ${album.artist_name}`,
    description: `Listen to ${album.title} by ${album.artist_name}`,
    openGraph: {
      title: `${album.title} - ${album.artist_name}`,
      description: `Listen to ${album.title} by ${album.artist_name}`,
      images: album.cover_art_url ? [album.cover_art_url] : [],
    },
  };
}
