import { notFound } from 'next/navigation';
import HomePageClient from '@/app/HomePageClient';
import Footer from '@/components/landing/Footer';
import { getVerse, getHomepageMode, getInitialClips } from '@/lib/homepageHelpers';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ clip: string }>;
}

/**
 * The clips feed opened on one clip: where an old link to one clip
 * (/?clip=123, from an ad or a share) lands, as the home page showed it
 * before the home page became the room.
 */
export default async function ClipPage({ params }: PageProps) {
  const { clip } = await params;
  const clipId = parseInt(clip, 10);
  if (!Number.isFinite(clipId)) notFound();

  const [verseOfTheDay, homepageMode, initialClips] = await Promise.all([getVerse(), getHomepageMode(), getInitialClips()]);
  return (
    <div className="pb-16">
      <HomePageClient
        verseOfTheDay={verseOfTheDay}
        homepageMode={homepageMode}
        initialClipId={clipId}
        initialClips={homepageMode === 'clips' ? initialClips : undefined}
      />
      <Footer />
    </div>
  );
}
