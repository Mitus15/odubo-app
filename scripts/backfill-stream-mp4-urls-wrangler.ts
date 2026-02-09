#!/usr/bin/env tsx
/**
 * Backfill Stream MP4 Download URLs (Wrangler Version)
 *
 * Uses wrangler for DB access - just run `wrangler login` first
 *
 * Usage:
 *   wrangler login  # First time only
 *   tsx scripts/backfill-stream-mp4-urls-wrangler.ts
 *
 * Options:
 *   --dry-run       Show what would be updated without making changes
 *   --limit=N       Process only N videos (for testing)
 *   --clips         Process only clips
 *   --videos        Process only parent videos
 */

import { execSync } from 'child_process';
import CloudflareStreamAPI from '../src/lib/cloudflareStream.js';

interface Video {
  id: number;
  uid: string | null;
  title: string;
  mp4_url: string | null;
  source_format: string | null;
  parent_video_id: number | null;
}

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const clipsOnly = args.includes('--clips');
const videosOnly = args.includes('--videos');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

function runWranglerQuery(sql: string): any[] {
  try {
    const result = execSync(
      `wrangler d1 execute odubo --remote --json --command="${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const parsed = JSON.parse(result);
    return parsed[0]?.results || [];
  } catch (error: any) {
    // Check if it's an auth error
    if (error.message?.includes('not authenticated') || error.message?.includes('login')) {
      console.error('\n❌ Not authenticated with Wrangler');
      console.error('Run: wrangler login\n');
      process.exit(1);
    }
    throw error;
  }
}

function runWranglerUpdate(sql: string, params: any[]): void {
  // Escape single quotes in params and build SQL
  const escapedParams = params.map(p => {
    if (p === null) return 'NULL';
    if (typeof p === 'string') return `'${p.replace(/'/g, "''")}'`;
    return p;
  });

  // Build parameterized query manually since wrangler doesn't support params well via CLI
  let finalSql = sql;
  escapedParams.forEach((param, i) => {
    finalSql = finalSql.replace('?', param);
  });

  execSync(
    `wrangler d1 execute odubo --remote --command="${finalSql.replace(/"/g, '\\"')}"`,
    { stdio: 'inherit' }
  );
}

async function backfillStreamMp4Urls() {
  console.log('🎬 Stream MP4 URL Backfill Script (Wrangler)');
  console.log('==========================================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Build query conditions
  const conditions: string[] = ['uid IS NOT NULL']; // Must have Stream UID

  // Only process videos that need fixing
  conditions.push("(mp4_url IS NULL OR source_format IS NULL OR source_format != 'mp4')");

  // Clip/video filter
  if (clipsOnly) {
    conditions.push('parent_video_id IS NOT NULL');
  } else if (videosOnly) {
    conditions.push('parent_video_id IS NULL');
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const limitClause = limit ? `LIMIT ${limit}` : '';

  console.log('📊 Fetching videos from database...\n');

  // Fetch videos needing MP4 URL update
  const sql = `SELECT id, uid, title, mp4_url, source_format, parent_video_id
     FROM videos
     ${whereClause}
     ORDER BY created_at DESC
     ${limitClause}`;

  const videos = runWranglerQuery(sql) as Video[];

  if (!videos || videos.length === 0) {
    console.log('✅ No videos need MP4 URL updates');
    return;
  }

  console.log(`📊 Found ${videos.length} videos to process\n`);

  // Group by source format for reporting
  const formatCounts: Record<string, number> = {};
  videos.forEach(v => {
    const format = v.source_format || 'unknown';
    formatCounts[format] = (formatCounts[format] || 0) + 1;
  });

  console.log('Source format breakdown:');
  Object.entries(formatCounts).forEach(([format, count]) => {
    console.log(`  • ${format.toUpperCase()}: ${count} videos`);
  });
  console.log('');

  // Check for Cloudflare credentials
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    console.error('❌ Missing Cloudflare credentials');
    console.error('Set these environment variables:');
    console.error('  CLOUDFLARE_ACCOUNT_ID');
    console.error('  CLOUDFLARE_STREAM_API_TOKEN (or CLOUDFLARE_API_TOKEN)');
    console.error('');
    console.error('Get them from: https://dash.cloudflare.com/');
    process.exit(1);
  }

  // Initialize Stream API
  const stream = new CloudflareStreamAPI();

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ id: number; title: string; error: string }> = [];

  for (const video of videos) {
    processed++;
    const progress = `[${processed}/${videos.length}]`;

    try {
      if (!video.uid) {
        console.log(`${progress} SKIP: No Stream UID - "${video.title}"`);
        skipped++;
        continue;
      }

      const formatLabel = video.source_format ? video.source_format.toUpperCase() : 'UNKNOWN';
      console.log(`${progress} Processing [${formatLabel}]: "${video.title}"`);
      console.log(`  Stream UID: ${video.uid}`);

      if (dryRun) {
        console.log(`  Would enable downloads and update mp4_url\n`);
        succeeded++;
        continue;
      }

      // Step 1: Enable MP4 downloads on Stream
      console.log(`  Enabling downloads...`);
      await stream.enableDownloads(video.uid);

      // Wait a moment for Stream to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Get the MP4 download URL
      console.log(`  Fetching download URL...`);
      const downloadUrl = await stream.getDownloadUrl(video.uid);

      if (!downloadUrl) {
        console.log(`  ⚠️  Download not ready yet, may need to wait\n`);
        skipped++;
        continue;
      }

      console.log(`  ✅ MP4 URL: ${downloadUrl.substring(0, 60)}...`);

      // Step 3: Update database via wrangler
      console.log(`  Updating database...`);
      runWranglerUpdate(
        'UPDATE videos SET mp4_url = ? WHERE id = ?',
        [downloadUrl, video.id]
      );

      succeeded++;
      console.log(`  ✅ Updated!\n`);

    } catch (error) {
      failed++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ id: video.id, title: video.title, error: errorMsg });
      console.log(`  ❌ Failed: ${errorMsg}\n`);
    }
  }

  // Summary
  console.log('\n==========================================');
  console.log('📊 Backfill Summary');
  console.log('==========================================\n');
  console.log(`Total processed: ${processed}`);
  console.log(`✅ Updated: ${succeeded}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:\n');
    errors.forEach(err => {
      console.log(`  • [ID ${err.id}] ${err.title}`);
      console.log(`    ${err.error}\n`);
    });
  }

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to update MP4 URLs');
  } else if (succeeded > 0) {
    console.log('\n✅ Backfill complete!');
    console.log(`   ${succeeded} videos now have proper Stream MP4 download URLs`);
    console.log('   Ready for PostForMe deployment');
  }
}

backfillStreamMp4Urls().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
