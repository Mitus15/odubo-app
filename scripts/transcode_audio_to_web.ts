// Load env first
import 'dotenv/config';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { queryDatabase, executeQuery } from '@/lib/db';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

type Args = {
  trackId?: string;
  albumId?: string;
  all?: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--track' || a === '--id') result.trackId = args[++i];
    else if (a === '--album') result.albumId = args[++i];
    else if (a === '--all') result.all = true;
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
  const tmpFile = path.join(os.tmpdir(), `odubo_src_${Date.now()}`);
  await fs.writeFile(tmpFile, new Uint8Array(await res.arrayBuffer()));
  return tmpFile;
}

async function transcodeToAacM4a(inputPath: string, title: string): Promise<string> {
  if (!ffmpegPath || !existsSync(ffmpegPath)) throw new Error('ffmpeg-static binary not found');
  const outPath = path.join(os.tmpdir(), `odubo_${Date.now()}.m4a`);
  
  // Two-pass loudness normalization to -16 LUFS (Apple Music standard)
  // Pass 1: Analyze loudness
  console.log('Analyzing loudness levels...');
  const loudnessData = await new Promise<{ i: number; tp: number; lra: number }>((resolve, reject) => {
    let stderr = '';
    const p = spawn(ffmpegPath as string, [
      '-i', inputPath,
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
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
        return resolve({ i: -24, tp: -2, lra: 7 }); // Safe defaults
      }
      try {
        const json = JSON.parse(match[0]);
        resolve({
          i: parseFloat(json.input_i) || -24,
          tp: parseFloat(json.input_tp) || -2,
          lra: parseFloat(json.input_lra) || 7,
        });
      } catch {
        resolve({ i: -24, tp: -2, lra: 7 });
      }
    });
  });
  
  console.log(`Input loudness: ${loudnessData.i.toFixed(1)} LUFS, TP: ${loudnessData.tp.toFixed(1)} dB, LRA: ${loudnessData.lra.toFixed(1)}`);
  
  // Pass 2: Apply normalization and encode
  console.log('Applying loudness normalization to -16 LUFS...');
  await new Promise<void>((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-vn',
      // Loudness normalization filter - target -16 LUFS (Apple Music), -1.5 dB true peak
      '-af', `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${loudnessData.i}:measured_TP=${loudnessData.tp}:measured_LRA=${loudnessData.lra}:linear=true`,
      '-acodec', 'aac',
      '-profile:a', 'aac_low',
      '-b:a', '256k',
      '-ar', '44100',
      '-ac', '2',
      '-movflags', '+faststart',
      '-metadata', `title=${title || ''}`,
      outPath,
    ];
    const p = spawn(ffmpegPath as string, args, { stdio: 'inherit' });
    p.on('error', reject);
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)));
  });
  return outPath;
}

function toWebKeyFromUrl(url: string): { key: string; webKey: string; webUrl: string } {
  // url: https://media.domain/<key>
  const key = url.replace(/^https?:\/\/[^/]+\//, '');
  const parsed = path.parse(key);
  // Strip existing .web suffix if present to avoid double web.web
  const baseName = parsed.name.endsWith('.web') ? parsed.name.slice(0, -4) : parsed.name;
  const webBase = `${baseName}.web.m4a`;
  const webKey = path.join(parsed.dir, webBase).replace(/\\/g, '/');
  const webUrl = `${R2_PUBLIC}/${webKey}`;
  return { key, webKey, webUrl };
}

async function uploadToR2(key: string, filePath: string) {
  const body = await fs.readFile(filePath);
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: 'audio/mp4',
    Metadata: { codec: 'aac', optimized: 'true' },
  }));
}

async function processTrack(trackId: string) {
  const rows = await queryDatabase('SELECT id, title, audio_url FROM tracks WHERE id = ? LIMIT 1', [trackId]);
  if (!rows || (rows as any[]).length === 0) throw new Error(`Track not found: ${trackId}`);
  const track = (rows as any[])[0];
  if (!track.audio_url) throw new Error(`Track has no audio_url: ${trackId}`);

  // Skip if already a normalized web variant
  if (/\.web\.m4a$/i.test(track.audio_url)) {
    console.log(`Skipping (already web variant): ${trackId}`);
    return;
  }

  console.log(`Downloading source: ${track.audio_url}`);
  const srcPath = await downloadToTemp(track.audio_url);
  console.log(`Transcoding → AAC (m4a)`);
  const outPath = await transcodeToAacM4a(srcPath, track.title);
  const { webKey, webUrl } = toWebKeyFromUrl(track.audio_url);
  console.log(`Uploading web version to R2: ${webKey}`);
  await uploadToR2(webKey, outPath);

  console.log(`Updating database audio_url → ${webUrl}`);
  await executeQuery('UPDATE tracks SET audio_url = ?, audio_status = ?, updated_at = datetime("now") WHERE id = ?', [webUrl, 'ready', trackId]);

  console.log(`✅ Done: ${trackId}`);
}

async function run() {
  const { trackId, albumId, all } = parseArgs();
  if (trackId) {
    await processTrack(trackId);
    return;
  }

  let tracks: any[] = [];
  if (albumId) {
    tracks = await queryDatabase('SELECT id FROM tracks WHERE album_id = ? ORDER BY track_number', [albumId]) as any[];
  } else if (all) {
    tracks = await queryDatabase('SELECT id FROM tracks ORDER BY created_at DESC', []) as any[];
  } else {
    console.log('Usage: tsx scripts/transcode_audio_to_web.ts --track <id> | --album <albumId> | --all');
    process.exit(1);
  }

  for (const row of tracks) {
    try {
      await processTrack(row.id);
    } catch (err) {
      console.error(`❌ Failed for ${row.id}:`, err);
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});


