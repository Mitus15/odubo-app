import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/requireAdmin';
import { executeQuery, queryDatabase } from '@/lib/db';
import { createPost, getAccounts, isConfigured, type CreatePostInput } from '@/lib/postforme';
import { accountFor, plainError } from '@/lib/social/appLink';
import { platformMark, type PlatformMark } from '@/lib/social/postQueue';

export const runtime = 'edge';

/**
 * POST /api/social/posts/[id]/send   { platform, title?, description? }
 *
 * One platform of one post, sent to the app through Post for Me, on his tap
 * in the Studio (never on its own):
 *
 *   youtube  the upload itself, public, scheduled for the post's time (now if
 *            that has passed), with the title and description he confirmed.
 *            For a full song with the song laid in, which needs nothing added
 *            in the app.
 *   tiktok   a draft in his TikTok inbox: he opens TikTok, adds the song from
 *            the Studio's start time, and posts it there.
 *
 * The platform's mark records the send ({ sent, pfm_id, for }); the post's own
 * status is left alone, so the platforms he posts by hand stay in his queue.
 * Whether it went out comes back through api/social/feeds.
 */

const SENDABLE = new Set(['youtube', 'tiktok']);
/** A time this close is "now": Post for Me needs a moment to take it */
const SOON_MS = 5 * 60 * 1000;

function json<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;
  if (!isConfigured()) return NextResponse.json({ error: 'Post for Me is not set up' }, { status: 503 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { platform?: string; title?: string; description?: string };
  const platform = body.platform || '';
  if (!SENDABLE.has(platform)) {
    return NextResponse.json({ error: 'Only YouTube uploads and TikTok drafts go through the Studio' }, { status: 400 });
  }

  const rows = (await queryDatabase(
    `SELECT id, caption, media_url, thumbnail_url, platforms, platform_status, scheduled_at FROM social_posts WHERE id = ?`,
    [id],
  )) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  const platforms = json<string[]>(row.platforms, []);
  if (!platforms.includes(platform)) {
    return NextResponse.json({ error: `This post is not planned for ${platform}` }, { status: 400 });
  }
  const status = json<Record<string, unknown>>(row.platform_status, {});
  const prev = platformMark({ platform_status: status }, platform);
  if (prev?.posted || prev?.sent === 'scheduled' || prev?.sent === 'draft') {
    return NextResponse.json({ error: 'Already sent', mark: prev }, { status: 409 });
  }
  if (!row.media_url) return NextResponse.json({ error: 'This post has no video' }, { status: 400 });

  const accounts = await getAccounts();
  const account = accounts.data ? accountFor(accounts.data, platform) : null;
  if (!account) {
    return NextResponse.json({ error: plainError(accounts.error || `${platform} is not connected in Post for Me`) }, { status: 502 });
  }

  const caption = String(row.caption || '');
  const planned = row.scheduled_at ? new Date(String(row.scheduled_at)) : null;
  const later = planned && planned.getTime() > Date.now() + SOON_MS ? planned.toISOString() : undefined;
  const input: CreatePostInput = {
    caption: platform === 'youtube' ? body.description ?? caption : caption,
    social_accounts: [account.id],
    media: [{ url: String(row.media_url), type: 'video', ...(row.thumbnail_url ? { thumbnail_url: String(row.thumbnail_url) } : {}) }],
    ...(platform === 'youtube' && later ? { scheduled_at: later } : {}),
    platform_configurations:
      platform === 'youtube'
        ? {
            youtube: {
              title: (body.title || caption || 'Untitled').slice(0, 100),
              description: body.description ?? caption,
              privacy_status: 'public',
              made_for_kids: false,
              category_id: '10', // Music
            },
          }
        : { tiktok: { is_draft: true } },
  };

  const result = await createPost(input);
  const sentAt = new Date().toISOString();
  const mark: PlatformMark = result.success && result.data
    ? { ...(prev || {}), posted: false, sent: platform === 'youtube' ? 'scheduled' : 'draft', pfm_id: result.data.id, for: later || sentAt }
    : { ...(prev || {}), posted: false, sent: 'failed', error: plainError(result.error) };
  await executeQuery(
    `UPDATE social_posts SET platform_status = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify({ ...status, [platform]: { ...mark, sent_at: sentAt } }), sentAt, id],
  );

  if (!result.success) return NextResponse.json({ error: mark.error, mark }, { status: 502 });
  return NextResponse.json({ ok: true, mark });
}
