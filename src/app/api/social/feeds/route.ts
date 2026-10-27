import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/requireAdmin';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getAccountFeed, getAccounts, getPostResults, isConfigured } from '@/lib/postforme';
import { accountFor, plainError } from '@/lib/social/appLink';
import { feedPost, markFromFeed, matchFeed, type FeedPost } from '@/lib/social/feedMatch';
import { allPlatformsDone, platformMark, type PlatformMark, type QueuePost } from '@/lib/social/postQueue';

export const runtime = 'edge';

/**
 * POST /api/social/feeds
 *
 * The Studio noticing what went out. He posts by hand from his phone; this
 * reads what is live on each connected account (Post for Me's account feeds:
 * Instagram, TikTok, YouTube), finds the planned post each one is
 * (lib/social/feedMatch), and ticks that platform with its link and numbers.
 * A post ticked everywhere it was planned is published. It also asks Post for
 * Me how the posts it was sent are doing (api/social/posts/[id]/send): a
 * refusal comes back as one sentence on the post.
 *
 * Reads and writes only the Studio's own rows; nothing is posted anywhere.
 * The Studio calls it when it opens (at most every few minutes) and from its
 * menu.
 */

const APPS = ['instagram', 'tiktok', 'youtube'];
const DAY = 24 * 3600 * 1000;
/** Sends asked after per check, so one slow check cannot hold the Studio */
const SENDS_PER_CHECK = 10;

type Row = Record<string, unknown>;

function json<T>(raw: unknown, fallback: T): T {
  if (raw && typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;
  if (!isConfigured()) return NextResponse.json({ error: 'Post for Me is not set up' }, { status: 503 });

  const now = new Date();
  const checkedAt = now.toISOString();
  const accounts = await getAccounts();
  if (!accounts.success || !accounts.data) {
    return NextResponse.json({ error: plainError(accounts.error) }, { status: 502 });
  }

  // What is live on each app
  const apps: Record<string, { ok: boolean; seen?: number; error?: string }> = {};
  const items: FeedPost[] = [];
  await Promise.all(
    APPS.map(async (platform) => {
      const account = accountFor(accounts.data!, platform);
      if (!account) {
        apps[platform] = { ok: false, error: 'Not connected in Post for Me' };
        return;
      }
      const feed = await getAccountFeed(account.id, { limit: 50 });
      if (!feed.success || !feed.data) {
        apps[platform] = { ok: false, error: plainError(feed.error) };
        return;
      }
      apps[platform] = { ok: true, seen: feed.data.length };
      items.push(...feed.data.map(feedPost).filter((i) => i.platform === platform));
    }),
  );

  // The planned posts a live one could be
  const rows = (await queryDatabase(
    `SELECT id, status, caption, platforms, platform_status, platform_post_ids, scheduled_at, published_at
       FROM social_posts
      WHERE scheduled_at IS NOT NULL AND scheduled_at >= ? AND scheduled_at <= ?`,
    [new Date(now.getTime() - 60 * DAY).toISOString(), new Date(now.getTime() + 3 * DAY).toISOString()],
  )) as Row[];
  const posts = rows.map((r) => ({
    id: String(r.id),
    status: String(r.status),
    caption: (r.caption as string) || '',
    media_type: 'video',
    media_url: '',
    platforms: json<string[]>(r.platforms, []),
    platform_status: json<Record<string, unknown>>(r.platform_status, {}),
    scheduled_at: r.scheduled_at as string,
    published_at: (r.published_at as string) || undefined,
    ids: json<Record<string, string>>(r.platform_post_ids, {}),
  })) as (QueuePost & { ids: Record<string, string> })[];

  const changed = new Map<string, (typeof posts)[number]>();
  let linked = 0;
  const unchecked = (mark: object | null) => JSON.stringify({ ...mark, checked_at: undefined });
  for (const m of matchFeed(posts, items)) {
    const post = changed.get(m.postId) || { ...posts.find((p) => p.id === m.postId)! };
    const before = platformMark(post, m.platform);
    const after = markFromFeed(before, m.item, checkedAt);
    if (m.known && unchecked(before) === unchecked(after)) continue; // same numbers: nothing to write
    post.platform_status = { ...post.platform_status, [m.platform]: after };
    post.ids = { ...post.ids, [m.platform]: m.item.id };
    changed.set(post.id, post);
    if (!m.known) linked += 1;
  }

  // The posts sent through Post for Me that are not live yet: delivered, waiting, or refused
  let refused = 0;
  const pending = posts
    .flatMap((p) => p.platforms.map((platform) => ({ p, platform, mark: platformMark(changed.get(p.id) || p, platform) })))
    .filter(({ mark }) => mark && !mark.posted && mark.pfm_id && (mark.sent === 'scheduled' || mark.sent === 'draft'))
    .slice(0, SENDS_PER_CHECK);
  await Promise.all(
    pending.map(async ({ p, platform, mark }) => {
      const results = await getPostResults(mark!.pfm_id!);
      const result = results.data?.[0];
      if (!result) return;
      const post = changed.get(p.id) || { ...p };
      let next: PlatformMark | null = null;
      if (!result.success) {
        next = { ...mark!, sent: 'failed', error: plainError(result.error) };
        refused += 1;
      } else if (mark!.sent === 'scheduled' && result.platform_data?.url) {
        next = { ...mark!, posted: true, at: checkedAt, url: result.platform_data.url, id: result.platform_data.id };
        if (result.platform_data.id) post.ids = { ...post.ids, [platform]: result.platform_data.id };
      }
      if (!next) return;
      post.platform_status = { ...post.platform_status, [platform]: next };
      changed.set(p.id, post);
    }),
  );

  for (const post of changed.values()) {
    const done = allPlatformsDone(post);
    const firstOut = Object.values(post.platform_status || {})
      .map((v) => (v && typeof v === 'object' ? (v as PlatformMark).at : undefined))
      .filter((at): at is string => !!at)
      .sort()[0];
    await executeQuery(
      `UPDATE social_posts
          SET platform_status = ?, platform_post_ids = ?,
              status = CASE WHEN ? THEN 'published' ELSE status END,
              published_at = CASE WHEN ? THEN COALESCE(published_at, ?) ELSE published_at END,
              last_synced_at = ?, updated_at = ?
        WHERE id = ?`,
      [JSON.stringify(post.platform_status), JSON.stringify(post.ids), done ? 1 : 0, done ? 1 : 0, firstOut || checkedAt, checkedAt, checkedAt, post.id],
    );
  }

  return NextResponse.json({ checkedAt, apps, linked, updated: changed.size, refused });
}
