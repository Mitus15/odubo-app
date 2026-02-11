/**
 * Fix video MP4 URL by enabling Stream downloads
 * Usage: npx tsx --env-file=.env.local scripts/fix-video-mp4-url.ts <video-id>
 */

import { queryDatabase, executeQuery } from '../src/lib/db';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_STREAM_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const CLOUDFLARE_CUSTOMER_SUBDOMAIN = process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN;

async function enableStreamMp4Download(uid: string): Promise<string | null> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_STREAM_API_TOKEN) {
    throw new Error('Missing Cloudflare credentials');
  }

  console.log(`\n📥 Enabling MP4 downloads for Stream UID: ${uid}`);

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
    console.error('❌ Failed to create download:', error);
    return null;
  }

  console.log('✅ MP4 download generation requested');

  // Step 2: Poll for download ready status
  console.log('⏳ Waiting for MP4 to be ready...');

  for (let i = 0; i < 60; i++) { // Poll for up to 3 minutes
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds between checks

    const statusResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}/downloads`,
      {
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
        },
      }
    );

    if (!statusResponse.ok) {
      console.error('❌ Failed to check download status');
      continue;
    }

    const data = await statusResponse.json() as any;
    const downloads = data.result?.default;

    if (downloads?.status === 'ready') {
      const mp4Url = `https://${CLOUDFLARE_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${uid}/downloads/default.mp4`;
      console.log(`✅ MP4 ready: ${mp4Url}`);
      return mp4Url;
    } else if (downloads?.status === 'error') {
      console.error('❌ MP4 generation failed');
      return null;
    } else {
      console.log(`   Status: ${downloads?.status || 'pending'}... (${i + 1}/60)`);
    }
  }

  console.error('❌ Timeout waiting for MP4');
  return null;
}

async function main() {
  const videoId = process.argv[2];

  if (!videoId) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/fix-video-mp4-url.ts <video-id>');
    process.exit(1);
  }

  console.log(`\n🔧 Fixing MP4 URL for video ID: ${videoId}\n`);

  // Get video details
  const videos = await queryDatabase(
    'SELECT id, title, uid, mp4_url FROM videos WHERE id = ?',
    [videoId]
  ) as any[];

  if (!videos || videos.length === 0) {
    console.error('❌ Video not found');
    process.exit(1);
  }

  const video = videos[0];
  console.log(`📹 Video: ${video.title}`);
  console.log(`   Stream UID: ${video.uid}`);
  console.log(`   Current MP4 URL: ${video.mp4_url || 'MISSING'}`);

  if (!video.uid) {
    console.error('❌ Video has no Stream UID');
    process.exit(1);
  }

  // Check if it already has a Stream MP4 download URL
  if (video.mp4_url && video.mp4_url.includes('cloudflarestream.com') && video.mp4_url.includes('/downloads/')) {
    console.log('\n✅ Video already has a valid Stream MP4 download URL');
    process.exit(0);
  }

  // Enable Stream MP4 download
  const mp4Url = await enableStreamMp4Download(video.uid);

  if (!mp4Url) {
    console.error('\n❌ Failed to generate MP4 download URL');
    process.exit(1);
  }

  // Update database
  console.log('\n💾 Updating database...');
  await executeQuery(
    'UPDATE videos SET mp4_url = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [mp4Url, videoId]
  );

  console.log('✅ Database updated successfully');
  console.log(`\n🎉 Video ${videoId} fixed! MP4 URL: ${mp4Url}\n`);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
