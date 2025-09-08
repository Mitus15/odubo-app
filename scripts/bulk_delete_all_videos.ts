#!/usr/bin/env tsx

/**
 * Bulk delete all videos from DB and storage (R2 + Stream where possible).
 * SAFE: requires --execute flag; otherwise prints what it would do.
 */

import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

import { queryDatabase, executeQuery } from '../src/lib/db.js';
import { deleteFile as deleteR2File } from '../src/worker/upload.js';

async function main() {
  const execute = process.argv.includes('--execute');
  console.log(`\n🚨 Bulk delete videos (${execute ? 'EXECUTE' : 'DRY RUN'})`);

  const rows = await queryDatabase('SELECT id, url, poster_url, thumbnail FROM videos ORDER BY id ASC');
  console.log(`Found ${rows.length} videos`);

  // Try to lazy-import Stream API; if not configured, skip
  let stream: any = null;
  try {
    const { default: CloudflareStreamAPI } = await import('../src/lib/cloudflareStream.js');
    stream = new CloudflareStreamAPI();
  } catch {
    console.log('Cloudflare Stream not configured; will skip Stream deletions');
  }

  const extractKeyFromUrl = (url: string): string | null => {
    if (!url) return null;
    const base = process.env.CLOUDFLARE_R2_PUBLIC_URL || '';
    if (base && url.startsWith(`${base}/`)) return url.substring(base.length + 1);
    if (url.startsWith('https://media.odubo.studio/')) return url.replace('https://media.odubo.studio/', '');
    if (!url.startsWith('http')) return url;
    const parts = url.split('/');
    return parts[parts.length - 1] || null;
  };

  let deleted = 0;
  for (const v of rows) {
    const videoUrl: string = v.url || '';
    const posterUrl: string = v.poster_url || v.thumbnail || '';

    console.log(`\n• Video ${v.id}`);

    // Try delete from Stream if url is a stream embed
    try {
      if (stream && /iframe\.videodelivery\.net\/.+/.test(videoUrl)) {
        const uid = videoUrl.split('/').pop();
        if (uid) {
          console.log(`  Stream: delete ${uid}`);
          if (execute) await stream.deleteVideo(uid);
        }
      }
    } catch (e) {
      console.warn('  Stream delete failed (non-fatal):', e);
    }

    // Try delete R2 objects
    for (const url of [videoUrl, posterUrl]) {
      const key = extractKeyFromUrl(url);
      if (key) {
        console.log(`  R2: delete ${key}`);
        if (execute) {
          const res = await deleteR2File(key);
          if (!res.success) console.warn('   R2 delete failed:', res.error);
        }
      }
    }

    // Delete DB row
    console.log(`  DB: delete video id=${v.id}`);
    if (execute) await executeQuery('DELETE FROM videos WHERE id = ?', [v.id]);
    deleted++;
  }

  console.log(`\n✅ Completed. ${execute ? 'Deleted' : 'Would delete'} ${deleted} videos.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}


