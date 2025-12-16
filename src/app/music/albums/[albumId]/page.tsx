import { notFound } from 'next/navigation';
import { queryDatabase } from '@/lib/db';
import { Album, Track } from '@/types/music';
import AlbumPlayer from '@/components/AlbumPlayer';
import Image from 'next/image';

export const runtime = 'edge';

interface AlbumPageProps {
  params: Promise<{
    albumId: string;
  }>;
}

async function getAlbumData(albumId: string): Promise<{ album: Album; tracks: Track[] } | null> {
  try {
    // Get album details
    const albumResult = await queryDatabase(
      'SELECT * FROM albums WHERE id = ?',
      [albumId]
    );

    if (!albumResult || albumResult.length === 0) {
      return null;
    }

    // Get tracks with credits
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

    // Parse credits for each track
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

  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);
  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
  };

  const releaseYear = album.release_date ? new Date(album.release_date).getFullYear() : null;

  return (
    <>
      {/* Liquid Glass Background with Dynamic Elements - Fixed to viewport */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#171616] via-[#302927] to-[#171616] -z-10">
        {/* Animated Glass Orbs */}
        <div className="absolute top-16 right-8 w-40 h-40 bg-gradient-to-br from-[#843c2d]/15 to-[#502d26]/15 rounded-full blur-3xl animate-pulse opacity-50"></div>
        <div className="absolute top-32 left-12 w-24 h-24 bg-gradient-to-br from-[#ede8df]/8 to-[#b2a491]/8 rounded-full blur-2xl animate-pulse opacity-40" style={{ animationDelay: '0.5s' }}></div>
        <div className="absolute bottom-40 right-16 w-32 h-32 bg-gradient-to-br from-[#726d6c]/12 to-[#502d26]/12 rounded-full blur-3xl animate-pulse opacity-35" style={{ animationDelay: '1.2s' }}></div>
        <div className="absolute bottom-20 left-8 w-36 h-36 bg-gradient-to-br from-[#302927]/20 to-[#171616]/20 rounded-full blur-3xl animate-pulse opacity-45" style={{ animationDelay: '2s' }}></div>
        
        {/* Liquid Glass Overlay */}
        <div className="absolute inset-0 backdrop-blur-[0.5px] bg-gradient-to-br from-[#171616]/10 via-transparent to-[#302927]/10"></div>
      </div>

    <div className="relative h-full overflow-hidden">

      {/* Content with Glass Morphism */}
      <div className="relative z-10">
        {/* Back Button with Liquid Glass Effect */}
        <div className="px-3 pt-1 sm:px-4 sm:pt-2">
          <a
            href="/music"
            className="inline-flex items-center gap-2 text-[#b2a491] hover:text-[#ede8df] transition-colors group glass-card p-2 rounded-xl"
            title="Back to Media"
          >
            <svg className="w-5 h-5 group-hover:transform group-hover:-translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-sm">Back to Media</span>
          </a>
        </div>

            {/* Mobile Layout - Stacked */}
      <div className="xl:hidden">
        <div className="relative px-3 pt-1 pb-3 sm:px-4 sm:pt-2 sm:pb-4">
          {/* Mobile Layout - Optimized for full viewport */}
          <div className="flex items-start space-x-3 sm:hidden">
            {/* Album Cover with Badge - Larger and more prominent */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-xl overflow-hidden shadow-xl">
                {album.cover_art_url ? (
                  <Image
                    src={album.cover_art_url}
                    alt={album.title}
                    width={128}
                    height={128}
                    sizes="(max-width: 640px) 128px, 192px"
                    className="w-full h-full object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#502d26] to-[#302927] flex items-center justify-center">
                    <svg className="w-10 h-10 text-[#726d6c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
              </div>
              {/* Badge under album cover */}
              <div className="mt-1">
                <span className="inline-block px-0.5 py-0.5 bg-[#843c2d]/20 text-[#b2a491] text-xs font-medium rounded border border-[#843c2d]/30">
                  {album.release_type?.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Album Info - Better mobile layout */}
            <div className="flex-1 min-w-0 space-y-2 pt-1">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold leading-tight text-[#ede8df] line-clamp-2">
                    {album.title}
                  </h1>
                </div>
                {Boolean(album.explicit_content) && (
                  <span className="bg-[#843c2d] text-[#ede8df] text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                    E
                  </span>
                )}
              </div>
              
              <h2 className="text-base font-semibold text-[#b2a491] line-clamp-1">
                {album.artist_name}
              </h2>

              <div className="text-sm text-[#726d6c] space-x-1 flex flex-wrap gap-1">
                {releaseYear && <span>{releaseYear}</span>}
                {album.genre && <span>• {album.genre}</span>}
                {totalDuration > 0 && <span>• {formatTotalDuration(totalDuration)}</span>}
              </div>
              
              {album.description && (
                <p className="text-sm text-[#b2a491]/80 line-clamp-2 leading-relaxed pt-1">
                  {album.description}
                </p>
              )}
            </div>
          </div>

          {/* Tablet Layout */}
          <div className="hidden sm:flex flex-col md:flex-row items-start md:items-end space-y-6 md:space-y-0 md:space-x-8 w-full mx-auto" style={{maxWidth: 'min(1280px, 92vw)'}}>
            {/* Album Cover with Badge */}
            <div className="flex-shrink-0">
              <div className="w-56 h-56 lg:w-64 lg:h-64 rounded-xl overflow-hidden shadow-2xl">
                {album.cover_art_url ? (
                  <Image
                    src={album.cover_art_url}
                    alt={album.title}
                    width={256}
                    height={256}
                    sizes="(max-width: 768px) 256px, (max-width: 1024px) 320px, 384px"
                    className="w-full h-full object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#502d26] to-[#302927] flex items-center justify-center">
                    <svg className="w-20 h-20 text-[#726d6c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
              </div>
              {/* Badge under album cover */}
              <div className="mt-2">
                <span className="inline-block px-0.5 py-0.5 bg-[#843c2d]/20 text-[#b2a491] text-xs font-medium rounded border border-[#843c2d]/30">
                  {album.release_type?.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Album Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight text-[#ede8df]">
                {album.title}
              </h1>
              
              <div className="flex items-center space-x-3 mb-4">
                <h2 className="text-xl md:text-2xl font-semibold text-[#b2a491]">
                  {album.artist_name}
              </h2>
                {Boolean(album.explicit_content) && (
                  <span className="bg-[#843c2d] text-[#ede8df] text-xs font-bold px-2 py-1 rounded">
                    E
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-[#726d6c] mb-4">
                {releaseYear && <span>{releaseYear}</span>}
                {album.genre && <span>• {album.genre}</span>}
                {totalDuration > 0 && <span>• {formatTotalDuration(totalDuration)}</span>}
              </div>

              {album.description && (
                <p className="text-[#b2a491] max-w-2xl leading-relaxed mb-4 text-base">
                  {album.description}
                </p>
              )}

              {album.record_label && (
                <p className="text-xs text-[#726d6c]">
                  ℗ {releaseYear} {album.record_label}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

        {/* Desktop Layout: 2-Column Album Details and Tracklist */}
        <div className="px-3 pb-16 sm:px-4">
          <div className="w-full mx-auto" style={{maxWidth: 'min(1280px, 92vw)'}}>
            {/* Desktop: Side-by-side layout */}
            <div className="hidden xl:grid xl:grid-cols-2 gap-6">
              {/* Left Column: Album Cover, Title, Artist, and Details */}
              <div className="space-y-4">
                {/* Album Hero Section */}
                <div className="glass-surface rounded-2xl p-4 border border-[#502d26]/30">
                  <div className="flex flex-col items-center text-center">
                    {/* Album Cover */}
                    <div className="w-40 h-40 lg:w-56 lg:h-56 rounded-xl overflow-hidden shadow-2xl mb-4">
                      {album.cover_art_url ? (
                        <Image
                          src={album.cover_art_url}
                          alt={album.title}
                          width={224}
                          height={224}
                          sizes="(max-width: 1024px) 160px, 224px"
                          className="w-full h-full object-cover"
                          priority
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#502d26] to-[#302927] flex items-center justify-center">
                          <svg className="w-16 h-16 text-[#726d6c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Album Badge */}
                    <div className="mb-3">
                      <span className="inline-block px-2 py-1 bg-[#843c2d]/20 text-[#b2a491] text-xs font-medium rounded border border-[#843c2d]/30">
                        {album.release_type?.toUpperCase()}
                      </span>
                    </div>

                    {/* Album Title */}
                    <h1 className="text-2xl lg:text-3xl font-bold mb-2 leading-tight text-[#ede8df] line-clamp-2">
                      {album.title}
                    </h1>
                    
                    {/* Artist Name */}
                    <h2 className="text-lg lg:text-xl font-semibold mb-3 text-[#b2a491] line-clamp-1">
                      {album.artist_name}
                    </h2>

                    {/* Basic Info */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#726d6c] mb-3">
                      {releaseYear && <span>{releaseYear}</span>}
                      {album.genre && <span>• {album.genre}</span>}
                      {totalDuration > 0 && <span>• {formatTotalDuration(totalDuration)}</span>}
                    </div>

                    {/* Explicit Content Badge */}
                    {Boolean(album.explicit_content) && (
                      <div className="mb-3">
                        <span className="bg-[#843c2d] text-[#ede8df] text-xs font-bold px-2 py-1 rounded">
                          E
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    {album.description && (
                      <p className="text-[#b2a491] leading-relaxed text-xs line-clamp-3">
                        {album.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Album Stats and Info */}
                <div className="glass-surface rounded-2xl p-4 border border-[#502d26]/30">
                  <h3 className="text-lg font-bold text-[#ede8df] mb-3">Album Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-[#b2a491]">Type:</span>
                      <span className="text-[#ede8df] capitalize">{album.release_type}</span>
                    </div>
                    {album.release_date && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#b2a491]">Date:</span>
                        <span className="text-[#ede8df]">{new Date(album.release_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {album.genre && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#b2a491]">Genre:</span>
                        <span className="text-[#ede8df]">{album.genre}</span>
                      </div>
                    )}
                    {album.subgenre && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#b2a491]">Subgenre:</span>
                        <span className="text-[#ede8df]">{album.subgenre}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-[#b2a491]">Tracks:</span>
                      <span className="text-[#ede8df]">{tracks.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#b2a491]">Duration:</span>
                      <span className="text-[#ede8df]">{formatTotalDuration(totalDuration)}</span>
                    </div>
                    {album.record_label && (
                      <div className="flex justify-between items-center col-span-2">
                        <span className="text-[#b2a491]">Label:</span>
                        <span className="text-[#ede8df]">{album.record_label}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Copyright Info */}
                {album.record_label && (
                  <div className="glass-surface rounded-2xl p-3 border border-[#502d26]/30">
                    <p className="text-xs text-[#726d6c] text-center">
                      ℗ {releaseYear} {album.record_label}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Tracklist */}
              <div>
                <AlbumPlayer album={album} tracks={tracks} />
              </div>
            </div>

            {/* Mobile: Stacked layout */}
            <div className="xl:hidden">
              <AlbumPlayer album={album} tracks={tracks} />
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// Generate metadata for the page
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
    description: album.description || `Listen to ${album.title} by ${album.artist_name}`,
    openGraph: {
      title: `${album.title} - ${album.artist_name}`,
      description: album.description || `Listen to ${album.title} by ${album.artist_name}`,
      images: album.cover_art_url ? [album.cover_art_url] : [],
    },
  };
}
