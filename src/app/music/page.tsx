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
 * Loop Soul is now two albums (Vol. 1 and Vol. 2), each page linking to the
 * other, so /music still lands on one: whatever is out first (published),
 * then the latest dated, then the FIRST made among undated drafts, which is
 * Vol. 1. Never the newest draft, or the menu would open on Vol. 2 before
 * Vol. 1 is out.
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
      ORDER BY CASE WHEN status = 'published' THEN 0 ELSE 1 END,
               CASE WHEN release_date IS NULL THEN 1 ELSE 0 END, release_date DESC, created_at ASC
      LIMIT 1`,
    []
  )) as Array<{ id: string }> | null;

  const album = albums?.[0];
  redirect(album ? `/music/albums/${album.id}` : '/');
}
