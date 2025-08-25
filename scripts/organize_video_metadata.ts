#!/usr/bin/env tsx

/**
 * Video Metadata Organization Script
 * 
 * This script organizes your Cloudflare Stream videos by creating a structured
 * metadata system without moving the actual video files. It:
 * 
 * 1. Creates virtual organized paths for management
 * 2. Organizes poster files in R2 to match the structure
 * 3. Updates database with organized metadata
 * 4. Maintains Stream video functionality
 */

// Load environment variables FIRST before any other imports
import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

import { S3Client, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { queryDatabase, executeQuery } from '../src/lib/db.js';
import { generateFilePath } from '../src/lib/fileOrganization.js';
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
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`
};

interface VideoRecord {
  id: number;
  title: string;
  url: string;
  poster_url: string | null;
  thumbnail: string | null;
  type: string;
  category: string;
  artist_name?: string;
  created_at: string;
}

interface OrganizationPlan {
  videoId: string;
  record: VideoRecord;
  isStreamVideo: boolean;
  streamVideoId: string | null;
  virtualPath: string;
  oldPosterKey: string | null;
  newPosterKey: string | null;
  newPosterUrl: string | null;
  videoType: 'music-video' | 'short-film' | 'feature';
  organizationMetadata: {
    organized_path: string;
    original_url: string;
    video_source: 'stream' | 'r2';
    stream_id?: string;
  };
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
 * Extract Cloudflare Stream video ID from URL
 */
function extractStreamId(url: string): string | null {
  if (!url) return null;
  
  // Extract from iframe URL: https://iframe.videodelivery.net/{uid}
  const iframeMatch = url.match(/iframe\.videodelivery\.net\/([a-z0-9]+)/i);
  if (iframeMatch) return iframeMatch[1];
  
  // Extract from other Stream URLs
  const streamMatch = url.match(/videodelivery\.net\/([a-z0-9]+)/i);
  if (streamMatch) return streamMatch[1];
  
  return null;
}

/**
 * Check if URL is a Cloudflare Stream video
 */
function isStreamVideo(url: string): boolean {
  return Boolean(url && (url.includes('videodelivery.net') || url.includes('iframe.videodelivery.net')));
}

/**
 * Extract file key from R2 URL
 */
function extractKeyFromUrl(url: string): string | null {
  if (!url) return null;
  
  // Handle full URLs
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
 * Generate organization plan for all videos
 */
async function generateOrganizationPlan(): Promise<OrganizationPlan[]> {
  console.log(colors.blue('📋 Generating organization plan...'));
  
  // Get all videos from database (handle missing artist_name column gracefully)
  let videos: VideoRecord[];
  try {
    videos = await queryDatabase(`
      SELECT id, title, url, poster_url, thumbnail, type, category, 
             COALESCE(artist_name, '') as artist_name, created_at
      FROM videos 
      ORDER BY id ASC
    `) as VideoRecord[];
  } catch (error) {
    // Fallback if artist_name column doesn't exist
    console.log(colors.yellow('   Note: artist_name column not found, using fallback query'));
    videos = await queryDatabase(`
      SELECT id, title, url, poster_url, thumbnail, type, category, created_at
      FROM videos 
      ORDER BY id ASC
    `) as VideoRecord[];
    // Add empty artist_name to match interface
    videos = videos.map(v => ({ ...v, artist_name: '' }));
  }
  
  console.log(colors.cyan(`Found ${videos.length} videos in database`));
  
  const organizationPlan: OrganizationPlan[] = [];
  
  for (const record of videos) {
    // Use sanitized video title as the directory name
    const sanitizedTitle = sanitizeVideoTitle(record.title || `video_${record.id}`);
    const videoId = `${sanitizedTitle}_${record.id}`;
    const videoType = mapVideoType(record.type, record.category);
    
    // Determine if this is a Stream video
    const isStream = isStreamVideo(record.url);
    const streamVideoId = isStream ? extractStreamId(record.url) : null;
    
    // Create virtual organized path for management
    const virtualPath = `videos/${videoType}/${videoId}`;
    
    // Handle poster organization
    const oldPosterKey = extractKeyFromUrl(record.poster_url || record.thumbnail || '');
    
    let newPosterKey: string | null = null;
    let newPosterUrl: string | null = null;
    
    if (oldPosterKey) {
      newPosterKey = generateFilePath({
        fileType: 'video-poster',
        videoId,
        videoType,
        fileName: oldPosterKey
      });
      newPosterUrl = `${PUBLIC_URL_BASE}/${newPosterKey}`;
    }
    
    // Create organization metadata
    const organizationMetadata = {
      organized_path: virtualPath,
      original_url: record.url,
      video_source: isStream ? 'stream' as const : 'r2' as const,
      ...(streamVideoId && { stream_id: streamVideoId })
    };
    
    organizationPlan.push({
      videoId,
      record,
      isStreamVideo: isStream,
      streamVideoId,
      virtualPath,
      oldPosterKey,
      newPosterKey,
      newPosterUrl,
      videoType,
      organizationMetadata
    });
  }
  
  return organizationPlan;
}

/**
 * Execute the organization plan
 */
async function executeOrganization(plan: OrganizationPlan[], dryRun: boolean = true): Promise<void> {
  console.log(colors.blue(`\n🚀 ${dryRun ? 'DRY RUN:' : 'EXECUTING'} Organization plan...`));
  
  let postersMigrated = 0;
  let metadataUpdated = 0;
  const errors: string[] = [];
  
  for (const item of plan) {
    const { record, isStreamVideo, virtualPath, oldPosterKey, newPosterKey, newPosterUrl, organizationMetadata } = item;
    
    console.log(colors.cyan(`\nProcessing: ${record.title} (ID: ${record.id})`));
    console.log(colors.gray(`  Type: ${isStreamVideo ? 'Cloudflare Stream' : 'R2 Video'}`));
    console.log(colors.gray(`  Virtual Path: ${virtualPath}`));
    
    // Organize poster file if it exists
    if (oldPosterKey && newPosterKey) {
      const posterExists = await fileExists(oldPosterKey);
      if (posterExists) {
        console.log(colors.yellow(`  🖼️  Poster: ${oldPosterKey} → ${newPosterKey}`));
        
        if (!dryRun) {
          const copied = await copyFile(oldPosterKey, newPosterKey);
          if (copied) {
            postersMigrated++;
            console.log(colors.green(`    ✅ Poster organized successfully`));
          } else {
            errors.push(`Failed to organize poster for ${record.title}`);
          }
        }
      } else {
        console.log(colors.red(`  ❌ Poster file not found: ${oldPosterKey}`));
      }
    }
    
    // Update database with organization metadata
    if (!dryRun) {
      try {
        const updateSql = `
          UPDATE videos 
          SET poster_url = COALESCE(?, poster_url),
              updated_at = datetime('now')
          WHERE id = ?
        `;
        
        await executeQuery(updateSql, [
          newPosterUrl || record.poster_url,
          record.id
        ]);
        
        metadataUpdated++;
        console.log(colors.green(`    ✅ Metadata updated`));
      } catch (error) {
        errors.push(`Failed to update metadata for ${record.title}: ${error}`);
        console.error(colors.red(`    ❌ Metadata update failed:`), error);
      }
    }
  }
  
  // Show results
  console.log(colors.bold('\n📈 Organization Results:'));
  console.log(colors.cyan(`   Total videos processed: ${plan.length}`));
  console.log(colors.cyan(`   Stream videos: ${plan.filter(p => p.isStreamVideo).length}`));
  console.log(colors.cyan(`   R2 videos: ${plan.filter(p => !p.isStreamVideo).length}`));
  console.log(colors.green(`   Posters organized: ${postersMigrated}`));
  console.log(colors.green(`   Metadata updated: ${metadataUpdated}`));
  console.log(colors.red(`   Errors: ${errors.length}`));
  
  if (errors.length > 0) {
    console.log(colors.red('\n❌ Errors encountered:'));
    errors.forEach(error => console.log(colors.red(`   • ${error}`)));
  }
}

/**
 * Save organization plan to file for review
 */
function saveOrganizationPlan(plan: OrganizationPlan[]): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `organization-plan-${timestamp}.json`;
  const filepath = path.join(process.cwd(), 'tmp', filename);
  
  // Ensure tmp directory exists
  const tmpDir = path.dirname(filepath);
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, JSON.stringify(plan, null, 2));
  console.log(colors.cyan(`📄 Organization plan saved to: ${filepath}`));
}

/**
 * Show organization preview
 */
function showOrganizationPreview(plan: OrganizationPlan[]): void {
  console.log(colors.bold('\n📁 Organization Preview:'));
  
  // Group by video type
  const videosByType: Record<string, OrganizationPlan[]> = {
    'music-video': [],
    'short-film': [],
    'feature': []
  };
  
  plan.forEach(item => {
    videosByType[item.videoType].push(item);
  });
  
  Object.entries(videosByType).forEach(([type, items]) => {
    if (items.length === 0) return;
    
    console.log(colors.bold(`\n📂 ${type.toUpperCase()} (${items.length} videos)`));
    console.log(colors.gray(`   videos/${type}/`));
    
    items.forEach(item => {
      const source = item.isStreamVideo ? '📺 Stream' : '📁 R2';
      console.log(colors.cyan(`   ├── ${item.videoId}/`));
      console.log(colors.gray(`   │   ├── ${source} ${item.record.title}`));
      
      if (item.newPosterKey) {
        console.log(colors.green(`   │   └── poster_{timestamp}_${path.basename(item.oldPosterKey || 'poster.jpg')}`));
      }
      
      console.log(colors.gray(`   │`));
    });
  });
}

/**
 * Main organization function
 */
async function main() {
  console.log(colors.bold('\n🎬 Video Metadata Organization\n'));
  
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
    // Generate organization plan
    const plan = await generateOrganizationPlan();
    
    // Save plan for review
    saveOrganizationPlan(plan);
    
    // Show preview
    showOrganizationPreview(plan);
    
    // Show summary
    const streamVideos = plan.filter(p => p.isStreamVideo).length;
    const r2Videos = plan.filter(p => !p.isStreamVideo).length;
    const postersToOrganize = plan.filter(p => p.oldPosterKey).length;
    
    console.log(colors.cyan(`\n📊 Organization Summary:`));
    console.log(colors.cyan(`   Total videos: ${plan.length}`));
    console.log(colors.cyan(`   Cloudflare Stream videos: ${streamVideos}`));
    console.log(colors.cyan(`   R2 videos: ${r2Videos}`));
    console.log(colors.cyan(`   Posters to organize: ${postersToOrganize}`));
    
    // Get command line arguments
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--execute');
    
    if (dryRun) {
      console.log(colors.yellow('\n⚠️  DRY RUN MODE - No files will be moved or database updated'));
      console.log(colors.yellow('   Use --execute flag to perform actual organization'));
    }
    
    // Execute organization
    await executeOrganization(plan, dryRun);
    
    if (!dryRun) {
      console.log(colors.bold('\n✅ Organization completed!'));
      console.log(colors.yellow('\nBenefits:'));
      console.log(colors.cyan('• Videos organized by type and readable names'));
      console.log(colors.cyan('• Posters moved to organized structure'));
      console.log(colors.cyan('• Stream videos remain fully functional'));
      console.log(colors.cyan('• Database metadata updated for management'));
    } else {
      console.log(colors.bold('\n✅ Preview completed!'));
      console.log(colors.yellow('\nTo execute the organization:'));
      console.log(colors.cyan('  npm run organize:videos -- --execute'));
    }
    
  } catch (error) {
    console.error(colors.red('\n❌ Organization failed:'), error);
    process.exit(1);
  }
}

// Run the organization
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as organizeVideoMetadata };
