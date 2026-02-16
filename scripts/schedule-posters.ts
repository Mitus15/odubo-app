/**
 * Schedule Posters — Post poster images to Instagram for each video batch.
 *
 * Calculates the poster time as the midnight closest to each batch's last clip,
 * based on existing video_deployments data.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/schedule-posters.ts              # dry-run
 *   npx tsx --env-file=.env.local scripts/schedule-posters.ts --live       # actually schedule
 */

import { createPost, getAccounts, mapPlatform } from '../src/lib/postforme';
import { queryDatabase, executeQuery } from '../src/lib/db';

const VIDEO_ORDER = [439, 440, 441, 442, 443, 444, 445, 446, 447];

function posterCaption(title: string): string {
  return [
    `${title} - Vid\u00e9o Officielle`,
    'Sort Maintenant!',
    'Directeur par Mani Odubo',
    'odubo.studio',
  ].join('\n');
}

/**
 * Convert Pacific date + hour to UTC ISO for PostForMe.
 * Handles PST/PDT automatically.
 */
function pacificToUtcIso(dateStr: string, hour: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const refDate = new Date(Date.UTC(year, month - 1, day, 20, 0, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    hour12: false,
  });
  const pacificHourAtRef = parseInt(formatter.format(refDate));
  const offset = 20 - pacificHourAtRef;
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour + offset, 0, 0));
  return utcDate.toISOString().replace('.000Z', '+00:00');
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
}

async function main() {
  const isLive = process.argv.includes('--live');
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  SCHEDULE POSTERS — ${isLive ? 'LIVE MODE' : 'DRY RUN'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get Instagram account
  const accountsRes = await getAccounts();
  if (!accountsRes.success || !accountsRes.data) {
    console.error('Failed to fetch PostForMe accounts');
    process.exit(1);
  }

  const instagramAccount = accountsRes.data.find(
    a => mapPlatform(a.platform) === 'instagram' && a.status === 'connected'
  );
  if (!instagramAccount) {
    console.error('No connected Instagram account found');
    process.exit(1);
  }
  console.log(`Instagram: ${instagramAccount.id}\n`);

  let scheduled = 0;
  let skipped = 0;
  let errors = 0;

  for (const parentId of VIDEO_ORDER) {
    // Get parent video
    const parents = await queryDatabase(
      'SELECT id, title, poster_url FROM videos WHERE id = ?',
      [parentId]
    ) as any[];

    if (!parents?.[0]) {
      console.log(`[SKIP] Parent ${parentId} not found`);
      continue;
    }

    const parent = parents[0];

    if (!parent.poster_url) {
      console.log(`[SKIP] ${parent.title} — no poster_url`);
      skipped++;
      continue;
    }

    // Check if poster already scheduled
    const existing = await queryDatabase(
      `SELECT id FROM video_deployments
       WHERE video_id = ? AND platform = 'instagram'
       AND (metadata_json LIKE '%poster%' OR metadata_json LIKE '%image%')`,
      [parentId]
    ) as any[];

    if (existing && existing.length > 0) {
      console.log(`[SKIP] ${parent.title} — poster already scheduled`);
      skipped++;
      continue;
    }

    // Find the last clip deployment for this parent to determine timing
    const lastClip = await queryDatabase(
      `SELECT vd.deployed_at, vd.postforme_post_id
       FROM video_deployments vd
       JOIN videos v ON v.id = vd.video_id
       WHERE v.parent_video_id = ?
       ORDER BY vd.deployed_at DESC
       LIMIT 1`,
      [parentId]
    ) as any[];

    if (!lastClip?.[0]?.deployed_at) {
      console.log(`[SKIP] ${parent.title} — no clip deployments found`);
      skipped++;
      continue;
    }

    // Parse the last clip's scheduled time to find closest midnight
    // We need to check what PostForMe has for this post's scheduled_at
    // But since we scheduled them, we can derive from the deployment pattern:
    // Look at ALL clip deployments to find the latest scheduled time
    const allClipDeployments = await queryDatabase(
      `SELECT vd.postforme_post_id, vd.deployed_at
       FROM video_deployments vd
       JOIN videos v ON v.id = vd.video_id
       WHERE v.parent_video_id = ? AND vd.platform = 'youtube'
       ORDER BY vd.deployed_at DESC`,
      [parentId]
    ) as any[];

    // Get the last deployment date and figure out the posting hour
    // The deployed_at is when WE created the record, but the actual schedule
    // is in PostForMe. We need to look at the schedule pattern.
    // Since clips are 3/day at 7AM/1PM/7PM, count clips to find last slot.
    const clipCount = await queryDatabase(
      `SELECT COUNT(*) as count FROM videos
       WHERE parent_video_id = ? AND status = 'published'`,
      [parentId]
    ) as any[];

    const numClips = clipCount?.[0]?.count || 0;
    const POSTING_HOURS = [7, 13, 19];
    const lastSlotIndex = (numClips - 1) % 3;
    const lastClipHour = POSTING_HOURS[lastSlotIndex];

    // Calculate how many full days of clips (0-indexed)
    const fullDays = Math.floor((numClips - 1) / 3);

    // Find the start date for this parent from deployments
    // Use the first deployment's date as reference
    const firstDeploy = await queryDatabase(
      `SELECT MIN(vd.deployed_at) as first_at
       FROM video_deployments vd
       JOIN videos v ON v.id = vd.video_id
       WHERE v.parent_video_id = ?`,
      [parentId]
    ) as any[];

    // Simpler approach: just use the clip count + posting hours to determine
    // if the closest midnight is before or after the last clip
    // 7 AM → midnight same day (before), 1 PM or 7 PM → midnight next day (after)
    const posterAfterLastClip = lastClipHour > 12;

    // We need the actual last clip date. Let's compute it from the schedule.
    // Since schedule-all already ran, look at the latest scheduled deployment
    // and parse its PostForMe scheduled_at via the API... but that's slow.
    //
    // Instead, count days forward from the start, skipping Sundays:
    const SKIP_DAYS = [0]; // Sunday
    function advanceDays(startDate: string, days: number): string {
      let current = startDate;
      let advanced = 0;
      while (advanced < days) {
        current = addDays(current, 1);
        if (!SKIP_DAYS.includes(new Date(current).getDay())) {
          advanced++;
        }
      }
      return current;
    }

    // Get the batch start date from the first clip deployment's scheduled time
    // Since we don't store scheduled_at locally, we'll compute from the known schedule
    // The start dates are deterministic from schedule-all.ts
    const START_DATE = '2026-02-18';
    let batchStart = START_DATE;

    // Walk through previous batches to find this batch's start
    for (const prevId of VIDEO_ORDER) {
      if (prevId === parentId) break;

      const prevClipCount = await queryDatabase(
        `SELECT COUNT(*) as count FROM videos
         WHERE parent_video_id = ? AND status = 'published'`,
        [prevId]
      ) as any[];

      const prevClips = prevClipCount?.[0]?.count || 0;
      if (prevClips === 0) continue;

      const prevFullDays = Math.floor((prevClips - 1) / 3);
      const prevLastSlot = (prevClips - 1) % 3;

      // Advance through this batch's posting days
      batchStart = advanceDays(batchStart, prevFullDays);

      // Batch boundary: next video starts the next posting day
      if (prevLastSlot > 0 || prevFullDays >= 0) {
        batchStart = addDays(batchStart, 1);
        // Skip Sundays
        while (SKIP_DAYS.includes(new Date(batchStart).getDay())) {
          batchStart = addDays(batchStart, 1);
        }
      }
    }

    // Now batchStart is the first posting day for this parent
    // Last clip date = batchStart + fullDays (skipping Sundays)
    const lastClipDate = advanceDays(batchStart, fullDays);
    const posterDate = posterAfterLastClip ? addDays(lastClipDate, 1) : lastClipDate;
    const posterUtc = pacificToUtcIso(posterDate, 0);

    console.log(`  ${parent.title}`);
    console.log(`    Clips: ${numClips}, Last slot: ${formatHour(lastClipHour)} on ${lastClipDate}`);
    console.log(`    Poster: ${posterDate} 12:00 AM Pacific (${posterUtc})`);
    console.log(`    Image: ${parent.poster_url.substring(0, 60)}...`);

    if (!isLive) {
      scheduled++;
      continue;
    }

    // Schedule via PostForMe
    try {
      const response = await createPost({
        caption: posterCaption(parent.title),
        social_accounts: [instagramAccount.id],
        media: [{ url: parent.poster_url, type: 'image' }],
        scheduled_at: posterUtc,
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
        console.log(`    -> Scheduled: ${response.data.id}`);
        scheduled++;
      } else {
        console.log(`    -> FAILED: ${response.error}`);
        errors++;
      }

      await new Promise(r => setTimeout(r, 250));
    } catch (err: any) {
      console.log(`    -> ERROR: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${isLive ? 'SCHEDULED' : 'WOULD SCHEDULE'}: ${scheduled} | Skipped: ${skipped} | Errors: ${errors}`);
  console.log(`${'='.repeat(60)}\n`);

  if (!isLive) {
    console.log('DRY RUN. Use --live to schedule.\n');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
