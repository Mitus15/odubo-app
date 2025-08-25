/*
  One-off migration: copy R2 video URLs into Cloudflare Stream and update DB to embed Stream.
  - Reads env from .env.local when run with ts-node or tsx.
  - Only updates rows whose url is NOT already a Cloudflare Stream URL.
  - Minimal logging; no UI changes.
*/

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// IMPORTANT: use dynamic imports so env is loaded BEFORE these modules read process.env
const { default: CloudflareStreamAPI } = await import('../src/lib/cloudflareStream');
const { queryDatabase, executeQuery } = await import('../src/lib/db');

function isCloudflareStreamUrl(url: string): boolean {
  return /(?:^|\.)videodelivery\.net|cloudflarestream\.com|(?:^|\.)iframe\.videodelivery\.net/.test(url);
}

async function migrate() {
  const stream = new CloudflareStreamAPI();
  console.log('Starting migration to Cloudflare Stream...');

  const videos: Array<{ id: number; url: string; poster_url?: string | null }> = await queryDatabase(
    'SELECT id, url, poster_url FROM videos ORDER BY id ASC'
  );

  let migrated = 0;
  for (const v of videos) {
    const { id, url, poster_url } = v;
    if (!url || isCloudflareStreamUrl(url)) {
      continue; // already Stream or empty
    }

    // NOTE: If your R2 objects are private, generate a temporary presigned URL per object.
    const sourceUrl = url;
    try {
      console.log(`→ Copying video ${id} from ${sourceUrl}`);
      const res = await stream.uploadFromUrl(sourceUrl, {
        name: `video-${id}`,
        // Set allowed origins if you want to restrict playback
        // allowedOrigins: ['https://your-domain.com'],
        // requireSignedURLs: false,
      });
      const uid = res.result.uid;

      // Optionally wait until ready. Comment out for async processing.
      // await stream.waitForVideoReady(uid, { pollInterval: 3000 });

      const embedUrl = `https://iframe.videodelivery.net/${uid}`;
      const poster = poster_url || `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;
      await executeQuery('UPDATE videos SET url = ?, poster_url = ? WHERE id = ?', [embedUrl, poster, id]);
      migrated++;
      console.log(`✓ Migrated ${id} -> ${uid}`);
    } catch (err) {
      console.error(`✗ Failed to migrate ${id}:`, err);
    }
  }

  console.log(`Done. Migrated ${migrated} videos.`);
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});


