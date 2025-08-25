import { queryDatabase } from '@/lib/db';
import { notFound } from "next/navigation";
import { Video } from "../types";
import VideoPlayerClient from "../../../components/VideoPlayerClient";
import Image from 'next/image';

interface VideoPageProps {
  params: Promise<{ videoId: string }>;
}

async function getVideo(id: string): Promise<Video | null> {
  try {
    const videos = await queryDatabase(`
      SELECT * FROM videos WHERE id = ?
    `, [id]);
    
    const video = videos[0];
    if (!video) return null;
    
    // Transform database video to match expected Video type
    return {
      id: video.id,
      title: video.title || '',
      description: video.description || '',
      url: video.url || '',
      poster_url: video.poster_url || '',
      thumbnail: video.thumbnail || '',
      duration: video.duration || '',
      category: video.category || '',
      is_public: Boolean(video.is_public),
      type: video.type || 'short film',
      mood: video.mood || 'neutral',
      credits: video.credits ? JSON.parse(video.credits) : [],
      related_projects: video.related_projects ? JSON.parse(video.related_projects) : [],
      created_at: video.created_at
    };
  } catch (error) {
    console.error('Error fetching video:', error);
    return null;
  }
}

async function getRelatedVideos(currentVideo: Video): Promise<Video[]> {
  try {
    const videos = await queryDatabase(`
      SELECT * FROM videos 
      WHERE id != ? 
      AND (type = ? OR category = ? OR mood = ?)
      ORDER BY created_at DESC
      LIMIT 6
    `, [currentVideo.id, currentVideo.type, currentVideo.category, currentVideo.mood]);
    
    // Transform database videos to match expected Video type
    return videos.map((video: any) => ({
      id: video.id,
      title: video.title || '',
      description: video.description || '',
      url: video.url || '',
      poster_url: video.poster_url || '',
      thumbnail: video.thumbnail || '',
      duration: video.duration || '',
      category: video.category || '',
      is_public: Boolean(video.is_public),
      type: video.type || 'short film',
      mood: video.mood || 'neutral',
      credits: video.credits ? JSON.parse(video.credits) : [],
      related_projects: video.related_projects ? JSON.parse(video.related_projects) : [],
      created_at: video.created_at
    }));
  } catch (error) {
    console.error("Error fetching related videos:", error);
    return [];
  }
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { videoId } = await params;
  
  // Fetch the video data
  const video = await getVideo(videoId);
  
  if (!video) {
    notFound();
  }

  // Fetch related videos
  const relatedVideos = await getRelatedVideos(video);

  return (
    <div className="relative w-full h-full">
      {/* Immersive Background */}
      {video.poster_url && (
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <Image
            src={video.poster_url}
            alt="Background"
            fill
            className="object-cover opacity-20 blur-3xl scale-110"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#171616]/80 via-[#171616]/90 to-[#302927]/80" />
        </div>
      )}
      <VideoPlayerClient 
        video={video} 
        relatedVideos={relatedVideos}
      />
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: VideoPageProps) {
  const { videoId } = await params;
  const video = await getVideo(videoId);

  if (!video) {
    return {
      title: 'Video Not Found',
      description: 'The requested video could not be found.',
    };
  }

  return {
    title: `${video.title} | Odubo Studio`,
    description: video.description,
    openGraph: {
      title: video.title,
      description: video.description,
      images: video.poster_url ? [video.poster_url] : [],
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title: video.title,
      description: video.description,
      images: video.poster_url ? [video.poster_url] : [],
    },
  };
}
