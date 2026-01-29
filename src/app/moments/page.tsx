import HomePageClient from '@/app/HomePageClient';
import { getVerse, getHomepageMode, getInitialClips } from '@/lib/homepageHelpers';
import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Moments',
  description: 'Capture and share moments from live events. Browse photo galleries and contribute to the community.',
  path: '/moments',
});

export const dynamic = 'force-dynamic';

export default async function MomentsPage() {
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
      defaultModal="moments"
    />
  );
}
