"use client";
import dynamic from 'next/dynamic';
import { Video } from '../types';

const VideoPlayerClient = dynamic(() => import('../../../components/VideoPlayerClient'), {
  ssr: false,
  loading: () => null,
});

export default function VideoPlayerClientWrapper({ video, relatedVideos }: { video: Video; relatedVideos: Video[] }) {
  return <VideoPlayerClient video={video} relatedVideos={relatedVideos} />;
}
