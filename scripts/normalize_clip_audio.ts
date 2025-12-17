#!/usr/bin/env npx tsx
/**
 * Normalize audio on existing video clips to -16 LUFS (Apple Music standard)
 * 
 * This script:
 * 1. Fetches all clips from the database
 * 2. Downloads each clip from Cloudflare Stream
 * 3. Re-encodes with loudness normalized audio (-16 LUFS)
 * 4. Re-uploads to Cloudflare Stream
 * 5. Updates the database with the new Stream UID
 * 
 * Usage:
 *   npx tsx scripts/normalize_clip_audio.ts --all           # Process all clips
 *   npx tsx scripts/normalize_clip_audio.ts --clip 123      # Process specific clip
 *   npx tsx scripts/normalize_clip_audio.ts --parent 456    # Process clips for parent video
 *   npx tsx scripts/normalize_clip_audio.ts --dry-run       # Preview without changes
 *   npx tsx scripts/normalize_clip_audio.ts --analyze-only  # Just show loudness levels
 */

// Load .env.local explicitly
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { queryDatabase, executeQuery } from '@/lib/db';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
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
const CUSTOMER_SUBDOMAIN = 'customer-tpkm273r1u0s40no';

type Args = {
  clipId?: string;
  parentId?: string;
  all?: boolean;
  dryRun?: boolean;
  analyzeOnly?: boolean;
  force?: boolean;
  limit?: number;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--clip' || a === '--id') result.clipId = args[++i];
    else if (a === '--parent') result.parentId = args[++i];
    else if (a === '--all') result.all = true;
    else if (a === '--dry-run') result.dryRun = true;
    else if (a === '--analyze-only') result.analyzeOnly = true;
    else if (a === '--force') result.force = true;
    else if (a === '--limit') result.limit = parseInt(args[++i], 10);
  }
  return result;
}

interface LoudnessData {
  input_i: number;
  input_tp: number;
  input_lra: number;
  input_thresh: number;
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

async function normalizeVideo(inputPath: string, loudnessData: LoudnessData): Promise<string> {
  if (!ffmpegPath || !existsSync(ffmpegPath)) throw new Error('ffmpeg-static binary not found');
  const outPath = path.join(os.tmpdir(), `odubo_normalized_${Date.now()}.mp4`);
  
  // Apply second-pass normalization with measured values
  // Keep video stream as-is (copy), only re-encode audio
  const loudnormFilter = `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:` +
    `measured_I=${loudnessData.input_i}:` +
    `measured_TP=${loudnessData.input_tp}:` +
    `measured_LRA=${loudnessData.input_lra}:` +
    `measured_thresh=${loudnessData.input_thresh}:` +
    `linear=true`;
  
  await new Promise<void>((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-c:v', 'copy',           // Copy video stream (no re-encode)
      '-af', loudnormFilter,    // Normalize audio
      '-c:a', 'aac',            // Re-encode audio to AAC
      '-b:a', '192k',           // Audio bitrate
      '-ar', '48000',           // Sample rate
      '-movflags', '+faststart', // Web optimization
      '-y', outPath
    ];
    
    let stderr = '';
    const p = spawn(ffmpegPath as string, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    p.stderr?.on('data', (data) => { stderr += data.toString(); });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg normalize failed: ${stderr.slice(-500)}`));
      resolve();
    });
  });
  
  return outPath;
}

function extractUidFromUrl(url: string): string | null {
  // Pattern: https://customer-xxx.cloudflarestream.com/<UID>/manifest/video.m3u8
  // Or: https://videodelivery.net/<UID>/manifest/video.m3u8
  const match = url.match(/(?:cloudflarestream\.com|videodelivery\.net)\/([a-f0-9]{32})/i);
  return match ? match[1] : null;
}

function parseParentId(related?: string | null): number | null {
  if (!related) return null;
  const m = related.match(/parent_id:(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

interface ClipRow {
  id: number;
  title: string | null;
  url: string;
  uid: string | null;
  related_projects: string | null;
  audio_normalized?: number;
}

async function processClip(
  clip: ClipRow, 
  stream: CloudflareStreamAPI,
  dryRun: boolean, 
  analyzeOnly: boolean,
  force: boolean
): Promise<{ success: boolean; message: string; loudness?: number }> {
  
  // Use uid directly if available, otherwise extract from URL
  const clipUid = clip.uid || (clip.url ? extractUidFromUrl(clip.url) : null);
  if (!clipUid) {
    return { success: false, message: `No Stream UID found for clip ${clip.id}` };
  }
  
  // Check if already normalized (unless force)
  if (!force && clip.audio_normalized === 1) {
    return { success: true, message: `Already normalized: ${clip.title || clip.id}` };
  }
  
  console.log(`\n🎬 Processing clip: ${clip.title || `ID ${clip.id}`}`);
  console.log(`   Stream UID: ${clipUid}`);
  
  let srcPath: string | null = null;
  let outPath: string | null = null;
  
  try {
    // Enable downloads and get URL
    console.log(`   ⬇️  Getting download URL...`);
    let downloadUrl = await stream.getDownloadUrl(clipUid);
    
    if (!downloadUrl) {
      console.log(`   📥 Enabling downloads...`);
      await stream.enableDownloads(clipUid);
      
      // Poll for download URL (up to 2 minutes)
      const start = Date.now();
      for (let i = 0; i < 60 && !downloadUrl; i++) {
        await new Promise(r => setTimeout(r, 2000));
        downloadUrl = await stream.getDownloadUrl(clipUid);
        if (i % 10 === 0 && !downloadUrl) {
          console.log(`   ⏳ Waiting for download to be ready... (${Math.round((Date.now() - start) / 1000)}s)`);
        }
      }
    }
    
    if (!downloadUrl) {
      return { success: false, message: `Timeout waiting for download URL: ${clip.id}` };
    }
    
    // Download the video
    console.log(`   ⬇️  Downloading video...`);
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`Failed to download: ${res.status}`);
    
    srcPath = path.join(os.tmpdir(), `odubo_clip_${clip.id}_${Date.now()}.mp4`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(srcPath, buffer);
    
    const fileSizeMB = buffer.length / (1024 * 1024);
    console.log(`   📁 Downloaded: ${fileSizeMB.toFixed(1)} MB`);
    
    // Analyze loudness
    console.log(`   🔊 Analyzing audio loudness...`);
    const loudnessData = await analyzeLoudness(srcPath);
    console.log(`   📊 Current: ${loudnessData.input_i.toFixed(1)} LUFS, TP: ${loudnessData.input_tp.toFixed(1)} dB`);
    
    // Check if normalization is needed
    const delta = Math.abs(loudnessData.input_i - TARGET_LUFS);
    if (!force && delta < 1.0) {
      console.log(`   ✅ Already within tolerance (±1 LUFS)`);
      // Mark as normalized in DB
      if (!dryRun && !analyzeOnly) {
        await executeQuery('UPDATE videos SET audio_normalized = 1 WHERE id = ?', [clip.id]);
      }
      return { success: true, message: `Within tolerance: ${clip.title || clip.id}`, loudness: loudnessData.input_i };
    }
    
    if (analyzeOnly) {
      return { 
        success: true, 
        message: `Needs normalization: ${loudnessData.input_i.toFixed(1)} → ${TARGET_LUFS} LUFS`,
        loudness: loudnessData.input_i 
      };
    }
    
    if (dryRun) {
      console.log(`   [DRY RUN] Would normalize ${loudnessData.input_i.toFixed(1)} → ${TARGET_LUFS} LUFS`);
      return { success: true, message: `[DRY RUN] Would normalize: ${clip.title || clip.id}`, loudness: loudnessData.input_i };
    }
    
    // Normalize the audio
    console.log(`   🎚️  Normalizing audio: ${loudnessData.input_i.toFixed(1)} → ${TARGET_LUFS} LUFS...`);
    outPath = await normalizeVideo(srcPath, loudnessData);
    
    const outStats = await fs.stat(outPath);
    console.log(`   📁 Normalized file: ${(outStats.size / (1024 * 1024)).toFixed(1)} MB`);
    
    // Upload to Cloudflare Stream
    console.log(`   ⬆️  Uploading to Cloudflare Stream...`);
    const fileBuffer = await fs.readFile(outPath);
    const uploadResult = await stream.uploadVideoStream(fileBuffer, {
      name: `${clip.title || `Clip ${clip.id}`} (normalized)`,
      meta: {
        originalClipId: clip.id,
        normalizedAt: new Date().toISOString(),
        targetLufs: TARGET_LUFS,
        originalLufs: loudnessData.input_i,
      }
    });
    
    const newUid = uploadResult.result.uid;
    console.log(`   📤 Uploaded new UID: ${newUid}`);
    
    // Wait for processing
    console.log(`   ⏳ Waiting for Stream to process...`);
    const isReady = await stream.waitForVideoReady(newUid, {
      maxWaitTime: 300000, // 5 minutes
      pollInterval: 5000,
      onProgress: (state, pct) => {
        if (state !== 'ready') {
          process.stdout.write(`\r   ⏳ Processing: ${state} (${pct}%)   `);
        }
      }
    });
    console.log(''); // New line after progress
    
    if (!isReady) {
      return { success: false, message: `Stream processing timeout for clip ${clip.id}` };
    }
    
    // Update database with new URL
    const newUrl = `https://${CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${newUid}/manifest/video.m3u8`;
    console.log(`   💾 Updating database...`);
    
    await executeQuery(
      `UPDATE videos SET 
         url = ?, 
         uid = ?, 
         audio_normalized = 1,
         updated_at = datetime("now")
       WHERE id = ?`,
      [newUrl, newUid, clip.id]
    );
    
    // Optionally delete old video (commented out for safety)
    // console.log(`   🗑️  Deleting old video...`);
    // await stream.deleteVideo(clipUid);
    
    console.log(`   ✅ Done: ${clip.title || clip.id}`);
    return { 
      success: true, 
      message: `Normalized: ${clip.title || clip.id} (${loudnessData.input_i.toFixed(1)} → ${TARGET_LUFS} LUFS)`,
      loudness: loudnessData.input_i 
    };
    
  } catch (err: any) {
    console.error(`   ❌ Error: ${err.message}`);
    return { success: false, message: `Error processing clip ${clip.id}: ${err.message}` };
  } finally {
    // Cleanup temp files
    if (srcPath) await fs.unlink(srcPath).catch(() => {});
    if (outPath) await fs.unlink(outPath).catch(() => {});
  }
}

async function main() {
  const args = parseArgs();
  
  console.log('🔊 Odubo Clip Audio Normalizer');
  console.log(`   Target: ${TARGET_LUFS} LUFS (Apple Music standard)`);
  console.log(`   True Peak: ${TARGET_TP} dB`);
  
  if (args.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made');
  }
  if (args.analyzeOnly) {
    console.log('\n📊 ANALYZE ONLY MODE - Just showing loudness levels');
  }
  if (args.force) {
    console.log('\n⚠️  FORCE MODE - Re-processing all clips');
  }
  
  const stream = new CloudflareStreamAPI();
  
  // Build query
  let sql = `
    SELECT id, title, url, uid, related_projects, audio_normalized
    FROM videos
    WHERE type = 'clip'
      AND (uid IS NOT NULL AND uid != '')
  `;
  const params: any[] = [];
  
  if (args.clipId) {
    sql += ' AND id = ?';
    params.push(args.clipId);
  } else if (args.parentId) {
    sql += ' AND related_projects LIKE ?';
    params.push(`%parent_id:${args.parentId}%`);
  } else if (!args.all) {
    console.log('\nUsage:');
    console.log('  npx tsx scripts/normalize_clip_audio.ts --all           # Process all clips');
    console.log('  npx tsx scripts/normalize_clip_audio.ts --clip 123      # Process specific clip');
    console.log('  npx tsx scripts/normalize_clip_audio.ts --parent 456    # Process clips for parent video');
    console.log('  npx tsx scripts/normalize_clip_audio.ts --dry-run --all # Preview without changes');
    console.log('  npx tsx scripts/normalize_clip_audio.ts --analyze-only  # Just show loudness levels');
    console.log('  npx tsx scripts/normalize_clip_audio.ts --force --all   # Re-process all clips');
    console.log('  npx tsx scripts/normalize_clip_audio.ts --limit 5 --all # Process first 5 clips');
    process.exit(1);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  if (args.limit) {
    sql += ` LIMIT ${args.limit}`;
  }
  
  const clips = await queryDatabase(sql, params) as ClipRow[];
  
  if (!clips.length) {
    console.log('\n❌ No clips found matching criteria');
    process.exit(0);
  }
  
  console.log(`\n🎬 Found ${clips.length} clip(s) to process`);
  
  const results: { success: boolean; message: string; loudness?: number }[] = [];
  let processed = 0;
  
  for (const clip of clips) {
    const result = await processClip(clip, stream, !!args.dryRun, !!args.analyzeOnly, !!args.force);
    results.push(result);
    processed++;
    
    // Progress update
    if (processed % 5 === 0 || processed === clips.length) {
      console.log(`\n📈 Progress: ${processed}/${clips.length} (${Math.round(processed/clips.length*100)}%)`);
    }
  }
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const needsNormalization = results.filter(r => r.message.includes('Needs normalization')).length;
  const withinTolerance = results.filter(r => r.message.includes('tolerance') || r.message.includes('Already normalized')).length;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`   Total clips:          ${clips.length}`);
  console.log(`   Successful:           ${successful}`);
  console.log(`   Failed:               ${failed}`);
  if (args.analyzeOnly) {
    console.log(`   Needs normalization:  ${needsNormalization}`);
    console.log(`   Within tolerance:     ${withinTolerance}`);
    
    // Show distribution
    const loudnessValues = results.filter(r => r.loudness !== undefined).map(r => r.loudness!);
    if (loudnessValues.length > 0) {
      const avg = loudnessValues.reduce((a, b) => a + b, 0) / loudnessValues.length;
      const min = Math.min(...loudnessValues);
      const max = Math.max(...loudnessValues);
      console.log(`\n   Loudness Distribution:`);
      console.log(`   - Average: ${avg.toFixed(1)} LUFS`);
      console.log(`   - Range:   ${min.toFixed(1)} to ${max.toFixed(1)} LUFS`);
      console.log(`   - Target:  ${TARGET_LUFS} LUFS`);
    }
  }
  console.log('='.repeat(60));
  
  // List failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('\n❌ Failures:');
    failures.forEach(f => console.log(`   - ${f.message}`));
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
