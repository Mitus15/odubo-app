import HomePageClient from '@/app/HomePageClient';
import { getVerse, getHomepageMode, getInitialClips } from '@/lib/homepageHelpers';
import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

// SEO Metadata
export const metadata: Metadata = generateSeoMetadata({
  title: 'Home',
  description: 'Listen to the latest music, watch exclusive clips, and shop the latest drops from Odubo Studio.',
  path: '/',
});

// Use dynamic rendering with ISR to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 60; // ISR: regenerate every minute

interface PageProps {
  searchParams: Promise<{ clip?: string }>;
}

// Server component
export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Fetch everything in parallel
  const [verseOfTheDay, homepageMode, initialClips] = await Promise.all([
    getVerse(),
    getHomepageMode(),
    getInitialClips()
  ]);

  // Parse clip ID for deep linking (e.g., /?clip=123 for ad campaigns)
  const initialClipId = params.clip ? parseInt(params.clip, 10) : null;
  const validClipId = initialClipId && Number.isFinite(initialClipId) ? initialClipId : null;

  return (
    <HomePageClient
      verseOfTheDay={verseOfTheDay}
      homepageMode={homepageMode}
      initialClipId={validClipId}
      initialClips={homepageMode === 'clips' ? initialClips : undefined}
    />
  );
}
