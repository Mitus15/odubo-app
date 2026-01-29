import HomePageClient from '@/app/HomePageClient';
import { getVerse, getHomepageMode, getInitialClips } from '@/lib/homepageHelpers';
import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Store',
  description: 'Shop exclusive fashion, merchandise, and limited edition drops from Odubo Studio.',
  path: '/store',
});

export const dynamic = 'force-dynamic';

export default async function StorePage() {
  const [verseOfTheDay, homepageMode, initialClips] = await Promise.all([
    getVerse(),
    getHomepageMode(),
    getInitialClips()
  ]);

  return (
    <HomePageClient
      verseOfTheDay={verseOfTheDay}
      homepageMode={homepageMode}
      initialClips={homepageMode === 'clips' ? initialClips : undefined}
      defaultModal="store"
    />
  );
}
