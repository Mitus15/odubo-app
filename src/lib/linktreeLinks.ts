/**
 * Client-safe helpers for link tree rows (no database here: the landing's
 * client component imports this; lib/linktree.ts reads the table on the server).
 */

import type { LinkTreeItem } from '@/types/linktree';

/** A link that opens the store rather than leaving the site. */
export function isStoreLink(link: Pick<LinkTreeItem, 'platform'>): boolean {
  return link.platform === 'shopify' || link.platform === 'odubo';
}
