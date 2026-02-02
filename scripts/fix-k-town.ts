import 'dotenv/config';
import { queryDatabase, executeQuery } from '../src/lib/db';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN!;

async function getVideoFromCloudflare(searchTerm: string) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream?search=${encodeURIComponent(searchTerm)}`,
    {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    }
  );
  
  const data = await response.json() as any;
  return data.result || [];
}

async function fixVideo407() {
  console.log('Finding K-Town video on Cloudflare Stream...');
  
  const cloudflareVideos = await getVideoFromCloudflare('K-Town');
  
  if (cloudflareVideos.length === 0) {
    console.log('No videos found on Cloudflare');
    return;
  }
  
  console.log(`Found ${cloudflareVideos.length} video(s) on Cloudflare`);
  
  // Get the most recent one
  const video = cloudflareVideos[0];
  const uid = video.uid;
  
  console.log(`\nCloudflare Video UID: ${uid}`);
  console.log(`Name: ${video.meta?.name || 'N/A'}`);
  console.log(`Created: ${video.created}`);
  
  // Update database
  const posterUrl = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;
  
  await executeQuery(
    `UPDATE videos SET uid = ?, poster_url = ? WHERE id = 407`,
    [uid, posterUrl]
  );
  
  console.log(`\n✅ Updated video 407 with UID: ${uid}`);
  console.log(`Poster URL: ${posterUrl}`);
}

fixVideo407().catch(console.error);
