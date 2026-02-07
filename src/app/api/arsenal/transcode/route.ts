/**
 * Arsenal Transcoding Endpoint
 *
 * Real-time FFmpeg video transcoding with detailed progress tracking.
 * Converts any video format (MOV, AVI, etc.) to MP4 for PostForMe compatibility.
 *
 * Flow:
 * 1. Create transcoding_job record (status: queued)
 * 2. Download source video from R2
 * 3. Analyze video metadata (status: analyzing)
 * 4. Transcode with FFmpeg (status: transcoding, progress: 0-100%)
 * 5. Upload transcoded MP4 to R2
 * 6. Update video record with mp4_url (status: complete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Initialize S3 client for R2
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || 'odubo';

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('[Transcode] Missing R2 credentials');
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

interface TranscodingJob {
  id: number;
  video_id: number;
  status: string;
  progress: number;
  source_url: string;
  output_url: string | null;
  error_message: string | null;
}

/**
 * POST /api/arsenal/transcode
 * Start transcoding job for a video
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const body = await req.json();
    const { video_id } = body;

    if (!video_id) {
      return NextResponse.json({ error: 'video_id is required' }, { status: 400 });
    }

    const db = await getDb();

    // Get video details
    const video = await db.prepare('SELECT id, title, mp4_url, uid FROM videos WHERE id = ?').bind(video_id).first<{
      id: number;
      title: string;
      mp4_url: string;
      uid: string;
    }>();

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (!video.mp4_url) {
      return NextResponse.json({ error: 'Video has no source URL' }, { status: 400 });
    }

    console.log('[Transcode] Starting job for video:', { video_id, title: video.title, source_url: video.mp4_url });

    // Create transcoding job record
    const jobResult = await db.prepare(`
      INSERT INTO transcoding_jobs (
        video_id, status, progress, source_url, started_at
      ) VALUES (?, 'queued', 0, ?, CURRENT_TIMESTAMP)
    `).bind(video_id, video.mp4_url).run();

    const job_id = jobResult.meta.last_row_id;

    console.log('[Transcode] Created job:', { job_id, video_id });

    // Update video with job reference
    await db.prepare('UPDATE videos SET transcoding_job_id = ? WHERE id = ?').bind(job_id, video_id).run();

    // Start transcoding asynchronously (don't await)
    processTranscoding(job_id, video_id, video.mp4_url, video.title).catch((err) => {
      console.error('[Transcode] Background processing failed:', err);
    });

    return NextResponse.json({
      success: true,
      job_id,
      video_id,
      status: 'queued',
      message: 'Transcoding job started. Poll /api/arsenal/transcode/[job_id] for progress.',
    });
  } catch (error: any) {
    console.error('[Transcode] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to start transcoding', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Background transcoding process
 * Updates job progress in database at each stage
 */
async function processTranscoding(
  job_id: number,
  video_id: number,
  source_url: string,
  title: string
): Promise<void> {
  const db = await getDb();
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    console.log(`[Transcode Job ${job_id}] Starting processing`);

    // Update status: analyzing
    await updateJobStatus(db, job_id, 'analyzing', 5);

    // Extract R2 key from URL
    const urlObj = new URL(source_url);
    const r2Key = urlObj.pathname.substring(1); // Remove leading slash

    console.log(`[Transcode Job ${job_id}] Downloading from R2:`, r2Key);

    // Download source video from R2
    const getCommand = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
    });

    const { Body, ContentLength } = await s3.send(getCommand);

    if (!Body) {
      throw new Error('Failed to download source video from R2');
    }

    // Save to temp file
    const tempDir = tmpdir();
    const timestamp = Date.now();
    inputPath = join(tempDir, `input_${job_id}_${timestamp}.original`);
    outputPath = join(tempDir, `output_${job_id}_${timestamp}.mp4`);

    console.log(`[Transcode Job ${job_id}] Saving to temp:`, inputPath);

    const chunks: Uint8Array[] = [];
    const readableStream = Body as Readable;

    for await (const chunk of readableStream) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    await writeFile(inputPath, buffer);

    const sourceSize = buffer.length;

    console.log(`[Transcode Job ${job_id}] Downloaded ${sourceSize} bytes`);

    // Update source size
    await db.prepare('UPDATE transcoding_jobs SET source_size = ? WHERE id = ?').bind(sourceSize, job_id).run();

    // Update status: transcoding
    await updateJobStatus(db, job_id, 'transcoding', 10);

    // Get video metadata
    const metadata = await getVideoMetadata(inputPath);
    console.log(`[Transcode Job ${job_id}] Video metadata:`, metadata);

    await db.prepare('UPDATE transcoding_jobs SET duration_seconds = ?, codec_info = ? WHERE id = ?')
      .bind(metadata.duration, JSON.stringify(metadata.format), job_id)
      .run();

    // Transcode with FFmpeg
    await transcodeVideo(inputPath, outputPath, job_id, metadata.duration, db);

    console.log(`[Transcode Job ${job_id}] Transcoding complete, uploading to R2`);

    await updateJobStatus(db, job_id, 'transcoding', 95);

    // Read transcoded file
    const fs = await import('fs/promises');
    const transcodedBuffer = await fs.readFile(outputPath);
    const outputSize = transcodedBuffer.length;

    // Upload to R2
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9.-]/g, '_');
    const outputKey = `videos/transcoded/${year}/${month}/${timestamp}-${sanitizedTitle}.mp4`;

    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: outputKey,
      Body: transcodedBuffer,
      ContentType: 'video/mp4',
    });

    await s3.send(putCommand);

    const outputUrl = `https://media.odubo.studio/${outputKey}`;

    console.log(`[Transcode Job ${job_id}] Uploaded to R2:`, outputUrl);

    // Update job: complete
    await db.prepare(`
      UPDATE transcoding_jobs
      SET status = 'complete', progress = 100, output_url = ?, output_size = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(outputUrl, outputSize, job_id).run();

    // Update video with transcoded URL
    await db.prepare('UPDATE videos SET mp4_url = ? WHERE id = ?').bind(outputUrl, video_id).run();

    console.log(`[Transcode Job ${job_id}] Complete! Output URL:`, outputUrl);
  } catch (error: any) {
    console.error(`[Transcode Job ${job_id}] Error:`, error);

    await db.prepare(`
      UPDATE transcoding_jobs
      SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(error.message, job_id).run();
  } finally {
    // Cleanup temp files
    if (inputPath) {
      try {
        await unlink(inputPath);
      } catch (err) {
        console.error(`[Transcode Job ${job_id}] Failed to delete input file:`, err);
      }
    }
    if (outputPath) {
      try {
        await unlink(outputPath);
      } catch (err) {
        console.error(`[Transcode Job ${job_id}] Failed to delete output file:`, err);
      }
    }
  }
}

/**
 * Update job status in database
 */
async function updateJobStatus(db: any, job_id: number, status: string, progress: number): Promise<void> {
  await db.prepare('UPDATE transcoding_jobs SET status = ?, progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(status, progress, job_id)
    .run();

  console.log(`[Transcode Job ${job_id}] Status: ${status} (${progress}%)`);
}

/**
 * Get video metadata using FFprobe
 */
function getVideoMetadata(inputPath: string): Promise<{ duration: number; format: any }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          duration: metadata.format.duration || 0,
          format: {
            format_name: metadata.format.format_name,
            size: metadata.format.size,
            bit_rate: metadata.format.bit_rate,
          },
        });
      }
    });
  });
}

/**
 * Transcode video with FFmpeg, updating progress
 */
function transcodeVideo(
  inputPath: string,
  outputPath: string,
  job_id: number,
  duration: number,
  db: any
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .videoCodec('libx264') // H.264 codec
      .audioCodec('aac') // AAC audio
      .format('mp4')
      .outputOptions([
        '-preset fast', // Balance speed vs compression
        '-crf 23', // Quality (lower = better, 23 is default)
        '-movflags +faststart', // Enable streaming
        '-pix_fmt yuv420p', // Compatibility
      ])
      .on('progress', async (progress) => {
        if (progress.timemark && duration > 0) {
          const timeParts = progress.timemark.split(':');
          const currentSeconds = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseFloat(timeParts[2]);
          const percent = Math.min(Math.round((currentSeconds / duration) * 85) + 10, 95); // 10-95%

          await updateJobStatus(db, job_id, 'transcoding', percent);
        }
      })
      .on('end', () => {
        console.log(`[Transcode Job ${job_id}] FFmpeg processing complete`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`[Transcode Job ${job_id}] FFmpeg error:`, err);
        reject(err);
      })
      .run();
  });
}
