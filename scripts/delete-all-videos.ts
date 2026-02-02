#!/usr/bin/env tsx
/**
 * Delete all videos from Cloudflare Stream and database
 * Nuclear option - clears everything for fresh start
 */

import 'dotenv/config';
import { executeQuery } from '../src/lib/db';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN!;

interface CloudflareVideo {
  uid: string;
  meta: { name?: string };
}

interface CloudflareResponse {
  result: CloudflareVideo[];
  result_info?: { cursor?: string };
  success: boolean;
}

async function fetchAllVideos(): Promise<CloudflareVideo[]> {
  const allVideos: CloudflareVideo[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`);
    if (cursor) url.searchParams.set('after', cursor);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
    });

    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    const data: CloudflareResponse = await response.json();
    if (!data.success) throw new Error('API returned success: false');

    allVideos.push(...data.result);
    cursor = data.result_info?.cursor;
    console.log(`  Fetched ${data.result.length} videos (total: ${allVideos.length})`);
  } while (cursor);

  return allVideos;
}

async function deleteVideo(uid: string): Promise<boolean> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
    }
  );
  return response.ok;
}

async function main() {
  console.log('🗑️  DELETING ALL VIDEOS FROM CLOUDFLARE STREAM AND DATABASE\n');
  console.log('⚠️  This will delete EVERYTHING. Press Ctrl+C to cancel...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('================================================\n');
  console.log('🔍 Fetching all videos...\n');
  
  const videos = await fetchAllVideos();
  console.log(`\n📹 Found ${videos.length} videos to delete\n`);

  if (videos.length === 0) {
    console.log('✅ No videos to delete\n');
    return;
  }

  console.log('🗑️  Deleting from Cloudflare Stream...\n');
  let deletedCount = 0;

  for (const video of videos) {
    const name = video.meta.name || 'Untitled';
    console.log(`   Deleting: "${name}" (${video.uid})`);
    
    const deleted = await deleteVideo(video.uid);
    if (deleted) deletedCount++;
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n   ✓ Deleted ${deletedCount} videos from Cloudflare Stream\n`);
  
  console.log('🗑️  Clearing database...\n');
  await executeQuery('DELETE FROM videos', []);
  console.log('   ✓ Cleared all video records from database\n');
  
  console.log('================================================');
  console.log('✅ All videos deleted! Ready for fresh upload.\n');
}

main().catch(error => {
  console.error('❌ Deletion failed:', error);
  process.exit(1);
});
