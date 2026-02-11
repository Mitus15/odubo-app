/**
 * Audit ALL videos to find those with incorrect MP4 URLs
 */

import { queryDatabase } from '../src/lib/db';

async function main() {
  console.log('\n🔍 Auditing ALL videos for MP4 URL issues...\n');

  // Get all videos with their MP4 URLs
  const videos = await queryDatabase(
    `SELECT
      id,
      title,
      uid,
      mp4_url,
      created_at
     FROM videos
     WHERE uid IS NOT NULL
     ORDER BY created_at DESC`,
    []
  ) as any[];

  if (!videos || videos.length === 0) {
    console.log('❌ No videos found\n');
    return;
  }

  const issues: any[] = [];
  const correct: any[] = [];
  const missing: any[] = [];

  for (const video of videos) {
    if (!video.mp4_url) {
      missing.push(video);
    } else if (video.mp4_url.includes('media.odubo.studio/videos/source/')) {
      // R2 URL - WRONG
      issues.push({
        ...video,
        issue: 'R2 URL (should be Stream download URL)',
      });
    } else if (video.mp4_url.includes('cloudflarestream.com') && video.mp4_url.includes('/downloads/')) {
      // Stream download URL - CORRECT
      correct.push(video);
    } else {
      // Unknown format
      issues.push({
        ...video,
        issue: 'Unknown URL format',
      });
    }
  }

  console.log('═'.repeat(80));
  console.log('📊 AUDIT SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total videos: ${videos.length}`);
  console.log(`✅ Correct Stream URLs: ${correct.length}`);
  console.log(`❌ Incorrect URLs: ${issues.length}`);
  console.log(`⚠️  Missing URLs: ${missing.length}`);
  console.log();

  if (issues.length > 0) {
    console.log('❌ VIDEOS WITH INCORRECT URLs:');
    console.log('─'.repeat(80));
    for (const video of issues) {
      console.log(`ID ${video.id}: ${video.title}`);
      console.log(`   Created: ${video.created_at}`);
      console.log(`   UID: ${video.uid}`);
      console.log(`   Issue: ${video.issue}`);
      console.log(`   Current URL: ${video.mp4_url}`);
      console.log();
    }
  }

  if (missing.length > 0) {
    console.log('⚠️  VIDEOS WITH MISSING MP4 URLs:');
    console.log('─'.repeat(80));
    for (const video of missing) {
      console.log(`ID ${video.id}: ${video.title}`);
      console.log(`   Created: ${video.created_at}`);
      console.log(`   UID: ${video.uid}`);
      console.log();
    }
  }

  // Focus on recent uploads (after the supposed fix on 2026-02-07)
  const recentIssues = issues.filter(v => v.created_at >= '2026-02-07');
  if (recentIssues.length > 0) {
    console.log('═'.repeat(80));
    console.log('🚨 CRITICAL: RECENT UPLOADS WITH ISSUES (after 2026-02-07):');
    console.log('═'.repeat(80));
    for (const video of recentIssues) {
      console.log(`ID ${video.id}: ${video.title} (${video.created_at})`);
    }
    console.log();
  }

  console.log('═'.repeat(80));
  console.log(`\n💾 To fix all ${issues.length} videos, run:`);
  console.log('   npm run mp4:backfill\n');
}

main().catch(console.error);
