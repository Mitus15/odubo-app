import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { createPost, getAccounts } from '@/lib/postforme';

export const runtime = 'nodejs';

interface DeployMetadata {
  title?: string;
  description?: string;
  firstComment?: string;
  hashtags?: string[];
  visibility?: 'public' | 'unlisted' | 'private';
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
  parent_video_id: number | null;
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
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DeployRequest;
    const { videoIds, platforms, scheduleAt, metadata, wodaGenerationId } = body;

    if (!videoIds?.length || !platforms?.length) {
      return NextResponse.json(
        { error: 'videoIds and platforms are required' },
        { status: 400 }
      );
    }

    // Get videos to deploy
    const placeholders = videoIds.map(() => '?').join(',');
    const videos = await queryDatabase(
      `SELECT id, uid, title, url, mp4_url, poster_url, parent_video_id
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

    const selectedAccountIds = Object.values(platformToAccountMap);

    if (selectedAccountIds.length === 0) {
      return NextResponse.json(
        { error: 'No connected accounts found for selected platforms' },
        { status: 400 }
      );
    }

    // Deploy each video
    const results: Array<{ videoId: number; success: boolean; postId?: string; error?: string }> = [];

    for (const video of videos) {
      const videoUrl = video.mp4_url || video.url;

      if (!videoUrl) {
        results.push({
          videoId: video.id,
          success: false,
          error: 'No video URL available',
        });
        continue;
      }

      const isClip = video.parent_video_id !== null;

      // Save metadata to video for future reuse
      if (metadata) {
        await executeQuery(
          `UPDATE videos SET
            social_description = ?,
            social_hashtags = ?,
            social_first_comment = ?,
            social_visibility = ?
           WHERE id = ?`,
          [
            metadata.description || null,
            metadata.hashtags ? JSON.stringify(metadata.hashtags) : null,
            metadata.firstComment || null,
            metadata.visibility || 'public',
            video.id,
          ]
        );
      }

      // Build media array - video first, then thumbnail if available
      const media: Array<{ url: string; type: 'image' | 'video' }> = [
        { url: videoUrl, type: 'video' },
      ];

      // Add poster as thumbnail (some platforms will use it)
      if (video.poster_url) {
        media.push({ url: video.poster_url, type: 'image' });
      }

      // Format caption based on video type
      const caption = formatCaption(video, metadata, isClip);

      // Create post via Post for Me
      const postResponse = await createPost({
        caption,
        social_accounts: selectedAccountIds,
        media,
        schedule_at: scheduleAt,
        first_comment: metadata?.firstComment || undefined,
      });

      if (postResponse.success && postResponse.data) {
        const postId = postResponse.data.id;

        // Update video with Post for Me tracking info
        await executeQuery(
          `UPDATE videos
           SET postforme_post_id = ?,
               postforme_status = ?
           WHERE id = ?`,
          [postId, scheduleAt ? 'scheduled' : 'published', video.id]
        );

        results.push({
          videoId: video.id,
          success: true,
          postId,
        });
      } else {
        results.push({
          videoId: video.id,
          success: false,
          error: postResponse.error || 'Unknown error',
        });
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
                (video as Record<string, unknown>).mood || null,
                (video as Record<string, unknown>).category || null,
                (video as Record<string, unknown>).type || null,
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
      message: `Deployed ${successCount} videos${failCount > 0 ? `, ${failCount} failed` : ''}`,
      results,
    });
  } catch (error) {
    console.error('[Arsenal] Deploy error:', error);
    return NextResponse.json(
      { error: 'Failed to deploy videos' },
      { status: 500 }
    );
  }
}
