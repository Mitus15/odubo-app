#!/usr/bin/env npx tsx
/**
 * Normalize existing audio tracks to -16 LUFS (Apple Music standard)
 * 
 * This script:
 * 1. Fetches all tracks from the database
 * 2. Downloads and re-encodes each audio file with loudness normalization
 * 3. Uploads the normalized version back to R2
 * 4. Updates the database with the new URL
 * 
 * Usage:
 *   npx tsx scripts/normalize_existing_audio.ts --all          # Process all tracks
 *   npx tsx scripts/normalize_existing_audio.ts --album 123    # Process specific album
 *   npx tsx scripts/normalize_existing_audio.ts --track 456    # Process specific track
 *   npx tsx scripts/normalize_existing_audio.ts --dry-run      # Preview without changes
 */

import 'dotenv/config';

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { queryDatabase, executeQuery } from '@/lib/db';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

// Configuration
const TARGET_LUFS = -16;
const TARGET_TP = -1.5;
const TARGET_LRA = 11;

type Args = {
  trackId?: string;
  albumId?: string;
  all?: boolean;
  dryRun?: boolean;
  force?: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--track' || a === '--id') result.trackId = args[++i];
    else if (a === '--album') result.albumId = args[++i];
    else if (a === '--all') result.all = true;
    else if (a === '--dry-run') result.dryRun = true;
    else if (a === '--force') result.force = true;
  }
  return result;
}

function ensure(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const R2_PUBLIC = ensure(process.env.CLOUDFLARE_R2_PUBLIC_URL, 'CLOUDFLARE_R2_PUBLIC_URL');
const R2_BUCKET = ensure(process.env.CLOUDFLARE_R2_BUCKET_NAME, 'CLOUDFLARE_R2_BUCKET_NAME');
const R2_ENDPOINT = ensure(process.env.CLOUDFLARE_R2_ENDPOINT, 'CLOUDFLARE_R2_ENDPOINT');
const R2_ACCESS_KEY = ensure(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, 'CLOUDFLARE_R2_ACCESS_KEY_ID');
const R2_SECRET_KEY = ensure(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY, 'CLOUDFLARE_R2_SECRET_ACCESS_KEY');

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

async function downloadToTemp(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Failed to download source: ${res.status}`);
  const tmpFile = path.join(os.tmpdir(), `odubo_normalize_${Date.now()}`);
  await fs.writeFile(tmpFile, new Uint8Array(await res.arrayBuffer()));
  return tmpFile;
}

interface LoudnessData {
  input_i: number;
  input_tp: number;
  input_lra: number;
  input_thresh: number;
  output_i?: number;
  output_tp?: number;
  output_lra?: number;
  normalization_type?: string;
  target_offset?: number;
}

async function analyzeLoudness(inputPath: string): Promise<LoudnessData> {
  if (!ffmpegPath || !existsSync(ffmpegPath)) throw new Error('ffmpeg-static binary not found');
  
  return new Promise((resolve, reject) => {
    let stderr = '';
    const p = spawn(ffmpegPath as string, [
      '-i', inputPath,
      '-af', `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:print_format=json`,
      '-f', 'null',
      '-'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    
    p.stderr?.on('data', (data) => { stderr += data.toString(); });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg loudnorm analysis failed with ${code}`));
      
      // Parse loudnorm JSON output from stderr
      const match = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
      if (!match) {
        console.warn('Could not parse loudnorm output, using defaults');
        return resolve({ input_i: -24, input_tp: -2, input_lra: 7, input_thresh: -34 });
      }
      
      try {
        const json = JSON.parse(match[0]);
        resolve({
          input_i: parseFloat(json.input_i) || -24,
          input_tp: parseFloat(json.input_tp) || -2,
          input_lra: parseFloat(json.input_lra) || 7,
          input_thresh: parseFloat(json.input_thresh) || -34,
        });
      } catch {
        resolve({ input_i: -24, input_tp: -2, input_lra: 7, input_thresh: -34 });
      }
    });
  });
}

async function normalizeAudio(inputPath: string, title: string, loudnessData: LoudnessData): Promise<string> {
  if (!ffmpegPath || !existsSync(ffmpegPath)) throw new Error('ffmpeg-static binary not found');
  const outPath = path.join(os.tmpdir(), `odubo_normalized_${Date.now()}.m4a`);
  
  // Apply second-pass normalization with measured values
  const loudnormFilter = `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:` +
    `measured_I=${loudnessData.input_i}:` +
    `measured_TP=${loudnessData.input_tp}:` +
    `measured_LRA=${loudnessData.input_lra}:` +
    `measured_thresh=${loudnessData.input_thresh}:` +
    `linear=true:print_format=summary`;
  
  await new Promise<void>((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-af', loudnormFilter,
      '-c:a', 'aac',
      '-b:a', '256k',
      '-ar', '48000',
      '-movflags', '+faststart',
      '-metadata', `title=${title}`,
      '-metadata', `comment=Normalized to ${TARGET_LUFS} LUFS`,
      '-y', outPath
    ];
    
    const p = spawn(ffmpegPath as string, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    p.stderr?.on('data', (data) => { stderr += data.toString(); });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg normalize failed: ${stderr.slice(-500)}`));
      resolve();
    });
  });
  
  return outPath;
}

function toNormalizedKeyFromUrl(audioUrl: string): { normalizedKey: string; normalizedUrl: string } {
  // Pattern: audio/tracks/xxx.m4a → audio/tracks/xxx.normalized.m4a
  // Or: audio/tracks/xxx.web.m4a → audio/tracks/xxx.normalized.m4a
  const url = new URL(audioUrl);
  const pathname = url.pathname.replace(/^\//, '');
  
  // Remove any existing suffixes and add .normalized.m4a
  const basePath = pathname.replace(/\.(web|normalized)\.m4a$/i, '.m4a').replace(/\.m4a$/i, '');
  const normalizedKey = `${basePath}.normalized.m4a`;
  const normalizedUrl = `${R2_PUBLIC}/${normalizedKey}`;
  
  return { normalizedKey, normalizedUrl };
}

async function checkIfAlreadyNormalized(audioUrl: string): Promise<boolean> {
  // Check if URL already contains .normalized
  if (/\.normalized\.m4a$/i.test(audioUrl)) {
    return true;
  }
  
  // Check if normalized version exists in R2
  const { normalizedKey } = toNormalizedKeyFromUrl(audioUrl);
  try {
    await s3.send(new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: normalizedKey,
    }));
    return true;
  } catch {
    return false;
  }
}

async function processTrack(trackId: string, dryRun: boolean, force: boolean): Promise<{ success: boolean; message: string }> {
  const rows = await queryDatabase('SELECT id, title, audio_url FROM tracks WHERE id = ? LIMIT 1', [trackId]);
  if (!rows.length) return { success: false, message: `Track not found: ${trackId}` };
  
  const track = rows[0];
  if (!track.audio_url) return { success: false, message: `Track has no audio_url: ${trackId}` };
  
  // Check if already normalized
  if (!force && await checkIfAlreadyNormalized(track.audio_url)) {
    return { success: true, message: `Already normalized: ${track.title}` };
  }
  
  console.log(`\n📀 Processing: ${track.title} (ID: ${trackId})`);
  
  if (dryRun) {
    console.log(`   [DRY RUN] Would download, normalize to ${TARGET_LUFS} LUFS, and re-upload`);
    return { success: true, message: `[DRY RUN] Would process: ${track.title}` };
  }
  
  let srcPath: string | null = null;
  let outPath: string | null = null;
  
  try {
    // Download source
    console.log(`   ⬇️  Downloading source: ${track.audio_url}`);
    srcPath = await downloadToTemp(track.audio_url);
    
    // Analyze loudness
    console.log(`   🔊 Analyzing loudness...`);
    const loudnessData = await analyzeLoudness(srcPath);
    console.log(`   📊 Input: ${loudnessData.input_i.toFixed(1)} LUFS, TP: ${loudnessData.input_tp.toFixed(1)} dB, LRA: ${loudnessData.input_lra.toFixed(1)}`);
    
    // Check if normalization is actually needed
    const delta = Math.abs(loudnessData.input_i - TARGET_LUFS);
    if (!force && delta < 1.0) {
      console.log(`   ✅ Already within tolerance (±1 LUFS), skipping`);
      return { success: true, message: `Already normalized: ${track.title} (${loudnessData.input_i.toFixed(1)} LUFS)` };
    }
    
    // Normalize
    console.log(`   🎚️  Normalizing to ${TARGET_LUFS} LUFS...`);
    outPath = await normalizeAudio(srcPath, track.title || 'Untitled', loudnessData);
    
    // Upload to R2
    const { normalizedKey, normalizedUrl } = toNormalizedKeyFromUrl(track.audio_url);
    console.log(`   ⬆️  Uploading to R2: ${normalizedKey}`);
    
    const fileBuffer = await fs.readFile(outPath);
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: normalizedKey,
      Body: fileBuffer,
      ContentType: 'audio/mp4',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    
    // Update database
    console.log(`   💾 Updating database...`);
    await executeQuery(
      'UPDATE tracks SET audio_url = ?, audio_status = ?, updated_at = datetime("now") WHERE id = ?',
      [normalizedUrl, 'ready', trackId]
    );
    
    console.log(`   ✅ Done: ${track.title}`);
    return { success: true, message: `Normalized: ${track.title} (${loudnessData.input_i.toFixed(1)} → ${TARGET_LUFS} LUFS)` };
    
  } finally {
    // Cleanup temp files
    if (srcPath) await fs.unlink(srcPath).catch(() => {});
    if (outPath) await fs.unlink(outPath).catch(() => {});
  }
}

async function processAlbum(albumId: string, dryRun: boolean, force: boolean): Promise<void> {
  const tracks = await queryDatabase(
    'SELECT id FROM tracks WHERE album_id = ? ORDER BY track_number ASC',
    [albumId]
  );
  
  if (!tracks.length) {
    console.log(`No tracks found for album ${albumId}`);
    return;
  }
  
  console.log(`\n🎵 Processing ${tracks.length} tracks from album ${albumId}`);
  
  const results: { success: boolean; message: string }[] = [];
  for (const track of tracks) {
    const result = await processTrack(String(track.id), dryRun, force);
    results.push(result);
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n📊 Album ${albumId} complete: ${successful} successful, ${failed} failed`);
}

async function processAllTracks(dryRun: boolean, force: boolean): Promise<void> {
  const tracks = await queryDatabase(
    `SELECT id, title, audio_url FROM tracks 
     WHERE audio_url IS NOT NULL 
       AND audio_url != ''
     ORDER BY album_id ASC, track_number ASC`
  );
  
  if (!tracks.length) {
    console.log('No tracks found with audio URLs');
    return;
  }
  
  console.log(`\n🎵 Processing ${tracks.length} tracks total`);
  
  const results: { success: boolean; message: string }[] = [];
  let processed = 0;
  
  for (const track of tracks) {
    const result = await processTrack(String(track.id), dryRun, force);
    results.push(result);
    processed++;
    
    // Progress update every 10 tracks
    if (processed % 10 === 0) {
      console.log(`\n📈 Progress: ${processed}/${tracks.length} (${Math.round(processed/tracks.length*100)}%)`);
    }
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const skipped = results.filter(r => r.message.includes('Already')).length;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 NORMALIZATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`   Total tracks: ${tracks.length}`);
  console.log(`   Successful:   ${successful}`);
  console.log(`   Skipped:      ${skipped}`);
  console.log(`   Failed:       ${failed}`);
  console.log('='.repeat(60));
  
  // List failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('\n❌ Failures:');
    failures.forEach(f => console.log(`   - ${f.message}`));
  }
}

async function main() {
  const args = parseArgs();
  
  console.log('🔊 Odubo Audio Loudness Normalizer');
  console.log(`   Target: ${TARGET_LUFS} LUFS (Apple Music standard)`);
  console.log(`   True Peak: ${TARGET_TP} dB`);
  console.log(`   LRA: ${TARGET_LRA}`);
  
  if (args.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made');
  }
  
  if (args.force) {
    console.log('\n⚠️  FORCE MODE - Re-processing all tracks');
  }
  
  if (args.trackId) {
    await processTrack(args.trackId, !!args.dryRun, !!args.force);
  } else if (args.albumId) {
    await processAlbum(args.albumId, !!args.dryRun, !!args.force);
  } else if (args.all) {
    await processAllTracks(!!args.dryRun, !!args.force);
  } else {
    console.log('\nUsage:');
    console.log('  npx tsx scripts/normalize_existing_audio.ts --all          # Process all tracks');
    console.log('  npx tsx scripts/normalize_existing_audio.ts --album 123    # Process specific album');
    console.log('  npx tsx scripts/normalize_existing_audio.ts --track 456    # Process specific track');
    console.log('  npx tsx scripts/normalize_existing_audio.ts --dry-run      # Preview without changes');
    console.log('  npx tsx scripts/normalize_existing_audio.ts --force --all  # Re-process all tracks');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
