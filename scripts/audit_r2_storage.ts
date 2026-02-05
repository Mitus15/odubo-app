/**
 * R2 Storage Audit Script
 * 
 * Analyzes current R2 storage structure and generates a report.
 * Run: tsx --env-file=.env.local scripts/audit_r2_storage.ts
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { queryDatabase } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

interface R2Object {
  key: string;
  size: number;
  lastModified: Date;
}

interface AuditReport {
  timestamp: string;
  totalObjects: number;
  totalSize: number;
  byFolder: Record<string, { count: number; size: number; files: string[] }>;
  galleries: any[];
  galleryPhotos: any[];
  albums: any[];
  tracks: any[];
  videos: any[];
  orphanedFiles: string[];
  recommendations: string[];
}

async function listAllR2Objects(): Promise<R2Object[]> {
  const objects: R2Object[] = [];
  let continuationToken: string | undefined;

  console.log('📦 Listing all R2 objects...');

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          objects.push({
            key: obj.Key,
            size: obj.Size || 0,
            lastModified: obj.LastModified || new Date(),
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
    console.log(`  Found ${objects.length} objects so far...`);
  } while (continuationToken);

  console.log(`✅ Total objects found: ${objects.length}`);
  return objects;
}

async function queryDatabaseState() {
  console.log('\n🗄️  Querying database state...');

  const galleries = await queryDatabase('SELECT * FROM galleries ORDER BY created_at DESC');
  const galleryPhotos = await queryDatabase('SELECT * FROM gallery_photos ORDER BY created_at DESC');
  const albums = await queryDatabase('SELECT * FROM albums ORDER BY created_at DESC');
  const tracks = await queryDatabase('SELECT * FROM tracks ORDER BY created_at DESC');
  const videos = await queryDatabase('SELECT * FROM videos ORDER BY created_at DESC');

  console.log(`  Galleries: ${galleries.length}`);
  console.log(`  Gallery Photos: ${galleryPhotos.length}`);
  console.log(`  Albums: ${albums.length}`);
  console.log(`  Tracks: ${tracks.length}`);
  console.log(`  Videos: ${videos.length}`);

  return { galleries, galleryPhotos, albums, tracks, videos };
}

function analyzeObjects(objects: R2Object[]): Record<string, { count: number; size: number; files: string[] }> {
  const byFolder: Record<string, { count: number; size: number; files: string[] }> = {};

  for (const obj of objects) {
    const parts = obj.key.split('/');
    const topFolder = parts[0] || 'root';

    if (!byFolder[topFolder]) {
      byFolder[topFolder] = { count: 0, size: 0, files: [] };
    }

    byFolder[topFolder].count++;
    byFolder[topFolder].size += obj.size;
    byFolder[topFolder].files.push(obj.key);
  }

  return byFolder;
}

function findOrphanedFiles(
  objects: R2Object[],
  dbState: { galleries: any[]; galleryPhotos: any[]; albums: any[]; tracks: any[]; videos: any[] }
): string[] {
  const orphaned: string[] = [];
  const referencedKeys = new Set<string>();

  // Collect all referenced R2 keys from database
  for (const photo of dbState.galleryPhotos) {
    if (photo.r2_key) referencedKeys.add(photo.r2_key);
    if (photo.thumbnail_key) referencedKeys.add(photo.thumbnail_key);
  }

  for (const album of dbState.albums) {
    if (album.cover_art_key) referencedKeys.add(album.cover_art_key);
  }

  for (const track of dbState.tracks) {
    if (track.audio_id) referencedKeys.add(track.audio_id);
  }

  // Check each R2 object
  for (const obj of objects) {
    const key = obj.key;
    
    // Skip system folders
    if (key.startsWith('featured/') || key.startsWith('brand-assets/') || key.startsWith('social/')) {
      continue;
    }

    // Check if referenced
    if (!referencedKeys.has(key)) {
      orphaned.push(key);
    }
  }

  return orphaned;
}

function generateRecommendations(
  byFolder: Record<string, any>,
  dbState: any,
  orphaned: string[]
): string[] {
  const recs: string[] = [];

  // Check for galleries folder issues
  if (byFolder['galleries']) {
    const galleryKeys = byFolder['galleries'].files as string[];
    const catchingLightFiles = galleryKeys.filter(k => k.includes('catching') || k.includes('light'));
    const testEventFiles = galleryKeys.filter(k => k.includes('test') && k.includes('event'));
    
    if (testEventFiles.length > 0) {
      recs.push(`🔴 CRITICAL: Found ${testEventFiles.length} files in 'test-events' or similar - should be renamed to 'catching-light'`);
    }
    
    if (catchingLightFiles.length > 0) {
      recs.push(`✅ Found ${catchingLightFiles.length} files that may be Catching Light gallery`);
    }
  }

  // Check for orphaned videos folder
  if (byFolder['videos']) {
    recs.push(`⚠️ CLEANUP: 'videos/' folder exists with ${byFolder['videos'].count} files - likely orphaned music videos`);
  }

  // Check for orphaned albums
  if (byFolder['albums']) {
    recs.push(`⚠️ CLEANUP: 'albums/' folder exists with ${byFolder['albums'].count} files - will be reorganized`);
  }

  // Check for orphaned posters
  if (byFolder['posters']) {
    recs.push(`⚠️ CLEANUP: 'posters/' folder exists with ${byFolder['posters'].count} files - likely orphaned`);
  }

  // Check orphaned count
  if (orphaned.length > 0) {
    recs.push(`⚠️ Found ${orphaned.length} orphaned files not referenced in database`);
  }

  return recs;
}

async function main() {
  console.log('🚀 Starting R2 Storage Audit\n');

  try {
    // List all R2 objects
    const objects = await listAllR2Objects();

    // Query database
    const dbState = await queryDatabaseState();

    // Analyze by folder
    console.log('\n📊 Analyzing folder structure...');
    const byFolder = analyzeObjects(objects);

    // Find orphaned files
    console.log('\n🔍 Finding orphaned files...');
    const orphaned = findOrphanedFiles(objects, dbState);

    // Generate recommendations
    console.log('\n💡 Generating recommendations...');
    const recommendations = generateRecommendations(byFolder, dbState, orphaned);

    // Calculate totals
    const totalSize = objects.reduce((sum, obj) => sum + obj.size, 0);

    // Build report
    const report: AuditReport = {
      timestamp: new Date().toISOString(),
      totalObjects: objects.length,
      totalSize,
      byFolder: Object.fromEntries(
        Object.entries(byFolder).map(([folder, data]) => [
          folder,
          {
            count: data.count,
            size: data.size,
            files: data.files.slice(0, 10), // Only include first 10 for brevity
          },
        ])
      ),
      galleries: dbState.galleries,
      galleryPhotos: dbState.galleryPhotos,
      albums: dbState.albums,
      tracks: dbState.tracks,
      videos: dbState.videos,
      orphanedFiles: orphaned.slice(0, 50), // Only include first 50
      recommendations,
    };

    // Save report
    const outputPath = path.join(process.cwd(), 'tmp', `r2_audit_${Date.now()}.json`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 AUDIT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Objects: ${objects.length}`);
    console.log(`Total Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('\nFolder Breakdown:');
    
    for (const [folder, data] of Object.entries(byFolder).sort((a, b) => b[1].size - a[1].size)) {
      const sizeMB = (data.size / 1024 / 1024).toFixed(2);
      console.log(`  ${folder}: ${data.count} files (${sizeMB} MB)`);
    }

    console.log('\nDatabase State:');
    console.log(`  Galleries: ${dbState.galleries.length}`);
    console.log(`  Gallery Photos: ${dbState.galleryPhotos.length}`);
    console.log(`  Albums: ${dbState.albums.length}`);
    console.log(`  Tracks: ${dbState.tracks.length}`);
    console.log(`  Videos: ${dbState.videos.length}`);

    console.log('\nRecommendations:');
    for (const rec of recommendations) {
      console.log(`  ${rec}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Full report saved to: ${outputPath}`);
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

main();
