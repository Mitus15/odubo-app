import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { createPost, CreatePostInput } from '@/lib/postforme';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'edge';

interface ScheduledPost {
  id: string;
  media_type: string;
  media_url: string;
  caption?: string;
  hashtags?: string;
  first_comment?: string;
  scheduled_at: string;
  platforms: string;
  account_ids: string;
}

interface SocialAccount {
  id: string;
  platform: string;
  postforme_account_id: string;
  account_handle: string;
  is_active: number;
}

/**
 * POST /api/social/posts/process-scheduled
 * Process all due scheduled posts and publish them to Post for Me
 * Called by cron job or manual trigger
 */
export async function POST(request: NextRequest) {
  try {
    // Check authorization - allow cron secret or admin user
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
    
    if (!isCronAuth) {
      const user = getUserFromRequest(request);
      if (!isAdminUser(user)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Get all scheduled posts that are due (scheduled_at <= now)
    const now = new Date().toISOString();
    const duePosts = await queryDatabase(
      `SELECT * FROM social_posts 
       WHERE status = 'scheduled' 
       AND scheduled_at <= ?
       ORDER BY scheduled_at ASC`,
      [now]
    ) as ScheduledPost[] || [];

    console.log(`[Process Scheduled] Found ${duePosts.length} due posts`);

    const results = {
      processed: 0,
      published: 0,
      failed: 0,
      errors: [] as Array<{ post_id: string; error: string }>,
    };

    // Process each post
    for (const post of duePosts) {
      results.processed++;

      try {
        // Parse account IDs
        let accountIds: string[] = [];
        try {
          accountIds = JSON.parse(post.account_ids || '[]');
        } catch {
          throw new Error('Invalid account_ids data');
        }

        if (accountIds.length === 0) {
          throw new Error('No accounts specified');
        }

        // Fetch accounts
        const placeholders = accountIds.map(() => '?').join(', ');
        const fetchedAccounts = await queryDatabase(
          `SELECT * FROM social_accounts WHERE id IN (${placeholders}) AND is_active = 1`,
          accountIds
        ) as SocialAccount[] || [];

        if (fetchedAccounts.length === 0) {
          throw new Error('No valid accounts found');
        }

        // Build Post for Me request
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

        // Update status to publishing
        await executeQuery(
          `UPDATE social_posts SET status = 'publishing', updated_at = datetime('now') WHERE id = ?`,
          [post.id]
        );

        // Call Post for Me API (without schedule_at - publish immediately)
        const result = await createPost(createPostInput);

        if (!result.success) {
          throw new Error(result.error || 'Post for Me API error');
        }

        // Success! Update to published
        const platformPostIds = result.data ? { postforme_id: result.data.id } : {};

        await executeQuery(
          `UPDATE social_posts
           SET status = 'published', 
               platform_post_ids = ?, 
               published_at = datetime('now'), 
               updated_at = datetime('now')
           WHERE id = ?`,
          [JSON.stringify(platformPostIds), post.id]
        );

        // Log success
        await executeQuery(
          `INSERT INTO social_activity_log (id, user_id, action, target_type, target_id, details)
           VALUES (?, 'system', 'auto_published', 'post', ?, ?)`,
          [
            crypto.randomUUID().split('-')[0],
            post.id,
            JSON.stringify({
              platforms: publishPlatforms,
              account_ids: fetchedAccounts.map((a) => a.id),
              postforme_id: result.data?.id,
              scheduled_at: post.scheduled_at,
            })
          ]
        );

        results.published++;
        console.log(`[Process Scheduled] Published post ${post.id}`);

      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        console.error(`[Process Scheduled] Failed to publish post ${post.id}:`, errorMsg);
        
        results.errors.push({
          post_id: post.id,
          error: errorMsg,
        });

        // Update post status to failed
        await executeQuery(
          `UPDATE social_posts
           SET status = 'failed', 
               error_message = ?, 
               retry_count = retry_count + 1,
               last_retry_at = datetime('now'), 
               updated_at = datetime('now')
           WHERE id = ?`,
          [errorMsg, post.id]
        );

        // Log the failure
        await executeQuery(
          `INSERT INTO social_activity_log (id, user_id, action, target_type, target_id, details)
           VALUES (?, 'system', 'auto_publish_failed', 'post', ?, ?)`,
          [crypto.randomUUID().split('-')[0], post.id, JSON.stringify({ error: errorMsg })]
        );
      }
    }

    console.log(`[Process Scheduled] Complete: ${results.published} published, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      processed: results.processed,
      published: results.published,
      failed: results.failed,
      errors: results.errors,
    });

  } catch (error) {
    console.error('[Process Scheduled] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled posts', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
