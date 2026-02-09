#!/usr/bin/env tsx
/**
 * Backfill MP4 URLs for Arsenal Deployment
 *
 * Downloads videos from Cloudflare Stream and uploads to R2 to populate
 * mp4_url for videos that were uploaded before the Arsenal R2 system.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/backfill-mp4-urls.ts
 *
 * Options:
 *   --dry-run       Show what would be processed without making changes
 *   --limit=N       Process only N videos (for testing)
 *   --clips         Process only clips
 *   --videos        Process only parent videos
 *   --force         Re-process even if mp4_url exists
 */

import { queryDatabase, executeQuery } from '@/lib/db';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface Video {
  id: number;
  uid: string;
  title: string;
  mp4_url: string | null;
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

// S3 client for R2
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET || 'odubo-studio-media';
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || 'https://media.odubo.studio';

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Download video from Cloudflare Stream
 */
async function downloadFromStream(uid: string): Promise<Buffer | null> {
  const streamDownloadUrl = `https://videodelivery.net/${uid}/downloads/default.mp4`;

  try {
    const response = await fetch(streamDownloadUrl);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Download not available
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    throw new Error(`Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload video to R2
 */
async function uploadToR2(videoBuffer: Buffer, title: string): Promise<{ mp4_url: string; key: string }> {
  // Generate unique key for R2
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now();

  // Force .mp4 extension for compatibility
  const baseFilename = title.replace(/[^a-zA-Z0-9.-]/g, '_');
  const sanitized = `${baseFilename}.mp4`;
  const key = `videos/source/${year}/${month}/${timestamp}-${sanitized}`;

  // Upload to R2
  const putCommand = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: videoBuffer,
    ContentType: 'video/mp4',
  });

  await s3.send(putCommand);

  // Calculate public URL
  const mp4_url = `${R2_PUBLIC_URL}/${key}`;

  return { mp4_url, key };
}

async function backfillMP4URLs() {
  console.log('🎬 Arsenal MP4 URL Backfill Script');
  console.log('==========================================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Build query conditions
  const conditions: string[] = ['uid IS NOT NULL'];
  const params: any[] = [];

  if (!force) {
    conditions.push('mp4_url IS NULL');
  }

  // Clip/video filter
  if (clipsOnly) {
    conditions.push('parent_video_id IS NOT NULL');
  } else if (videosOnly) {
    conditions.push('parent_video_id IS NULL');
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const limitClause = limit ? `LIMIT ${limit}` : '';

  // Fetch videos needing backfill
  const videos = await queryDatabase(
    `SELECT id, uid, title, mp4_url, parent_video_id
     FROM videos
     ${whereClause}
     ORDER BY created_at DESC
     ${limitClause}`,
    params
  ) as Video[];

  if (!videos || videos.length === 0) {
    console.log('✅ No videos need MP4 URL backfill');
    return;
  }

  console.log(`📊 Found ${videos.length} videos to process\n`);

  // Group by type for reporting
  const parentCount = videos.filter(v => !v.parent_video_id).length;
  const clipCount = videos.filter(v => v.parent_video_id).length;

  console.log('Video breakdown:');
  console.log(`  • Parent videos: ${parentCount}`);
  console.log(`  • Clips: ${clipCount}`);
  console.log('');

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ id: number; title: string; error: string }> = [];

  for (const video of videos) {
    processed++;
    const progress = `[${processed}/${videos.length}]`;
    const videoType = video.parent_video_id ? 'clip' : 'parent';

    try {
      if (!video.uid) {
        console.log(`${progress} SKIP: No uid - "${video.title}"`);
        skipped++;
        continue;
      }

      if (video.mp4_url && !force) {
        console.log(`${progress} SKIP: Already has mp4_url - "${video.title}"`);
        skipped++;
        continue;
      }

      console.log(`${progress} Processing: "${video.title}" (${videoType})`);

      if (dryRun) {
        console.log(`  Would download from Stream uid: ${video.uid}`);
        console.log(`  Would upload to R2`);
        console.log(`  Would update database\n`);
        succeeded++;
      } else {
        // Download from Stream
        console.log(`  Downloading from Stream...`);
        const videoBuffer = await downloadFromStream(video.uid);

        if (!videoBuffer) {
          console.log(`  ⚠️  Stream download not available (might need MP4 enabled)`);
          skipped++;
          continue;
        }

        console.log(`  ✅ Downloaded (${formatBytes(videoBuffer.length)})`);

        // Upload to R2
        console.log(`  Uploading to R2...`);
        const { mp4_url, key } = await uploadToR2(videoBuffer, video.title);
        console.log(`  ✅ Uploaded: ${key}`);

        // Update database
        console.log(`  Updating database...`);
        await executeQuery(
          'UPDATE videos SET mp4_url = ?, source_format = ? WHERE id = ?',
          [mp4_url, 'mp4', video.id]
        );
        console.log(`  ✅ Updated database\n`);

        succeeded++;
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
  console.log(`✅ Successfully backfilled: ${succeeded}`);
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
    console.log('\n💡 Run without --dry-run to backfill MP4 URLs');
  } else if (succeeded > 0) {
    console.log('\n✅ Backfill complete!');
    console.log(`   ${succeeded} videos now ready for Arsenal deployment`);
  }
}

backfillMP4URLs().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
