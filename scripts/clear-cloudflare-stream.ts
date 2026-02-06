#!/usr/bin/env tsx
/**
 * Clear Cloudflare Stream
 *
 * Deletes ALL videos from Cloudflare Stream.
 * Use with caution - this is irreversible!
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/clear-cloudflare-stream.ts [options]
 *
 * Options:
 *   --dry-run     Show what would be deleted without actually deleting (default)
 *   --confirm     Actually delete all videos
 */

import CloudflareStreamAPI from '../src/lib/cloudflareStream';

const args = process.argv.slice(2);
const dryRun = !args.includes('--confirm');

console.log('='.repeat(60));
console.log('CLEAR CLOUDFLARE STREAM');
console.log('='.repeat(60));
console.log(`Mode: ${dryRun ? 'DRY RUN (no deletions)' : 'CONFIRM (will delete ALL videos)'}`);
console.log('='.repeat(60));
console.log('');

async function main() {
  const stream = new CloudflareStreamAPI();

  console.log('📹 Fetching all videos from Cloudflare Stream...');

  // Get all videos from Cloudflare Stream using cursor-based pagination
  const allVideos: Array<{ uid: string; status: any; meta?: any; created?: string }> = [];
  let after: string | undefined = undefined;
  let batchCount = 0;

  while (true) {
    try {
      const response = await stream.listVideos({ limit: 100, after });
      const videos = response?.result || [];

      if (videos.length === 0) {
        break;
      }

      allVideos.push(...videos);
      batchCount++;
      console.log(`  Fetched batch ${batchCount}: ${videos.length} videos (total: ${allVideos.length})`);

      // Check if there are more results
      const paginationInfo = response?.result_info;
      if (paginationInfo?.cursors?.after) {
        after = paginationInfo.cursors.after;
      } else {
        // No more pages
        break;
      }
    } catch (e) {
      console.error('  Error listing Stream videos:', e);
      break;
    }
  }

  console.log('');
  console.log(`Total videos in Cloudflare Stream: ${allVideos.length}`);

  if (allVideos.length === 0) {
    console.log('');
    console.log('✨ No videos found in Cloudflare Stream. Already clean!');
    process.exit(0);
  }

  console.log('');
  console.log('Videos to delete:');
  for (const video of allVideos.slice(0, 10)) {
    const meta = video.meta || {};
    const title = meta.name || meta.title || '(no title)';
    console.log(`  - ${video.uid} | ${title} | ${video.created || 'unknown date'}`);
  }
  if (allVideos.length > 10) {
    console.log(`  ... and ${allVideos.length - 10} more`);
  }

  if (dryRun) {
    console.log('');
    console.log('⚠️  DRY RUN - No videos deleted.');
    console.log('   Run with --confirm to actually delete all videos.');
    process.exit(0);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('DELETING ALL VIDEOS');
  console.log('='.repeat(60));

  let deleted = 0;
  let failed = 0;

  for (const video of allVideos) {
    try {
      await stream.deleteVideo(video.uid);
      deleted++;
      if (deleted <= 10 || deleted % 20 === 0) {
        console.log(`  ✓ Deleted: ${video.uid}`);
      }
    } catch (e) {
      failed++;
      console.error(`  ✗ Failed to delete ${video.uid}:`, e);
    }
  }

  if (deleted > 10) {
    console.log(`  ... deleted ${deleted} total videos`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`✅ Cleanup complete!`);
  console.log(`   Deleted: ${deleted}`);
  console.log(`   Failed: ${failed}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
