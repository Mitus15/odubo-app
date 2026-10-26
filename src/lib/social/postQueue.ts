/**
 * Posting by hand, in order: the Social Studio's Post view.
 *
 * The owner posts from his phone through each app's own composer (no
 * PostForMe). The Studio's job is to put the next post in front of him with
 * its video and caption ready, and to remember what is out. A post is done
 * when every platform it was planned for is ticked; each tick lives in the
 * post's `platform_status` JSON as `{ <platform>: { posted: true, at } }`.
 */

export interface QueuePost {
  id: string;
  status: string;
  title?: string;
  caption?: string;
  hashtags?: string[];
  caption_by_platform?: Record<string, string>;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
  platforms: string[];
  platform_status?: Record<string, unknown>;
  scheduled_at?: string;
  published_at?: string;
  notes?: string;
}

export interface PlatformMark {
  posted: boolean;
  at?: string;
}

/** Statuses a post can be posted from by hand. */
const OPEN = new Set(['draft', 'scheduled', 'pending_approval', 'failed']);

export function platformMark(post: Pick<QueuePost, 'platform_status'>, platform: string): PlatformMark | null {
  const raw = post.platform_status?.[platform];
  if (raw && typeof raw === 'object' && 'posted' in raw) return raw as PlatformMark;
  return null;
}

export function isPlatformDone(post: Pick<QueuePost, 'platform_status'>, platform: string): boolean {
  return platformMark(post, platform)?.posted === true;
}

/** The post's platform_status with one platform ticked or unticked. Other keys are kept. */
export function withPlatformMark(
  status: Record<string, unknown> | undefined,
  platform: string,
  posted: boolean,
  at: string,
): Record<string, unknown> {
  return { ...(status || {}), [platform]: posted ? { posted: true, at } : { posted: false } };
}

export function allPlatformsDone(post: Pick<QueuePost, 'platforms' | 'platform_status'>): boolean {
  return post.platforms.length > 0 && post.platforms.every((p) => isPlatformDone(post, p));
}

/** What to paste in the app: the platform's own caption if it has one, then the hashtags. */
export function captionFor(post: Pick<QueuePost, 'caption' | 'caption_by_platform' | 'hashtags'>, platform: string): string {
  const words = (post.caption_by_platform?.[platform] || post.caption || '').trim();
  const tags = (post.hashtags || []).map((t) => `#${t.replace(/^#/, '')}`).join(' ');
  return [words, tags].filter(Boolean).join('\n\n');
}

function endOfDay(now: Date): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function startOfDay(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface Queue<T extends QueuePost> {
  /** Planned for today or earlier and not out yet: the work in front of him */
  due: T[];
  /** Planned for later */
  later: T[];
  /** No date yet */
  unplanned: T[];
  /** Went out today (by hand or otherwise) */
  postedToday: T[];
}

/** The posts in posting order, split by when. Days are the device's own (his phone's time zone). */
export function queueOf<T extends QueuePost>(posts: T[], now: Date = new Date()): Queue<T> {
  const today = endOfDay(now);
  const dayStart = startOfDay(now);
  const byTime = (a: T, b: T) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime();
  const open = posts.filter((p) => OPEN.has(p.status) && p.media_url);
  return {
    due: open.filter((p) => p.scheduled_at && new Date(p.scheduled_at).getTime() <= today).sort(byTime),
    later: open.filter((p) => p.scheduled_at && new Date(p.scheduled_at).getTime() > today).sort(byTime),
    unplanned: open.filter((p) => !p.scheduled_at),
    postedToday: posts.filter(
      (p) => p.status === 'published' && p.published_at && new Date(p.published_at).getTime() >= dayStart,
    ),
  };
}

export interface SoundCue {
  /** Where to start the app's sound, as the picker shows it ("0:17") */
  from: string;
  /** Where the piece ends in the song */
  to?: string;
  /** Anything after the times on that line, e.g. "(the song starts 4 s into the video)" */
  extra?: string;
  /** The note's other lines, in order */
  rest: string[];
}

/**
 * The song cue in a post's note: the "Sound from 0:17 (to 0:59)" line the
 * training posts carry (scripts/loop/posts), for a video posted with the app's
 * own sound. The video opens on that second of the song, so starting the sound
 * there lines it up. Null when the note has no such line.
 */
export function soundCue(notes?: string | null): SoundCue | null {
  const lines = (notes || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const i = lines.findIndex((l) => /^Sound from \d+:\d{2}/.test(l));
  if (i < 0) return null;
  const m = lines[i].match(/^Sound from (\d+:\d{2})(?: \(to (\d+:\d{2})\))?\s*(.*)$/)!;
  return { from: m[1], to: m[2], extra: m[3] || undefined, rest: lines.filter((_, k) => k !== i) };
}

/**
 * Where each app draws over a 9:16 video (its header, the caption and name at
 * the bottom, the button rail on the right), as fractions of the frame.
 * Approximate: the apps change these, and they differ by phone. For checking
 * that the HUD and the moves stay clear, not for pixel work.
 */
export const SAFE_ZONES: Record<string, { label: string; top: number; bottom: number; right: number; railTop: number; railBottom: number }> = {
  instagram: { label: 'Instagram', top: 0.115, bottom: 0.22, right: 0.11, railTop: 0.42, railBottom: 0.85 },
  tiktok: { label: 'TikTok', top: 0.085, bottom: 0.25, right: 0.13, railTop: 0.36, railBottom: 0.85 },
  youtube: { label: 'YouTube', top: 0.075, bottom: 0.2, right: 0.12, railTop: 0.4, railBottom: 0.85 },
};

export const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  threads: 'Threads',
  twitter: 'X',
};
