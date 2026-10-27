import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import RoomScreen from '@/components/room/RoomScreen';
import { loadRoom } from '@/components/room/loadRoom';
import { generateSeoMetadata } from '@/lib/seo';
import { getLevel } from '@/lib/levelsServer';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const level = await getLevel((await params).id);
  if (!level) return generateSeoMetadata({ title: 'Levels', path: '/levels', noIndex: true });
  return generateSeoMetadata({
    title: `${level.label} · ${level.song}`,
    description: `${level.label}: Mani Odubo dances ${level.song}${level.artist ? ` by ${level.artist}` : ''}.`,
    path: `/levels/${level.id}`,
    ogImage: `/share/${level.id}`,
    type: 'video.other',
  });
}

/**
 * One level: the feed (components/room/RoomScreen), opened in that level's
 * room, so a shared link lands in it and a swipe carries on through the rest.
 * Only a piece that is out has a page; anything else is not found, so an
 * address can never show a post before he does.
 */
export default async function LevelPage({ params }: PageProps) {
  const { id } = await params;
  const data = await loadRoom();
  const room = data.levels.find((l) => l.pieceIds.includes(id));
  if (!room) notFound();
  return <RoomScreen {...data} startAt={room.id} />;
}
