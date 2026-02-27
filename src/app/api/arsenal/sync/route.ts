import { NextResponse, NextRequest } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getPost, getAccountFeed, getAccounts, createPost, mapPlatform } from '@/lib/postforme';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

interface Deployment {
  id: number;
  video_id: number;
  title: string;
  platform: string;
  postforme_post_id: string;
  parent_video_id: number | null;
  status: string;
  metadata_json: string | null;
}

function getLegacyColumnForPlatform(platform: string, isClip: boolean): string {
  switch (platform) {
    case 'youtube': return isClip ? 'youtube_shorts_url' : 'youtube_url';
    case 'tiktok': return 'tiktok_url';
    case 'instagram': return 'instagram_reels_url';
    default: return '';
  }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Retry wrapper for API calls that may intermittently fail (e.g. YouTube feed 500s)
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, delayMs = 1000, label = '' } = {}
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      console.log(`[Arsenal Sync] Retry ${i + 1}/${attempts} for ${label}: ${err instanceof Error ? err.message : 'Unknown'}`);
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw new Error('Unreachable');
}

async function markDeploymentPublished(
  deployment: Deployment,
  url: string,
  externalId: string | null,
): Promise<{ updated: boolean; madePublic: boolean }> {
  await executeQuery(
    `UPDATE video_deployments
     SET external_url = ?, external_id = ?, status = 'published', synced_at = datetime('now')
     WHERE id = ?`,
    [url, externalId, deployment.id]
  );

  const isClip = deployment.parent_video_id !== null;
  const legacyColumn = getLegacyColumnForPlatform(deployment.platform, isClip);

  if (legacyColumn) {
    await executeQuery(
      `UPDATE videos
       SET ${legacyColumn} = ?, postforme_post_id = ?, postforme_status = 'published'
       WHERE id = ?`,
      [url, deployment.postforme_post_id, deployment.video_id]
    );
  }

  // Publication status is NOT set here — it's gated on the poster being published to Instagram.
  // See goLiveOnPosterPublished() which triggers when the poster deployment syncs.

  return { updated: true, madePublic: false };
}

/**
 * Get the next midnight Pacific time as UTC ISO string.
 */
function getNextMidnightPacificUtc(): string {
  const now = new Date();
  // Get current Pacific date
  const pacificNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  // Next day at midnight
  const nextDay = new Date(pacificNow.getFullYear(), pacificNow.getMonth(), pacificNow.getDate() + 1, 0, 0, 0);

  // Determine offset: check if next day is PST or PDT
  const refDate = new Date(Date.UTC(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate(), 20, 0, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    hour12: false,
  });
  const pacificHourAtRef = parseInt(formatter.format(refDate));
  const offset = 20 - pacificHourAtRef; // 8 for PST, 7 for PDT

  const utcDate = new Date(Date.UTC(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate(), offset, 0, 0));
  return utcDate.toISOString().replace('.000Z', '+00:00');
}

/**
 * Auto-poster: After sync, check if all clips for a parent are published.
 * If so and poster_url exists with no poster deployment, schedule poster.
 */
async function checkAutoPoster(
  updatedParentIds: Set<number>,
  errors: string[]
): Promise<{ postersScheduled: number }> {
  let postersScheduled = 0;

  for (const parentId of updatedParentIds) {
    try {
      // Count total vs published clip deployments for this parent
      const stats = await queryDatabase(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN vd.status = 'published' THEN 1 ELSE 0 END) as published
         FROM video_deployments vd
         JOIN videos v ON v.id = vd.video_id
         WHERE v.parent_video_id = ?`,
        [parentId]
      ) as any[];

      if (!stats?.[0] || stats[0].total === 0) continue;
      if (stats[0].total !== stats[0].published) continue;

      // All clips published — check if poster exists and hasn't been deployed
      const parent = await queryDatabase(
        'SELECT id, title, poster_url FROM videos WHERE id = ?',
        [parentId]
      ) as any[];

      if (!parent?.[0]?.poster_url) continue;

      // Check if poster deployment already exists
      const existingPoster = await queryDatabase(
        `SELECT id FROM video_deployments
         WHERE video_id = ? AND platform = 'instagram'
         AND metadata_json LIKE '%poster%'`,
        [parentId]
      ) as any[];

      if (existingPoster && existingPoster.length > 0) continue;

      // Schedule poster via PostForMe
      const accountsRes = await getAccounts();
      if (!accountsRes.success || !accountsRes.data) continue;

      const instagramAccount = accountsRes.data.find(
        a => mapPlatform(a.platform) === 'instagram' && a.status === 'connected'
      );
      if (!instagramAccount) continue;

      const scheduledAt = getNextMidnightPacificUtc();
      const caption = [
        `${parent[0].title} - Vid\u00e9o Officielle`,
        'Sort Maintenant!',
        'Directeur par Mani Odubo',
        'odubo.studio',
      ].join('\n');

      const response = await createPost({
        caption,
        social_accounts: [instagramAccount.id],
        media: [{ url: parent[0].poster_url, type: 'image' }],
        scheduled_at: scheduledAt,
        platform_configurations: {
          instagram: { placement: 'FEED' },
        },
      });

      if (response.success && response.data) {
        await executeQuery(
          `INSERT INTO video_deployments (video_id, platform, postforme_post_id, status, deployed_at, metadata_json)
           VALUES (?, 'instagram', ?, 'scheduled', datetime('now'), '{"type":"poster"}')`,
          [parentId, response.data.id]
        );
        console.log(`[Arsenal Sync] Auto-poster scheduled for ${parent[0].title} at ${scheduledAt}`);
        postersScheduled++;
      }
    } catch (err) {
      errors.push(`Auto-poster for parent ${parentId}: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  return { postersScheduled };
}

/**
 * Core sync logic — used by both POST (admin) and GET (cron) handlers.
 *
 * Three-phase sync:
 * 1. Check PostForMe post status directly
 * 2. Fall back to platform feed matching (with retry for flaky APIs)
 * 3. Auto-poster: schedule poster when all clips for a video are published
 */
async function runSync() {
  const deployments = await queryDatabase(
    `SELECT
      vd.id, vd.video_id, v.title, vd.platform, vd.postforme_post_id,
      vd.status, v.parent_video_id, vd.metadata_json
     FROM video_deployments vd
     JOIN videos v ON v.id = vd.video_id
     WHERE vd.postforme_post_id IS NOT NULL
       AND (vd.external_url IS NULL OR vd.external_url = '')
       AND vd.status IN ('pending', 'published', 'scheduled')`,
    []
  ) as Deployment[];

  if (!deployments || deployments.length === 0) {
    return { message: 'No deployments to sync', updated: 0, madePublic: 0, postersScheduled: 0, total: 0, errors: [] };
  }

  let updated = 0;
  let madePublic = 0;
  const errors: string[] = [];
  const remaining: Deployment[] = [];
  const updatedParentIds = new Set<number>();
  const publishedPosterVideoIds = new Set<number>(); // Parent videos whose poster just synced

  // Phase 1: Check PostForMe post status
  // PostForMe uses: scheduled → processed (never "published", never returns platform URLs)
  // "processed" means the content was sent to the platform successfully
  const byPostId = new Map<string, Deployment[]>();
  for (const d of deployments) {
    const group = byPostId.get(d.postforme_post_id) || [];
    group.push(d);
    byPostId.set(d.postforme_post_id, group);
  }

  for (const [postformePostId, group] of byPostId) {
    try {
      const postResponse = await getPost(postformePostId);

      if (!postResponse.success || !postResponse.data) {
        remaining.push(...group);
        continue;
      }

      const post = postResponse.data as any;
      const postStatus = post.status;

      // PostForMe "processed" = sent to platform. URLs come from feed matching (Phase 2).
      // PostForMe "published" also possible but rare. Either way, no platform URLs in the response.
      if (postStatus === 'processed' || postStatus === 'published') {
        // Check if PostForMe happens to have URLs (unlikely but handle it)
        const platformData = new Map<string, { url?: string; externalId?: string }>();
        if (post.platforms && Array.isArray(post.platforms)) {
          for (const p of post.platforms) {
            if (p.platform && p.url) {
              platformData.set(mapPlatform(p.platform), { url: p.url, externalId: p.external_id });
            }
          }
        }

        for (const deployment of group) {
          const pData = platformData.get(deployment.platform);
          const effectiveUrl = pData?.url || post.external_url;

          if (effectiveUrl) {
            const result = await markDeploymentPublished(
              deployment, effectiveUrl, pData?.externalId || post.external_id || null,
            );
            if (result.updated) updated++;
            if (result.madePublic) madePublic++;
            if (deployment.parent_video_id) updatedParentIds.add(deployment.parent_video_id);
            // Track poster deployments — triggers go-live for parent + clips
            if (deployment.metadata_json?.includes('poster')) {
              publishedPosterVideoIds.add(deployment.video_id);
            }
          } else {
            // Processed but no URL — need feed matching
            remaining.push(deployment);
          }
        }
      } else if (postStatus === 'failed') {
        for (const deployment of group) {
          await executeQuery(
            `UPDATE video_deployments SET status = 'failed', error_message = ? WHERE id = ?`,
            [post.error_message || 'Post failed on platform', deployment.id]
          );
        }
      } else {
        // Still scheduled or unknown status — keep for next sync
        remaining.push(...group);
      }
    } catch (err) {
      errors.push(`Post ${postformePostId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      remaining.push(...group);
    }
  }

  // Phase 2: Feed-based matching for unresolved deployments (with retry)
  if (remaining.length > 0) {
    console.log(`[Arsenal Sync] Phase 2: ${remaining.length} deployments need feed-based matching`);

    const accountsResponse = await getAccounts();
    if (!accountsResponse.success || !accountsResponse.data) {
      errors.push('Failed to fetch PostForMe accounts for feed matching');
    } else {
      const platformAccountMap = new Map<string, string>();
      for (const acct of accountsResponse.data) {
        if (acct.status !== 'connected') continue;
        platformAccountMap.set(mapPlatform(acct.platform), acct.id);
      }

      const remainingByPlatform = new Map<string, Deployment[]>();
      for (const d of remaining) {
        const group = remainingByPlatform.get(d.platform) || [];
        group.push(d);
        remainingByPlatform.set(d.platform, group);
      }

      for (const [platform, platformDeployments] of remainingByPlatform) {
        const accountId = platformAccountMap.get(platform);
        if (!accountId) continue;

        try {
          // Retry up to 3 times for flaky feed APIs (YouTube returns 500 intermittently)
          const feedResponse = await withRetry(
            () => getAccountFeed(accountId, { limit: 50, expand: true }),
            { attempts: 3, delayMs: 2000, label: `${platform} feed` }
          );

          if (!feedResponse.success || !feedResponse.data) {
            errors.push(`Feed fetch failed for ${platform} after retries`);
            continue;
          }

          const feedItems = feedResponse.data;
          const usedFeedIds = new Set<string>();

          for (const deployment of platformDeployments) {
            const normalizedTitle = normalizeTitle(deployment.title);
            const match = feedItems.find(item => {
              if (usedFeedIds.has(item.platform_post_id)) return false;
              return normalizeTitle(item.caption || '').startsWith(normalizedTitle);
            });

            if (match && match.platform_url) {
              usedFeedIds.add(match.platform_post_id);
              console.log(`[Arsenal Sync] Feed match: "${deployment.title}" / ${platform} -> ${match.platform_url}`);
              const result = await markDeploymentPublished(
                deployment, match.platform_url, match.platform_post_id || null,
              );
              if (result.updated) updated++;
              if (result.madePublic) madePublic++;
              if (deployment.parent_video_id) updatedParentIds.add(deployment.parent_video_id);
              if (deployment.metadata_json?.includes('poster')) {
                publishedPosterVideoIds.add(deployment.video_id);
              }
            }
          }
        } catch (err) {
          errors.push(`Feed matching for ${platform}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }
  }

  // Phase 3: Auto-poster check for completed video batches
  let postersScheduled = 0;
  if (updatedParentIds.size > 0) {
    const posterResult = await checkAutoPoster(updatedParentIds, errors);
    postersScheduled = posterResult.postersScheduled;
  }

  // Phase 4: Go live — when a poster is confirmed published on Instagram,
  // set the parent video + all its clips to publication_status = 'live'
  if (publishedPosterVideoIds.size > 0) {
    for (const parentId of publishedPosterVideoIds) {
      try {
        // Set parent video live
        const parentResult = await executeQuery(
          `UPDATE videos SET is_public = 1, publication_status = 'live', updated_at = datetime('now')
           WHERE id = ? AND (publication_status IS NULL OR publication_status != 'live')`,
          [parentId]
        );
        // Set all clips live
        const clipsResult = await executeQuery(
          `UPDATE videos SET is_public = 1, publication_status = 'live', updated_at = datetime('now')
           WHERE parent_video_id = ? AND (publication_status IS NULL OR publication_status != 'live')`,
          [parentId]
        );

        const parentChanged = parentResult && typeof parentResult === 'object' &&
          'changes' in parentResult && (parentResult as any).changes > 0;
        const clipsChanged = clipsResult && typeof clipsResult === 'object' &&
          'changes' in clipsResult ? (clipsResult as any).changes : 0;

        if (parentChanged || clipsChanged > 0) {
          madePublic += (parentChanged ? 1 : 0) + clipsChanged;
          console.log(`[Arsenal Sync] Go live: video ${parentId} + ${clipsChanged} clips now public (poster confirmed on Instagram)`);
        }
      } catch (err) {
        errors.push(`Go live for ${parentId}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }
  }

  // Phase 5: Check for already-confirmed posters that haven't triggered go-live yet
  // (handles posters that were synced in a previous run but videos are still archived)
  try {
    const archivedWithPoster = await queryDatabase(
      `SELECT DISTINCT v.id
       FROM videos v
       JOIN video_deployments vd ON vd.video_id = v.id
       WHERE vd.platform = 'instagram'
         AND vd.metadata_json LIKE '%poster%'
         AND vd.status = 'published'
         AND v.parent_video_id IS NULL
         AND (v.publication_status IS NULL OR v.publication_status != 'live')`,
      []
    ) as any[];

    if (archivedWithPoster && archivedWithPoster.length > 0) {
      for (const row of archivedWithPoster) {
        await executeQuery(
          `UPDATE videos SET is_public = 1, publication_status = 'live', updated_at = datetime('now')
           WHERE id = ? OR parent_video_id = ?`,
          [row.id, row.id]
        );
        console.log(`[Arsenal Sync] Catch-up go-live: video ${row.id} (poster was already published)`);
        madePublic++;
      }
    }
  } catch (err) {
    errors.push(`Catch-up go-live: ${err instanceof Error ? err.message : 'Unknown'}`);
  }

  return {
    message: `Synced ${updated} of ${deployments.length} deployments${madePublic > 0 ? `, ${madePublic} made public` : ''}${postersScheduled > 0 ? `, ${postersScheduled} poster(s) scheduled` : ''}`,
    updated,
    madePublic,
    postersScheduled,
    total: deployments.length,
    errors,
  };
}

/**
 * GET /api/arsenal/sync — Cron-triggered sync (uses CRON_SECRET)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runSync();
    console.log('[Arsenal Sync Cron]', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Arsenal Sync Cron] Error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/arsenal/sync — Admin-triggered sync (uses cookie auth)
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const result = await runSync();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Arsenal] Sync error:', error);
    return NextResponse.json({ error: 'Failed to sync deployments' }, { status: 500 });
  }
}
