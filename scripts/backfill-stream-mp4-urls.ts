#!/usr/bin/env tsx
/**
 * Backfill Stream MP4 Download URLs
 *
 * Replaces R2 URLs (which may be MOV/other formats) with proper
 * Cloudflare Stream MP4 download URLs for PostForMe compatibility.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/backfill-stream-mp4-urls.ts
 *
 * Options:
 *   --dry-run       Show what would be updated without making changes
 *   --limit=N       Process only N videos (for testing)
 *   --clips         Process only clips
 *   --videos        Process only parent videos
 *   --force         Update even if mp4_url already exists
 */

import { queryDatabase, executeQuery } from '@/lib/db';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

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
const force = args.includes('--force');
const clipsOnly = args.includes('--clips');
const videosOnly = args.includes('--videos');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

async function backfillStreamMp4Urls() {
  console.log('🎬 Stream MP4 URL Backfill Script');
  console.log('==========================================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Build query conditions
  const conditions: string[] = ['uid IS NOT NULL']; // Must have Stream UID
  const params: any[] = [];

  // Only process videos that need fixing (unless force)
  if (!force) {
    // Target videos with:
    // 1. Missing mp4_url
    // 2. R2 URLs (wrong format)
    // 3. Any non-Stream download URL
    conditions.push("(mp4_url IS NULL OR mp4_url LIKE '%media.odubo.studio/videos/source/%' OR mp4_url NOT LIKE '%cloudflarestream.com%downloads%')");
  }

  // Clip/video filter
  if (clipsOnly) {
    conditions.push('parent_video_id IS NOT NULL');
  } else if (videosOnly) {
    conditions.push('parent_video_id IS NULL');
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const limitClause = limit ? `LIMIT ${limit}` : '';

  // Fetch videos needing MP4 URL update
  const videos = await queryDatabase(
    `SELECT id, uid, title, mp4_url, source_format, parent_video_id
     FROM videos
     ${whereClause}
     ORDER BY created_at DESC
     ${limitClause}`,
    params
  ) as Video[];

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
      const enableResult = await stream.enableDownloads(video.uid);

      // Wait a moment for Stream to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Poll for the MP4 download URL (wait up to 5 minutes for large files)
      console.log(`  Waiting for download to be ready...`);
      let downloadUrl = null;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes total (60 * 5s)

      while (!downloadUrl && attempts < maxAttempts) {
        downloadUrl = await stream.getDownloadUrl(video.uid);
        if (!downloadUrl) {
          attempts++;
          if (attempts < maxAttempts) {
            // Show progress every 10 attempts (50 seconds)
            if (attempts % 10 === 0) {
              console.log(`  ⏳ Still waiting... (${attempts * 5}s / ${maxAttempts * 5}s)`);
            }
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          }
        }
      }

      if (!downloadUrl) {
        console.log(`  ❌ Download not ready after ${maxAttempts * 5}s, skipping\n`);
        skipped++;
        continue;
      }

      console.log(`  ✅ MP4 URL: ${downloadUrl.substring(0, 60)}...`);

      // Step 3: Update database
      await executeQuery(
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
