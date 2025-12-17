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
export const maxDuration = 300; // 5 minutes for processing

// Configuration
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
    
    let stderr = '';
    const p = spawn(ffmpegPath as string, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    p.stderr?.on('data', (data) => { stderr += data.toString(); });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg normalize failed`));
      resolve();
    });
  });
  
  return outPath;
}

/**
 * POST /api/videos/[id]/normalize
 * 
 * Normalizes audio on a video/clip to -16 LUFS (Apple Music standard).
 * This downloads the video, processes it with ffmpeg, and re-uploads to Cloudflare Stream.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getUserFromRequest(req);
  if (!isAdminUser(authUser)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const { id } = await params;
  const videoId = parseInt(id, 10);
  
  if (isNaN(videoId)) {
    return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
  }
  
  let srcPath: string | null = null;
  let outPath: string | null = null;
  
  try {
    // Get video from database
    const rows = await queryDatabase(
      'SELECT id, title, url, uid, audio_normalized FROM videos WHERE id = ? LIMIT 1',
      [videoId]
    );
    
    if (!rows.length) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    
    const video = rows[0];
    const videoUid = video.uid;
    
    if (!videoUid) {
      return NextResponse.json({ error: 'Video has no Stream UID' }, { status: 400 });
    }
    
    // Check if force parameter is set
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true';
    
    if (!force && video.audio_normalized === 1) {
      return NextResponse.json({ 
        success: true, 
        message: 'Already normalized',
        skipped: true 
      });
    }
    
    const stream = new CloudflareStreamAPI();
    
    // Enable downloads and get URL
    let downloadUrl = await stream.getDownloadUrl(videoUid);
    
    if (!downloadUrl) {
      await stream.enableDownloads(videoUid);
      
      // Poll for download URL (up to 2 minutes)
      for (let i = 0; i < 60 && !downloadUrl; i++) {
        await new Promise(r => setTimeout(r, 2000));
        downloadUrl = await stream.getDownloadUrl(videoUid);
      }
    }
    
    if (!downloadUrl) {
      return NextResponse.json({ error: 'Timeout waiting for download URL' }, { status: 504 });
    }
    
    // Download the video
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to download video' }, { status: 502 });
    }
    
    srcPath = path.join(os.tmpdir(), `odubo_src_${videoId}_${Date.now()}.mp4`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(srcPath, buffer);
    
    // Analyze loudness
    const loudnessData = await analyzeLoudness(srcPath);
    
    // Check if normalization is actually needed
    const delta = Math.abs(loudnessData.input_i - TARGET_LUFS);
    if (!force && delta < 1.0) {
      // Mark as normalized since it's already within tolerance
      await executeQuery('UPDATE videos SET audio_normalized = 1 WHERE id = ?', [videoId]);
      
      return NextResponse.json({
        success: true,
        message: 'Already within tolerance',
        loudness: {
          current: loudnessData.input_i,
          target: TARGET_LUFS,
          delta: delta
        },
        skipped: true
      });
    }
    
    // Normalize the audio
    outPath = await normalizeVideo(srcPath, loudnessData);
    
    // Upload to Cloudflare Stream
    const fileBuffer = await fs.readFile(outPath);
    const uploadResult = await stream.uploadVideoStream(fileBuffer, {
      name: `${video.title || `Video ${videoId}`} (normalized)`,
      meta: {
        originalVideoId: videoId,
        normalizedAt: new Date().toISOString(),
        targetLufs: TARGET_LUFS,
        originalLufs: loudnessData.input_i,
      }
    });
    
    const newUid = uploadResult.result.uid;
    
    // Wait for processing (up to 5 minutes)
    const isReady = await stream.waitForVideoReady(newUid, {
      maxWaitTime: 300000,
      pollInterval: 5000,
    });
    
    if (!isReady) {
      return NextResponse.json({ error: 'Stream processing timeout' }, { status: 504 });
    }
    
    // Update database with new URL
    const newUrl = `https://${CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${newUid}/manifest/video.m3u8`;
    
    await executeQuery(
      `UPDATE videos SET 
         url = ?, 
         uid = ?, 
         audio_normalized = 1,
         updated_at = datetime("now")
       WHERE id = ?`,
      [newUrl, newUid, videoId]
    );
    
    return NextResponse.json({
      success: true,
      message: 'Audio normalized successfully',
      loudness: {
        before: loudnessData.input_i,
        after: TARGET_LUFS,
        delta: loudnessData.input_i - TARGET_LUFS
      },
      video: {
        id: videoId,
        uid: newUid,
        url: newUrl
      }
    });
    
  } catch (err: any) {
    console.error('Normalization error:', err);
    return NextResponse.json({ 
      error: 'Normalization failed', 
      details: err?.message 
    }, { status: 500 });
  } finally {
    // Cleanup temp files
    if (srcPath) await fs.unlink(srcPath).catch(() => {});
    if (outPath) await fs.unlink(outPath).catch(() => {});
  }
}

/**
 * GET /api/videos/[id]/normalize
 * 
 * Check normalization status and current loudness level.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getUserFromRequest(req);
  if (!isAdminUser(authUser)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const { id } = await params;
  const videoId = parseInt(id, 10);
  
  if (isNaN(videoId)) {
    return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
  }
  
  const rows = await queryDatabase(
    'SELECT id, title, uid, audio_normalized FROM videos WHERE id = ? LIMIT 1',
    [videoId]
  );
  
  if (!rows.length) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }
  
  const video = rows[0];
  
  return NextResponse.json({
    id: video.id,
    title: video.title,
    uid: video.uid,
    audio_normalized: video.audio_normalized === 1,
    target_lufs: TARGET_LUFS
  });
}
