"use client";
import dynamic from 'next/dynamic';

const VideoLibrary = dynamic(() => import('@/components/VideoLibrary'), {
  ssr: false,
  loading: () => null,
});

export default function VideoLibraryClientWrapper({ videos }: { videos: any[] }) {
  return <VideoLibrary videos={videos} />;
}
