#!/usr/bin/env tsx

/**
 * Quick Fix Script for Album Issues
 * 
 * This script fixes common album issues:
 * 1. Updates track audio_status from 'pending' to 'ready'
 * 2. Checks for cover art files and updates database if found
 * 3. Publishes albums and tracks that are ready
 */

// Load environment variables FIRST before any other imports
import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { queryDatabase, executeQuery } from '../src/lib/db.js';

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

async function fixAlbumIssues(albumId?: string) {
  console.log(colors.bold('\n🎵 Album Issues Fix Tool\n'));
  
  try {
    // Get albums to fix
    const albums = albumId 
      ? await queryDatabase('SELECT * FROM albums WHERE id = ?', [albumId])
      : await queryDatabase('SELECT * FROM albums WHERE status = "draft" OR cover_art_url IS NULL');
    
    console.log(colors.cyan(`Found ${albums.length} albums to check`));
    
    for (const album of albums) {
      console.log(colors.blue(`\n📀 Processing: ${album.title} (${album.id})`));
      
      // 1. Fix track audio status
      const tracks = await queryDatabase(
        'SELECT * FROM tracks WHERE album_id = ? AND audio_url IS NOT NULL',
        [album.id]
      );
      
      if (tracks.length > 0) {
        console.log(colors.yellow(`  🎵 Found ${tracks.length} tracks with audio`));
        
        // Update track status to ready
        await executeQuery(
          'UPDATE tracks SET audio_status = "ready" WHERE album_id = ? AND audio_url IS NOT NULL',
          [album.id]
        );
        
        console.log(colors.green(`  ✅ Updated track audio status to "ready"`));
      }
      
      // 2. Check for cover art in R2
      if (!album.cover_art_url) {
        console.log(colors.yellow(`  🎨 Checking for cover art in R2...`));
        
        try {
          const listCommand = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: `music/albums/${album.id}/cover-art/`,
          });
          
          const response = await s3Client.send(listCommand);
          const coverFiles = response.Contents || [];
          
          if (coverFiles.length > 0) {
            const coverFile = coverFiles[0];
            const coverUrl = `${PUBLIC_URL_BASE}/${coverFile.Key}`;
            
            // Update album with cover art
            await executeQuery(
              'UPDATE albums SET cover_art_url = ?, cover_art_key = ? WHERE id = ?',
              [coverUrl, coverFile.Key, album.id]
            );
            
            console.log(colors.green(`  ✅ Found and linked cover art: ${coverFile.Key}`));
          } else {
            console.log(colors.red(`  ❌ No cover art found in R2`));
          }
        } catch (error) {
          console.log(colors.red(`  ❌ Error checking cover art: ${error}`));
        }
      } else {
        console.log(colors.green(`  ✅ Cover art already set`));
      }
      
      // 3. Publish album if it has tracks and cover art
      const updatedAlbum = await queryDatabase('SELECT * FROM albums WHERE id = ?', [album.id]);
      const albumData = updatedAlbum[0];
      
      if (albumData && tracks.length > 0 && albumData.status === 'draft') {
        await executeQuery(
          'UPDATE albums SET status = "published" WHERE id = ?',
          [album.id]
        );
        
        await executeQuery(
          'UPDATE tracks SET status = "published" WHERE album_id = ?',
          [album.id]
        );
        
        console.log(colors.green(`  ✅ Published album and tracks`));
      }
    }
    
    console.log(colors.bold('\n✅ Album fixes completed!'));
    
  } catch (error) {
    console.error(colors.red('\n❌ Fix failed:'), error);
    process.exit(1);
  }
}

// Run the fix
const albumId = process.argv[2]; // Optional album ID argument
fixAlbumIssues(albumId).catch(console.error);
