import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import ffmpegPath from 'ffmpeg-static';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

const TARGET_LUFS = -16;
const TARGET_TP = -1.5;
const TARGET_LRA = 11;
const CUSTOMER_SUBDOMAIN = 'customer-tpkm273r1u0s40no';

interface LoudnessData {
  input_i: number;
  input_tp: number;
  input_lra: number;
  input_thresh: number;
}

async function analyzeLoudness(inputPath: string): Promise<LoudnessData> {
  if (!ffmpegPath || !existsSync(ffmpegPath)) {
    throw new Error('ffmpeg-static binary not found');
  }
  
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
      if (code !== 0) return reject(new Error(`ffmpeg analysis failed`));
      
      const match = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
      if (!match) {
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
  if (!ffmpegPath || !existsSync(ffmpegPath)) {
    throw new Error('ffmpeg-static binary not found');
  }
  
  const outPath = path.join(os.tmpdir(), `odubo_normalized_${Date.now()}.mp4`);
  
  const loudnormFilter = `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:` +
    `measured_I=${loudnessData.input_i}:` +
    `measured_TP=${loudnessData.input_tp}:` +
    `measured_LRA=${loudnessData.input_lra}:` +
    `measured_thresh=${loudnessData.input_thresh}:` +
    `linear=true`;
  
  await new Promise<void>((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-c:v', 'copy',
      '-af', loudnormFilter,
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-movflags', '+faststart',
      '-y', outPath
    ];
    
    const p = spawn(ffmpegPath as string, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg normalize failed`));
      resolve();
    });
  });
  
  return outPath;
}

async function processVideo(
  video: { id: number; title: string | null; uid: string },
  stream: CloudflareStreamAPI
): Promise<{ success: boolean; message: string; loudness?: { before: number; after: number } }> {
  let srcPath: string | null = null;
  let outPath: string | null = null;
  
  try {
    // Get download URL
    let downloadUrl = await stream.getDownloadUrl(video.uid);
    
    if (!downloadUrl) {
      await stream.enableDownloads(video.uid);
      for (let i = 0; i < 30 && !downloadUrl; i++) {
        await new Promise(r => setTimeout(r, 2000));
        downloadUrl = await stream.getDownloadUrl(video.uid);
      }
    }
    
    if (!downloadUrl) {
      return { success: false, message: `Timeout waiting for download: ${video.id}` };
    }
    
    // Download
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      return { success: false, message: `Download failed: ${video.id}` };
    }
    
    srcPath = path.join(os.tmpdir(), `odubo_src_${video.id}_${Date.now()}.mp4`);
    await fs.writeFile(srcPath, Buffer.from(await res.arrayBuffer()));
    
    // Analyze
    const loudnessData = await analyzeLoudness(srcPath);
    
    // Check tolerance
    const delta = Math.abs(loudnessData.input_i - TARGET_LUFS);
    if (delta < 1.0) {
      await executeQuery('UPDATE videos SET audio_normalized = 1 WHERE id = ?', [video.id]);
      return { 
        success: true, 
        message: `Within tolerance: ${video.title || video.id}`,
        loudness: { before: loudnessData.input_i, after: loudnessData.input_i }
      };
    }
    
    // Normalize
    outPath = await normalizeVideo(srcPath, loudnessData);
    
    // Upload
    const fileBuffer = await fs.readFile(outPath);
    const uploadResult = await stream.uploadVideoStream(fileBuffer, {
      name: `${video.title || `Video ${video.id}`} (normalized)`,
      meta: {
        originalVideoId: video.id,
        normalizedAt: new Date().toISOString(),
        targetLufs: TARGET_LUFS,
        originalLufs: loudnessData.input_i,
      }
    });
    
    const newUid = uploadResult.result.uid;
    
    // Wait for processing
    await stream.waitForVideoReady(newUid, { maxWaitTime: 180000, pollInterval: 5000 });
    
    // Update database
    const newUrl = `https://${CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${newUid}/manifest/video.m3u8`;
    await executeQuery(
      `UPDATE videos SET url = ?, uid = ?, audio_normalized = 1, updated_at = datetime("now") WHERE id = ?`,
      [newUrl, newUid, video.id]
    );
    
    return {
      success: true,
      message: `Normalized: ${video.title || video.id}`,
      loudness: { before: loudnessData.input_i, after: TARGET_LUFS }
    };
    
  } catch (err: any) {
    return { success: false, message: `Error: ${video.id} - ${err?.message}` };
  } finally {
    if (srcPath) await fs.unlink(srcPath).catch(() => {});
    if (outPath) await fs.unlink(outPath).catch(() => {});
  }
}

/**
 * GET /api/videos/normalize-pending
 * 
 * List all videos/clips that haven't been normalized yet.
 */
export async function GET(req: NextRequest) {
  const authUser = getUserFromRequest(req);
  if (!isAdminUser(authUser)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const pending = await queryDatabase(`
    SELECT id, title, uid, type, audio_normalized
    FROM videos
    WHERE uid IS NOT NULL AND uid != ''
      AND (audio_normalized IS NULL OR audio_normalized = 0)
    ORDER BY created_at DESC
  `);
  
  const normalized = await queryDatabase(`
    SELECT COUNT(*) as count FROM videos WHERE audio_normalized = 1
  `);
  
  return NextResponse.json({
    pending: pending.length,
    normalized: normalized?.[0]?.count || 0,
    target_lufs: TARGET_LUFS,
    videos: pending.map((v: any) => ({
      id: v.id,
      title: v.title,
      uid: v.uid,
      type: v.type
    }))
  });
}

/**
 * POST /api/videos/normalize-pending
 * 
 * Normalize the next pending video (processes one at a time to avoid timeouts).
 * Call repeatedly to process all pending videos.
 */
export async function POST(req: NextRequest) {
  const authUser = getUserFromRequest(req);
  if (!isAdminUser(authUser)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '1', 10), 5);
  
  // Get pending videos
  const pending = await queryDatabase(`
    SELECT id, title, uid
    FROM videos
    WHERE uid IS NOT NULL AND uid != ''
      AND (audio_normalized IS NULL OR audio_normalized = 0)
    ORDER BY created_at DESC
    LIMIT ?
  `, [limit]);
  
  if (!pending.length) {
    return NextResponse.json({
      success: true,
      message: 'No pending videos to normalize',
      processed: 0,
      remaining: 0
    });
  }
  
  const stream = new CloudflareStreamAPI();
  const results: Array<{ id: number; success: boolean; message: string }> = [];
  
  for (const video of pending) {
    const result = await processVideo(video, stream);
    results.push({ id: video.id, ...result });
  }
  
  // Count remaining
  const remainingRows = await queryDatabase(`
    SELECT COUNT(*) as count FROM videos
    WHERE uid IS NOT NULL AND uid != ''
      AND (audio_normalized IS NULL OR audio_normalized = 0)
  `);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  return NextResponse.json({
    success: true,
    processed: results.length,
    successful,
    failed,
    remaining: remainingRows?.[0]?.count || 0,
    results
  });
}
