import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { createPost, getAccounts } from '@/lib/postforme';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

interface DeployMetadata {
  title?: string;
  description?: string;
  firstComment?: string;
  hashtags?: string[];
  visibility?: 'public' | 'unlisted' | 'private';
  // Platform-specific settings
  youtube?: {
    madeForKids: boolean;
    category: string; // YouTube category ID
    asShort: boolean;
  };
  tiktok?: {
    allowDuet: boolean;
    allowStitch: boolean;
    allowComments: boolean;
  };
  instagram?: {
    shareToFeed: boolean;
  };
}

interface DeployRequest {
  videoIds: number[];
  platforms: string[];
  scheduleAt?: string;
  metadata?: DeployMetadata;
  wodaGenerationId?: number; // Track which AI generation was used
}

interface Video {
  id: number;
  uid: string;
  title: string;
  url: string;
  mp4_url: string | null;
  poster_url: string | null;
  thumbnail: string | null;
  parent_video_id: number | null;
  mood?: string;
  category?: string;
  type?: string;
}

/**
 * Format caption based on video type and metadata
 */
function formatCaption(
  video: Video,
  metadata: DeployMetadata | undefined,
  isClip: boolean
): string {
  const title = metadata?.title || video.title || 'New video';
  const description = metadata?.description || '';

  if (isClip && metadata?.hashtags?.length) {
    // Clips: Short caption + hashtags for TikTok/Reels/Shorts
    const hashtags = metadata.hashtags
      .map(h => (h.startsWith('#') ? h : `#${h}`))
      .join(' ');

    return description
      ? `${title}\n\n${description}\n\n${hashtags}`
      : `${title}\n\n${hashtags}`;
  }

  // Long video: Title + description
  return description ? `${title}\n\n${description}` : title;
}

/**
 * POST /api/arsenal/deploy
 * Deploy videos to social platforms via Post for Me
 * Each platform gets deployed separately for proper tracking
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Server-side authentication using httpOnly cookies
    const user = getUserFromRequest(request);
    if (!isAdminUser(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Admins only' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as DeployRequest;
    const { videoIds, platforms, scheduleAt, metadata, wodaGenerationId } = body;

    if (!videoIds?.length || !platforms?.length) {
      return NextResponse.json(
        { error: 'videoIds and platforms are required' },
        { status: 400 }
      );
    }

    // Get videos to deploy with proper columns (not flat social columns)
    const placeholders = videoIds.map(() => '?').join(',');
    const videos = await queryDatabase(
      `SELECT id, uid, title, url, mp4_url, poster_url, thumbnail, parent_video_id, mood, category, type
       FROM videos
       WHERE id IN (${placeholders})`,
      videoIds
    ) as Video[];

    if (!videos || videos.length === 0) {
      return NextResponse.json(
        { error: 'No videos found' },
        { status: 404 }
      );
    }

    // Get connected accounts from Post for Me
    const accountsResponse = await getAccounts();
    if (!accountsResponse.success || !accountsResponse.data) {
      return NextResponse.json(
        { error: 'Failed to fetch social accounts' },
        { status: 500 }
      );
    }

    const accounts = accountsResponse.data;

    // Map platform names to account IDs
    const platformToAccountMap: Record<string, string> = {};
    for (const account of accounts) {
      const platform = account.platform.toLowerCase();
      if (platform.includes('youtube') && platforms.includes('youtube')) {
        platformToAccountMap['youtube'] = account.id;
      }
      if (platform.includes('tiktok') && platforms.includes('tiktok')) {
        platformToAccountMap['tiktok'] = account.id;
      }
      if (platform.includes('instagram') && platforms.includes('instagram')) {
        platformToAccountMap['instagram'] = account.id;
      }
    }

    if (Object.keys(platformToAccountMap).length === 0) {
      return NextResponse.json(
        { error: 'No connected accounts found for selected platforms' },
        { status: 400 }
      );
    }

    // Deploy each video to each platform separately
    const results: Array<{
      videoId: number;
      platform: string;
      success: boolean;
      postId?: string;
      externalUrl?: string;
      error?: string;
    }> = [];

    for (const video of videos) {
      // Construct proper video URL for PostForMe
      // PostForMe needs a direct video URL (not iframe embed)
      let videoUrl = video.mp4_url;

      // If no mp4_url, construct from uid
      if (!videoUrl && video.uid) {
        // Try HLS manifest URL (most compatible with PostForMe)
        videoUrl = `https://videodelivery.net/${video.uid}/manifest/video.m3u8`;
      }

      // Last resort: use the url field (though it may be an iframe URL)
      if (!videoUrl) {
        videoUrl = video.url;
      }

      if (!videoUrl) {
        for (const platform of platforms) {
          results.push({
            videoId: video.id,
            platform,
            success: false,
            error: 'No video URL available',
          });
        }
        continue;
      }

      const isClip = video.parent_video_id !== null;

      // Build media array - video first, then thumbnail if available
      const media: Array<{ url: string; type: 'image' | 'video' }> = [
        { url: videoUrl, type: 'video' },
      ];

      // Add thumbnail (prefer custom thumbnail over poster)
      const thumbnailUrl = video.thumbnail || video.poster_url;
      if (thumbnailUrl) {
        media.push({ url: thumbnailUrl, type: 'image' });
      }

      // Format caption based on video type
      const caption = formatCaption(video, metadata, isClip);

      // Deploy to each platform individually
      for (const platform of platforms) {
        const accountId = platformToAccountMap[platform];

        if (!accountId) {
          results.push({
            videoId: video.id,
            platform,
            success: false,
            error: `No connected ${platform} account found`,
          });
          continue;
        }

        // Build platform-specific configuration
        const platform_configurations: any = {};

        if (platform === 'youtube' && metadata?.youtube) {
          platform_configurations.youtube = {
            title: metadata.title || video.title,
            privacy_status: metadata.visibility || 'public',
            made_for_kids: metadata.youtube.madeForKids,
            category_id: metadata.youtube.category,
            description: metadata.description,
          };
        }

        if (platform === 'tiktok' && metadata?.tiktok) {
          platform_configurations.tiktok = {
            title: metadata.title || video.title,
            privacy_status: metadata.visibility === 'private' ? 'self_only' : 'public',
            allow_duet: metadata.tiktok.allowDuet,
            allow_stitch: metadata.tiktok.allowStitch,
            allow_comment: metadata.tiktok.allowComments,
            description: metadata.description,
          };
        }

        if (platform === 'instagram' && metadata?.instagram) {
          platform_configurations.instagram = {
            placement: isClip ? 'REELS' : 'FEED',
            share_to_feed: metadata.instagram.shareToFeed,
          };
        }

        console.log('[Arsenal Deploy]', {
          videoId: video.id,
          platform,
          accountId,
          scheduleAt,
          hasSchedule: !!scheduleAt,
        });

        // Create post via Post for Me (one platform at a time)
        const postResponse = await createPost({
          caption,
          social_accounts: [accountId], // Single account
          media,
          schedule_at: scheduleAt,
          first_comment: metadata?.firstComment || undefined,
          platform_configurations: Object.keys(platform_configurations).length > 0
            ? platform_configurations
            : undefined,
        });

        console.log('[Arsenal Deploy] PostForMe response:', {
          success: postResponse.success,
          platform,
          postId: postResponse.data?.id,
          status: postResponse.data?.status,
          externalUrl: postResponse.data?.external_url,
          scheduledAt: postResponse.data?.scheduled_at,
          error: postResponse.error,
        });

        if (postResponse.success && postResponse.data) {
          const postId = postResponse.data.id;
          const postStatus = postResponse.data.status || (scheduleAt ? 'scheduled' : 'published');
          const externalUrl = postResponse.data.external_url || null;
          const externalId = postResponse.data.external_id || null;

          // Create video_deployments record
          try {
            await executeQuery(
              `INSERT INTO video_deployments (
                video_id,
                platform,
                postforme_post_id,
                external_url,
                external_id,
                status,
                deployed_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                video.id,
                platform,
                postId,
                externalUrl,
                externalId,
                postStatus,
                new Date().toISOString(),
              ]
            );

            results.push({
              videoId: video.id,
              platform,
              success: true,
              postId,
              externalUrl: externalUrl || undefined,
            });
          } catch (dbError) {
            console.error('[Arsenal] Failed to create deployment record:', dbError);
            results.push({
              videoId: video.id,
              platform,
              success: false,
              error: 'Deployment succeeded but failed to save record',
            });
          }
        } else {
          results.push({
            videoId: video.id,
            platform,
            success: false,
            error: postResponse.error || 'Unknown error',
          });
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    // Record positive feedback for Woda-generated content that was deployed
    if (wodaGenerationId && successCount > 0) {
      try {
        await executeQuery(
          `UPDATE ai_generation_feedback
           SET rating = 1, feedback_notes = 'deployed to platforms'
           WHERE id = ?`,
          [wodaGenerationId]
        );
      } catch (e) {
        console.error('[Arsenal] Failed to record Woda feedback:', e);
      }
    }

    // Auto-capture user-written captions as training examples (passive learning)
    // Only if user wrote this themselves (no wodaGenerationId)
    if (metadata && !wodaGenerationId && successCount > 0) {
      try {
        for (const video of videos) {
          const isClip = video.parent_video_id !== null;
          const caption = formatCaption(video, metadata, isClip);

          // Only capture if there's meaningful content
          if (caption && caption.length > 10) {
            await executeQuery(
              `INSERT INTO ai_training_examples (
                profile_id, content, platform, rating, source, notes,
                video_id, video_mood, video_category, video_type, is_clip, parent_video_id
              ) VALUES (?, ?, ?, 'perfect', 'deployed', ?, ?, ?, ?, ?, ?, ?)`,
              [
                1, // default profile
                caption,
                platforms.join(','),
                `Auto-captured from deploy. Video: ${video.title}`,
                video.id,
                video.mood || null,
                video.category || null,
                video.type || null,
                isClip ? 1 : 0,
                video.parent_video_id,
              ]
            );
          }
        }
      } catch (e) {
        console.error('[Woda] Failed to capture training example:', e);
      }
    }

    return NextResponse.json({
      message: `Deployed ${successCount} times${failCount > 0 ? `, ${failCount} failed` : ''}`,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failCount,
        byPlatform: platforms.reduce((acc: Record<string, number>, platform) => {
          acc[platform] = results.filter(r => r.platform === platform && r.success).length;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error('[Arsenal] Deploy error:', error);
    return NextResponse.json(
      { error: 'Failed to deploy videos' },
      { status: 500 }
    );
  }
}