#!/usr/bin/env tsx

/**
 * Video File Organization Migration Script
 * 
 * This script migrates existing video files from the root R2 storage
 * to the organized folder structure:
 * 
 * FROM: /filename.mp4, /poster.jpg
 * TO:   /videos/{type}/{sanitized_title}_{id}/timestamp_filename.mp4
 *       /videos/{type}/{sanitized_title}_{id}/poster_timestamp_filename.jpg
 * 
 * The script will:
 * 1. Analyze current video files in database
 * 2. Copy files to new organized locations
 * 3. Update database URLs to point to new locations
 * 4. Verify migration success
 * 5. Optionally clean up old files
 */

// Load environment variables FIRST before any other imports
import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { queryDatabase, executeQuery } from '../src/lib/db.js';
import { validateFileType } from '../src/lib/fileOrganization.js';
import fs from 'fs';
import path from 'path';

// Cloudflare R2 configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
const PUBLIC_URL_BASE = process.env.CLOUDFLARE_R2_PUBLIC_URL!;

// Color functions for terminal output
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`
};

interface VideoRecord {
  id: number;
  title: string;
  url: string;
  poster_url: string | null;
  thumbnail: string | null;
  type: string;
  category: string;
  created_at: string;
}

interface MigrationPlan {
  videoId: string;
  record: VideoRecord;
  oldVideoKey: string | null;
  oldPosterKey: string | null;
  newVideoKey: string | null;
  newPosterKey: string | null;
  newVideoUrl: string | null;
  newPosterUrl: string | null;
  videoType: 'music-video' | 'short-film' | 'feature';
}

interface MigrationStats {
  totalVideos: number;
  videosWithFiles: number;
  videoFilesMigrated: number;
  posterFilesMigrated: number;
  errors: string[];
  skipped: string[];
}

/**
 * Extract file key from URL
 */
function extractKeyFromUrl(url: string): string | null {
  if (!url) return null;
  
  // Handle full URLs
  if (url.startsWith('https://media.odubo.studio/')) {
    return url.replace('https://media.odubo.studio/', '');
  }
  
  if (url.startsWith(`${PUBLIC_URL_BASE}/`)) {
    return url.replace(`${PUBLIC_URL_BASE}/`, '');
  }
  
  // Handle relative URLs (just the filename)
  if (!url.startsWith('http')) {
    return url.startsWith('/') ? url.substring(1) : url;
  }
  
  // Fallback: extract filename from any URL
  const urlParts = url.split('/');
  return urlParts[urlParts.length - 1];
}

/**
 * Map video type/category to our organized structure
 */
function mapVideoType(type: string, category: string): 'music-video' | 'short-film' | 'feature' {
  const typeStr = (type || '').toLowerCase();
  const categoryStr = (category || '').toLowerCase();
  
  if (typeStr.includes('music') || categoryStr.includes('music')) {
    return 'music-video';
  }
  
  if (typeStr.includes('short') || typeStr.includes('film') || categoryStr.includes('film')) {
    return 'short-film';
  }
  
  return 'feature';
}

/**
 * Sanitize video title for use as directory name
 */
function sanitizeVideoTitle(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special chars except spaces, hyphens, underscores
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .toLowerCase()
    .substring(0, 50); // Limit length to 50 characters
}

/**
 * Check if file exists in R2
 */
async function fileExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy file in R2 from old location to new location
 */
async function copyFile(oldKey: string, newKey: string): Promise<boolean> {
  try {
    await s3Client.send(new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${oldKey}`,
      Key: newKey,
    }));
    return true;
  } catch (error) {
    console.error(colors.red(`Failed to copy ${oldKey} to ${newKey}:`), error);
    return false;
  }
}

/**
 * Delete old file from R2
 */
async function deleteFile(key: string): Promise<boolean> {
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch (error) {
    console.error(colors.red(`Failed to delete ${key}:`), error);
    return false;
  }
}

/**
 * Generate migration plan for all videos
 */
async function generateMigrationPlan(): Promise<MigrationPlan[]> {
  console.log(colors.blue('📋 Generating migration plan...'));
  
  // Get all videos from database
  const videos = await queryDatabase(`
    SELECT id, title, url, poster_url, thumbnail, type, category, created_at
    FROM videos 
    ORDER BY id ASC
  `) as VideoRecord[];
  
  console.log(colors.cyan(`Found ${videos.length} videos in database`));
  
  const migrationPlan: MigrationPlan[] = [];
  
  for (const record of videos) {
    // Use sanitized video title as the directory name
    const sanitizedTitle = sanitizeVideoTitle(record.title || `video_${record.id}`);
    const videoId = `${sanitizedTitle}_${record.id}`;
    const videoType = mapVideoType(record.type, record.category);
    
    // Extract current file keys
    const oldVideoKey = extractKeyFromUrl(record.url);
    const oldPosterKey = extractKeyFromUrl(record.poster_url || record.thumbnail || '');
    
    let newVideoKey: string | null = null;
    let newPosterKey: string | null = null;
    let newVideoUrl: string | null = null;
    let newPosterUrl: string | null = null;
    
    // Generate new paths if files exist
    if (oldVideoKey) {
      const baseName = oldVideoKey.split('/').pop() || 'video.mp4';
      newVideoKey = `videos/${videoType}/${videoId}/${Date.now()}_${baseName}`;
      newVideoUrl = `${PUBLIC_URL_BASE}/${newVideoKey}`;
    }
    
    if (oldPosterKey) {
      const baseName = oldPosterKey.split('/').pop() || 'poster.jpg';
      newPosterKey = `videos/${videoType}/${videoId}/poster_${Date.now()}_${baseName}`;
      newPosterUrl = `${PUBLIC_URL_BASE}/${newPosterKey}`;
    }
    
    migrationPlan.push({
      videoId,
      record,
      oldVideoKey,
      oldPosterKey,
      newVideoKey,
      newPosterKey,
      newVideoUrl,
      newPosterUrl,
      videoType
    });
  }
  
  return migrationPlan;
}

/**
 * Execute the migration plan
 */
async function executeMigration(plan: MigrationPlan[], dryRun: boolean = true): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalVideos: plan.length,
    videosWithFiles: 0,
    videoFilesMigrated: 0,
    posterFilesMigrated: 0,
    errors: [],
    skipped: []
  };
  
  console.log(colors.blue(`\n🚀 ${dryRun ? 'DRY RUN:' : 'EXECUTING'} Migration plan...`));
  
  for (const item of plan) {
    const { record, oldVideoKey, oldPosterKey, newVideoKey, newPosterKey, newVideoUrl, newPosterUrl } = item;
    
    console.log(colors.cyan(`\nProcessing: ${record.title} (ID: ${record.id})`));
    
    let hasFiles = false;
    
    // Migrate video file
    if (oldVideoKey && newVideoKey) {
      const videoExists = await fileExists(oldVideoKey);
      if (videoExists) {
        hasFiles = true;
        console.log(colors.yellow(`  📹 Video: ${oldVideoKey} → ${newVideoKey}`));
        
        if (!dryRun) {
          const copied = await copyFile(oldVideoKey, newVideoKey);
          if (copied) {
            stats.videoFilesMigrated++;
            console.log(colors.green(`    ✅ Video file copied successfully`));
          } else {
            stats.errors.push(`Failed to copy video file for ${record.title}`);
          }
        }
      } else {
        console.log(colors.red(`  ❌ Video file not found: ${oldVideoKey}`));
        stats.skipped.push(`Video file not found: ${record.title} - ${oldVideoKey}`);
      }
    }
    
    // Migrate poster file
    if (oldPosterKey && newPosterKey) {
      const posterExists = await fileExists(oldPosterKey);
      if (posterExists) {
        hasFiles = true;
        console.log(colors.yellow(`  🖼️  Poster: ${oldPosterKey} → ${newPosterKey}`));
        
        if (!dryRun) {
          const copied = await copyFile(oldPosterKey, newPosterKey);
          if (copied) {
            stats.posterFilesMigrated++;
            console.log(colors.green(`    ✅ Poster file copied successfully`));
          } else {
            stats.errors.push(`Failed to copy poster file for ${record.title}`);
          }
        }
      } else {
        console.log(colors.red(`  ❌ Poster file not found: ${oldPosterKey}`));
        stats.skipped.push(`Poster file not found: ${record.title} - ${oldPosterKey}`);
      }
    }
    
    if (hasFiles) {
      stats.videosWithFiles++;
      
      // Update database URLs (only if not dry run)
      if (!dryRun) {
        try {
          const updateSql = `
            UPDATE videos 
            SET url = ?, poster_url = ?, updated_at = datetime('now')
            WHERE id = ?
          `;
          
          await executeQuery(updateSql, [
            newVideoUrl || record.url,
            newPosterUrl || record.poster_url,
            record.id
          ]);
          
          console.log(colors.green(`    ✅ Database updated`));
        } catch (error) {
          stats.errors.push(`Failed to update database for ${record.title}: ${error}`);
          console.error(colors.red(`    ❌ Database update failed:`), error);
        }
      }
    } else {
      console.log(colors.bold(`  ⏭️  No files to migrate`));
    }
  }
  
  return stats;
}

/**
 * Verify migration success
 */
async function verifyMigration(plan: MigrationPlan[]): Promise<void> {
  console.log(colors.blue('\n🔍 Verifying migration...'));
  
  let verified = 0;
  let failed = 0;
  
  for (const item of plan) {
    if (item.newVideoKey) {
      const exists = await fileExists(item.newVideoKey);
      if (exists) {
        verified++;
      } else {
        failed++;
        console.log(colors.red(`❌ Missing: ${item.newVideoKey}`));
      }
    }
    
    if (item.newPosterKey) {
      const exists = await fileExists(item.newPosterKey);
      if (exists) {
        verified++;
      } else {
        failed++;
        console.log(colors.red(`❌ Missing: ${item.newPosterKey}`));
      }
    }
  }
  
  console.log(colors.green(`✅ Verified: ${verified} files`));
  if (failed > 0) {
    console.log(colors.red(`❌ Failed: ${failed} files`));
  }
}

/**
 * Clean up old files after successful migration
 */
async function cleanupOldFiles(plan: MigrationPlan[]): Promise<void> {
  console.log(colors.blue('\n🧹 Cleaning up old files...'));
  
  let deleted = 0;
  let failed = 0;
  
  for (const item of plan) {
    if (item.oldVideoKey && item.newVideoKey) {
      const newExists = await fileExists(item.newVideoKey);
      if (newExists) {
        const success = await deleteFile(item.oldVideoKey);
        if (success) {
          deleted++;
          console.log(colors.green(`🗑️  Deleted: ${item.oldVideoKey}`));
        } else {
          failed++;
        }
      }
    }
    
    if (item.oldPosterKey && item.newPosterKey) {
      const newExists = await fileExists(item.newPosterKey);
      if (newExists) {
        const success = await deleteFile(item.oldPosterKey);
        if (success) {
          deleted++;
          console.log(colors.green(`🗑️  Deleted: ${item.oldPosterKey}`));
        } else {
          failed++;
        }
      }
    }
  }
  
  console.log(colors.green(`🧹 Cleanup complete: ${deleted} files deleted`));
  if (failed > 0) {
    console.log(colors.red(`❌ Cleanup failed: ${failed} files`));
  }
}

/**
 * Save migration plan to file for review
 */
function saveMigrationPlan(plan: MigrationPlan[]): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `migration-plan-${timestamp}.json`;
  const filepath = path.join(process.cwd(), 'tmp', filename);
  
  // Ensure tmp directory exists
  const tmpDir = path.dirname(filepath);
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, JSON.stringify(plan, null, 2));
  console.log(colors.cyan(`📄 Migration plan saved to: ${filepath}`));
}

/**
 * Main migration function
 */
async function main() {
  console.log(colors.bold('\n🎬 Video File Organization Migration\n'));
  
  // Check required environment variables
  const requiredEnvVars = [
    'CLOUDFLARE_R2_ENDPOINT',
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_R2_BUCKET_NAME',
    'CLOUDFLARE_R2_PUBLIC_URL',
    'DATABASE_URL'
  ];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(colors.red(`❌ Missing environment variable: ${envVar}`));
      process.exit(1);
    }
  }
  
  try {
    // Generate migration plan
    const plan = await generateMigrationPlan();
    
    // Save plan for review
    saveMigrationPlan(plan);
    
    // Show summary
    const videosWithFiles = plan.filter(p => p.oldVideoKey || p.oldPosterKey).length;
    console.log(colors.cyan(`\n📊 Migration Summary:`));
    console.log(colors.cyan(`   Total videos: ${plan.length}`));
    console.log(colors.cyan(`   Videos with files: ${videosWithFiles}`));
    console.log(colors.cyan(`   Video files to migrate: ${plan.filter(p => p.oldVideoKey).length}`));
    console.log(colors.cyan(`   Poster files to migrate: ${plan.filter(p => p.oldPosterKey).length}`));
    
    // Get command line arguments
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--execute');
    const skipCleanup = args.includes('--skip-cleanup');
    
    if (dryRun) {
      console.log(colors.yellow('\n⚠️  DRY RUN MODE - No files will be moved or database updated'));
      console.log(colors.yellow('   Use --execute flag to perform actual migration'));
    }
    
    // Execute migration
    const stats = await executeMigration(plan, dryRun);
    
    // Show results
    console.log(colors.bold('\n📈 Migration Results:'));
    console.log(colors.cyan(`   Total videos processed: ${stats.totalVideos}`));
    console.log(colors.cyan(`   Videos with files: ${stats.videosWithFiles}`));
    console.log(colors.green(`   Video files migrated: ${stats.videoFilesMigrated}`));
    console.log(colors.green(`   Poster files migrated: ${stats.posterFilesMigrated}`));
    console.log(colors.yellow(`   Files skipped: ${stats.skipped.length}`));
    console.log(colors.red(`   Errors: ${stats.errors.length}`));
    
    if (stats.errors.length > 0) {
      console.log(colors.red('\n❌ Errors encountered:'));
      stats.errors.forEach(error => console.log(colors.red(`   • ${error}`)));
    }
    
    if (stats.skipped.length > 0) {
      console.log(colors.yellow('\n⏭️  Files skipped:'));
      stats.skipped.forEach(skip => console.log(colors.yellow(`   • ${skip}`)));
    }
    
    if (!dryRun) {
      // Verify migration
      await verifyMigration(plan);
      
      // Clean up old files if requested
      if (!skipCleanup) {
        console.log(colors.yellow('\n⚠️  Cleanup will start in 5 seconds...'));
        console.log(colors.yellow('   Press Ctrl+C to cancel if you want to keep old files'));
        await new Promise(resolve => setTimeout(resolve, 5000));
        await cleanupOldFiles(plan);
      } else {
        console.log(colors.yellow('\n⏭️  Cleanup skipped (use without --skip-cleanup to clean up old files)'));
      }
    }
    
    console.log(colors.bold('\n✅ Migration completed!'));
    
    if (dryRun) {
      console.log(colors.yellow('\nTo execute the migration:'));
      console.log(colors.cyan('  npm run migrate-videos --execute'));
      console.log(colors.yellow('\nTo execute without cleanup:'));
      console.log(colors.cyan('  npm run migrate-videos --execute --skip-cleanup'));
    }
    
  } catch (error) {
    console.error(colors.red('\n❌ Migration failed:'), error);
    process.exit(1);
  }
}

// Run the migration
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as migrateVideoFiles };
