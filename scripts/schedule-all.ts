/**
 * Schedule All Clips — Master Deployment Script
 *
 * Schedules all remaining videos (clips + full videos + posters) for deployment.
 *
 * Rules:
 * - 3 clips/day at 7:00 AM, 1:00 PM, 7:00 PM Pacific
 * - Skip Sundays
 * - First clip of each video batch: also deploy the full parent video to YouTube
 * - Poster: Instagram FEED post at 12:00 AM (midnight) Pacific on last clip day
 * - Batch boundary: when a video finishes mid-day, remaining slots stay empty.
 *   Next video starts the next posting day.
 * - Clips go to YouTube (Shorts) + TikTok + Instagram (Reels only, NOT feed)
 * - Full videos go to YouTube only (regular video, NOT Short)
 * - Posters go to Instagram only (FEED post, visible on main grid)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/schedule-all.ts              # dry-run
 *   npx tsx --env-file=.env.local scripts/schedule-all.ts --live       # actually deploy
 */

import { createPost, getAccounts, mapPlatform } from '../src/lib/postforme';
import { queryDatabase, executeQuery } from '../src/lib/db';

// ─── Configuration ──────────────────────────────────────────────────────────

const POSTING_HOURS = [7, 13, 19]; // 7 AM, 1 PM, 7 PM Pacific
const POSTER_HOUR = 0; // 12:00 AM (midnight) Pacific
const SKIP_DAYS = [0]; // 0 = Sunday
const START_DATE = '2026-02-18'; // First posting day (after K-Town finishes Feb 17)

// Parent video IDs in deployment order
const VIDEO_ORDER = [439, 440, 441, 442, 443, 444, 445, 446, 447];

// ─── Caption Templates ─────────────────────────────────────────────────────

function clipCaption(title: string): string {
  return [
    title,
    'Directed by Mani Odubo',
    'B.A.A.D @ Odubo.Studio',
  ].join('\n\n');
}

function videoCaption(title: string): string {
  return [
    title,
    'Directed by Mani Odubo',
    'B.A.A.D @ Odubo.Studio',
  ].join('\n\n');
}

function posterCaption(title: string): string {
  return [
    `${title} - Vid\u00e9o Officielle`,
    'Sort Maintenant!',
    'Directeur par Mani Odubo',
    'odubo.studio',
  ].join('\n');
}

// ─── Timezone Helpers ───────────────────────────────────────────────────────

/**
 * Convert a Pacific date + hour to UTC ISO string for PostForMe scheduled_at.
 * Handles PST/PDT transition automatically.
 *
 * DST 2026: Spring forward March 8 at 2:00 AM
 * Before Mar 8: PST (UTC-8)
 * After Mar 8: PDT (UTC-7)
 */
function pacificToUtcIso(dateStr: string, hour: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);

  // Create a reference date at noon UTC on this day to detect DST
  const refDate = new Date(Date.UTC(year, month - 1, day, 20, 0, 0)); // 20:00 UTC = noon-ish Pacific

  // Use Intl to get the actual Pacific hour for this UTC time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    hour12: false,
  });
  const pacificHourAtRef = parseInt(formatter.format(refDate));
  const offset = 20 - pacificHourAtRef; // UTC offset in hours (8 for PST, 7 for PDT)

  // Compute UTC hour for the desired Pacific hour
  const utcHour = hour + offset;

  // Handle day rollover (e.g., midnight Pacific = 8:00 UTC same day for PST)
  const utcDate = new Date(Date.UTC(year, month - 1, day, utcHour, 0, 0));

  return utcDate.toISOString().replace('.000Z', '+00:00');
}

function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function nextPostingDay(dateStr: string): string {
  let current = dateStr;
  while (SKIP_DAYS.includes(getDayOfWeek(current))) {
    current = addDays(current, 1);
  }
  return current;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface Video {
  id: number;
  uid: string;
  title: string;
  mp4_url: string;
  poster_url: string | null;
  parent_video_id: number | null;
  clip_index: number | null;
}

interface ScheduleEntry {
  type: 'clip' | 'full_video' | 'poster';
  video: Video;
  parentVideo?: Video;
  date: string;
  hour: number;
  utcIso: string;
  platforms: string[];
  accountIds: string[];
  caption: string;
  platformConfigs: Record<string, any>;
  media: Array<{ url: string; type: 'image' | 'video'; thumbnail_url?: string }>;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const isLive = process.argv.includes('--live');
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  SCHEDULE ALL — ${isLive ? 'LIVE MODE' : 'DRY RUN'}`);
  console.log(`${'='.repeat(80)}\n`);

  // ── Fetch PostForMe accounts ──────────────────────────────────────────
  const accountsRes = await getAccounts();
  if (!accountsRes.success || !accountsRes.data) {
    console.error('Failed to fetch PostForMe accounts:', accountsRes.error);
    process.exit(1);
  }

  const accountMap = new Map<string, string>();
  for (const acct of accountsRes.data) {
    if (acct.status !== 'connected') continue;
    accountMap.set(mapPlatform(acct.platform), acct.id);
  }

  console.log('Connected accounts:');
  for (const [platform, id] of accountMap) {
    console.log(`  ${platform}: ${id}`);
  }

  const youtubeId = accountMap.get('youtube');
  const tiktokId = accountMap.get('tiktok');
  const instagramId = accountMap.get('instagram');

  if (!youtubeId || !tiktokId || !instagramId) {
    console.error('\nMissing required accounts. Need YouTube, TikTok, and Instagram.');
    process.exit(1);
  }

  // ── Build schedule ────────────────────────────────────────────────────
  const schedule: ScheduleEntry[] = [];
  let currentDate = START_DATE;

  for (const parentId of VIDEO_ORDER) {
    // Fetch parent video
    const parents = await queryDatabase(
      `SELECT id, uid, title, mp4_url, poster_url, parent_video_id, clip_index
       FROM videos WHERE id = ?`,
      [parentId]
    ) as Video[];

    if (!parents || parents.length === 0) {
      console.error(`Parent video ${parentId} not found!`);
      continue;
    }
    const parentVideo = parents[0];

    // Fetch clips ordered by clip_index
    const clips = await queryDatabase(
      `SELECT id, uid, title, mp4_url, poster_url, parent_video_id, clip_index
       FROM videos
       WHERE parent_video_id = ? AND status = 'published'
       ORDER BY clip_index ASC`,
      [parentId]
    ) as Video[];

    if (clips.length === 0) {
      console.log(`\n[SKIP] ${parentVideo.title} — no published clips`);
      continue;
    }

    // Verify all clips have mp4_url
    const missingMp4 = clips.filter(c => !c.mp4_url);
    if (missingMp4.length > 0) {
      console.error(`\n[ERROR] ${parentVideo.title}: ${missingMp4.length} clips missing mp4_url!`);
      for (const c of missingMp4) console.error(`  - ${c.id}: ${c.title}`);
      process.exit(1);
    }

    if (!parentVideo.mp4_url) {
      console.error(`\n[ERROR] Parent video ${parentVideo.title} missing mp4_url!`);
      process.exit(1);
    }

    console.log(`\n  ${parentVideo.title} — ${clips.length} clips`);

    // Ensure we start on a valid posting day
    currentDate = nextPostingDay(currentDate);

    let slotIndex = 0;
    let lastClipDate = currentDate;
    let lastClipHour = POSTING_HOURS[0];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const isFirstClip = i === 0;
      const hour = POSTING_HOURS[slotIndex];
      const utcIso = pacificToUtcIso(currentDate, hour);

      // ── Clip entry (YouTube Shorts + TikTok + Instagram Reels) ────
      schedule.push({
        type: 'clip',
        video: clip,
        parentVideo,
        date: currentDate,
        hour,
        utcIso,
        platforms: ['youtube', 'tiktok', 'instagram'],
        accountIds: [youtubeId, tiktokId, instagramId],
        caption: clipCaption(clip.title),
        platformConfigs: {
          youtube: {
            title: clip.title,
            shorts: true,
            category_id: '10',
            description: 'Directed by Mani Odubo\n\nB.A.A.D @ Odubo.Studio',
            made_for_kids: false,
            privacy_status: 'public',
          },
          tiktok: {
            title: clip.title,
            description: 'Directed by Mani Odubo\n\nB.A.A.D @ Odubo.Studio',
            allow_duet: true,
            allow_stitch: true,
            allow_comment: true,
            privacy_status: 'public',
          },
          instagram: {
            placement: 'REELS',
            share_to_feed: false,
          },
        },
        media: [{
          url: clip.mp4_url,
          type: 'video',
          thumbnail_url: `https://videodelivery.net/${clip.uid}/thumbnails/thumbnail.jpg`,
        }],
      });

      // ── Full parent video to YouTube (with first clip only) ───────
      if (isFirstClip) {
        schedule.push({
          type: 'full_video',
          video: parentVideo,
          date: currentDate,
          hour,
          utcIso,
          platforms: ['youtube'],
          accountIds: [youtubeId],
          caption: videoCaption(parentVideo.title),
          platformConfigs: {
            youtube: {
              title: parentVideo.title,
              shorts: false,
              category_id: '10',
              description: 'Directed by Mani Odubo\n\nB.A.A.D @ Odubo.Studio',
              made_for_kids: false,
              privacy_status: 'public',
            },
          },
          media: [{
            url: parentVideo.mp4_url,
            type: 'video',
            thumbnail_url: parentVideo.poster_url || `https://videodelivery.net/${parentVideo.uid}/thumbnails/thumbnail.jpg`,
          }],
        });
      }

      lastClipDate = currentDate;
      lastClipHour = hour;

      // Advance slot
      slotIndex++;
      if (slotIndex >= POSTING_HOURS.length) {
        slotIndex = 0;
        currentDate = addDays(currentDate, 1);
        currentDate = nextPostingDay(currentDate);
      }
    }

    // Batch boundary: next video starts the next posting day
    if (slotIndex > 0) {
      currentDate = addDays(currentDate, 1);
    }
    slotIndex = 0;
  }

  // ─── Print Schedule ───────────────────────────────────────────────────

  console.log(`\n${'='.repeat(80)}`);
  console.log(`  FULL SCHEDULE — ${schedule.length} entries`);
  console.log(`${'='.repeat(80)}`);

  const byDate = new Map<string, ScheduleEntry[]>();
  for (const entry of schedule) {
    const group = byDate.get(entry.date) || [];
    group.push(entry);
    byDate.set(entry.date, group);
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let clipCount = 0;
  let videoCount = 0;
  let posterCount = 0;
  let currentParent = '';

  for (const [date, entries] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const dayName = dayNames[getDayOfWeek(date)];
    entries.sort((a, b) => a.hour - b.hour);

    console.log(`\n  ${date} (${dayName}):`);

    for (const e of entries) {
      const hourStr = formatHour(e.hour);
      const icon = e.type === 'clip' ? 'CLIP' : e.type === 'full_video' ? 'VIDEO' : 'POSTER';
      const platforms = e.platforms.join('+');
      const title = e.video.title.substring(0, 38);

      // Show parent name when it changes
      const parentName = e.parentVideo?.title || e.video.title;
      if (parentName !== currentParent) {
        console.log(`    --- ${parentName} ---`);
        currentParent = parentName;
      }

      console.log(`    ${hourStr.padEnd(10)} [${icon.padEnd(6)}] ${title.padEnd(40)} ${platforms}`);

      if (e.type === 'clip') clipCount++;
      if (e.type === 'full_video') videoCount++;
      if (e.type === 'poster') posterCount++;
    }
  }

  const dates = [...byDate.keys()].sort();
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  SUMMARY`);
  console.log(`${'='.repeat(80)}`);
  console.log(`  Clips:       ${clipCount} (x3 platforms = ${clipCount * 3} deployments)`);
  console.log(`  Full Videos: ${videoCount} (YouTube only)`);
  console.log(`  Posters:     ${posterCount} (Instagram only)`);
  console.log(`  Total posts: ${schedule.length}`);
  console.log(`  Date range:  ${dates[0]} -> ${dates[dates.length - 1]}`);
  console.log(`  PostForMe calls: ${schedule.length}`);
  console.log(`${'='.repeat(80)}\n`);

  if (!isLive) {
    console.log('DRY RUN complete. Use --live to actually schedule.\n');
    return;
  }

  // ─── Deploy (Live Mode) ───────────────────────────────────────────────

  console.log('\nDEPLOYING...\n');

  let deployed = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of schedule) {
    // Duplicate protection: check if deployment already exists for this video+platform
    const existingCheck = entry.platforms.map(() => '?').join(',');
    const existing = await queryDatabase(
      `SELECT id, platform FROM video_deployments
       WHERE video_id = ? AND platform IN (${existingCheck})
       AND postforme_post_id IS NOT NULL`,
      [entry.video.id, ...entry.platforms]
    ) as any[];

    if (existing && existing.length > 0) {
      const existingPlatforms = existing.map((e: any) => e.platform).join(', ');
      console.log(`  [SKIP] ${entry.video.title} — already deployed to ${existingPlatforms}`);
      skipped++;
      continue;
    }

    try {
      const response = await createPost({
        caption: entry.caption,
        social_accounts: entry.accountIds,
        media: entry.media,
        scheduled_at: entry.utcIso,
        platform_configurations: entry.platformConfigs,
      });

      if (response.success && response.data) {
        const postId = response.data.id;
        const status = response.data.status || 'scheduled';

        // Create one deployment record per platform
        for (const platform of entry.platforms) {
          await executeQuery(
            `INSERT INTO video_deployments (video_id, platform, postforme_post_id, status, deployed_at)
             VALUES (?, ?, ?, ?, datetime('now'))`,
            [entry.video.id, platform, postId, status]
          );
        }

        const icon = entry.type === 'clip' ? 'CLIP' : entry.type === 'full_video' ? 'VIDEO' : 'POSTER';
        console.log(`  [OK] ${icon} ${entry.video.title} / ${entry.platforms.join('+')} -> ${postId} (${entry.date} ${formatHour(entry.hour)})`);
        deployed++;
      } else {
        console.log(`  [FAIL] ${entry.video.title}: ${response.error}`);
        errors++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 250));
    } catch (err: any) {
      console.log(`  [FAIL] ${entry.video.title}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`  DEPLOY COMPLETE`);
  console.log(`${'='.repeat(80)}`);
  console.log(`  Scheduled: ${deployed}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`${'='.repeat(80)}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
