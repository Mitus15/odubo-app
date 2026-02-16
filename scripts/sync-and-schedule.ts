/**
 * Sync all pending deployments with PostForMe and display the deployment schedule.
 *
 * Two-phase sync:
 * 1. Check PostForMe post status directly
 * 2. Fall back to platform feed matching (handles PostForMe's "processed" bug)
 *
 * Usage: npx tsx --env-file=.env.local scripts/sync-and-schedule.ts
 */

import { getPost, getAccounts, getAccountFeed, mapPlatform } from '../src/lib/postforme';
import type { FeedItem } from '../src/lib/postforme';
import { queryDatabase, executeQuery } from '../src/lib/db';

interface Deployment {
  id: number;
  video_id: number;
  title: string;
  platform: string;
  postforme_post_id: string;
  status: string;
  external_url: string | null;
  deployed_at: string | null;
  parent_video_id: number | null;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getLegacyColumn(platform: string, isClip: boolean): string {
  switch (platform) {
    case 'youtube': return isClip ? 'youtube_shorts_url' : 'youtube_url';
    case 'tiktok': return 'tiktok_url';
    case 'instagram': return 'instagram_reels_url';
    default: return '';
  }
}

async function syncDeployments() {
  console.log('=== SYNCING DEPLOYMENTS ===\n');

  const deployments = await queryDatabase(
    `SELECT
      vd.id, vd.video_id, v.title, vd.platform, vd.postforme_post_id,
      vd.status, vd.external_url, vd.deployed_at, v.parent_video_id
     FROM video_deployments vd
     JOIN videos v ON v.id = vd.video_id
     WHERE vd.postforme_post_id IS NOT NULL
       AND (vd.external_url IS NULL OR vd.external_url = '')
     ORDER BY vd.deployed_at ASC`,
    []
  ) as Deployment[];

  console.log(`Found ${deployments.length} deployments to sync.\n`);
  if (deployments.length === 0) return;

  let updated = 0;
  let errors = 0;
  const remaining: Deployment[] = [];

  // ── Phase 1: Check PostForMe post status ──────────────────────────────

  console.log('── Phase 1: Checking PostForMe post status ──\n');

  const byPostId = new Map<string, Deployment[]>();
  for (const d of deployments) {
    const group = byPostId.get(d.postforme_post_id) || [];
    group.push(d);
    byPostId.set(d.postforme_post_id, group);
  }

  for (const [postId, group] of byPostId) {
    try {
      const response = await getPost(postId);
      if (!response.success || !response.data) {
        remaining.push(...group);
        continue;
      }

      const post = response.data as any;
      const postStatus = post.status;

      // Build platform info from platforms array
      const platformResults: Array<{ platform: string; status: string; url?: string; external_id?: string }> = [];
      if (post.platforms && post.platforms.length > 0) {
        for (const p of post.platforms) platformResults.push(p);
      }

      let anyResolved = false;
      for (const dep of group) {
        const normalizedPlatform = mapPlatform(dep.platform);
        const match = platformResults.find(p => {
          if (!p.platform) return false;
          try { return mapPlatform(p.platform) === normalizedPlatform; }
          catch { return false; }
        });

        const effectiveStatus = match?.status || postStatus;
        const effectiveUrl = match?.url || post.external_url;

        if (effectiveStatus === 'published' && effectiveUrl) {
          await markPublished(dep, effectiveUrl, match?.external_id || post.external_id || null);
          console.log(`  ✅ ${dep.title} / ${dep.platform} → published (${effectiveUrl})`);
          updated++;
          anyResolved = true;
        } else if (effectiveStatus === 'failed') {
          await executeQuery(
            `UPDATE video_deployments SET status = 'failed' WHERE id = ?`,
            [dep.id]
          );
          console.log(`  ❌ ${dep.title} / ${dep.platform} → failed`);
          anyResolved = true;
        } else {
          remaining.push(dep);
        }
      }

      if (!anyResolved) {
        const scheduledAt = post.scheduled_at;
        console.log(`  ⏳ ${group[0].title} — status: ${postStatus}${scheduledAt ? ` (scheduled: ${scheduledAt.substring(0, 19)})` : ''}`);
      }

      await new Promise(r => setTimeout(r, 100));
    } catch (err: any) {
      console.log(`  [ERROR] ${postId}: ${err.message}`);
      remaining.push(...group);
      errors++;
    }
  }

  console.log(`\nPhase 1: ${updated} resolved, ${remaining.length} remaining.\n`);

  // ── Phase 2: Feed-based matching ──────────────────────────────────────

  if (remaining.length > 0) {
    console.log('── Phase 2: Matching against platform feeds ──\n');

    const accountsRes = await getAccounts();
    if (!accountsRes.success || !accountsRes.data) {
      console.log('  [ERROR] Could not fetch accounts');
      return;
    }

    // Build platform → accountId map
    const platformAccounts = new Map<string, string>();
    for (const acct of accountsRes.data) {
      if (acct.status !== 'connected') continue;
      platformAccounts.set(mapPlatform(acct.platform), acct.id);
    }

    // Group remaining by platform
    const remainingByPlatform = new Map<string, Deployment[]>();
    for (const d of remaining) {
      const group = remainingByPlatform.get(d.platform) || [];
      group.push(d);
      remainingByPlatform.set(d.platform, group);
    }

    for (const [platform, deps] of remainingByPlatform) {
      const accountId = platformAccounts.get(platform);
      if (!accountId) {
        console.log(`  [SKIP] No connected account for ${platform}`);
        continue;
      }

      try {
        const feedRes = await getAccountFeed(accountId, { limit: 50, expand: true });
        if (!feedRes.success || !feedRes.data) {
          console.log(`  [ERROR] Feed fetch failed for ${platform}`);
          errors++;
          continue;
        }

        const feedItems = feedRes.data;
        console.log(`  📡 ${platform}: ${feedItems.length} feed items`);

        const usedIds = new Set<string>();

        for (const dep of deps) {
          const normalizedTitle = normalizeTitle(dep.title);
          const match = feedItems.find(item => {
            if (usedIds.has(item.platform_post_id)) return false;
            const normalizedCaption = normalizeTitle(item.caption || '');
            return normalizedCaption.startsWith(normalizedTitle);
          });

          if (match && match.platform_url) {
            usedIds.add(match.platform_post_id);
            await markPublished(dep, match.platform_url, match.platform_post_id || null);
            console.log(`  ✅ ${dep.title} / ${platform} → ${match.platform_url}`);
            updated++;
          } else {
            console.log(`  ⏳ ${dep.title} / ${platform} — no feed match`);
          }
        }
      } catch (err: any) {
        console.log(`  [ERROR] ${platform}: ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\nSync complete: ${updated} updated, ${errors} errors.\n`);
}

async function markPublished(dep: Deployment, url: string, externalId: string | null) {
  await executeQuery(
    `UPDATE video_deployments
     SET external_url = ?, external_id = ?, status = 'published', synced_at = datetime('now')
     WHERE id = ?`,
    [url, externalId, dep.id]
  );

  const isClip = dep.parent_video_id !== null;
  const legacyCol = getLegacyColumn(dep.platform, isClip);
  if (legacyCol && url) {
    await executeQuery(
      `UPDATE videos SET ${legacyCol} = ?, postforme_status = 'published' WHERE id = ?`,
      [url, dep.video_id]
    );
  }
}

async function showSchedule() {
  console.log('=== DEPLOYMENT SCHEDULE ===\n');

  const all = await queryDatabase(
    `SELECT
      vd.id, vd.video_id, v.title, vd.platform, vd.status,
      vd.external_url, vd.deployed_at, vd.synced_at, vd.postforme_post_id,
      v.parent_video_id, v.scheduled_for,
      pv.title as parent_title
     FROM video_deployments vd
     JOIN videos v ON v.id = vd.video_id
     LEFT JOIN videos pv ON pv.id = v.parent_video_id
     ORDER BY
       CASE vd.status
         WHEN 'scheduled' THEN 0
         WHEN 'pending' THEN 1
         WHEN 'published' THEN 2
         WHEN 'failed' THEN 3
         ELSE 4
       END,
       vd.deployed_at ASC`,
    []
  ) as any[];

  if (all.length === 0) {
    console.log('No deployments found.');
    return;
  }

  const published = all.filter(d => d.status === 'published');
  const scheduled = all.filter(d => d.status === 'scheduled');
  const pending = all.filter(d => d.status === 'pending');
  const failed = all.filter(d => d.status === 'failed');

  const printTable = (items: any[], showUrl = false) => {
    console.log('─'.repeat(100));
    if (showUrl) {
      console.log(`${'Title'.padEnd(25)} ${'Platform'.padEnd(12)} ${'URL'}`);
    } else {
      console.log(`${'Title'.padEnd(25)} ${'Platform'.padEnd(12)} ${'Created'.padEnd(22)} ${'Parent'.padEnd(20)} ${'PostForMe ID'}`);
    }
    console.log('─'.repeat(100));
    for (const d of items) {
      if (showUrl) {
        console.log(`${(d.title || '').substring(0, 24).padEnd(25)} ${d.platform.padEnd(12)} ${d.external_url || 'no URL'}`);
      } else {
        const parent = d.parent_title || '—';
        const pfmId = (d.postforme_post_id || '').substring(0, 20);
        console.log(`${(d.title || '').substring(0, 24).padEnd(25)} ${d.platform.padEnd(12)} ${(d.deployed_at || 'N/A').substring(0, 20).padEnd(22)} ${parent.substring(0, 19).padEnd(20)} ${pfmId}`);
      }
    }
  };

  if (published.length > 0) {
    console.log(`\n✅ PUBLISHED (${published.length}):`);
    printTable(published, true);
  }
  if (scheduled.length > 0) {
    console.log(`\n📅 SCHEDULED (${scheduled.length}):`);
    printTable(scheduled);
  }
  if (pending.length > 0) {
    console.log(`\n⏳ PENDING (${pending.length}):`);
    printTable(pending);
  }
  if (failed.length > 0) {
    console.log(`\n❌ FAILED (${failed.length}):`);
    printTable(failed);
  }

  console.log('\n' + '─'.repeat(100));
  console.log(`TOTAL: ${all.length} deployments — ${published.length} published, ${scheduled.length} scheduled, ${pending.length} pending, ${failed.length} failed`);

  // Show undeployed clips
  console.log('\n\n=== VIDEOS WITHOUT DEPLOYMENTS ===\n');
  const undeployed = await queryDatabase(
    `SELECT v.id, v.title, v.parent_video_id, pv.title as parent_title, v.status, v.created_at
     FROM videos v
     LEFT JOIN videos pv ON pv.id = v.parent_video_id
     WHERE v.id NOT IN (SELECT DISTINCT video_id FROM video_deployments)
       AND v.status = 'published'
       AND v.parent_video_id IS NOT NULL
     ORDER BY v.parent_video_id, v.clip_index`,
    []
  ) as any[];

  if (undeployed.length === 0) {
    console.log('All published clips have deployments.');
  } else {
    console.log(`Found ${undeployed.length} published clips without any deployments:\n`);
    let lastParent = '';
    for (const v of undeployed) {
      const parent = v.parent_title || '(standalone)';
      if (parent !== lastParent) {
        console.log(`\n  📁 ${parent}:`);
        lastParent = parent;
      }
      console.log(`     ${v.id}: ${v.title}`);
    }
  }
}

async function main() {
  await syncDeployments();
  await showSchedule();
}

main().catch(console.error);
