import { redirect } from 'next/navigation';
import RoomScreen from '@/components/room/RoomScreen';
import { loadRoom } from '@/components/room/loadRoom';
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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The home page is the room (components/room/RoomScreen), the same page as
 * the bio link's /links. A link to one clip (/?clip=123, from an old ad or
 * share) still opens the clips feed on that clip: the feed is the old app's,
 * so it lives outside the rooms at /clips/123, with the rest of the link
 * (a campaign's utm_ tags) carried along.
 */
export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const clip = typeof params.clip === 'string' ? params.clip : undefined;
  const clipId = clip ? parseInt(clip, 10) : NaN;

  if (Number.isFinite(clipId)) {
    const rest = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === 'clip' || value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) rest.append(key, v);
    }
    const query = rest.toString();
    redirect(`/clips/${clipId}${query ? `?${query}` : ''}`);
  }

  return <RoomScreen {...await loadRoom()} />;
}
