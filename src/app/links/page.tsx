import type { Metadata } from 'next';
import RoomScreen from '@/components/room/RoomScreen';
import { loadRoom } from '@/components/room/loadRoom';
import { generateSeoMetadata } from '@/lib/seo';
import { getLevels } from '@/lib/levelsServer';

/**
 * /links: where the bio link lands. Someone saw a level on TikTok, Instagram
 * or YouTube and tapped through; they get the room, the home page's own
 * (components/room/RoomScreen). Kept as its own address so the bio
 * link's ?utm_source= says which app they came from.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const newest = (await getLevels())[0];
  return generateSeoMetadata({
    description: 'Odubo Studio: the music and dance of Mani Odubo, and B.A.A.D Creative Wear.',
    path: '/links',
    ogImage: newest ? '/share/newest' : undefined,
  });
}

export default async function LinksPage() {
  return <RoomScreen {...await loadRoom()} />;
}
