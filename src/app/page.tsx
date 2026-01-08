import HomePageClient from '@/app/HomePageClient';
import { fetchVerseOfTheDay } from '@/lib/gemini';
import { generateSeoMetadata } from '@/lib/seo';
import { queryDatabase } from '@/lib/db';
import { mapClipRows } from '@/lib/clipsMapper';
import type { ClipApiRow, ClipItem } from '@/types/clips';
import type { Metadata } from 'next';

// SEO Metadata
export const metadata: Metadata = generateSeoMetadata({
  title: 'Clips',
  description: 'Watch exclusive clips, discover new music, and shop the latest drops from Odubo Studio.',
  path: '/',
});

// Use dynamic rendering with ISR to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // ISR: regenerate every hour

interface PageProps {
  searchParams: Promise<{ clip?: string }>;
}

// Server-side verse fetching function - calls Gemini logic directly
async function getVerse() {
  try {
    const timestamp = Date.now().toString();
    const requestId = Math.random().toString(36).substring(7);

    // Call the shared logic directly (no HTTP fetch needed)
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
      error: "Unable to fetch today's verse. Showing a timeless favorite."
    };
  }
}

// Server-side initial clips fetch - eliminates client waterfall
const INITIAL_CLIPS_LIMIT = 12;

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
       LIMIT ?`,
      [INITIAL_CLIPS_LIMIT]
    ) as ClipApiRow[];

    return mapClipRows(rows);
  } catch (error) {
    console.error('getInitialClips error:', error);
    return []; // Return empty array, ClipsFeed will fetch on client
  }
}

// Server component - note the 'async' keyword
export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Fetch verse and initial clips in parallel for faster load
  const [verseOfTheDay, initialClips] = await Promise.all([
    getVerse(),
    getInitialClips()
  ]);

  // Parse clip ID for deep linking (e.g., /?clip=123 for ad campaigns)
  const initialClipId = params.clip ? parseInt(params.clip, 10) : null;
  const validClipId = initialClipId && Number.isFinite(initialClipId) ? initialClipId : null;

  return (
    <HomePageClient
      verseOfTheDay={verseOfTheDay}
      initialClipId={validClipId}
      initialClips={initialClips}
    />
  );
}
