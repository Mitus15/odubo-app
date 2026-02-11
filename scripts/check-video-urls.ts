/**
 * Check video URLs in database
 * Usage: npx tsx --env-file=.env.local scripts/check-video-urls.ts <search-term>
 */

import { queryDatabase } from '../src/lib/db';

async function main() {
  const searchTerm = process.argv[2] || 'Pinnochio';

  console.log(`\n🔍 Searching for videos matching: ${searchTerm}\n`);

  const videos = await queryDatabase(
    `SELECT
      id,
      title,
      uid,
      mp4_url,
      url as stream_url,
      postforme_post_id,
      postforme_status,
      youtube_url,
      youtube_shorts_url,
      created_at
     FROM videos
     WHERE title LIKE ?
     ORDER BY created_at DESC
     LIMIT 5`,
    [`%${searchTerm}%`]
  ) as any[];

  if (!videos || videos.length === 0) {
    console.log('❌ No videos found\n');
    process.exit(0);
  }

  for (const video of videos) {
    console.log('─'.repeat(80));
    console.log(`📹 ${video.title}`);
    console.log(`   ID: ${video.id}`);
    console.log(`   Created: ${video.created_at}`);
    console.log(`   Stream UID: ${video.uid || '❌ MISSING'}`);
    console.log(`   PostForMe ID: ${video.postforme_post_id || 'N/A'}`);
    console.log(`   PostForMe Status: ${video.postforme_status || 'N/A'}`);
    console.log();
    console.log(`   MP4 URL: ${video.mp4_url || '❌ MISSING'}`);
    console.log(`   Stream URL: ${video.stream_url || 'N/A'}`);
    console.log();
    console.log(`   YouTube: ${video.youtube_url || video.youtube_shorts_url || 'N/A'}`);
    console.log();
  }

  console.log('─'.repeat(80));
  console.log('\n✅ Done\n');
}

main().catch(console.error);
