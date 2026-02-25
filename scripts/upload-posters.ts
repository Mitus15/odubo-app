#!/usr/bin/env tsx
/**
 * Upload Posters to R2 & Map to Videos
 *
 * Reads poster images from public/posters/, fuzzy-matches them to videos by title,
 * uploads to R2, and saves poster_url to the DB.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/upload-posters.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/upload-posters.ts --live   # upload + save
 */

import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { queryDatabase, executeQuery } from '../src/lib/db';

const POSTERS_DIR = path.join(process.cwd(), 'public/posters');
const isLive = process.argv.includes('--live');

interface Video {
  id: number;
  title: string;
  parent_video_id: number | null;
  poster_url: string | null;
}

interface PosterMatch {
  file: string;
  video: Video | null;
  slug: string;
  videoTitle: string;
}

// Convert filename to slug for matching: "k-town.jpg" → "k town"
function filenameToSlug(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '') // remove extension
    .replace(/-/g, ' ') // replace dashes with spaces
    .toLowerCase();
}

// Fuzzy match: check if slug appears in video title or vice versa
function slugMatches(slug: string, title: string): boolean {
  const titleLower = title.toLowerCase().replace(/[^a-z0-9\s]/g, ''); // Remove punctuation
  const slugLower = slug.toLowerCase().replace(/[^a-z0-9\s]/g, '');

  // Exact substring match
  if (titleLower.includes(slugLower) || slugLower.includes(titleLower)) {
    return true;
  }

  // All slug words in title
  const slugWords = slugLower.split(/\s+/);
  if (slugWords.every(word => titleLower.includes(word))) {
    return true;
  }

  // All title words in slug (for reversed cases like "Vase" in "vaselini")
  const titleWords = titleLower.split(/\s+/);
  if (titleWords.every(word => slugLower.includes(word))) {
    return true;
  }

  return false;
}

function getR2Client() {
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured');
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log(`  UPLOAD POSTERS TO R2 — ${isLive ? 'LIVE MODE' : 'DRY RUN'}`);
  console.log('='.repeat(70) + '\n');

  // Read poster files
  const posterFiles = fs
    .readdirSync(POSTERS_DIR)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .sort();

  if (posterFiles.length === 0) {
    console.log('❌ No poster files found in public/posters/\n');
    process.exit(1);
  }

  console.log(`📁 Found ${posterFiles.length} poster files:\n`);
  posterFiles.forEach(f => console.log(`   • ${f}`));
  console.log();

  // Query all parent videos
  const videos = (await queryDatabase(
    'SELECT id, title, parent_video_id, poster_url FROM videos WHERE parent_video_id IS NULL ORDER BY id',
    []
  )) as Video[];

  if (!videos || videos.length === 0) {
    console.log('❌ No parent videos found in DB\n');
    process.exit(1);
  }

  console.log(`📹 Found ${videos.length} parent videos\n`);

  // Match posters to videos
  const posterMatches: PosterMatch[] = posterFiles.map(file => {
    const slug = filenameToSlug(file);
    const video = videos.find(v => slugMatches(slug, v.title)) || null;
    return {
      file,
      video,
      slug,
      videoTitle: video?.title || '(no match)',
    };
  });

  // Print mapping table
  console.log('📊 MAPPING:\n');
  console.log(
    `${'Poster'.padEnd(35)} │ ${'Video Title'.padEnd(30)} │ ID`
  );
  console.log('-'.repeat(70));

  const unmatched: string[] = [];
  posterMatches.forEach(m => {
    const poster = m.file.padEnd(35);
    const title = m.videoTitle.padEnd(30);
    const id = m.video?.id ? String(m.video.id).padStart(3) : '  ?';
    console.log(`${poster} │ ${title} │ ${id}`);
    if (!m.video) unmatched.push(m.file);
  });

  console.log();

  if (unmatched.length > 0) {
    console.log(`⚠️  UNMATCHED POSTERS (${unmatched.length}):\n`);
    unmatched.forEach(f => console.log(`   • ${f}`));
    console.log();
  }

  const toUpload = posterMatches.filter(m => m.video);
  console.log(`✅ Ready to upload: ${toUpload.length}/${posterMatches.length}\n`);

  if (!isLive) {
    console.log('💡 Run with --live to actually upload and save to DB\n');
    process.exit(0);
  }

  // LIVE MODE: Upload to R2 + update DB
  console.log('🚀 UPLOADING TO R2...\n');

  const s3 = getR2Client();
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME;
  const publicBase = process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;

  if (!bucket || !publicBase) {
    console.error('❌ R2_BUCKET_NAME or R2_PUBLIC_URL not configured\n');
    process.exit(1);
  }

  let uploaded = 0;
  let failed = 0;
  const errors: Array<{ file: string; error: string }> = [];

  for (const match of toUpload) {
    const { file, video } = match;
    const filePath = path.join(POSTERS_DIR, file);
    const ext = path.extname(file).slice(1).toLowerCase();
    const key = `posters/${video!.id}.${ext}`;
    const publicUrl = `${publicBase}/${key}`;

    try {
      const fileData = fs.readFileSync(filePath);
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

      const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        Body: fileData,
      });

      await s3.send(cmd);

      // Save to DB
      await executeQuery(
        'UPDATE videos SET poster_url = ?, updated_at = datetime("now") WHERE id = ?',
        [publicUrl, video!.id]
      );

      console.log(`  ✅ ${file.padEnd(35)} → ${video!.title.padEnd(30)} [${video!.id}]`);
      uploaded++;
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(
        `  ❌ ${file.padEnd(35)} → ${video!.title.padEnd(30)} [ERROR: ${errorMsg.substring(0, 40)}]`
      );
      errors.push({ file, error: errorMsg });
      failed++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`  ✅ UPLOADED: ${uploaded} │ ❌ FAILED: ${failed}`);
  console.log('='.repeat(70) + '\n');

  if (errors.length > 0) {
    console.log('❌ ERRORS:\n');
    errors.forEach(e => {
      console.log(`   ${e.file}`);
      console.log(`   → ${e.error}\n`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
