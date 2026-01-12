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
 */
function calculateAsymmetricGain(measuredLufs: number, measuredLra: number): number {
  const isHighDynamicRange = measuredLra > HIGH_LRA_THRESHOLD;
  const effectiveMaxBoost = isHighDynamicRange ? 1.5 : MAX_BOOST_DB;

  if (measuredLufs > LOUD_CEILING) {
    return LOUD_CEILING - measuredLufs;
  }

  if (measuredLufs < QUIET_FLOOR) {
    const idealBoost = QUIET_FLOOR - measuredLufs;
    return Math.min(idealBoost, effectiveMaxBoost);
  }

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
 */
async function applyGain(inputPath: string, gainDb: number): Promise<string> {
  if (!ffmpegPath || !existsSync(ffmpegPath)) {
    throw new Error('ffmpeg-static binary not found');
  }

  const outPath = path.join(os.tmpdir(), `odubo_normalized_${Date.now()}.mp4`);
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

    const p = spawn(ffmpegPath as string, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg gain adjustment failed`));
      resolve();
    });
  });

  return outPath;
}

interface ProcessResult {
  success: boolean;
  message: string;
  analysis?: {
    originalLoudness: number;
    dynamicRange: number;
    gainApplied: number;
    resultingLoudness: number;
  };
}

async function processVideo(
  video: { id: number; title: string | null; uid: string },
  stream: CloudflareStreamAPI
): Promise<ProcessResult> {
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
    const gainDb = calculateAsymmetricGain(loudnessData.input_i, loudnessData.input_lra);
    const now = new Date().toISOString();

    // Store analysis results regardless of processing
    await executeQuery(
      `UPDATE videos SET
         audio_loudness_lufs = ?,
         audio_loudness_range_lu = ?,
         audio_analyzed_at = ?
       WHERE id = ?`,
      [loudnessData.input_i, loudnessData.input_lra, now, video.id]
    );

    // Check if normalization needed
    if (Math.abs(gainDb) < 0.5) {
      await executeQuery(
        `UPDATE videos SET audio_normalized = 1, audio_gain_applied_db = 0 WHERE id = ?`,
        [video.id]
      );
      const reason = loudnessData.input_i > LOUD_CEILING
        ? 'below loud ceiling'
        : loudnessData.input_i < QUIET_FLOOR
        ? 'gentle boost not needed'
        : 'in sweet spot';
      return {
        success: true,
        message: `No adjustment needed (${reason}): ${video.title || video.id}`,
        analysis: {
          originalLoudness: loudnessData.input_i,
          dynamicRange: loudnessData.input_lra,
          gainApplied: 0,
          resultingLoudness: loudnessData.input_i,
        }
      };
    }

    // Apply gain
    outPath = await applyGain(srcPath, gainDb);

    // Upload
    const fileBuffer = await fs.readFile(outPath);
    const uploadResult = await stream.uploadVideoStream(fileBuffer, {
      name: `${video.title || `Video ${video.id}`} (normalized)`,
      meta: {
        originalVideoId: video.id,
        normalizedAt: now,
        originalLufs: loudnessData.input_i,
        gainApplied: gainDb,
      }
    });

    const newUid = uploadResult.result.uid;

    // Wait for processing
    await stream.waitForVideoReady(newUid, { maxWaitTime: 180000, pollInterval: 5000 });

    // Update database
    const newUrl = `https://${CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${newUid}/manifest/video.m3u8`;
    await executeQuery(
      `UPDATE videos SET
         url = ?,
         uid = ?,
         audio_normalized = 1,
         audio_gain_applied_db = ?,
         updated_at = datetime("now")
       WHERE id = ?`,
      [newUrl, newUid, gainDb, video.id]
    );

    const action = gainDb < 0 ? `reduced ${Math.abs(gainDb).toFixed(1)}dB` : `boosted ${gainDb.toFixed(1)}dB`;
    return {
      success: true,
      message: `Normalized (${action}): ${video.title || video.id}`,
      analysis: {
        originalLoudness: loudnessData.input_i,
        dynamicRange: loudnessData.input_lra,
        gainApplied: gainDb,
        resultingLoudness: loudnessData.input_i + gainDb,
      }
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
    SELECT id, title, uid, type, audio_normalized,
           audio_loudness_lufs, audio_loudness_range_lu
    FROM videos
    WHERE uid IS NOT NULL AND uid != ''
      AND (audio_normalized IS NULL OR audio_normalized = 0)
    ORDER BY created_at DESC
  `);

  const normalized = await queryDatabase(`
    SELECT COUNT(*) as count FROM videos WHERE audio_normalized = 1
  `);

  // Analyze what would happen to each pending video
  const videosWithPrediction = pending.map((v: any) => {
    const predictedGain = v.audio_loudness_lufs
      ? calculateAsymmetricGain(v.audio_loudness_lufs, v.audio_loudness_range_lu || 7)
      : null;

    return {
      id: v.id,
      title: v.title,
      uid: v.uid,
      type: v.type,
      analyzed: !!v.audio_loudness_lufs,
      loudness: v.audio_loudness_lufs,
      dynamicRange: v.audio_loudness_range_lu,
      predictedGain,
      predictedAction: predictedGain
        ? (predictedGain < -0.5
          ? `Reduce ${Math.abs(predictedGain).toFixed(1)}dB`
          : predictedGain > 0.5
          ? `Boost ${predictedGain.toFixed(1)}dB`
          : 'No change needed')
        : 'Needs analysis'
    };
  });

  return NextResponse.json({
    pending: pending.length,
    normalized: normalized?.[0]?.count || 0,
    config: {
      loudCeiling: LOUD_CEILING,
      quietFloor: QUIET_FLOOR,
      maxBoost: MAX_BOOST_DB,
    },
    videos: videosWithPrediction
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
  const results: Array<{ id: number; success: boolean; message: string; analysis?: ProcessResult['analysis'] }> = [];

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
