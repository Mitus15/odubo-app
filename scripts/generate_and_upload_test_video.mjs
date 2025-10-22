import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import ffmpegStatic from 'ffmpeg-static';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function run() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'odubo-test-'));
  const outPath = path.join(tmpDir, 'test_123.webm');

  // Prefer system 'ffmpeg' if available, fall back to ffmpeg-static
  let ffmpegBinary = 'ffmpeg';
  try {
    await fs.access('/usr/local/bin/ffmpeg');
    ffmpegBinary = '/usr/local/bin/ffmpeg';
  } catch {}
  try {
    await fs.access('/opt/homebrew/bin/ffmpeg');
    ffmpegBinary = '/opt/homebrew/bin/ffmpeg';
  } catch {}
  // if system ffmpeg wasn't found, try ffmpeg-static
  if (!ffmpegBinary) ffmpegBinary = ffmpegStatic || 'ffmpeg';

  console.log('Using ffmpeg binary:', ffmpegBinary);

  // create a 1 second black video
  await new Promise((resolve, reject) => {
    const args = ['-y', '-f', 'lavfi', '-i', 'color=size=320x240:rate=25:color=black', '-t', '1', '-c:v', 'libvpx', '-b:v', '200k', outPath];
    const p = spawn(ffmpegBinary, args, { stdio: 'inherit' });
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error('ffmpeg exited ' + code));
    });
    p.on('error', (err) => reject(err));
  }).catch(err => { console.error('ffmpeg failed', err); process.exit(1); });

  const buf = await fs.readFile(outPath);

  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  });

  const key = 'galleries/1/videos/test_123.webm';
  console.log('Uploading to R2 key', key);
  const cmd = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    Body: buf,
    ContentType: 'video/webm',
  });

  try {
    await s3.send(cmd);
    console.log('Upload successful');
  } catch (e) {
    console.error('Upload failed', e);
    process.exit(1);
  }

  // cleanup temp dir
  try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
}

run().catch(err => { console.error(err); process.exit(1); });
