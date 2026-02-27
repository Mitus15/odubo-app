import { queryDatabase } from '@/lib/db';
import { Metadata } from 'next';
import NowPageClient from './NowPageClient';

export const runtime = 'edge';

export const metadata: Metadata = {
  title: 'Odubo Studio',
  description: 'Music, film, and fashion. Explore the full catalog.',
  openGraph: {
    title: 'Odubo Studio',
    description: 'Music, film, and fashion. Explore the full catalog.',
    type: 'website',
  },
};

export interface ShowcaseVideo {
  id: number;
  title: string;
  poster_url: string;
  youtube_url: string | null;
  category: string | null;
  type: string | null;
}

export interface ContentStats {
  videoCount: number;
  albumCount: number;
  trackCount: number;
}

export interface SocialLink {
  id: number;
  title: string;
  url: string;
  platform: string;
}

async function getShowcaseVideos(featuredId: number | null): Promise<ShowcaseVideo[]> {
  try {
    const rows = await queryDatabase(
      `SELECT v.id, v.title, v.poster_url, v.youtube_url, v.category, v.type,
              vd.external_url as deployment_youtube_url
       FROM videos v
       LEFT JOIN video_deployments vd
         ON vd.video_id = v.id AND vd.platform = 'youtube' AND vd.external_url IS NOT NULL
       WHERE v.parent_video_id IS NULL
         AND v.publication_status = 'live'
         AND v.poster_url IS NOT NULL
       GROUP BY v.id
       ORDER BY v.created_at DESC`,
      []
    ) as any[];

    const videos: ShowcaseVideo[] = rows.map((v: any) => ({
      id: v.id,
      title: v.title || '',
      poster_url: v.poster_url,
      youtube_url: v.youtube_url || v.deployment_youtube_url || null,
      category: v.category || null,
      type: v.type || null,
    }));

    // Put featured video first
    if (featuredId) {
      const idx = videos.findIndex(v => v.id === featuredId);
      if (idx > 0) {
        const [featured] = videos.splice(idx, 1);
        videos.unshift(featured);
      }
    }

    return videos;
  } catch {
    return [];
  }
}

async function getContentStats(): Promise<ContentStats> {
  try {
    const rows = await queryDatabase(
      `SELECT
        (SELECT COUNT(*) FROM videos WHERE parent_video_id IS NULL AND publication_status = 'live') as video_count,
        (SELECT COUNT(*) FROM albums) as album_count,
        (SELECT COUNT(*) FROM tracks) as track_count`,
      []
    ) as any[];
    const r = rows[0];
    return {
      videoCount: r?.video_count || 0,
      albumCount: r?.album_count || 0,
      trackCount: r?.track_count || 0,
    };
  } catch {
    return { videoCount: 0, albumCount: 0, trackCount: 0 };
  }
}

async function getSocialLinks(): Promise<SocialLink[]> {
  try {
    const rows = await queryDatabase(
      `SELECT id, title, url, platform FROM linktree WHERE is_active = 1 ORDER BY display_order ASC`,
      []
    ) as any[];
    return rows.map((r: any) => ({
      id: r.id,
      title: r.title || '',
      url: r.url || '',
      platform: r.platform || '',
    }));
  } catch {
    return [];
  }
}

async function getFeaturedVideoId(): Promise<number | null> {
  try {
    const rows = await queryDatabase(
      `SELECT video_id FROM featured_schedule
       WHERE starts_at <= datetime('now')
       ORDER BY starts_at DESC
       LIMIT 1`,
      []
    ) as any[];
    return rows?.[0]?.video_id || null;
  } catch {
    return null;
  }
}

export default async function NowPage() {
  const featuredId = await getFeaturedVideoId();

  const [videos, stats, socialLinks] = await Promise.all([
    getShowcaseVideos(featuredId),
    getContentStats(),
    getSocialLinks(),
  ]);

  return (
    <NowPageClient
      videos={videos}
      stats={stats}
      socialLinks={socialLinks}
    />
  );
}
