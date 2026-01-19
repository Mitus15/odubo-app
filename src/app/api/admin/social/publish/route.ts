import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { createPost, CreatePostInput } from '@/lib/postforme';

export const runtime = 'edge';

interface SocialContent {
  id: number;
  upload_uid: string | null;
  thumbnail_url: string | null;
  title: string;
  caption_instagram: string | null;
  caption_tiktok: string | null;
  caption_youtube: string | null;
  hashtags_instagram: string | null;
  hashtags_tiktok: string | null;
  hashtags_youtube: string | null;
  status: string;
}

interface SocialAccount {
  id: string;
  platform: string;
  postforme_account_id: string;
  account_handle: string;
  is_active: number;
}

/**
 * POST /api/admin/social/publish
 * Publish social_content directly to platforms via Post for Me API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const contentId = (body as { content_id?: number }).content_id;
    const platforms = (body as { platforms?: string[] }).platforms || [];
    const publishNow = (body as { publish_now?: boolean }).publish_now ?? true;
    const scheduleAt = (body as { schedule_at?: string }).schedule_at;

    if (!contentId) {
      return NextResponse.json({ error: 'content_id is required' }, { status: 400 });
    }

    if (platforms.length === 0) {
      return NextResponse.json({ error: 'At least one platform is required' }, { status: 400 });
    }

    // Get the content
    const contentResult = await queryDatabase(
      'SELECT * FROM social_content WHERE id = ?',
      [contentId]
    );
    const content = contentResult?.[0] as SocialContent | undefined;

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    if (!content.upload_uid) {
      return NextResponse.json({ error: 'Content has no video attached' }, { status: 400 });
    }

    // Get connected accounts for selected platforms
    const placeholders = platforms.map(() => '?').join(', ');
    const accounts = await queryDatabase(
      `SELECT * FROM social_accounts WHERE platform IN (${placeholders}) AND is_active = 1`,
      platforms
    ) as SocialAccount[];

    if (!accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: `No connected accounts for: ${platforms.join(', ')}. Go to Connected Accounts tab to sync from PostForMe.` },
        { status: 400 }
      );
    }

    // Check we have accounts for all requested platforms
    const foundPlatforms = new Set(accounts.map((a) => a.platform));
    const missingPlatforms = platforms.filter((p) => !foundPlatforms.has(p));
    if (missingPlatforms.length > 0) {
      return NextResponse.json(
        { error: `Missing connected accounts for: ${missingPlatforms.join(', ')}` },
        { status: 400 }
      );
    }

    // Build caption - use the first platform's caption
    // Post for Me will use this caption for all platforms
    const primaryPlatform = platforms[0];
    let caption = '';
    let hashtags = '';

    if (primaryPlatform === 'instagram') {
      caption = content.caption_instagram || content.title || '';
      hashtags = content.hashtags_instagram || '';
    } else if (primaryPlatform === 'tiktok') {
      caption = content.caption_tiktok || content.title || '';
      hashtags = content.hashtags_tiktok || '';
    } else if (primaryPlatform === 'youtube') {
      caption = content.caption_youtube || content.title || '';
      hashtags = content.hashtags_youtube || '';
    } else {
      caption = content.title || '';
    }

    // Combine caption and hashtags
    const fullCaption = hashtags ? `${caption}\n\n${hashtags}` : caption;

    // Video URL - Cloudflare Stream downloadable MP4
    const videoUrl = `https://videodelivery.net/${content.upload_uid}/downloads/default.mp4`;

    // Build Post for Me request
    const postForMeAccountIds = accounts.map((acc) => acc.postforme_account_id);

    const createPostInput: CreatePostInput = {
      caption: fullCaption,
      social_accounts: postForMeAccountIds,
      media: [
        {
          url: videoUrl,
          type: 'video',
        },
      ],
    };

    // Add scheduling if not publishing now
    if (!publishNow && scheduleAt) {
      createPostInput.schedule_at = scheduleAt;
    }

    // Call Post for Me API
    const result = await createPost(createPostInput);

    if (!result.success) {
      // Log failure
      console.error('[Social Publish] PostForMe error:', result.error);

      return NextResponse.json(
        { success: false, error: result.error || 'Failed to publish via PostForMe' },
        { status: 500 }
      );
    }

    // Success! Update content status
    const newStatus = publishNow ? 'posted' : 'scheduled';
    const now = new Date().toISOString();
    const platformsJson = JSON.stringify(platforms);

    if (publishNow) {
      // Publishing immediately - set posted_at and posted_platforms
      await executeQuery(
        `UPDATE social_content
         SET status = ?,
             posted_at = ?,
             posted_platforms = ?,
             postforme_id = ?,
             updated_at = ?
         WHERE id = ?`,
        [newStatus, now, platformsJson, result.data?.id || null, now, contentId]
      );
    } else {
      // Scheduling - set scheduled_for and scheduled_platforms
      await executeQuery(
        `UPDATE social_content
         SET status = ?,
             scheduled_for = ?,
             scheduled_platforms = ?,
             postforme_id = ?,
             updated_at = ?
         WHERE id = ?`,
        [newStatus, scheduleAt, platformsJson, result.data?.id || null, now, contentId]
      );
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      postforme_id: result.data?.id,
      platforms_published: platforms,
    });
  } catch (error) {
    console.error('[Social Publish] Error:', error);
    return NextResponse.json(
      { error: 'Failed to publish', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/social/publish
 * Get connected accounts for publishing
 */
export async function GET() {
  try {
    // Get all active accounts
    const accounts = await queryDatabase(
      'SELECT * FROM social_accounts WHERE is_active = 1 ORDER BY platform',
      []
    ) as SocialAccount[];

    if (!accounts) {
      return NextResponse.json({
        success: true,
        accounts: {},
        platforms_available: [],
      });
    }

    // Group by platform
    const accountsByPlatform = accounts.reduce((acc, account) => {
      const platform = account.platform.toLowerCase();
      if (!acc[platform]) acc[platform] = [];
      acc[platform].push({
        id: account.id,
        handle: account.account_handle,
        postforme_id: account.postforme_account_id,
      });
      return acc;
    }, {} as Record<string, Array<{ id: string; handle: string; postforme_id: string }>>);

    return NextResponse.json({
      success: true,
      accounts: accountsByPlatform,
      platforms_available: Object.keys(accountsByPlatform),
    });
  } catch (error) {
    console.error('[Social Publish] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
