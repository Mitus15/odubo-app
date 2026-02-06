#!/usr/bin/env tsx
/**
 * Cleanup Orphans Script
 *
 * Finds and optionally removes orphaned files:
 * - Cloudflare Stream videos that don't exist in the database
 * - R2 thumbnails that don't have matching videos in the database
 * - video_deployments records for deleted videos
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/cleanup-orphans.ts [options]
 *
 * Options:
 *   --dry-run     Show what would be deleted without actually deleting (default)
 *   --confirm     Actually delete orphaned files
 *   --stream      Only check Cloudflare Stream
 *   --r2          Only check R2 thumbnails
 *   --deployments Only check video_deployments
 */

import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import CloudflareStreamAPI from '../src/lib/cloudflareStream';

// Initialize S3 client for R2
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'odubo-studio-media';

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--confirm');
const checkStream = args.includes('--stream') || (!args.includes('--r2') && !args.includes('--deployments'));
const checkR2 = args.includes('--r2') || (!args.includes('--stream') && !args.includes('--deployments'));
const checkDeployments = args.includes('--deployments') || (!args.includes('--stream') && !args.includes('--r2'));

console.log('='.repeat(60));
console.log('ORPHAN CLEANUP SCRIPT');
console.log('='.repeat(60));
console.log(`Mode: ${dryRun ? 'DRY RUN (no deletions)' : 'CONFIRM (will delete)'}`);
console.log(`Checking: ${[
  checkStream && 'Cloudflare Stream',
  checkR2 && 'R2 Thumbnails',
  checkDeployments && 'video_deployments'
].filter(Boolean).join(', ')}`);
console.log('='.repeat(60));
console.log('');

async function getDbVideoUids(): Promise<Set<string>> {
  const { queryDatabase } = await import('../src/lib/db');
  const videos = await queryDatabase(
    'SELECT uid FROM videos WHERE uid IS NOT NULL AND uid != ""',
    []
  ) as Array<{ uid: string }>;
  return new Set(videos.map(v => v.uid));
}

async function getDbVideoIds(): Promise<Set<number>> {
  const { queryDatabase } = await import('../src/lib/db');
  const videos = await queryDatabase(
    'SELECT id FROM videos',
    []
  ) as Array<{ id: number }>;
  return new Set(videos.map(v => v.id));
}

async function findOrphanedStreamVideos(): Promise<string[]> {
  console.log('\n📹 Checking Cloudflare Stream...');

  const stream = new CloudflareStreamAPI();
  const dbUids = await getDbVideoUids();

  console.log(`  Database UIDs: ${dbUids.size}`);

  // Get all videos from Cloudflare Stream using cursor-based pagination
  const streamVideos: Array<{ uid: string; status: any; meta?: any; created?: string }> = [];
  let after: string | undefined = undefined;

  while (true) {
    try {
      const response = await stream.listVideos({ limit: 100, after });
      const videos = response?.result || [];

      if (videos.length === 0) {
        break;
      }

      streamVideos.push(...videos);

      // Check for next page cursor
      const paginationInfo = response?.result_info;
      if (paginationInfo?.cursors?.after) {
        after = paginationInfo.cursors.after;
      } else {
        break;
      }
    } catch (e) {
      console.error('  Error listing Stream videos:', e);
      break;
    }
  }

  console.log(`  Stream videos: ${streamVideos.length}`);

  // Find orphans (in Stream but not in DB)
  const orphans = streamVideos.filter(v => !dbUids.has(v.uid));

  console.log(`  Orphaned videos: ${orphans.length}`);

  if (orphans.length > 0) {
    console.log('');
    console.log('  Orphaned Cloudflare Stream videos:');
    for (const video of orphans) {
      const meta = video.meta || {};
      const title = meta.name || meta.title || '(no title)';
      console.log(`    - ${video.uid} | ${title} | ${video.created || 'unknown date'}`);
    }
  }

  return orphans.map(v => v.uid);
}

async function findOrphanedR2Thumbnails(): Promise<string[]> {
  console.log('\n🖼️ Checking R2 Thumbnails...');

  const dbVideoIds = await getDbVideoIds();
  const orphanedKeys: string[] = [];

  let continuationToken: string | undefined;
  let totalKeys = 0;

  do {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: 'thumbnails/',
      ContinuationToken: continuationToken,
    }));

    const contents = response.Contents || [];
    totalKeys += contents.length;

    for (const obj of contents) {
      const key = obj.Key;
      if (!key) continue;

      // Extract video ID from key: thumbnails/clips/{videoId}/{timestamp}.jpg
      const match = key.match(/thumbnails\/clips\/(\d+)\//);
      if (match) {
        const videoId = parseInt(match[1], 10);
        if (!dbVideoIds.has(videoId)) {
          orphanedKeys.push(key);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`  R2 thumbnail keys: ${totalKeys}`);
  console.log(`  Orphaned thumbnails: ${orphanedKeys.length}`);

  if (orphanedKeys.length > 0 && orphanedKeys.length <= 20) {
    console.log('');
    console.log('  Orphaned R2 keys:');
    for (const key of orphanedKeys) {
      console.log(`    - ${key}`);
    }
  } else if (orphanedKeys.length > 20) {
    console.log(`  (showing first 20 of ${orphanedKeys.length})`);
    for (const key of orphanedKeys.slice(0, 20)) {
      console.log(`    - ${key}`);
    }
  }

  return orphanedKeys;
}

async function findOrphanedDeployments(): Promise<number[]> {
  console.log('\n📤 Checking video_deployments...');

  const { queryDatabase } = await import('../src/lib/db');

  // Find deployments where the video no longer exists
  const orphans = await queryDatabase(
    `SELECT vd.id, vd.video_id, vd.platform, vd.postforme_post_id
     FROM video_deployments vd
     LEFT JOIN videos v ON v.id = vd.video_id
     WHERE v.id IS NULL`,
    []
  ) as Array<{ id: number; video_id: number; platform: string; postforme_post_id: string }>;

  console.log(`  Orphaned deployments: ${orphans.length}`);

  if (orphans.length > 0) {
    console.log('');
    console.log('  Orphaned video_deployments:');
    for (const d of orphans.slice(0, 20)) {
      console.log(`    - ID ${d.id} | video_id: ${d.video_id} | ${d.platform} | ${d.postforme_post_id}`);
    }
    if (orphans.length > 20) {
      console.log(`    ... and ${orphans.length - 20} more`);
    }
  }

  return orphans.map(d => d.id);
}

async function deleteOrphanedStreamVideos(uids: string[]): Promise<number> {
  if (uids.length === 0) return 0;

  const stream = new CloudflareStreamAPI();
  let deleted = 0;

  for (const uid of uids) {
    try {
      await stream.deleteVideo(uid);
      deleted++;
      console.log(`  ✓ Deleted Stream video: ${uid}`);
    } catch (e) {
      console.error(`  ✗ Failed to delete ${uid}:`, e);
    }
  }

  return deleted;
}

async function deleteOrphanedR2Keys(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;

  let deleted = 0;

  for (const key of keys) {
    try {
      await s3.send(new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      }));
      deleted++;
      if (deleted <= 10 || deleted % 50 === 0) {
        console.log(`  ✓ Deleted R2 key: ${key}`);
      }
    } catch (e) {
      console.error(`  ✗ Failed to delete ${key}:`, e);
    }
  }

  if (deleted > 10) {
    console.log(`  ... deleted ${deleted} total R2 keys`);
  }

  return deleted;
}

async function deleteOrphanedDeployments(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;

  const { executeQuery } = await import('../src/lib/db');
  let deleted = 0;

  for (const id of ids) {
    try {
      await executeQuery('DELETE FROM video_deployments WHERE id = ?', [id]);
      deleted++;
    } catch (e) {
      console.error(`  ✗ Failed to delete deployment ${id}:`, e);
    }
  }

  console.log(`  ✓ Deleted ${deleted} orphaned video_deployments`);
  return deleted;
}

async function main() {
  let orphanedStreamUids: string[] = [];
  let orphanedR2Keys: string[] = [];
  let orphanedDeploymentIds: number[] = [];

  // Find orphans
  if (checkStream) {
    orphanedStreamUids = await findOrphanedStreamVideos();
  }

  if (checkR2) {
    orphanedR2Keys = await findOrphanedR2Thumbnails();
  }

  if (checkDeployments) {
    orphanedDeploymentIds = await findOrphanedDeployments();
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Orphaned Cloudflare Stream videos: ${orphanedStreamUids.length}`);
  console.log(`Orphaned R2 thumbnails: ${orphanedR2Keys.length}`);
  console.log(`Orphaned video_deployments: ${orphanedDeploymentIds.length}`);

  const totalOrphans = orphanedStreamUids.length + orphanedR2Keys.length + orphanedDeploymentIds.length;

  if (totalOrphans === 0) {
    console.log('');
    console.log('✨ No orphans found! System is clean.');
    process.exit(0);
  }

  if (dryRun) {
    console.log('');
    console.log('⚠️  DRY RUN - No files deleted.');
    console.log('   Run with --confirm to actually delete orphaned files.');
    process.exit(0);
  }

  // Delete orphans
  console.log('');
  console.log('='.repeat(60));
  console.log('DELETING ORPHANS');
  console.log('='.repeat(60));

  let totalDeleted = 0;

  if (orphanedStreamUids.length > 0) {
    console.log('');
    console.log('Deleting Cloudflare Stream videos...');
    totalDeleted += await deleteOrphanedStreamVideos(orphanedStreamUids);
  }

  if (orphanedR2Keys.length > 0) {
    console.log('');
    console.log('Deleting R2 thumbnails...');
    totalDeleted += await deleteOrphanedR2Keys(orphanedR2Keys);
  }

  if (orphanedDeploymentIds.length > 0) {
    console.log('');
    console.log('Deleting video_deployments...');
    totalDeleted += await deleteOrphanedDeployments(orphanedDeploymentIds);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`✅ Cleanup complete! Deleted ${totalDeleted} orphaned items.`);
  console.log('='.repeat(60));
}

main().catch(console.error);
