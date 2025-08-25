#!/usr/bin/env tsx

/**
 * Preview Video Migration Script
 * 
 * This script analyzes your current video data in the database
 * and shows what the new organized structure would look like
 * WITHOUT requiring R2 credentials or making any changes.
 */

// Load environment variables FIRST before any other imports
import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

import { queryDatabase } from '../src/lib/db.js';

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
  created_at: string;
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
 * Extract file key from URL
 */
function extractKeyFromUrl(url: string): string | null {
  if (!url) return null;
  
  // Handle full URLs
  if (url.startsWith('https://media.odubo.studio/')) {
    return url.replace('https://media.odubo.studio/', '');
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
 * Preview the migration without making any changes
 */
async function previewMigration(): Promise<void> {
  console.log(colors.bold('\n🎬 Video Migration Preview\n'));
  
  // Check required environment variables
  if (!process.env.DATABASE_URL) {
    console.error(colors.red('❌ Missing environment variable: DATABASE_URL'));
    console.log(colors.yellow('Please set DATABASE_URL in your .env.local file to preview migration.\n'));
    process.exit(1);
  }
  
  try {
    // Get all videos from database
    const videos = await queryDatabase(`
      SELECT id, title, url, poster_url, thumbnail, type, category, created_at
      FROM videos 
      ORDER BY id ASC
    `) as VideoRecord[];
    
    console.log(colors.cyan(`📊 Found ${videos.length} videos in database\n`));
    
    if (videos.length === 0) {
      console.log(colors.yellow('No videos found in database. Nothing to migrate.\n'));
      return;
    }
    
    // Group videos by type for better visualization
    const videosByType: Record<string, VideoRecord[]> = {
      'music-video': [],
      'short-film': [],
      'feature': []
    };
    
    // Process each video
    videos.forEach(record => {
      const videoType = mapVideoType(record.type, record.category);
      videosByType[videoType].push(record);
    });
    
    // Show preview by video type
    Object.entries(videosByType).forEach(([type, typeVideos]) => {
      if (typeVideos.length === 0) return;
      
      console.log(colors.bold(`📁 ${type.toUpperCase()} (${typeVideos.length} videos)`));
      console.log(colors.gray('   videos/' + type + '/'));
      
      typeVideos.forEach(record => {
        const sanitizedTitle = sanitizeVideoTitle(record.title || `video_${record.id}`);
        const videoId = `${sanitizedTitle}_${record.id}`;
        
        const oldVideoKey = extractKeyFromUrl(record.url);
        const oldPosterKey = extractKeyFromUrl(record.poster_url || record.thumbnail || '');
        
        console.log(colors.cyan(`   ├── ${videoId}/`));
        
        if (oldVideoKey) {
          console.log(colors.green(`   │   ├── {timestamp}_${oldVideoKey}`));
        }
        
        if (oldPosterKey) {
          console.log(colors.green(`   │   └── poster_{timestamp}_${oldPosterKey}`));
        }
        
        if (!oldVideoKey && !oldPosterKey) {
          console.log(colors.red(`   │   └── ❌ No files found`));
        }
        
        console.log(colors.gray(`   │`));
      });
      
      console.log('');
    });
    
    // Show summary
    const totalWithFiles = videos.filter(v => 
      extractKeyFromUrl(v.url) || extractKeyFromUrl(v.poster_url || v.thumbnail || '')
    ).length;
    
    console.log(colors.bold('📈 Migration Summary:'));
    console.log(colors.cyan(`   Total videos: ${videos.length}`));
    console.log(colors.cyan(`   Videos with files: ${totalWithFiles}`));
    console.log(colors.cyan(`   Videos without files: ${videos.length - totalWithFiles}`));
    
    // Show title examples
    console.log(colors.bold('\n🏷️  Title Sanitization Examples:'));
    videos.slice(0, 5).forEach(record => {
      const original = record.title || `video_${record.id}`;
      const sanitized = sanitizeVideoTitle(original);
      console.log(colors.yellow(`   "${original}"`));
      console.log(colors.green(`   → ${sanitized}_${record.id}`));
      console.log('');
    });
    
    console.log(colors.bold('✅ Preview completed!'));
    console.log(colors.yellow('\nTo run the actual migration:'));
    console.log(colors.cyan('1. Set up your R2 environment variables'));
    console.log(colors.cyan('2. Run: npm run migrate:videos -- --execute'));
    console.log('');
    
  } catch (error) {
    console.error(colors.red('❌ Preview failed:'), error);
    process.exit(1);
  }
}

// Run the preview
if (import.meta.url === `file://${process.argv[1]}`) {
  previewMigration().catch(console.error);
}

export { previewMigration };
