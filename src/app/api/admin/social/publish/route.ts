import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { createPost, CreatePostInput } from '@/lib/postforme';

export const runtime = 'edge';

interface SocialContent {
  id: number;
  upload_uid: string | null;
  thumbnail_url: string | null;
  title: string;
  video_id: number | null;
  caption_instagram: string | null;
  caption_tiktok: string | null;
  caption_youtube: string | null;
  hashtags_instagram: string | null;
  hashtags_tiktok: string | null;
  hashtags_youtube: string | null;
  title_youtube: string | null;
  description_youtube: string | null;
  is_youtube_short: number;
  source_type: string;
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
  const user = getUserFromRequest(request);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const contentId = (body as { content_id?: number }).content_id;
    const platforms = (body as { platforms?: string[] }).platforms || [];
    const publishNow = (body as { publish_now?: boolean }).publish_now ?? true;
    const scheduleAt = (body as { scheduled_at?: string }).scheduled_at;

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

    // Video URL - Cloudflare Stream downloadable MP4
    const videoUrl = `https://videodelivery.net/${content.upload_uid}/downloads/default.mp4`;

    // Build Post for Me request with account-specific configurations
    const postForMeAccountIds = accounts.map((acc) => acc.postforme_account_id);

    // Helper to parse hashtags into array for YouTube
    const parseHashtags = (hashtagString: string | null): string[] => {
      if (!hashtagString) return [];
      return hashtagString
        .split(/[\s,]+/)
        .filter(tag => tag.startsWith('#'))
        .map(tag => tag.substring(1));
    };

    // Build platform-specific configurations
    const platformConfigurations: Record<string, any> = {};
    
    // Check which platforms are being used
    const platformsSet = new Set(accounts.map(acc => acc.platform.toLowerCase()));

    // Instagram configuration
    if (platformsSet.has('instagram')) {
      const igCaption = content.caption_instagram || content.title || '';
      const igHashtags = content.hashtags_instagram || '';
      platformConfigurations.instagram = {
        caption: igHashtags ? `${igCaption}\n\n${igHashtags}` : igCaption,
        placement: 'REELS',
        share_to_feed: true,
      };
    }

    // TikTok configuration
    if (platformsSet.has('tiktok')) {
      const ttCaption = content.caption_tiktok || content.title || '';
      const ttHashtags = content.hashtags_tiktok || '';
      platformConfigurations.tiktok = {
        title: ttCaption,
        description: ttHashtags,
        allow_duet: true,
        allow_stitch: true,
        allow_comment: true,
      };
    }

    // YouTube configuration
    if (platformsSet.has('youtube')) {
      const ytTitle = content.title_youtube || content.title || 'Untitled';
      const ytCaption = content.caption_youtube || content.description_youtube || '';
      const ytHashtags = content.hashtags_youtube || '';
      const ytDescription = ytHashtags ? `${ytCaption}\n\n${ytHashtags}` : ytCaption;
      
      platformConfigurations.youtube = {
        title: ytTitle.substring(0, 100), // YouTube title max 100 chars
        description: ytDescription,
        tags: parseHashtags(content.hashtags_youtube),
        privacy_status: 'public',
        category_id: '10', // Music category
        made_for_kids: false,
      };

      // Determine if this should be a Short based on content type or flag
      const isShort = content.is_youtube_short === 1 || content.source_type === 'clip';
      if (isShort) {
        platformConfigurations.youtube.shorts = true;
      }
    }

    const createPostInput: CreatePostInput = {
      social_accounts: postForMeAccountIds,
      media: [
        {
          url: videoUrl,
          type: 'video',
        },
      ],
      platform_configurations: platformConfigurations,
    };

    // Add scheduling if not publishing now
    if (!publishNow && scheduleAt) {
      createPostInput.scheduled_at = scheduleAt;
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

    // Store PostForMe post ID and initial status
    const postForMePostId = result.data?.id || null;
    const postForMeStatus = publishNow ? 'publishing' : 'scheduled';

    if (publishNow) {
      // Publishing immediately - set posted_at and posted_platforms
      await executeQuery(
        `UPDATE social_content
         SET status = ?,
             posted_at = ?,
             posted_platforms = ?,
             postforme_id = ?,
             postforme_status = ?,
             last_status_sync = ?,
             updated_at = ?
         WHERE id = ?`,
        [newStatus, now, platformsJson, postForMePostId, postForMeStatus, now, now, contentId]
      );
    } else {
      // Scheduling - set scheduled_for and scheduled_platforms
      await executeQuery(
        `UPDATE social_content
         SET status = ?,
             scheduled_for = ?,
             scheduled_platforms = ?,
             postforme_id = ?,
             postforme_status = ?,
             last_status_sync = ?,
             updated_at = ?
         WHERE id = ?`,
        [newStatus, scheduleAt, platformsJson, postForMePostId, postForMeStatus, now, now, contentId]
      );
    }

    // NOTE: We do NOT make content visible here.
    // Visibility is only updated when PostForMe confirms the post is PUBLISHED (not scheduled).
    // This happens in /api/admin/social/status when we sync and see status = 'published'.
    // The status sync route will:
    // 1. Make the video visible (publication_status = 'live')
    // 2. If it's a parent video (not a clip), make all its clips visible too

    return NextResponse.json({
      success: true,
      status: newStatus,
      postforme_id: postForMePostId,
      postforme_status: postForMeStatus,
      platforms_published: platforms,
      video_made_public: !!(content.video_id || content.upload_uid),
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
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
