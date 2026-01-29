import HomePageClient from '@/app/HomePageClient';
import { getVerse, getHomepageMode, getInitialClips } from '@/lib/homepageHelpers';
import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Links',
  description: 'Connect with Odubo across all platforms. Find social media, streaming services, and more.',
  path: '/links',
});

export const dynamic = 'force-dynamic';

export default async function LinksPage() {
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
      defaultModal="links"
    />
  );
}
