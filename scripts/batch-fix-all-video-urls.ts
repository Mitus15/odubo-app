/**
 * Batch fix ALL videos with incorrect MP4 URLs
 * Enables Stream MP4 downloads and updates database
 */

import { queryDatabase, executeQuery } from '../src/lib/db';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_STREAM_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const CUSTOMER_SUBDOMAIN = 'customer-tpkm273r1u0s40no';

interface Video {
  id: number;
  title: string;
  uid: string;
  mp4_url: string;
}

async function enableStreamMp4Download(uid: string): Promise<string | null> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_STREAM_API_TOKEN) {
    throw new Error('Missing Cloudflare credentials');
  }

  // Step 1: Request MP4 download generation
  const createResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}/downloads`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: 'default' }),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create download: ${error}`);
  }

  // Step 2: Poll for download ready status (up to 5 minutes for large files)
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s between checks

    const statusResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}/downloads`,
      {
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
        },
      }
    );

    if (!statusResponse.ok) {
      continue;
    }

    const data = await statusResponse.json() as any;
    const downloads = data.result?.default;

    if (downloads?.status === 'ready') {
      const mp4Url = `https://${CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${uid}/downloads/default.mp4`;
      return mp4Url;
    } else if (downloads?.status === 'error') {
      throw new Error('MP4 generation failed');
    }
  }

  throw new Error('Timeout waiting for MP4');
}

async function main() {
  console.log('\n🔧 BATCH FIX: Enabling Stream MP4 downloads for ALL videos\n');
  console.log('═'.repeat(80));

  // Get all videos with R2 URLs
  const videos = await queryDatabase(
    `SELECT id, title, uid, mp4_url
     FROM videos
     WHERE uid IS NOT NULL
       AND mp4_url LIKE '%media.odubo.studio/videos/source/%'
     ORDER BY id ASC`,
    []
  ) as Video[];

  if (!videos || videos.length === 0) {
    console.log('✅ No videos need fixing\n');
    return;
  }

  console.log(`Found ${videos.length} videos to fix\n`);

  let fixed = 0;
  let failed = 0;
  const errors: Array<{ id: number; title: string; error: string }> = [];

  for (const video of videos) {
    console.log(`\n[${fixed + failed + 1}/${videos.length}] Processing video ${video.id}: ${video.title}`);
    console.log(`   UID: ${video.uid}`);

    try {
      const mp4Url = await enableStreamMp4Download(video.uid);

      // Update database
      await executeQuery(
        'UPDATE videos SET mp4_url = ?, updated_at = datetime(\'now\') WHERE id = ?',
        [mp4Url, video.id]
      );

      console.log(`   ✅ Fixed: ${mp4Url}`);
      fixed++;
    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}`);
      failed++;
      errors.push({
        id: video.id,
        title: video.title,
        error: error.message,
      });
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('📊 BATCH FIX COMPLETE');
  console.log('═'.repeat(80));
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${videos.length}`);

  if (errors.length > 0) {
    console.log('\n❌ FAILED VIDEOS:');
    console.log('─'.repeat(80));
    for (const err of errors) {
      console.log(`ID ${err.id}: ${err.title}`);
      console.log(`   Error: ${err.error}`);
    }
  }

  console.log('\n✅ Done\n');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
