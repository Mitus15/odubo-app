import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { queryDatabase } from '@/lib/db';
import { generateSeoMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Music',
  description:
    'Listen to albums and tracks from Odubo. Stream the latest releases and discover new sounds.',
  path: '/music',
});

export const revalidate = 0;

/**
 * /music — the way in to the record.
 *
 * This used to redirect to /media, which is the Moments gallery and has never
 * had any music on it. The album was reachable only by typing its UUID, so in
 * practice it was not reachable at all.
 *
 * With one album, the honest thing is to go straight there rather than render
 * a list of one. `status` is deliberately NOT filtered: the album is a draft
 * until it ships on 3 Oct, and the whole point of the preview is that the
 * owner can hear it and send it to people before then.
 *
 * When there is a second album this becomes a list, and the menu keeps
 * pointing at /music either way — which is why the menu links here and not at
 * a hardcoded id.
 */
export default async function MusicPage() {
  const albums = (await queryDatabase(
    `SELECT id FROM albums
      ORDER BY CASE WHEN release_date IS NULL THEN 1 ELSE 0 END, release_date DESC, created_at DESC
      LIMIT 1`,
    []
  )) as Array<{ id: string }> | null;

  const album = albums?.[0];
  redirect(album ? `/music/albums/${album.id}` : '/');
}
