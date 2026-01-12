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

// Configuration for dynamics-sensitive normalization
// Philosophy: Reduce the loud, gently touch the quiet
const LOUD_CEILING = -14;      // LUFS - clips louder than this get reduced
const QUIET_FLOOR = -20;       // LUFS - clips quieter than this get gentle boost
const MAX_BOOST_DB = 3;        // Never boost more than this
const HIGH_LRA_THRESHOLD = 10; // LU - clips with high dynamic range get gentler treatment
const LIMITER_CEILING = -1;    // dB - safety limiter to prevent clipping

// Legacy config (still used for analysis)
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

/**
 * Calculate asymmetric gain for dynamics-sensitive normalization
 * - Loud clips: bring down to ceiling (priority: prevent ear damage)
 * - Quiet clips: gentle boost, capped at MAX_BOOST_DB
 * - High dynamic range: even gentler treatment
 * - Middle range: leave alone
 */
function calculateAsymmetricGain(measuredLufs: number, measuredLra: number): number {
  // High dynamic range? Be extra gentle
  const isHighDynamicRange = measuredLra > HIGH_LRA_THRESHOLD;
  const effectiveMaxBoost = isHighDynamicRange ? 1.5 : MAX_BOOST_DB;

  if (measuredLufs > LOUD_CEILING) {
    // TOO LOUD - bring down to ceiling (always do this)
    return LOUD_CEILING - measuredLufs; // Negative gain (reduction)
  }

  if (measuredLufs < QUIET_FLOOR) {
    // Quiet - gentle boost, capped
    const idealBoost = QUIET_FLOOR - measuredLufs;
    return Math.min(idealBoost, effectiveMaxBoost);
  }

  // In the sweet spot (-14 to -20 LUFS) - leave it alone
  return 0;
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

/**
 * Apply fixed gain to video using volume filter (preserves dynamics)
 * Unlike loudnorm which dynamically adjusts, this applies a fixed dB change
 */
async function applyGain(inputPath: string, gainDb: number): Promise<string> {
  if (!ffmpegPath || !existsSync(ffmpegPath)) {
    throw new Error('ffmpeg-static binary not found');
  }

  const outPath = path.join(os.tmpdir(), `odubo_normalized_${Date.now()}.mp4`);

  // Use volume filter for fixed gain + limiter for safety
  // This preserves the original dynamics while shifting the overall level
  const audioFilter = `volume=${gainDb}dB,alimiter=limit=${LIMITER_CEILING}dB:attack=5:release=50`;

  await new Promise<void>((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-c:v', 'copy',
      '-af', audioFilter,
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
      if (code !== 0) return reject(new Error(`ffmpeg gain adjustment failed`));
      resolve();
    });
  });

  return outPath;
}

/**
 * Main normalization function using dynamics-sensitive algorithm
 * Returns the output path, or null if no processing needed (gain ~0)
 */
async function normalizeVideo(inputPath: string, loudnessData: LoudnessData): Promise<string | null> {
  const gainDb = calculateAsymmetricGain(loudnessData.input_i, loudnessData.input_lra);

  // If gain is negligible, no processing needed
  if (Math.abs(gainDb) < 0.5) {
    return null;
  }

  return applyGain(inputPath, gainDb);
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
    
    // Calculate what gain would be applied
    const gainDb = calculateAsymmetricGain(loudnessData.input_i, loudnessData.input_lra);
    const now = new Date().toISOString();

    // Store analysis results regardless of whether we process
    await executeQuery(
      `UPDATE videos SET
         audio_loudness_lufs = ?,
         audio_loudness_range_lu = ?,
         audio_analyzed_at = ?
       WHERE id = ?`,
      [loudnessData.input_i, loudnessData.input_lra, now, videoId]
    );

    // Check if normalization is actually needed (gain is negligible)
    if (!force && Math.abs(gainDb) < 0.5) {
      // Mark as normalized since it doesn't need adjustment
      await executeQuery(
        `UPDATE videos SET
           audio_normalized = 1,
           audio_gain_applied_db = 0
         WHERE id = ?`,
        [videoId]
      );

      return NextResponse.json({
        success: true,
        message: 'No adjustment needed - loudness is within acceptable range',
        analysis: {
          loudness: loudnessData.input_i,
          dynamicRange: loudnessData.input_lra,
          gainCalculated: gainDb,
          decision: loudnessData.input_i > LOUD_CEILING
            ? 'Already below loud ceiling'
            : loudnessData.input_i < QUIET_FLOOR
            ? 'Too gentle to boost significantly'
            : 'In the sweet spot (-14 to -20 LUFS)'
        },
        skipped: true
      });
    }

    // Normalize the audio
    outPath = await normalizeVideo(srcPath, loudnessData);

    // If normalizeVideo returns null, no processing was done
    if (!outPath) {
      await executeQuery(
        `UPDATE videos SET audio_normalized = 1, audio_gain_applied_db = 0 WHERE id = ?`,
        [videoId]
      );
      return NextResponse.json({
        success: true,
        message: 'No processing needed',
        skipped: true
      });
    }

    // Upload to Cloudflare Stream
    const fileBuffer = await fs.readFile(outPath);
    const uploadResult = await stream.uploadVideoStream(fileBuffer, {
      name: `${video.title || `Video ${videoId}`} (normalized)`,
      meta: {
        originalVideoId: videoId,
        normalizedAt: now,
        originalLufs: loudnessData.input_i,
        gainApplied: gainDb,
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

    // Update database with new URL and analysis results
    const newUrl = `https://${CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${newUid}/manifest/video.m3u8`;

    await executeQuery(
      `UPDATE videos SET
         url = ?,
         uid = ?,
         audio_normalized = 1,
         audio_gain_applied_db = ?,
         updated_at = datetime("now")
       WHERE id = ?`,
      [newUrl, newUid, gainDb, videoId]
    );

    // Determine what action was taken
    const action = gainDb < 0
      ? `Reduced by ${Math.abs(gainDb).toFixed(1)}dB (was too loud)`
      : `Boosted by ${gainDb.toFixed(1)}dB (was quiet)`;

    return NextResponse.json({
      success: true,
      message: 'Audio normalized successfully',
      action,
      analysis: {
        originalLoudness: loudnessData.input_i,
        dynamicRange: loudnessData.input_lra,
        gainApplied: gainDb,
        resultingLoudness: loudnessData.input_i + gainDb,
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
    `SELECT id, title, uid, audio_normalized,
            audio_loudness_lufs, audio_loudness_range_lu,
            audio_gain_applied_db, audio_analyzed_at
     FROM videos WHERE id = ? LIMIT 1`,
    [videoId]
  );

  if (!rows.length) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  const video = rows[0];

  // Calculate what gain would be applied (for preview)
  const predictedGain = video.audio_loudness_lufs
    ? calculateAsymmetricGain(video.audio_loudness_lufs, video.audio_loudness_range_lu || 7)
    : null;

  return NextResponse.json({
    id: video.id,
    title: video.title,
    uid: video.uid,
    audio_normalized: video.audio_normalized === 1,
    analysis: video.audio_loudness_lufs ? {
      loudness: video.audio_loudness_lufs,
      dynamicRange: video.audio_loudness_range_lu,
      gainApplied: video.audio_gain_applied_db,
      analyzedAt: video.audio_analyzed_at,
      predictedGain,
    } : null,
    config: {
      loudCeiling: LOUD_CEILING,
      quietFloor: QUIET_FLOOR,
      maxBoost: MAX_BOOST_DB,
    }
  });
}
