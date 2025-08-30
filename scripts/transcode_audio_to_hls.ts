// Load env first
import 'dotenv/config';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { queryDatabase, executeQuery } from '@/lib/db';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

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

function toHlsKeyFromUrl(url: string): { baseDirKey: string; masterKey: string; webBaseName: string; webDir: string; masterUrl: string } {
  // url: https://media.domain/dir/name.web.m4a
  const key = url.replace(/^https?:\/\/[^/]+\//, '');
  const parsed = path.parse(key); // { dir, name, ext }
  const nameNoExt = parsed.name; // could be name.web
  const baseName = nameNoExt.endsWith('.web') ? nameNoExt.slice(0, -4) : nameNoExt;
  const webBaseName = baseName; // normalize
  const webDir = path.join(parsed.dir, `${webBaseName}.hls`).replace(/\\/g, '/');
  const baseDirKey = webDir; // directory to hold segments and master
  const masterKey = path.join(webDir, 'master.m3u8').replace(/\\/g, '/');
  const masterUrl = `${R2_PUBLIC}/${masterKey}`;
  return { baseDirKey, masterKey, webBaseName, webDir, masterUrl };
}

async function uploadR2(key: string, body: Buffer | string, contentType: string) {
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: typeof body === 'string' ? Buffer.from(body) : body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

function resolveFfmpegBinary(): string {
  const fromEnv = process.env.FFMPEG_PATH;
  if (fromEnv && (existsSync(fromEnv) || fromEnv === 'ffmpeg')) return fromEnv;
  if (ffmpegStatic && typeof ffmpegStatic === 'string' && existsSync(ffmpegStatic)) return ffmpegStatic;
  if (ffmpegInstaller && ffmpegInstaller.path && existsSync(ffmpegInstaller.path)) return ffmpegInstaller.path;
  // Fall back to system ffmpeg in PATH
  return 'ffmpeg';
}

async function transcodeToHlsVariants(srcPath: string, workDir: string) {
  await fs.mkdir(workDir, { recursive: true });
  const ffmpegBin = resolveFfmpegBinary();
  console.log(`Using ffmpeg: ${ffmpegBin}`);

  // Variants: 64k, 128k, 256k AAC LC
  const variants = [
    { name: '64k', bitrate: '64k' },
    { name: '128k', bitrate: '128k' },
    { name: '256k', bitrate: '256k' },
  ];

  const maps: string[] = [];
  const args: string[] = [
    '-y',
    '-i', srcPath,
    '-vn',
  ];

  variants.forEach((v, i) => {
    args.push(
      '-map', '0:a:0',
      '-c:a', 'aac',
      '-profile:a', 'aac_low',
      '-b:a', v.bitrate,
      '-ar', '44100',
      '-ac', '2',
    );
  });

  // HLS settings per variant
  const hlsTime = '6';
  const hlsFlags = 'independent_segments+delete_segments';
  const hlsListSize = '0';
  const segmentFilename = path.join(workDir, 'seg_%v_%03d.aac');
  const playlistFilename = path.join(workDir, 'v%v.m3u8');

  args.push(
    '-f', 'hls',
    '-hls_time', hlsTime,
    '-hls_playlist_type', 'vod',
    '-hls_flags', hlsFlags,
    '-hls_list_size', hlsListSize,
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', variants.map((_v, i) => `a:${i},name:${i}`).join(' '),
    '-hls_segment_filename', segmentFilename,
    playlistFilename,
  );

  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegBin as string, args, { stdio: 'inherit' });
    p.on('error', reject);
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)));
  });

  return { variants };
}

async function processTrack(trackId: string) {
  const rows = await queryDatabase('SELECT id, title, audio_url FROM tracks WHERE id = ? LIMIT 1', [trackId]);
  if (!rows || (rows as any[]).length === 0) throw new Error(`Track not found: ${trackId}`);
  const track = (rows as any[])[0];
  if (!track.audio_url) throw new Error(`Track has no audio_url: ${trackId}`);

  const { baseDirKey, masterKey, masterUrl } = toHlsKeyFromUrl(track.audio_url);

  // Download source
  const srcPath = await downloadToTemp(track.audio_url);

  // Transcode into temp dir structure
  const workDir = path.join(os.tmpdir(), `odubo_hls_${trackId}_${Date.now()}`);
  await transcodeToHlsVariants(srcPath, workDir);

  // Upload playlists and segments
  const entries = await fs.readdir(workDir);
  for (const entry of entries) {
    const filePath = path.join(workDir, entry);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) continue;
    const key = path.join(baseDirKey, entry).replace(/\\/g, '/');
    const buf = await fs.readFile(filePath);
    const contentType = entry.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'audio/aac';
    await uploadR2(key, buf, contentType);
  }

  // Optionally, update track to mark as ready (keep progressive url as-is). hls_url is derived on read.
  await executeQuery('UPDATE tracks SET updated_at = datetime("now") WHERE id = ?', [trackId]);

  console.log(`✅ HLS uploaded: ${masterUrl}`);
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
    console.log('Usage: tsx scripts/transcode_audio_to_hls.ts --track <id> | --album <albumId> | --all');
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


