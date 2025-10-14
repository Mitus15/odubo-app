"use client";
import dynamic from 'next/dynamic';
import { Album } from '@/types/music';

const MusicLibrary = dynamic(() => import('@/components/MusicLibrary'), {
  ssr: false,
  loading: () => null,
});

export default function MusicLibraryClientWrapper({ albums }: { albums: Album[] }) {
  return <MusicLibrary albums={albums} />;
}
