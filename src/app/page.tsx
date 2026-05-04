import HomePageClient from '@/app/HomePageClient';
import Footer from '@/components/landing/Footer';
import { getVerse, getHomepageMode, getInitialClips } from '@/lib/homepageHelpers';
import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

// SEO Metadata
export const metadata: Metadata = generateSeoMetadata({
  title: 'Home',
  description: 'Music, clips, shop.',
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

  // Desktop: use HomePageClient with store open on load (like mobile but with desktop layout)
  // The store opens automatically via defaultModal="store"
  return (
    <div className="pb-16">
      <HomePageClient
        verseOfTheDay={verseOfTheDay}
        homepageMode={homepageMode}
        initialClipId={validClipId}
        initialClips={homepageMode === 'clips' ? initialClips : undefined}
        defaultModal="store"
      />
      <Footer />
    </div>
  );
}
