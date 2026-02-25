/**
 * Schedule Poster Posts — Announce YouTube availability on Instagram.
 *
 * Two phases:
 *  1. Catch-up: K-Town, Pinocchio, David In The City, Alone — already on YouTube.
 *     Post every 2 calendar days at 1 PM Pacific, starting Feb 24.
 *  2. Future: Pour Salem → Take That — post at 1 PM Pacific on each video's
 *     YouTube release day (same day their first clip drops).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/schedule-posters.ts              # dry-run
 *   npx tsx --env-file=.env.local scripts/schedule-posters.ts --live       # schedule
 */

import { createPost, getAccounts, mapPlatform } from '../src/lib/postforme';
import { queryDatabase, executeQuery } from '../src/lib/db';

// ─── Configuration ───────────────────────────────────────────────────────────

// Videos already on YouTube — 2 today (Feb 25) + 2 tomorrow (Feb 26), staggered PST
const CATCH_UP: Array<{ id: number; date: string; hour: number }> = [
  { id: 424, date: '2026-02-25', hour: 14 }, // K-Town — today 2pm PST
  { id: 438, date: '2026-02-25', hour: 19 }, // Pinocchio is in K-Town — today 7pm PST
  { id: 439, date: '2026-02-26', hour: 13 }, // David In The City — tomorrow 1pm PST
  { id: 440, date: '2026-02-26', hour: 19 }, // Alone — tomorrow 7pm PST
];

// Videos not yet on YouTube — poster goes out on their YouTube release day
const FUTURE_IDS = [441, 442, 443, 444, 445, 446, 447];

// Manual date overrides for future videos (when calculated date needs adjustment)
const FUTURE_DATE_OVERRIDES: Record<number, string> = {
  441: '2026-02-28', // Pour Salem — shifted +1 day to avoid overlap with Alone catch-up
};

// Full VIDEO_ORDER from schedule-all.ts — used to walk the clip schedule
const ALL_VIDEO_ORDER = [439, 440, 441, 442, 443, 444, 445, 446, 447];

const POSTER_HOUR = 13; // 1 PM Pacific
const POSTING_SLOTS = 3; // 3 clips/day
const SKIP_DAYS = [0]; // Sunday
const START_DATE = '2026-02-18'; // First clip posting day (schedule-all start)

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function nextPostingDay(dateStr: string): string {
  let current = dateStr;
  while (SKIP_DAYS.includes(getDayOfWeek(current))) {
    current = addDays(current, 1);
  }
  return current;
}

function posterCaption(title: string): string {
  return `${title} — Official Video\n\nLink in bio.`;
}

// ─── Calculate future YouTube release dates ───────────────────────────────────

/**
 * Walk the schedule-all clip deployment pattern to find the YouTube release date
 * (= first clip day) for each future video. Mirrors schedule-all.ts date logic exactly.
 */
async function calcFutureReleaseDates(): Promise<Map<number, string>> {
  const releaseDates = new Map<number, string>();
  let currentDate = START_DATE;

  for (const parentId of ALL_VIDEO_ORDER) {
    currentDate = nextPostingDay(currentDate);

    // If this is a future video, its YouTube release date = start of its batch
    if (FUTURE_IDS.includes(parentId)) {
      releaseDates.set(parentId, currentDate);
    }

    // Query published clip count for this video
    const rows = await queryDatabase(
      `SELECT COUNT(*) as count FROM videos WHERE parent_video_id = ? AND status = 'published'`,
      [parentId]
    ) as any[];
    const clipCount = rows?.[0]?.count || 0;

    if (clipCount === 0) continue;

    // Advance date the same way schedule-all.ts does
    let slotIndex = 0;
    for (let i = 0; i < clipCount; i++) {
      slotIndex++;
      if (slotIndex >= POSTING_SLOTS) {
        slotIndex = 0;
        currentDate = nextPostingDay(addDays(currentDate, 1));
      }
    }

    // Batch boundary: next video starts the day after if mid-day
    if (slotIndex > 0) {
      currentDate = addDays(currentDate, 1);
    }
  }

  return releaseDates;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isLive = process.argv.includes('--live');
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  SCHEDULE POSTER POSTS — ${isLive ? 'LIVE MODE' : 'DRY RUN'}`);
  console.log(`${'='.repeat(70)}\n`);

  // Fetch PostForMe Instagram account
  const accountsRes = await getAccounts();
  if (!accountsRes.success || !accountsRes.data) {
    console.error('Failed to fetch PostForMe accounts:', accountsRes.error);
    process.exit(1);
  }

  const instagramAccount = accountsRes.data.find(
    a => mapPlatform(a.platform) === 'instagram' && a.status === 'connected'
  );
  if (!instagramAccount) {
    console.error('No connected Instagram account found');
    process.exit(1);
  }
  console.log(`Instagram account: ${instagramAccount.id}\n`);

  // Calculate future release dates
  const futureReleaseDates = await calcFutureReleaseDates();

  // Build full poster schedule: catch-up + future
  const allPosters: Array<{ id: number; date: string; hour: number; label: string }> = [
    ...CATCH_UP.map(c => ({ ...c, label: 'catch-up' })),
    ...FUTURE_IDS.map(id => ({
      id,
      date: FUTURE_DATE_OVERRIDES[id] ?? (futureReleaseDates.get(id) || ''),
      hour: POSTER_HOUR,
      label: 'future',
    })).filter(p => p.date !== ''),
  ];

  // Fetch video data for all posters
  const videoIds = allPosters.map(p => p.id);
  const placeholders = videoIds.map(() => '?').join(',');
  const videos = await queryDatabase(
    `SELECT id, title, poster_url FROM videos WHERE id IN (${placeholders})`,
    videoIds
  ) as any[];
  const videoMap = new Map(videos.map((v: any) => [v.id, v]));

  // Check existing poster deployments
  const existingRows = await queryDatabase(
    `SELECT video_id FROM video_deployments
     WHERE video_id IN (${placeholders}) AND platform = 'instagram'
     AND metadata_json LIKE '%poster%'`,
    videoIds
  ) as any[];
  const alreadyScheduled = new Set(existingRows.map((r: any) => r.video_id));

  // Print schedule table
  console.log('POSTER SCHEDULE:\n');
  console.log(
    `${'Date'.padEnd(13)} ${'Time'.padEnd(8)} ${'Type'.padEnd(9)} ${'Video Title'.padEnd(28)} ${'Story Link'.padEnd(32)} Status`
  );
  console.log('-'.repeat(100));

  for (const poster of allPosters) {
    const video = videoMap.get(poster.id);
    const title = video?.title || `[ID ${poster.id}]`;
    const hasUrl = !!video?.poster_url;
    const isDupe = alreadyScheduled.has(poster.id);
    const status = isDupe ? 'SKIP (already scheduled)' : !hasUrl ? 'SKIP (no poster_url)' : '';
    const storyLink = `odubo.studio/watch/${poster.id}`;
    const timeStr = `${poster.hour > 12 ? poster.hour - 12 : poster.hour}:00 ${poster.hour >= 12 ? 'PM' : 'AM'}`;
    console.log(
      `${poster.date.padEnd(13)} ${timeStr.padEnd(8)} ${poster.label.padEnd(9)} ${title.substring(0, 28).padEnd(28)} ${storyLink.padEnd(32)} ${status}`
    );
  }

  console.log();
  const toPost = allPosters.filter(p => {
    const video = videoMap.get(p.id);
    return video?.poster_url && !alreadyScheduled.has(p.id) && p.date;
  });
  console.log(`✅ To schedule: ${toPost.length}/${allPosters.length}`);

  if (!isLive) {
    console.log('\nDRY RUN. Use --live to schedule.\n');
    return;
  }

  // ── Live: schedule each poster ───────────────────────────────────────────

  console.log('\nSCHEDULING...\n');

  let scheduled = 0;
  let skipped = 0;
  let errors = 0;

  for (const poster of allPosters) {
    const video = videoMap.get(poster.id);
    if (!video?.poster_url) {
      console.log(`  [SKIP] ID ${poster.id} — no poster_url`);
      skipped++;
      continue;
    }
    if (alreadyScheduled.has(poster.id)) {
      console.log(`  [SKIP] ${video.title} — already scheduled`);
      skipped++;
      continue;
    }
    if (!poster.date) {
      console.log(`  [SKIP] ${video.title} — no date calculated`);
      skipped++;
      continue;
    }

    const scheduledAt = pacificToUtcIso(poster.date, poster.hour);

    try {
      const response = await createPost({
        caption: posterCaption(video.title),
        social_accounts: [instagramAccount.id],
        media: [{ url: video.poster_url, type: 'image' }],
        scheduled_at: scheduledAt,
        platform_configurations: {
          instagram: { placement: 'FEED' },
        },
      });

      if (response.success && response.data) {
        await executeQuery(
          `INSERT INTO video_deployments (video_id, platform, postforme_post_id, status, deployed_at, metadata_json)
           VALUES (?, 'instagram', ?, 'scheduled', datetime('now'), '{"type":"poster"}')`,
          [poster.id, response.data.id]
        );

        // Update bio link to point to this video
        await executeQuery(
          `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('featured_video_id', ?, datetime('now'))`,
          [String(poster.id)]
        );

        const okTime = `${poster.hour > 12 ? poster.hour - 12 : poster.hour}:00 ${poster.hour >= 12 ? 'PM' : 'AM'}`;
        console.log(
          `  [OK] ${video.title.padEnd(30)} → ${poster.date} ${okTime} Pacific (${response.data.id})`
        );
        console.log(`       Story → odubo.studio/watch/${poster.id}`);
        scheduled++;
      } else {
        console.log(`  [FAIL] ${video.title}: ${response.error}`);
        errors++;
      }

      await new Promise(r => setTimeout(r, 250));
    } catch (err: any) {
      console.log(`  [FAIL] ${video.title}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  Scheduled: ${scheduled} | Skipped: ${skipped} | Errors: ${errors}`);
  console.log(`${'='.repeat(70)}\n`);
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
