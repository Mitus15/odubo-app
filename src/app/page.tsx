import HomePageClient from '@/app/HomePageClient';
import Footer from '@/components/landing/Footer';
import RoomScreen from '@/components/room/RoomScreen';
import { loadRoom } from '@/components/room/loadRoom';
import { getVerse, getHomepageMode, getInitialClips } from '@/lib/homepageHelpers';
import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = generateSeoMetadata({
  description: 'Odubo Studio: the music and dance of Mani Odubo, and B.A.A.D Creative Wear.',
  path: '/',
  // The newest level's card (app/share/[card]); with none out, it shows the house's
  ogImage: '/share/newest',
});

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ clip?: string }>;
}

/**
 * The home page is the room (components/room/RoomScreen), the same page as
 * the bio link's /links. A link to one clip (/?clip=123, from an old
 * ad or share) still opens the clips feed on that clip.
 */
export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const clipId = params.clip ? parseInt(params.clip, 10) : NaN;

  if (!Number.isFinite(clipId)) return <RoomScreen {...await loadRoom()} />;

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
