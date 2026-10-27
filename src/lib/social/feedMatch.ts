/**
 * The apps' own feeds, matched to the Studio's posts.
 *
 * He posts by hand from his phone, pasting the Studio's caption. Post for Me
 * reads each connected account's feed (what is live, with views), and this
 * finds which planned post each live one is: the same platform, the same
 * caption (the app may add hashtags after it), within a few days of the
 * planned time. A live post found once keeps its id on the Studio's post, so
 * the next check only refreshes its numbers.
 */
import { platformMark, type PlatformMark, type QueuePost } from './postQueue';

export interface FeedPost {
  /** instagram, tiktok or youtube */
  platform: string;
  /** The app's own id for the post */
  id: string;
  url?: string;
  /** When it went out */
  at: string;
  caption?: string;
  views?: number;
  likes?: number;
  comments?: number;
}

/** Posted up to two days early or ten days late still counts as that post. */
const EARLY_MS = 2 * 24 * 3600 * 1000;
const LATE_MS = 10 * 24 * 3600 * 1000;

/** A caption reduced to its words: no case, accents, hashtags or punctuation. */
export function words(text?: string | null): string {
  return (text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/#\S+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

type RawFeedItem = {
  platform: string;
  platform_post_id: string;
  platform_url?: string;
  posted_at: string;
  caption?: string;
  metrics?: Record<string, unknown>;
};

function count(m: Record<string, unknown> | undefined, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = m?.[k];
    if (typeof v === 'number') return v;
  }
  return undefined;
}

/** A live post's link without the tracking tags an app adds (TikTok's utm_*); YouTube's ?v= stays. */
function cleanUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
}

/** One item of a Post for Me account feed, in the Studio's terms. Each app names its numbers its own way. */
export function feedPost(item: RawFeedItem): FeedPost {
  const m = item.metrics;
  return {
    platform: item.platform === 'tiktok_business' ? 'tiktok' : item.platform,
    id: item.platform_post_id,
    url: cleanUrl(item.platform_url),
    at: item.posted_at,
    caption: item.caption,
    views: count(m, 'views', 'view_count', 'viewCount', 'plays'),
    likes: count(m, 'likes', 'like_count', 'likeCount'),
    comments: count(m, 'comments', 'comment_count', 'commentCount'),
  };
}

export interface FeedMatch {
  postId: string;
  platform: string;
  item: FeedPost;
  /** Already linked before this check: only its numbers change */
  known: boolean;
}

/** Each live post to at most one planned post, and each planned post's platform to at most one live post. */
export function matchFeed(posts: QueuePost[], items: FeedPost[]): FeedMatch[] {
  const out: FeedMatch[] = [];
  const taken = new Set<string>();
  const key = (postId: string, platform: string) => `${postId}|${platform}`;

  const fresh: FeedPost[] = [];
  for (const item of items) {
    const linked = posts.find((p) => platformMark(p, item.platform)?.id === item.id);
    if (linked) {
      out.push({ postId: linked.id, platform: item.platform, item, known: true });
      taken.add(key(linked.id, item.platform));
    } else {
      fresh.push(item);
    }
  }

  // Every plausible pairing, best first: the exact caption before one the app
  // added to, then the nearest to the planned time.
  const pairs: { post: QueuePost; item: FeedPost; rank: number; gap: number }[] = [];
  for (const item of fresh) {
    const said = words(item.caption);
    const at = new Date(item.at).getTime();
    if (!said || Number.isNaN(at)) continue;
    for (const post of posts) {
      if (!post.platforms.includes(item.platform) || !post.scheduled_at) continue;
      if (platformMark(post, item.platform)?.id) continue;
      const planned = words(post.caption);
      if (planned.length < 3) continue;
      const rank = said === planned ? 0 : said.startsWith(`${planned} `) ? 1 : -1;
      if (rank < 0) continue;
      const when = new Date(post.scheduled_at).getTime();
      if (at < when - EARLY_MS || at > when + LATE_MS) continue;
      pairs.push({ post, item, rank, gap: Math.abs(at - when) });
    }
  }
  pairs.sort((a, b) => a.rank - b.rank || a.gap - b.gap);
  const used = new Set<FeedPost>();
  for (const { post, item } of pairs) {
    if (used.has(item) || taken.has(key(post.id, item.platform))) continue;
    used.add(item);
    taken.add(key(post.id, item.platform));
    out.push({ postId: post.id, platform: item.platform, item, known: false });
  }
  return out;
}

/** A platform's mark once its live post is found: posted, linked, counted. What it knew of a send stays. */
export function markFromFeed(prev: PlatformMark | null, item: FeedPost, checkedAt: string): PlatformMark & { checked_at: string } {
  return {
    ...(prev || {}),
    posted: true,
    at: item.at,
    url: item.url ?? prev?.url,
    id: item.id,
    views: item.views ?? prev?.views,
    likes: item.likes ?? prev?.likes,
    comments: item.comments ?? prev?.comments,
    checked_at: checkedAt,
  };
}
