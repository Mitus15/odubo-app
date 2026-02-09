#!/usr/bin/env tsx
/**
 * Backfill Transcoding Jobs Script
 *
 * Creates transcoding jobs for existing videos that need format conversion.
 * Identifies non-MP4 videos without transcoding jobs and queues them for processing.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/backfill-transcode.ts
 *
 * Options:
 *   --dry-run       Show what would be processed without creating jobs
 *   --limit=N       Process only N videos (for testing)
 *   --clips         Process only clips
 *   --videos        Process only parent videos
 *   --force         Create jobs even if transcoding_job_id exists (re-transcode)
 *   --format=mov    Only process specific format (mov, avi, mkv, etc.)
 */

import { queryDatabase, executeQuery } from '@/lib/db';

interface Video {
  id: number;
  uid: string;
  title: string;
  mp4_url: string;
  source_format: string | null;
  transcoding_job_id: number | null;
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
const formatArg = args.find(arg => arg.startsWith('--format='));
const targetFormat = formatArg ? formatArg.split('=')[1].toLowerCase() : undefined;

async function backfillTranscoding() {
  console.log('🎬 Arsenal Transcoding Backfill Script');
  console.log('==========================================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No jobs will be created\n');
  }

  // Build query conditions
  const conditions: string[] = ['mp4_url IS NOT NULL'];
  const params: any[] = [];

  // Exclude native MP4s (unless force)
  if (!force) {
    conditions.push("(source_format IS NULL OR source_format != 'mp4')");
    conditions.push('transcoding_job_id IS NULL');
  }

  // Clip/video filter
  if (clipsOnly) {
    conditions.push('parent_video_id IS NOT NULL');
  } else if (videosOnly) {
    conditions.push('parent_video_id IS NULL');
  }

  // Format filter
  if (targetFormat) {
    conditions.push('source_format = ?');
    params.push(targetFormat);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const limitClause = limit ? `LIMIT ${limit}` : '';

  // Fetch videos needing transcoding
  const videos = await queryDatabase(
    `SELECT id, uid, title, mp4_url, source_format, transcoding_job_id, parent_video_id
     FROM videos
     ${whereClause}
     ORDER BY created_at DESC
     ${limitClause}`,
    params
  ) as Video[];

  if (!videos || videos.length === 0) {
    console.log('✅ No videos need transcoding jobs');
    return;
  }

  console.log(`📊 Found ${videos.length} videos to process\n`);

  // Group by format for reporting
  const formatCounts: Record<string, number> = {};
  videos.forEach(v => {
    const format = v.source_format || 'unknown';
    formatCounts[format] = (formatCounts[format] || 0) + 1;
  });

  console.log('Format breakdown:');
  Object.entries(formatCounts).forEach(([format, count]) => {
    console.log(`  • ${format.toUpperCase()}: ${count} videos`);
  });
  console.log('');

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ id: number; title: string; error: string }> = [];

  for (const video of videos) {
    processed++;
    const progress = `[${processed}/${videos.length}]`;

    try {
      if (!video.mp4_url) {
        console.log(`${progress} SKIP: No mp4_url - "${video.title}"`);
        skipped++;
        continue;
      }

      if (video.transcoding_job_id && !force) {
        console.log(`${progress} SKIP: Has job #${video.transcoding_job_id} - "${video.title}"`);
        skipped++;
        continue;
      }

      if (video.source_format === 'mp4' && !force) {
        console.log(`${progress} SKIP: Already MP4 - "${video.title}"`);
        skipped++;
        continue;
      }

      const formatLabel = video.source_format ? video.source_format.toUpperCase() : 'UNKNOWN';

      if (dryRun) {
        console.log(`${progress} Would create job for [${formatLabel}]: "${video.title}"`);
        succeeded++;
      } else {
        console.log(`${progress} Creating job for [${formatLabel}]: "${video.title}"`);

        // Create transcoding job
        const jobResult = await executeQuery(
          `INSERT INTO transcoding_jobs (
            video_id, status, progress, source_url, source_format, started_at
          ) VALUES (?, 'queued', 0, ?, ?, CURRENT_TIMESTAMP)`,
          [video.id, video.mp4_url, video.source_format || 'unknown']
        );

        const job_id = (jobResult as any).meta?.last_row_id;

        // Update video with job reference
        await executeQuery(
          'UPDATE videos SET transcoding_job_id = ? WHERE id = ?',
          [job_id, video.id]
        );

        succeeded++;
        console.log(`  ✅ Job #${job_id} created\n`);
      }
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
  console.log(`✅ Jobs created: ${succeeded}`);
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
    console.log('\n💡 Run without --dry-run to create transcoding jobs');
  } else if (succeeded > 0) {
    console.log('\n✅ Backfill complete!');
    console.log(`   ${succeeded} jobs queued for Railway worker`);
    console.log('   Check Arsenal tab for transcoding progress');
  }
}

backfillTranscoding().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
