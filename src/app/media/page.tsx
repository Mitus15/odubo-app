import HomePageClient from '@/app/HomePageClient';
import { fetchVerseOfTheDay } from '@/lib/gemini';
import { queryDatabase } from '@/lib/db';
import { mapClipRows } from '@/lib/clipsMapper';
import { generateSeoMetadata } from '@/lib/seo';
import type { ClipApiRow, ClipItem } from '@/types/clips';
import type { Metadata } from 'next';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Media',
  description: 'Watch exclusive videos, listen to albums, and explore the full Odubo media library.',
  path: '/media',
});

export const dynamic = 'force-dynamic';

// Server-side verse fetching
async function getVerse() {
  try {
    const timestamp = Date.now().toString();
    const requestId = Math.random().toString(36).substring(7);
    const result = await fetchVerseOfTheDay(timestamp, requestId);
    return {
      text: result.text,
      reference: result.reference,
      error: result.note || result.error || null
    };
  } catch (error) {
    console.error('getVerse error:', error);
    return {
      text: "Trust in the Lord with all your heart and lean not on your own understanding.",
      reference: "Proverbs 3:5",
      error: "Unable to fetch today's verse."
    };
  }
}

// Server-side initial clips fetch
async function getInitialClips(): Promise<ClipItem[]> {
  try {
    const baseFields = `v.id, v.title, v.artist_name, v.description, v.url, v.uid, v.mp4_url, v.duration, v.duration_seconds, v.poster_url, v.thumbnail, v.created_at, v.shopify_product_handle, v.related_projects`;
    const rows = await queryDatabase(
      `SELECT ${baseFields}
       FROM videos v
       WHERE v.type = 'clip'
         AND (v.is_public = 1 OR v.is_public IS NULL)
         AND COALESCE(v.status, 'published') != 'archived'
         AND COALESCE(v.publication_status, 'live') = 'live'
       ORDER BY RANDOM()
       LIMIT 12`,
      []
    ) as ClipApiRow[];
    return mapClipRows(rows);
  } catch (error) {
    console.error('getInitialClips error:', error);
    return [];
  }
}

export default async function MediaPage() {
  const [verseOfTheDay, initialClips] = await Promise.all([
    getVerse(),
    getInitialClips()
  ]);

  return (
    <HomePageClient
      verseOfTheDay={verseOfTheDay}
      initialClips={initialClips}
      defaultModal="media"
    />
  );
}
