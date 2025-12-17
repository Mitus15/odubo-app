import { queryDatabase } from '@/lib/db';
import UserLikesClient from '../../components/UserLikesClient';
import { Album, Track } from '@/types/music';

// This would normally get the user ID from authentication
// For demo purposes, we're using a hardcoded user ID
const DEMO_USER_ID = 'demo-user';

async function getUserLikes() {
  try {
    // Get liked tracks
    const likedTracks = await queryDatabase(`
      SELECT t.*, a.title as album_title, a.artist_name, a.cover_art_url,
             utl.liked_at,
             GROUP_CONCAT(
               CASE WHEN tc.id IS NOT NULL
               THEN json_object('id', tc.id, 'role', tc.role, 'name', tc.name, 'is_featured', tc.is_featured)
               END
             ) as credits_json
      FROM user_track_likes utl
      JOIN tracks t ON utl.track_id = t.id
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_credits tc ON t.id = tc.track_id
      WHERE utl.user_id = ?
      GROUP BY t.id
      ORDER BY utl.liked_at DESC
    `, [DEMO_USER_ID]);

    // Get liked albums
    const likedAlbums = await queryDatabase(`
      SELECT a.*, ual.liked_at,
             COUNT(t.id) as total_tracks,
             SUM(t.duration) as total_duration
      FROM user_album_likes ual
      JOIN albums a ON ual.album_id = a.id
      LEFT JOIN tracks t ON a.id = t.album_id
      WHERE ual.user_id = ?
      GROUP BY a.id
      ORDER BY ual.liked_at DESC
    `, [DEMO_USER_ID]);

    // Get liked videos (films)
    const likedVideos = await queryDatabase(`
      SELECT f.*, uvl.liked_at
      FROM user_video_likes uvl
      JOIN films f ON uvl.video_id = f.id
      WHERE uvl.user_id = ?
      ORDER BY uvl.liked_at DESC
    `, [DEMO_USER_ID]);

    // Parse credits for tracks
    const processedTracks = likedTracks.map((track: any) => ({
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
      tracks: processedTracks,
      albums: likedAlbums,
      videos: likedVideos
    };
  } catch (error) {
    console.error('Error fetching user likes:', error);
    return {
      tracks: [],
      albums: [],
      videos: []
    };
  }
}

export default async function LikesPage() {
  const likes = await getUserLikes();

  return (
    <div className="flex flex-col h-full min-h-0 bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] text-[#ede8df]">
      {/* Header - warm glass with subtle glow */}
      <div className="flex-shrink-0 relative overflow-hidden">
        {/* Ambient light effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#843c2d]/15 via-transparent to-[#502d26]/15" />
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-[#843c2d]/10 rounded-full blur-3xl" />
        <div className="absolute top-0 right-1/4 w-48 h-48 bg-[#b2a491]/8 rounded-full blur-3xl" />

        <div className="relative px-4 py-8 sm:py-12">
          <div className="text-center">
            {/* Heart icon - warm glass treatment */}
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 glass-surface border border-[#843c2d]/30 rounded-full mb-6 shadow-[0_0_40px_rgba(132,60,45,0.2)]">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-[#843c2d]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-medium mb-4 text-[#ede8df] tracking-wide">
              Your Likes
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-[#b2a491] max-w-2xl mx-auto font-light tracking-wide">
              All your favorite music, albums, and videos in one place.
            </p>

            {/* Stats - warm glass pills */}
            <div className="mt-6 sm:mt-8 flex items-center justify-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2 px-3 py-1.5 glass-surface border border-[#502d26]/30 rounded-full">
                <div className="w-2 h-2 bg-[#843c2d] rounded-full shadow-[0_0_8px_rgba(132,60,45,0.5)]" />
                <span className="text-xs text-[#b2a491]">{likes.tracks.length} Tracks</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 glass-surface border border-[#502d26]/30 rounded-full">
                <div className="w-2 h-2 bg-[#b2a491] rounded-full shadow-[0_0_8px_rgba(178,164,145,0.4)]" />
                <span className="text-xs text-[#b2a491]">{likes.albums.length} Albums</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 glass-surface border border-[#502d26]/30 rounded-full">
                <div className="w-2 h-2 bg-[#ede8df] rounded-full shadow-[0_0_8px_rgba(237,232,223,0.3)]" />
                <span className="text-xs text-[#b2a491]">{likes.videos.length} Videos</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Likes Content (scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollable-container px-4 pb-8">
        <div className="max-w-7xl mx-auto">
          <UserLikesClient
            tracks={likes.tracks}
            albums={likes.albums}
            videos={likes.videos}
          />
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Your Likes - Odubo',
  description: 'Your favorite music, albums, and videos',
};
