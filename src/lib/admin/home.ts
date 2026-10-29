/**
 * The admin home's facts, read in one go (api/admin/home): today's posts for
 * the post at the top, and one live fact for each of his five jobs.
 *
 * His day is his phone's: the page sends the start and end of it, so the
 * server (on UTC) never decides what "today" is. Each fact is read on its own
 * and is null when it cannot be read, so one failed read leaves its row bare
 * instead of the page empty.
 */

import { queryDatabase } from '@/lib/db';
import { unreadThreadCount } from '@/lib/inbox/threads';
import { getFeaturedHandle } from '@/lib/featuredProduct';
import { getShopifyProduct } from '@/lib/shopify';
import { getLevelsOrThrow } from '@/lib/levelsServer';
import type { QueuePost } from '@/lib/social/postQueue';

export interface HomeCampaign {
  id: string;
  name: string;
  color?: string;
}

export interface HomeFacts {
  /** Open posts due by the end of his day, the next few after it, and what went out today */
  posts: QueuePost[];
  campaigns: HomeCampaign[];
  /** Conversations with something unread */
  inbox: number | null;
  /** Store orders in the last seven days, cancelled ones left out */
  orders: number | null;
  /** Songs out on the site, as /levels counts them */
  levels: number | null;
  /** The piece /links puts first; missing when its handle is no longer in the store */
  featured: { title: string | null; missing: boolean } | null;
  /** The release projects on the floor, the newest first */
  release: { title: string; more: number } | null;
}

/** Statuses a post can still be posted from (lib/social/postQueue) */
const OPEN = ['draft', 'scheduled', 'pending_approval', 'failed'];
/** How many posts after today are read, so a day with nothing left still shows the next one */
const NEXT_AFTER_TODAY = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const POST_COLUMNS = `id, status, title, tags, campaign_id, caption, hashtags, caption_by_platform,
  media_type, media_url, thumbnail_url, platforms, platform_status, scheduled_at, published_at, notes`;

function parsed<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return (raw as T) ?? fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toPost(row: Record<string, unknown>): QueuePost {
  return {
    ...(row as unknown as QueuePost),
    tags: parsed(row.tags, []),
    hashtags: parsed(row.hashtags, []),
    caption_by_platform: parsed(row.caption_by_platform, {}),
    platforms: parsed(row.platforms, []),
    platform_status: parsed(row.platform_status, {}),
  };
}

/** A fact, or null when it cannot be read */
async function known<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (e) {
    console.error('[admin/home]', (e as Error).message);
    return null;
  }
}

async function todaysPosts(since: string, until: string): Promise<{ posts: QueuePost[]; campaigns: HomeCampaign[] }> {
  const open = OPEN.map(() => '?').join(',');
  const [today, next] = await Promise.all([
    queryDatabase(
      `SELECT ${POST_COLUMNS} FROM social_posts
        WHERE media_url IS NOT NULL
          AND ((status IN (${open}) AND scheduled_at <= ?)
            OR (scheduled_at >= ? AND scheduled_at <= ?)
            OR (status = 'published' AND published_at >= ?))
        ORDER BY scheduled_at
        LIMIT 300`,
      [...OPEN, until, since, until, since],
    ),
    queryDatabase(
      `SELECT ${POST_COLUMNS} FROM social_posts
        WHERE media_url IS NOT NULL AND status IN (${open}) AND scheduled_at > ?
        ORDER BY scheduled_at
        LIMIT ${NEXT_AFTER_TODAY}`,
      [...OPEN, until],
    ),
  ]);
  const posts = [...((today || []) as Record<string, unknown>[]), ...((next || []) as Record<string, unknown>[])].map(toPost);
  const ids = [...new Set(posts.map((p) => p.campaign_id).filter((id): id is string => !!id))];
  const campaigns = ids.length
    ? ((await queryDatabase(`SELECT id, name, color FROM campaigns WHERE id IN (${ids.map(() => '?').join(',')})`, ids)) as HomeCampaign[])
    : [];
  return { posts, campaigns: campaigns || [] };
}

async function ordersThisWeek(now: Date): Promise<number> {
  // Shopify writes its times with the shop's offset ("…T15:25:33-07:00"), so they are compared as times, not as text
  const rows = (await queryDatabase(
    `SELECT shopify_created_at, cancelled_at FROM commerce_orders ORDER BY shopify_created_at DESC LIMIT 200`,
    [],
  )) as { shopify_created_at: string; cancelled_at: string | null }[];
  const from = now.getTime() - WEEK_MS;
  return (rows || []).filter((r) => !r.cancelled_at && new Date(r.shopify_created_at).getTime() >= from).length;
}

async function featured(): Promise<{ title: string | null; missing: boolean }> {
  const handle = await getFeaturedHandle();
  if (!handle) return { title: null, missing: false };
  const res = await getShopifyProduct(handle);
  return res.success && res.product ? { title: res.product.title, missing: false } : { title: null, missing: true };
}

async function release(): Promise<{ title: string; more: number } | null> {
  const rows = (await queryDatabase(
    `SELECT title FROM warehouse_projects WHERE status != 'archived' ORDER BY created_at DESC`,
    [],
  )) as { title: string }[];
  if (!rows?.length) return null;
  return { title: rows[0].title, more: rows.length - 1 };
}

export async function readHome({ since, until, now = new Date() }: { since: string; until: string; now?: Date }): Promise<HomeFacts> {
  const [today, inbox, orders, levels, piece, project] = await Promise.all([
    known(() => todaysPosts(since, until)),
    known(unreadThreadCount),
    known(() => ordersThisWeek(now)),
    known(async () => new Set((await getLevelsOrThrow()).map((l) => l.song)).size),
    known(featured),
    known(release),
  ]);
  return {
    posts: today?.posts || [],
    campaigns: today?.campaigns || [],
    inbox,
    orders,
    levels,
    featured: piece,
    release: project,
  };
}
