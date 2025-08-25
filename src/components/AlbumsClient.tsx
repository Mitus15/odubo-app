'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Album } from '@/types/music';
import AlbumActions from './AlbumActions';
import AlbumCreationForm from './AlbumCreationForm';

interface AlbumsClientProps {
  albums: Album[];
}

export default function AlbumsClient({ albums: initialAlbums }: AlbumsClientProps) {
  const [albums, setAlbums] = useState<Album[]>(initialAlbums);

  const handleAlbumUpdate = (updatedAlbum: Album) => {
    setAlbums(prevAlbums => 
      prevAlbums.map(album => 
        album.id === updatedAlbum.id ? updatedAlbum : album
      )
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Albums ({albums.length})</h2>
          <p className="text-gray-400">Manage your music catalog</p>
        </div>
        
        <AlbumCreationForm />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {albums.map((album) => (
          <div key={album.id} className="bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition-colors">
            <div className="flex items-start space-x-4">
              {album.cover_art_url ? (
                <Image
                  src={album.cover_art_url}
                  alt={album.title}
                  width={80}
                  height={80}
                  className="rounded-md object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-700 rounded-md flex items-center justify-center">
                  <span className="text-xs text-gray-400">No Cover</span>
                </div>
              )}
              
              <div className="flex-1">
                <h3 className="font-bold text-lg">{album.title}</h3>
                <p className="text-sm text-gray-400">{album.artist_name}</p>
                <p className="text-sm text-gray-500 capitalize">{album.release_type}</p>
                {album.release_date && (
                  <p className="text-sm text-gray-500">{new Date(album.release_date).getFullYear()}</p>
                )}
                <div className="flex items-center space-x-2 mt-2">
                  {album.featured && (
                    <span className="inline-block bg-yellow-600 text-xs px-2 py-1 rounded">
                      Featured
                    </span>
                  )}
                  {album.explicit_content && (
                    <span className="inline-block bg-red-600 text-xs px-2 py-1 rounded">
                      Explicit
                    </span>
                  )}
                </div>
              </div>
              
              <AlbumActions album={album} onAlbumUpdate={handleAlbumUpdate} />
            </div>
          </div>
        ))}
      </div>

      {albums.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No albums found</p>
          <p className="text-gray-500">Create your first album to get started</p>
        </div>
      )}
    </div>
  );
}
