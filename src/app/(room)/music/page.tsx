import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { queryDatabase } from '@/lib/db';
import { generateSeoMetadata } from '@/lib/seo';
import { CATCHING_LIGHT } from '@/lib/music/catchingLight';
import MusicLocked from './MusicLocked';
import { getLevels } from '@/lib/levelsServer';
import { roomFor } from '@/lib/room';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Music',
  description: `Odubo Studio: ${CATCHING_LIGHT.title}, the album by Mani Odubo.`,
  path: '/music',
  ogImage: CATCHING_LIGHT.cover,
});

export const revalidate = 0;

/**
 * /music: the way in to the record.
 *
 * An album that is out on this site has its own page here, so /music goes
 * straight to the newest published one. Until one is, the page is
 * MusicLocked: Catching Light on the streaming services, and the next record
 * locked with no title and no tracks. This used to send everyone to the
 * newest album whatever its status, which put the shelved Signs of Life, all
 * 14 tracks, on the public site (2026-10-24). The owner previews a draft from
 * Release Control, whose link opens the album page itself (it lets an admin in).
 */
export default async function MusicPage({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const albums = (await queryDatabase(
    `SELECT id FROM albums
      WHERE LOWER(COALESCE(status, '')) = 'published'
      ORDER BY CASE WHEN release_date IS NULL THEN 1 ELSE 0 END, release_date DESC, created_at DESC
      LIMIT 1`,
    []
  )) as Array<{ id: string }> | null;

  const album = albums?.[0];
  if (album) redirect(`/music/albums/${album.id}`);
  const room = roomFor(await getLevels(), (await searchParams).room);
  return <MusicLocked colour={room.colour} on={room.on} />;
}
