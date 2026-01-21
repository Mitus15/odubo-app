import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { createPost, CreatePostInput } from '@/lib/postforme';

export const runtime = 'edge';

interface SocialPost {
  id: string;
  status: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
  caption?: string;
  caption_by_platform?: string;
  hashtags?: string;
  mentions?: string;
  first_comment?: string;
  scheduled_at?: string;
  platforms: string;
  account_ids: string;
  platform_status?: string;
  platform_post_ids?: string;
  platform_errors?: string;
}

interface SocialAccount {
  id: string;
  platform: string;
  postforme_account_id: string;
  account_handle: string;
  is_active: number;
}

/**
 * POST /api/social/posts/publish
 * Publish a post to social platforms via Post for Me API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const postId = (body as { post_id?: string }).post_id;
    const publishNow = (body as { publish_now?: boolean }).publish_now ?? false;

    if (!postId) {
      return NextResponse.json({ error: 'post_id is required' }, { status: 400 });
    }

    // Get the post
    const posts = await queryDatabase(
      `SELECT * FROM social_posts WHERE id = ?`,
      [postId]
    );
    const post = posts?.[0] as SocialPost | undefined;

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check if already published
    if (post.status === 'published') {
      return NextResponse.json({ error: 'Post already published' }, { status: 400 });
    }

    // Parse account_ids from JSON (new approach)
    let accountIds: string[] = [];
    try {
      accountIds = JSON.parse(post.account_ids || '[]');
    } catch {
      // Fallback: try legacy platforms approach
    }

    // Legacy fallback: if no account_ids, derive from platforms
    let platforms: string[] = [];
    if (accountIds.length === 0) {
      try {
        platforms = JSON.parse(post.platforms || '[]');
      } catch {
        return NextResponse.json({ error: 'Invalid platforms/accounts data' }, { status: 400 });
      }
      if (platforms.length === 0) {
        return NextResponse.json({ error: 'No accounts or platforms specified' }, { status: 400 });
      }
    }

    let fetchedAccounts: SocialAccount[] = [];

    if (accountIds.length > 0) {
      // New approach: fetch by specific account IDs
      const placeholders = accountIds.map(() => '?').join(', ');
      fetchedAccounts = await queryDatabase(
        `SELECT * FROM social_accounts WHERE id IN (${placeholders}) AND is_active = 1`,
        accountIds
      ) as SocialAccount[] || [];

      // Check all accounts were found
      const foundIds = fetchedAccounts.map((a) => a.id);
      const missingIds = accountIds.filter((id) => !foundIds.includes(id));
      if (missingIds.length > 0) {
        return NextResponse.json(
          { error: `Some accounts not found or inactive: ${missingIds.join(', ')}` },
          { status: 400 }
        );
      }
    } else {
      // Legacy approach: fetch by platform names
      const placeholders = platforms.map(() => '?').join(', ');
      fetchedAccounts = await queryDatabase(
        `SELECT * FROM social_accounts WHERE platform IN (${placeholders}) AND is_active = 1`,
        platforms
      ) as SocialAccount[] || [];

      // Check we have accounts for all platforms
      const foundPlatforms = new Set(fetchedAccounts.map((a) => a.platform));
      const missingPlatforms = platforms.filter((p) => !foundPlatforms.has(p));
      if (missingPlatforms.length > 0) {
        return NextResponse.json(
          { error: `No connected accounts for: ${missingPlatforms.join(', ')}` },
          { status: 400 }
        );
      }
    }

    if (fetchedAccounts.length === 0) {
      return NextResponse.json({ error: 'No valid accounts to publish to' }, { status: 400 });
    }

    // Build the Post for Me API request
    const postForMeAccountIds = fetchedAccounts.map((acc) => acc.postforme_account_id);
    const publishPlatforms = fetchedAccounts.map((acc) => acc.platform);

    // Build caption with hashtags
    let fullCaption = post.caption || '';
    try {
      const hashtags = JSON.parse(post.hashtags || '[]') as string[];
      if (hashtags.length > 0) {
        fullCaption += '\n\n' + hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
      }
    } catch {
      // Ignore hashtag parsing errors
    }

    const createPostInput: CreatePostInput = {
      caption: fullCaption,
      social_accounts: postForMeAccountIds,
      media: [
        {
          url: post.media_url,
          type: post.media_type === 'image' ? 'image' : 'video',
        },
      ],
      first_comment: post.first_comment || undefined,
    };

    if (!publishNow) {
      if (!post.scheduled_at) {
        return NextResponse.json({ error: 'scheduled_at is required for scheduling' }, { status: 400 });
      }

      const scheduledDate = new Date(post.scheduled_at);
      if (Number.isNaN(scheduledDate.getTime())) {
        return NextResponse.json({ error: 'scheduled_at is invalid' }, { status: 400 });
      }

      if (scheduledDate.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'scheduled_at must be in the future' }, { status: 400 });
      }
    }

    // CRITICAL: For scheduled posts, do NOT send to Post for Me yet
    // Instead, store locally and let cron job publish at scheduled time
    if (!publishNow) {
      // Just update status to scheduled - cron will handle actual publishing
      await executeQuery(
        `UPDATE social_posts
         SET status = 'scheduled', updated_at = datetime('now')
         WHERE id = ?`,
        ['scheduled', postId]
      );

      // Log scheduling
      await executeQuery(
        `INSERT INTO social_activity_log (id, user_id, action, target_type, target_id, details)
         VALUES (?, 'system', 'scheduled', 'post', ?, ?)`,
        [
          crypto.randomUUID().split('-')[0],
          postId,
          JSON.stringify({
            platforms: publishPlatforms,
            account_ids: fetchedAccounts.map((a) => a.id),
            scheduled_at: post.scheduled_at,
          })
        ]
      );

      return NextResponse.json({
        success: true,
        status: 'scheduled',
        message: 'Post scheduled successfully. It will be published at the scheduled time.',
      });
    }

    // For immediate posts, update status to publishing and call Post for Me
    await executeQuery(
      `UPDATE social_posts SET status = 'publishing', updated_at = datetime('now') WHERE id = ?`,
      [postId]
    );

    // Call Post for Me API (without schedule_at - publish immediately)
    const result = await createPost(createPostInput);

    if (!result.success) {
      // Update post status to failed
      await executeQuery(
        `UPDATE social_posts
         SET status = 'failed', error_message = ?, retry_count = retry_count + 1,
             last_retry_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`,
        [result.error || 'Unknown error', postId]
      );

      // Log the failure
      await executeQuery(
        `INSERT INTO social_activity_log (id, user_id, action, target_type, target_id, details)
         VALUES (?, 'system', 'publish_failed', 'post', ?, ?)`,
        [crypto.randomUUID().split('-')[0], postId, JSON.stringify({ error: result.error })]
      );

      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    // Success! Update post status to published
    const platformPostIds = result.data ? { postforme_id: result.data.id } : {};

    await executeQuery(
      `UPDATE social_posts
       SET status = 'published', platform_post_ids = ?, published_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
      ['published', JSON.stringify(platformPostIds), postId]
    );

    // Log success
    await executeQuery(
      `INSERT INTO social_activity_log (id, user_id, action, target_type, target_id, details)
       VALUES (?, 'system', 'published', 'post', ?, ?)`,
      [
        crypto.randomUUID().split('-')[0],
        postId,
        JSON.stringify({
          platforms: publishPlatforms,
          account_ids: fetchedAccounts.map((a) => a.id),
          postforme_id: result.data?.id,
        })
      ]
    );

    return NextResponse.json({
      success: true,
      status: 'published',
      postforme_id: result.data?.id,
    });
  } catch (error) {
    console.error('[Social Publish] Error:', error);
    return NextResponse.json(
      { error: 'Failed to publish post', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
