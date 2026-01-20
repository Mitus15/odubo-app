import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import {
  platformConfigs,
  refreshAccessToken,
  type Platform,
} from '@/lib/platform-oauth';

export const runtime = 'edge';

/**
 * Manual Sync Trigger
 *
 * POST /api/connections/sync
 * Body: { platform: 'youtube' | 'instagram' | ... }
 *
 * Triggers a manual sync for the specified platform.
 * Refreshes tokens if needed before syncing.
 */
export async function POST(request: NextRequest) {
  try {
    const body: { platform?: string } = await request.json();
    const platform = body.platform as Platform;

    // Validate platform
    if (!platform || !platformConfigs[platform]) {
      return NextResponse.json(
        { error: 'Invalid platform specified' },
        { status: 400 }
      );
    }

    // Get connection
    const connections = await queryDatabase(
      `SELECT id, access_token, refresh_token, token_expires_at, status
       FROM platform_connections
       WHERE platform = ?`,
      [platform]
    );
    const connection = connections?.[0] as {
      id: string;
      access_token: string;
      refresh_token: string | null;
      token_expires_at: string | null;
      status: string;
    } | undefined;

    if (!connection) {
      return NextResponse.json(
        { error: 'No connection found for this platform' },
        { status: 404 }
      );
    }

    let accessToken = connection.access_token;

    // Check if token needs refresh
    if (connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at);
      const now = new Date();

      // Refresh if expires within 5 minutes
      if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        if (!connection.refresh_token) {
          // Mark connection as expired
          await executeQuery(
            `UPDATE platform_connections SET
               status = 'expired',
               last_error = 'Token expired and no refresh token available',
               updated_at = datetime('now')
             WHERE platform = ?`,
            [platform]
          );

          return NextResponse.json(
            {
              error: 'Token expired. Please reconnect the platform.',
              status: 'expired',
            },
            { status: 401 }
          );
        }

        try {
          // Refresh the token
          const tokens = await refreshAccessToken(platform, connection.refresh_token);
          accessToken = tokens.accessToken;

          // Update stored tokens
          const newExpiresAt = tokens.expiresIn
            ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
            : null;

          await executeQuery(
            `UPDATE platform_connections SET
               access_token = ?,
               refresh_token = ?,
               token_expires_at = ?,
               status = 'active',
               updated_at = datetime('now')
             WHERE platform = ?`,
            [
              tokens.accessToken,
              tokens.refreshToken || connection.refresh_token,
              newExpiresAt,
              platform
            ]
          );
        } catch (refreshError) {
          // Mark connection as error
          await executeQuery(
            `UPDATE platform_connections SET
               status = 'error',
               last_error = ?,
               updated_at = datetime('now')
             WHERE platform = ?`,
            [
              refreshError instanceof Error ? refreshError.message : 'Token refresh failed',
              platform
            ]
          );

          return NextResponse.json(
            { error: 'Failed to refresh token. Please reconnect.' },
            { status: 401 }
          );
        }
      }
    }

    // Create sync log entry
    const syncLogId = crypto.randomUUID().split('-')[0];
    await executeQuery(
      `INSERT INTO sync_logs (id, job_type, platform, status, started_at)
       VALUES (?, 'platform_sync', ?, 'running', datetime('now'))`,
      [syncLogId, platform]
    );

    // Run platform-specific sync
    let syncResult;
    try {
      syncResult = await runPlatformSync(platform, accessToken);

      // Update connection with last sync time
      await executeQuery(
        `UPDATE platform_connections SET
           last_sync_at = datetime('now'),
           status = 'active',
           last_error = NULL,
           updated_at = datetime('now')
         WHERE platform = ?`,
        [platform]
      );

      // Update sync log
      await executeQuery(
        `UPDATE sync_logs SET
           status = 'completed',
           records_fetched = ?,
           records_inserted = ?,
           completed_at = datetime('now')
         WHERE id = ?`,
        [syncResult.fetched, syncResult.inserted, syncLogId]
      );
    } catch (syncError) {
      // Update connection with error
      await executeQuery(
        `UPDATE platform_connections SET
           status = 'error',
           last_error = ?,
           updated_at = datetime('now')
         WHERE platform = ?`,
        [
          syncError instanceof Error ? syncError.message : 'Sync failed',
          platform
        ]
      );

      // Update sync log with error
      await executeQuery(
        `UPDATE sync_logs SET
           status = 'failed',
           error_message = ?,
           completed_at = datetime('now')
         WHERE id = ?`,
        [
          syncError instanceof Error ? syncError.message : 'Unknown error',
          syncLogId
        ]
      );

      throw syncError;
    }

    return NextResponse.json({
      success: true,
      platform,
      ...syncResult,
    });
  } catch (error) {
    console.error('[Sync API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * Run platform-specific sync logic
 */
async function runPlatformSync(
  platform: Platform,
  accessToken: string
): Promise<{ fetched: number; inserted: number; message: string }> {
  switch (platform) {
    case 'youtube':
      return syncYouTubeAnalytics(accessToken);

    case 'instagram':
      return syncInstagramMetrics(accessToken);

    case 'spotify':
      return syncSpotifyData(accessToken);

    case 'twitter':
      return syncTwitterMetrics(accessToken);

    case 'tiktok':
      return syncTikTokMetrics(accessToken);

    default:
      return {
        fetched: 0,
        inserted: 0,
        message: 'Platform sync not implemented yet',
      };
  }
}

/**
 * Sync YouTube Analytics
 */
async function syncYouTubeAnalytics(
  accessToken: string
): Promise<{ fetched: number; inserted: number; message: string }> {
  // Fetch channel statistics
  const channelRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!channelRes.ok) {
    throw new Error(`YouTube API error: ${channelRes.status}`);
  }

  const channelData: any = await channelRes.json();
  const channel = channelData.items?.[0];

  if (!channel) {
    return { fetched: 0, inserted: 0, message: 'No channel found' };
  }

  // Store channel metrics
  await executeQuery(
    `INSERT INTO social_account_metrics (
       platform, account_id, account_name,
       followers, total_views, total_videos,
       recorded_at
     ) VALUES ('youtube', ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT DO NOTHING`,
    [
      channel.id,
      channel.snippet.title,
      parseInt(channel.statistics.subscriberCount || '0'),
      parseInt(channel.statistics.viewCount || '0'),
      parseInt(channel.statistics.videoCount || '0')
    ]
  );

  return {
    fetched: 1,
    inserted: 1,
    message: `Synced YouTube channel: ${channel.snippet.title}`,
  };
}

/**
 * Sync Instagram Metrics
 */
async function syncInstagramMetrics(
  accessToken: string
): Promise<{ fetched: number; inserted: number; message: string }> {
  // Fetch basic profile info
  const profileRes = await fetch(
    `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${accessToken}`
  );

  if (!profileRes.ok) {
    throw new Error(`Instagram API error: ${profileRes.status}`);
  }

  const profile: any = await profileRes.json();

  // Store account metrics
  await executeQuery(
    `INSERT INTO social_account_metrics (
       platform, account_id, account_name,
       total_posts,
       recorded_at
     ) VALUES ('instagram', ?, ?, ?, datetime('now'))
     ON CONFLICT DO NOTHING`,
    [profile.id, profile.username, profile.media_count || 0]
  );

  return {
    fetched: 1,
    inserted: 1,
    message: `Synced Instagram profile: @${profile.username}`,
  };
}

/**
 * Sync Spotify Data (placeholder - requires artist API access)
 */
async function syncSpotifyData(
  accessToken: string
): Promise<{ fetched: number; inserted: number; message: string }> {
  // Basic profile fetch - artist analytics requires separate approval
  const profileRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileRes.ok) {
    throw new Error(`Spotify API error: ${profileRes.status}`);
  }

  const profile: any = await profileRes.json();

  return {
    fetched: 1,
    inserted: 0,
    message: `Connected as: ${profile.display_name}. Artist analytics requires Spotify for Artists API access.`,
  };
}

/**
 * Sync Twitter Metrics
 */
async function syncTwitterMetrics(
  accessToken: string
): Promise<{ fetched: number; inserted: number; message: string }> {
  const userRes = await fetch(
    'https://api.twitter.com/2/users/me?user.fields=public_metrics',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!userRes.ok) {
    throw new Error(`Twitter API error: ${userRes.status}`);
  }

  const userData: any = await userRes.json();
  const user = userData.data;
  const metrics = user.public_metrics || {};

  await executeQuery(
    `INSERT INTO social_account_metrics (
       platform, account_id, account_name,
       followers, following, total_posts,
       recorded_at
     ) VALUES ('twitter', ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT DO NOTHING`,
    [
      user.id,
      user.username,
      metrics.followers_count || 0,
      metrics.following_count || 0,
      metrics.tweet_count || 0
    ]
  );

  return {
    fetched: 1,
    inserted: 1,
    message: `Synced Twitter profile: @${user.username}`,
  };
}

/**
 * Sync TikTok Metrics
 */
async function syncTikTokMetrics(
  accessToken: string
): Promise<{ fetched: number; inserted: number; message: string }> {
  const userRes = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count,following_count,likes_count,video_count',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!userRes.ok) {
    throw new Error(`TikTok API error: ${userRes.status}`);
  }

  const userData: any = await userRes.json();
  const user = userData.data?.user;

  if (!user) {
    return { fetched: 0, inserted: 0, message: 'No user data returned' };
  }

  await executeQuery(
    `INSERT INTO social_account_metrics (
       platform, account_id, account_name,
       followers, following, total_likes, total_videos,
       recorded_at
     ) VALUES ('tiktok', ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT DO NOTHING`,
    [
      user.open_id,
      user.display_name,
      user.follower_count || 0,
      user.following_count || 0,
      user.likes_count || 0,
      user.video_count || 0
    ]
  );

  return {
    fetched: 1,
    inserted: 1,
    message: `Synced TikTok profile: ${user.display_name}`,
  };
}
