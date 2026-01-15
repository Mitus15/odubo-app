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
          <h2 className="text-2xl font-bold text-[#ede8df]">Albums ({albums.length})</h2>
          <p className="text-[#b2a491]">Manage your music catalog</p>
        </div>

        <AlbumCreationForm />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {albums.map((album) => (
          <div key={album.id} className="bg-[#1a1614] rounded-lg p-4 hover:bg-[#252220] transition-colors border border-[#302927]">
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
                <div className="w-20 h-20 bg-[#302927] rounded-md flex items-center justify-center">
                  <span className="text-xs text-[#726d6c]">No Cover</span>
                </div>
              )}

              <div className="flex-1">
                <h3 className="font-bold text-lg text-[#ede8df]">{album.title}</h3>
                <p className="text-sm text-[#b2a491]">{album.artist_name}</p>
                <p className="text-sm text-[#726d6c] capitalize">{album.release_type}</p>
                {album.release_date && (
                  <p className="text-sm text-[#726d6c]">{new Date(album.release_date).getFullYear()}</p>
                )}
                <div className="flex items-center space-x-2 mt-2">
                  {album.featured && (
                    <span className="inline-block bg-[#843c2d] text-xs px-2 py-1 rounded text-white">
                      Featured
                    </span>
                  )}
                  {album.explicit_content && (
                    <span className="inline-block bg-[#502d26] text-xs px-2 py-1 rounded text-[#e8a592]">
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
          <p className="text-[#b2a491] text-lg">No albums found</p>
          <p className="text-[#726d6c]">Create your first album to get started</p>
        </div>
      )}
    </div>
  );
}
