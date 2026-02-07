/**
 * Arsenal Transcoding Background Worker
 *
 * Runs perpetually on Railway, polling for queued transcoding jobs.
 * Processes videos with FFmpeg and updates progress in real-time.
 *
 * Flow:
 * 1. Poll database every 30 seconds for jobs with status='queued'
 * 2. Pick up first available job
 * 3. Download source video from R2
 * 4. Transcode with FFmpeg (H.264/AAC/MP4)
 * 5. Upload transcoded video to R2
 * 6. Update database with output URL and status='complete'
 * 7. Repeat forever
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Environment variables
const D1_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || 'odubo';

const POLL_INTERVAL_MS = 30000; // 30 seconds
const MAX_RETRIES = 3;

// Validate environment variables
if (!D1_API_TOKEN || !D1_ACCOUNT_ID || !D1_DATABASE_ID) {
  console.error('[Worker] Missing D1 credentials. Required: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID');
  process.exit(1);
}

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('[Worker] Missing R2 credentials. Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  process.exit(1);
}

// Initialize S3 client for R2
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
  source_url: string;
  source_size?: number;
  retry_count: number;
}

interface VideoRecord {
  id: number;
  title: string;
}

/**
 * Query Cloudflare D1 via REST API
 */
async function queryD1(sql: string, params: any[] = []): Promise<any> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${D1_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`D1 query failed: ${error}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(data.errors)}`);
  }

  return data.result[0];
}

/**
 * Update job status and progress in database
 */
async function updateJobStatus(jobId: number, status: string, progress: number, extra: any = {}): Promise<void> {
  const updates: string[] = ['status = ?', 'progress = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const params: any[] = [status, progress];

  if (extra.output_url) {
    updates.push('output_url = ?');
    params.push(extra.output_url);
  }

  if (extra.output_size) {
    updates.push('output_size = ?');
    params.push(extra.output_size);
  }

  if (extra.duration_seconds) {
    updates.push('duration_seconds = ?');
    params.push(extra.duration_seconds);
  }

  if (extra.codec_info) {
    updates.push('codec_info = ?');
    params.push(extra.codec_info);
  }

  if (extra.source_size) {
    updates.push('source_size = ?');
    params.push(extra.source_size);
  }

  if (extra.error_message) {
    updates.push('error_message = ?');
    params.push(extra.error_message);
  }

  if (status === 'complete' || status === 'failed') {
    updates.push('completed_at = CURRENT_TIMESTAMP');
  }

  params.push(jobId);

  const sql = `UPDATE transcoding_jobs SET ${updates.join(', ')} WHERE id = ?`;
  await queryD1(sql, params);

  console.log(`[Worker] Job ${jobId} → ${status} (${progress}%)`);
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
 * Transcode video with FFmpeg
 */
function transcodeVideo(
  inputPath: string,
  outputPath: string,
  jobId: number,
  duration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    let lastProgress = 0;

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

          // Only update every 5% to reduce database writes
          if (percent >= lastProgress + 5) {
            lastProgress = percent;
            await updateJobStatus(jobId, 'transcoding', percent);
          }
        }
      })
      .on('end', () => {
        console.log(`[Worker] Job ${jobId} FFmpeg processing complete`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`[Worker] Job ${jobId} FFmpeg error:`, err);
        reject(err);
      })
      .run();
  });
}

/**
 * Process a single transcoding job
 */
async function processJob(job: TranscodingJob): Promise<void> {
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    console.log(`[Worker] Processing job ${job.id} for video ${job.video_id}`);

    // Get video details
    const videoResult = await queryD1('SELECT id, title FROM videos WHERE id = ?', [job.video_id]);
    if (!videoResult.results || videoResult.results.length === 0) {
      throw new Error('Video not found');
    }
    const video: VideoRecord = videoResult.results[0];

    // Update status: analyzing
    await updateJobStatus(job.id, 'analyzing', 5);

    // Extract R2 key from URL
    const urlObj = new URL(job.source_url);
    const r2Key = urlObj.pathname.substring(1); // Remove leading slash

    console.log(`[Worker] Job ${job.id} downloading from R2: ${r2Key}`);

    // Download source video from R2
    const getCommand = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
    });

    const { Body, ContentLength } = await s3.send(getCommand);

    if (!Body) {
      throw new Error('Failed to download source video from R2');
    }

    // Ensure temp directory exists
    const tempDir = tmpdir();
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Save to temp file
    const timestamp = Date.now();
    inputPath = join(tempDir, `input_${job.id}_${timestamp}.original`);
    outputPath = join(tempDir, `output_${job.id}_${timestamp}.mp4`);

    console.log(`[Worker] Job ${job.id} saving to temp: ${inputPath}`);

    const chunks: Uint8Array[] = [];
    const readableStream = Body as Readable;

    for await (const chunk of readableStream) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    await writeFile(inputPath, buffer);

    const sourceSize = buffer.length;

    console.log(`[Worker] Job ${job.id} downloaded ${sourceSize} bytes`);

    // Update source size
    await updateJobStatus(job.id, 'analyzing', 7, { source_size: sourceSize });

    // Get video metadata
    const metadata = await getVideoMetadata(inputPath);
    console.log(`[Worker] Job ${job.id} metadata:`, metadata);

    await updateJobStatus(job.id, 'analyzing', 10, {
      duration_seconds: metadata.duration,
      codec_info: JSON.stringify(metadata.format),
    });

    // Update status: transcoding
    await updateJobStatus(job.id, 'transcoding', 10);

    // Transcode with FFmpeg
    await transcodeVideo(inputPath, outputPath, job.id, metadata.duration);

    console.log(`[Worker] Job ${job.id} transcoding complete, uploading to R2`);

    await updateJobStatus(job.id, 'transcoding', 95);

    // Read transcoded file
    const fs = await import('fs/promises');
    const transcodedBuffer = await fs.readFile(outputPath);
    const outputSize = transcodedBuffer.length;

    // Upload to R2
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const sanitizedTitle = video.title.replace(/[^a-zA-Z0-9.-]/g, '_');
    const outputKey = `videos/transcoded/${year}/${month}/${timestamp}-${sanitizedTitle}.mp4`;

    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: outputKey,
      Body: transcodedBuffer,
      ContentType: 'video/mp4',
    });

    await s3.send(putCommand);

    const outputUrl = `https://media.odubo.studio/${outputKey}`;

    console.log(`[Worker] Job ${job.id} uploaded to R2: ${outputUrl}`);

    // Update job: complete
    await updateJobStatus(job.id, 'complete', 100, {
      output_url: outputUrl,
      output_size: outputSize,
    });

    // Update video with transcoded URL
    await queryD1('UPDATE videos SET mp4_url = ? WHERE id = ?', [outputUrl, job.video_id]);

    console.log(`[Worker] Job ${job.id} COMPLETE! Video ${job.video_id} ready to deploy.`);
  } catch (error: any) {
    console.error(`[Worker] Job ${job.id} error:`, error);

    // Increment retry count
    const newRetryCount = job.retry_count + 1;

    if (newRetryCount < MAX_RETRIES) {
      // Retry later
      console.log(`[Worker] Job ${job.id} will retry (${newRetryCount}/${MAX_RETRIES})`);
      await queryD1(
        'UPDATE transcoding_jobs SET status = ?, retry_count = ?, error_message = ? WHERE id = ?',
        ['queued', newRetryCount, error.message, job.id]
      );
    } else {
      // Mark as failed
      console.log(`[Worker] Job ${job.id} FAILED after ${MAX_RETRIES} retries`);
      await updateJobStatus(job.id, 'failed', 0, { error_message: error.message });
    }
  } finally {
    // Cleanup temp files
    if (inputPath) {
      try {
        await unlink(inputPath);
      } catch (err) {
        console.error(`[Worker] Job ${job.id} failed to delete input file:`, err);
      }
    }
    if (outputPath) {
      try {
        await unlink(outputPath);
      } catch (err) {
        console.error(`[Worker] Job ${job.id} failed to delete output file:`, err);
      }
    }
  }
}

/**
 * Main worker loop
 */
async function workerLoop() {
  console.log('[Worker] Starting transcoding worker...');
  console.log(`[Worker] Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`[Worker] Max retries: ${MAX_RETRIES}`);

  while (true) {
    try {
      // Query for next queued job
      const result = await queryD1(
        `SELECT id, video_id, status, source_url, source_size, retry_count
         FROM transcoding_jobs
         WHERE status = 'queued'
         ORDER BY created_at ASC
         LIMIT 1`,
        []
      );

      if (result.results && result.results.length > 0) {
        const job: TranscodingJob = result.results[0];
        console.log(`[Worker] Found job ${job.id}, starting processing...`);

        await processJob(job);
      } else {
        // No jobs found, wait before next poll
        console.log(`[Worker] No jobs found, sleeping for ${POLL_INTERVAL_MS / 1000}s...`);
      }
    } catch (error) {
      console.error('[Worker] Error in worker loop:', error);
      // Continue anyway, don't crash the worker
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Start the worker
console.log('[Worker] Arsenal Transcoding Worker');
console.log('[Worker] Environment check...');
console.log(`[Worker] D1 Database: ${D1_DATABASE_ID}`);
console.log(`[Worker] R2 Bucket: ${R2_BUCKET}`);
console.log(`[Worker] FFmpeg: ${ffmpegInstaller.path}`);

workerLoop().catch((error) => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});
