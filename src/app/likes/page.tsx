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
    <div className="flex flex-col h-full min-h-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      {/* Header (fixed within layout) */}
      <div className="flex-shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-pink-600/20"></div>
        <div className="relative px-4 py-8 sm:py-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-full mb-6">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Your Likes
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
              All your favorite music, albums, and videos in one place.
            </p>
            <div className="mt-6 sm:mt-8 flex items-center justify-center space-x-6 sm:space-x-8 text-sm text-gray-400">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                {likes.tracks.length} Tracks
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                {likes.albums.length} Albums
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                {likes.videos.length} Videos
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
