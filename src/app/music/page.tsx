import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { queryDatabase } from '@/lib/db';
import { getActiveLinks } from '@/lib/linktree';
import { generateSeoMetadata } from '@/lib/seo';
import MusicLocked from './MusicLocked';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Music',
  description: 'Mani Odubo: album one, and what comes next.',
  path: '/music',
});

export const revalidate = 0;

/**
 * /music: the way in to the record.
 *
 * An album that is out has its own page here, so /music goes straight to the
 * newest published one. Until one is, the page is MusicLocked: album one on
 * the streaming services, and the next record locked with no title and no
 * tracks. This used to send everyone to the newest album whatever its status,
 * which put the shelved Signs of Life, all 14 tracks, on the public site
 * (2026-10-24). The owner previews a draft from Release Control, whose link
 * opens the album page itself (it lets an admin in).
 */
export default async function MusicPage() {
  const albums = (await queryDatabase(
    `SELECT id FROM albums
      WHERE LOWER(COALESCE(status, '')) = 'published'
      ORDER BY CASE WHEN release_date IS NULL THEN 1 ELSE 0 END, release_date DESC, created_at DESC
      LIMIT 1`,
    []
  )) as Array<{ id: string }> | null;

  const album = albums?.[0];
  if (album) redirect(`/music/albums/${album.id}`);

  const links = await getActiveLinks().catch(() => []);
  const listen = ['spotify', 'apple_music']
    .map((p) => links.find((link) => link.platform === p))
    .filter((link): link is NonNullable<typeof link> => Boolean(link));
  return <MusicLocked listen={listen} />;
}
