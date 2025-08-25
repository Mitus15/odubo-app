// Load env early
import 'dotenv/config';

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, _Object } from '@aws-sdk/client-s3';
import path from 'node:path';
import { queryDatabase } from '@/lib/db';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

const BUCKET = requireEnv('CLOUDFLARE_R2_BUCKET_NAME');
const ENDPOINT = requireEnv('CLOUDFLARE_R2_ENDPOINT');
const ACCESS_KEY = requireEnv('CLOUDFLARE_R2_ACCESS_KEY_ID');
const SECRET_KEY = requireEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
const PUBLIC_BASE = requireEnv('CLOUDFLARE_R2_PUBLIC_URL');

const s3 = new S3Client({
  region: 'auto',
  endpoint: ENDPOINT,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

type CleanupOptions = {
  execute: boolean;
};

function urlToKey(url: string): string {
  // Strip domain to get the object key
  return url.replace(/^https?:\/\/[^/]+\//, '');
}

function isTrackAudioObjectKey(key: string): boolean {
  if (!key.includes('/tracks/')) return false;
  const ext = path.extname(key).toLowerCase().replace('.', '');
  const allowed = new Set(['m4a', 'mp3', 'aac', 'flac', 'wav', 'alac', 'ogg', 'oga', 'webm']);
  if (!allowed.has(ext)) return false;
  // Ignore preview/waveform/temp files if any
  const base = path.basename(key).toLowerCase();
  if (base.startsWith('preview_') || base.startsWith('waveform_')) return false;
  return true;
}

async function listAllObjects(prefix: string): Promise<_Object[]> {
  const out: _Object[] = [];
  let ContinuationToken: string | undefined = undefined;
  do {
    const res: any = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken }));
    if (res.Contents) out.push(...res.Contents);
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return out;
}

async function main() {
  const execute = process.argv.includes('--execute');
  const options: CleanupOptions = { execute };

  // Build set of referenced audio keys from DB
  const rows = (await queryDatabase('SELECT audio_url FROM tracks WHERE audio_url IS NOT NULL AND audio_url != ""', [])) as any[];
  const referenced = new Set<string>();
  for (const row of rows) {
    const key = urlToKey(row.audio_url as string);
    referenced.add(key);
  }

  // List all audio objects under music/albums
  const objects = await listAllObjects('music/albums/');
  const candidates: string[] = [];
  for (const obj of objects) {
    const key = obj.Key || '';
    if (!isTrackAudioObjectKey(key)) continue;
    if (!referenced.has(key)) {
      // Avoid deleting new web versions that may not be committed yet
      if (key.endsWith('.web.m4a')) {
        // Keep web variants regardless; they should be referenced by DB soon
        continue;
      }
      candidates.push(key);
    }
  }

  if (!candidates.length) {
    console.log('No unreferenced audio files found.');
    return;
  }

  console.log(`Found ${candidates.length} unreferenced audio objects:`);
  for (const k of candidates) console.log(' -', k);

  if (!options.execute) {
    console.log('\nDry-run complete. Run with --execute to delete.');
    return;
  }

  // Batch delete in chunks of 1000 (S3 limit is 1000 keys per DeleteObjects)
  const chunkSize = 950;
  for (let i = 0; i < candidates.length; i += chunkSize) {
    const keys = candidates.slice(i, i + chunkSize).map((Key) => ({ Key }));
    await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys } }));
    console.log(`Deleted ${keys.length} objects`);
  }

  console.log('Cleanup complete.');
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});


