import { Suspense } from 'react';
import TracksClient from '@/components/TracksClient';
import { queryDatabase } from '@/lib/db';

async function getTracks() {
  try {
    const tracks = await queryDatabase('SELECT * FROM tracks ORDER BY created_at DESC');
    return tracks;
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return [];
  }
}

async function getAlbums() {
  try {
    const albums = await queryDatabase('SELECT id, title, artist_name FROM albums ORDER BY title');
    return albums;
  } catch (error) {
    console.error('Error fetching albums:', error);
    return [];
  }
}

export default async function AdminTracksPage() {
  const [tracks, albums] = await Promise.all([getTracks(), getAlbums()]);

  return (
    <div className="w-full text-white">
      <div className="container mx-auto px-4 py-8">
        
        <div className="mt-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Track Management</h1>
          </div>
          
          <Suspense fallback={
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
            </div>
          }>
            <TracksClient initialTracks={tracks} albums={albums} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
