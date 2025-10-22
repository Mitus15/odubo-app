import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import ffmpegPath from 'ffmpeg-static';
import { executeQuery } from '@/lib/db';

// Node-compatible S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

async function streamToBuffer(stream: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function generateThumbnailForVideo(r2Key: string, galleryId: string, photoUid: string) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'odubo-thumb-'));
  const tmpVideoPath = path.join(tmpDir, `${photoUid}.webm`);
  const tmpThumbPath = path.join(tmpDir, `${photoUid}.jpg`);

  try {
    // Download video from R2
    const getCmd = new GetObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, Key: r2Key });
    const getResp = await s3Client.send(getCmd);
    const body = getResp.Body as any;
    const buffer = await streamToBuffer(body);

    await fs.writeFile(tmpVideoPath, buffer);

    // Run ffmpeg to create a thumbnail at ~0.5s
    // Prefer an explicit FFMPEG_PATH, then common system install locations, then ffmpeg-static, then 'ffmpeg' on PATH
    let ffmpegBinary: string | null = null;
    if (process.env.FFMPEG_PATH) ffmpegBinary = process.env.FFMPEG_PATH;
    try {
      if (!ffmpegBinary) {
        await fs.access('/opt/homebrew/bin/ffmpeg');
        ffmpegBinary = '/opt/homebrew/bin/ffmpeg';
      }
    } catch {}
    try {
      if (!ffmpegBinary) {
        await fs.access('/usr/local/bin/ffmpeg');
        ffmpegBinary = '/usr/local/bin/ffmpeg';
      }
    } catch {}
    try {
      if (!ffmpegBinary && ffmpegPath) {
        await fs.access(ffmpegPath as string);
        ffmpegBinary = ffmpegPath as string;
      }
    } catch {}

    if (!ffmpegBinary) ffmpegBinary = 'ffmpeg';

    await new Promise<void>((resolve, reject) => {
      const args = ['-y', '-i', tmpVideoPath, '-ss', '00:00:00.500', '-frames:v', '1', '-q:v', '2', tmpThumbPath];
      const proc = spawn(ffmpegBinary as string, args, { stdio: 'inherit' });
      proc.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error('ffmpeg exited with code ' + code));
      });
      proc.on('error', (err) => reject(err));
    });

    const thumbBuf = await fs.readFile(tmpThumbPath);

    // Upload thumbnail back to R2
    const thumbKey = `galleries/${galleryId}/thumbs/${photoUid}.jpg`;
    const putCmd = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: thumbKey,
      Body: thumbBuf,
      ContentType: 'image/jpeg',
    });
    await s3Client.send(putCmd);

    // Update DB
    const sql = `UPDATE gallery_photos SET thumbnail_key = ? WHERE uid = ?`;
    await executeQuery(sql, [thumbKey, photoUid]);

    return { success: true, thumbnailKey: thumbKey };
  } catch (e: any) {
    console.error('Thumbnail generation error:', e);
    return { success: false, error: e.message || 'Failed' };
  } finally {
    // Cleanup temp files
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('generate_video_thumbnail.ts')) {
  (async () => {
    const [,, r2Key, galleryId, uid] = process.argv;
    if (!r2Key || !galleryId || !uid) {
      console.error('Usage: node generate_video_thumbnail.js <r2Key> <galleryId> <uid>');
      process.exit(1);
    }
    const res = await generateThumbnailForVideo(r2Key, galleryId, uid);
    console.log(res);
  })();
}
