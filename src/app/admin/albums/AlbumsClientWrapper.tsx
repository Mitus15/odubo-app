"use client";
import dynamic from 'next/dynamic';
import { Album } from '@/types/music';

const AlbumsClient = dynamic(() => import('@/components/AlbumsClient'));

export default function AlbumsClientWrapper({ albums }: { albums: Album[] }) {
  return <AlbumsClient albums={albums} />;
}
