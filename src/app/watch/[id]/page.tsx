import { queryDatabase } from '@/lib/db';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import WatchPageClient from './WatchPageClient';

export const runtime = 'edge';

interface WatchPageProps {
  params: Promise<{ id: string }>;
}

interface WatchVideo {
  id: number;
  uid: string | null;
  title: string;
  description: string | null;
  url: string | null;
  poster_url: string | null;
  duration: string | null;
  category: string | null;
  type: string | null;
  credits: Array<{ name: string; role: string }>;
}

async function getVideo(id: string): Promise<WatchVideo | null> {
  try {
    const rows = await queryDatabase(
      `SELECT id, uid, title, description, url, poster_url, duration, category, type, credits
       FROM videos WHERE id = ?`,
      [id]
    );
    const v = rows[0];
    if (!v) return null;
    return {
      id: v.id,
      uid: v.uid || null,
      title: v.title || '',
      description: v.description || null,
      url: v.url || null,
      poster_url: v.poster_url || null,
      duration: v.duration || null,
      category: v.category || null,
      type: v.type || null,
      credits: v.credits ? JSON.parse(v.credits) : [],
    };
  } catch {
    return null;
  }
}

async function getMoreVideos(excludeId: number): Promise<WatchVideo[]> {
  try {
    const rows = await queryDatabase(
      `SELECT id, uid, title, url, poster_url, category, type, credits
       FROM videos
       WHERE id != ?
         AND publication_status = 'live'
       ORDER BY created_at DESC
       LIMIT 6`,
      [excludeId]
    );
    return rows.map((v: any) => ({
      id: v.id,
      uid: v.uid || null,
      title: v.title || '',
      description: null,
      url: v.url || null,
      poster_url: v.poster_url || null,
      duration: null,
      category: v.category || null,
      type: v.type || null,
      credits: [],
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: WatchPageProps): Promise<Metadata> {
  const { id } = await params;
  const video = await getVideo(id);
  if (!video) return { title: 'Watch | Odubo Studio' };

  return {
    title: `${video.title} | Odubo Studio`,
    description: video.description || `Watch ${video.title} by Odubo Studio`,
    openGraph: {
      title: video.title,
      description: video.description || `Watch ${video.title}`,
      images: video.poster_url ? [{ url: video.poster_url }] : [],
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title: video.title,
      description: video.description || `Watch ${video.title}`,
      images: video.poster_url ? [video.poster_url] : [],
    },
  };
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params;
  const video = await getVideo(id);
  if (!video) notFound();

  const moreVideos = await getMoreVideos(video.id);

  return <WatchPageClient video={video} moreVideos={moreVideos} />;
}
