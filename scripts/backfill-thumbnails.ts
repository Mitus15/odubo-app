#!/usr/bin/env tsx
/**
 * Backfill Thumbnails Script
 * 
 * Generates thumbnails for all existing videos that don't have custom thumbnails.
 * 
 * Usage:
 *   tsx --env-file=.env.local scripts/backfill-thumbnails.ts
 * 
 * Options:
 *   --dry-run    Show what would be processed without making changes
 *   --limit=N    Process only N videos (for testing)
 *   --clips      Process only clips (random frame)
 *   --videos     Process only parent videos (AI candidates)
 *   --force      Regenerate even if thumbnail exists
 */

import { queryDatabase, executeQuery } from '@/lib/db';
import { generateClipThumbnail, generateAIThumbnailCandidates } from '@/lib/thumbnailService';

interface Video {
  id: number;
  uid: string;
  title: string;
  thumbnail: string | null;
  parent_video_id: number | null;
  type: string | null;
  duration: string | null;
}

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const clipsOnly = args.includes('--clips');
const videosOnly = args.includes('--videos');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

async function backfillThumbnails() {
  console.log('🎬 Arsenal Thumbnail Backfill Script');
  console.log('=====================================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Build query conditions
  const conditions: string[] = [];
  const params: any[] = [];

  if (!force) {
    // Only videos without thumbnails
    conditions.push('(thumbnail IS NULL OR thumbnail = "")');
  }

  if (clipsOnly) {
    conditions.push('parent_video_id IS NOT NULL');
  } else if (videosOnly) {
    conditions.push('parent_video_id IS NULL');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = limit ? `LIMIT ${limit}` : '';

  // Fetch videos that need thumbnails
  const videos = await queryDatabase(
    `SELECT id, uid, title, thumbnail, parent_video_id, type, duration
     FROM videos
     ${whereClause}
     ORDER BY created_at DESC
     ${limitClause}`,
    params
  ) as Video[];

  if (!videos || videos.length === 0) {
    console.log('✅ No videos need thumbnail generation');
    return;
  }

  console.log(`📊 Found ${videos.length} videos to process\n`);

  const clips = videos.filter(v => v.parent_video_id !== null);
  const parentVideos = videos.filter(v => v.parent_video_id === null);

  console.log(`  • ${clips.length} clips (random frame)`);
  console.log(`  • ${parentVideos.length} parent videos (AI candidates)\n`);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: Array<{ id: number; title: string; error: string }> = [];

  // Process clips (faster, random frame)
  if (clips.length > 0) {
    console.log('🎥 Processing clips...\n');

    for (const video of clips) {
      processed++;
      const progress = `[${processed}/${videos.length}]`;

      try {
        if (dryRun) {
          console.log(`${progress} Would generate thumbnail for clip: ${video.title} (${video.uid})`);
          succeeded++;
        } else {
          console.log(`${progress} Generating thumbnail for clip: ${video.title}`);
          
          const duration = video.duration ? parseInt(video.duration, 10) : 30; // Default 30s if missing
          await generateClipThumbnail(video.uid, duration, video.id);
          
          succeeded++;
          console.log(`  ✅ Success\n`);
        }
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ id: video.id, title: video.title, error: errorMsg });
        console.log(`  ❌ Failed: ${errorMsg}\n`);
      }
    }
  }

  // Process parent videos (slower, AI ranking)
  if (parentVideos.length > 0) {
    console.log('🎬 Processing parent videos with AI...\n');

    for (const video of parentVideos) {
      processed++;
      const progress = `[${processed}/${videos.length}]`;

      try {
        if (dryRun) {
          console.log(`${progress} Would generate AI thumbnails for: ${video.title} (${video.uid})`);
          succeeded++;
        } else {
          console.log(`${progress} Generating AI thumbnails for: ${video.title}`);
          
          await generateAIThumbnailCandidates(video.uid, video.id);
          
          succeeded++;
          console.log(`  ✅ Success\n`);
        }
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ id: video.id, title: video.title, error: errorMsg });
        console.log(`  ❌ Failed: ${errorMsg}\n`);
      }
    }
  }

  // Summary
  console.log('\n=====================================');
  console.log('📊 Backfill Summary');
  console.log('=====================================\n');
  console.log(`Total processed: ${processed}`);
  console.log(`✅ Succeeded: ${succeeded}`);
  console.log(`❌ Failed: ${failed}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:\n');
    errors.forEach(err => {
      console.log(`  • [ID ${err.id}] ${err.title}`);
      console.log(`    ${err.error}\n`);
    });
  }

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to apply changes');
  } else {
    console.log('\n✅ Backfill complete!');
  }
}

// Run script
backfillThumbnails().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
