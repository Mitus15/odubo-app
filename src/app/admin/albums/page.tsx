import AlbumsClientWrapper from './AlbumsClientWrapper';
import { queryDatabase } from '@/lib/db';

async function getAlbums() {
  try {
    const albums = await queryDatabase('SELECT * FROM albums ORDER BY created_at DESC');
    return albums;
  } catch (error) {
    console.error('Error fetching albums:', error);
    return [];
  }
}

export default async function AdminAlbumsPage() {
  const albums = await getAlbums();

  return (
    <div className="w-full text-white pt-16 pb-20">
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Music Management</h1>
          <p className="text-gray-400">Create albums and upload tracks in one workflow</p>
        </div>
        
        <AlbumsClientWrapper albums={albums} />
      </div>
    </div>
  );
}
