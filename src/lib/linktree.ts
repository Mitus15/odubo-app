/**
 * The link tree's data, for the API and for the /links landing alike.
 *
 * Active links, featured first, then by category and order. The YouTube link
 * points at the latest video deployed through the platform rather than the
 * channel, so the newest piece is one tap away, but only while that video is
 * new (FRESH_DAYS). He posts by hand now (2026-10), which records no
 * deployment, so the "latest" froze on an old Short; past that, the channel.
 */
const FRESH_DAYS = 14;

import { queryDatabase } from '@/lib/db';
import type { LinkTreeItem } from '@/types/linktree';

export async function getActiveLinks(): Promise<LinkTreeItem[]> {
  const [links, latestYoutube] = await Promise.all([
    queryDatabase(`
      SELECT * FROM linktree
      WHERE is_active = 1
      ORDER BY
        is_featured DESC,
        category ASC,
        display_order ASC,
        title ASC
    `) as Promise<LinkTreeItem[]>,
    queryDatabase(`
      SELECT external_url FROM video_deployments
      WHERE platform = 'youtube' AND status = 'published' AND external_url IS NOT NULL
        AND deployed_at >= datetime('now', '-${FRESH_DAYS} days')
      ORDER BY deployed_at DESC
      LIMIT 1
    `) as Promise<{ external_url: string }[]>,
  ]);

  const youtubeUrl = latestYoutube?.[0]?.external_url;
  if (youtubeUrl) {
    const youtube = (links || []).find((link) => link.platform === 'youtube');
    if (youtube) youtube.url = youtubeUrl;
  }
  return links || [];
}

export { isStoreLink } from './linktreeLinks';
