import { queryDatabase } from '../src/lib/db';

async function findTikTokFailures() {
  console.log('🔍 Finding videos deployed to Instagram + YouTube but failed on TikTok...\n');

  // Get recent deployments (last 2 days)
  const allDeploys = await queryDatabase(
    `SELECT video_id, platform, status, external_url
     FROM video_deployments
     WHERE deployed_at >= '2026-02-12'
     ORDER BY video_id, platform`,
    []
  );

  // Group by video_id
  const byVideo = new Map();
  for (const d of allDeploys) {
    if (!byVideo.has(d.video_id)) {
      byVideo.set(d.video_id, {});
    }
    const platforms = byVideo.get(d.video_id);
    platforms[d.platform] = {
      status: d.status,
      external_url: d.external_url
    };
  }

  const failedVideos = [];

  for (const [videoId, platforms] of byVideo.entries()) {
    const hasYoutube = platforms.youtube && platforms.youtube.external_url;
    const hasInstagram = platforms.instagram && platforms.instagram.external_url;
    const tiktokNoUrl = platforms.tiktok && !platforms.tiktok.external_url;

    if ((hasYoutube || hasInstagram) && tiktokNoUrl) {
      failedVideos.push(videoId);
    }
  }

  console.log(`❌ Found ${failedVideos.length} videos where TikTok failed\n`);

  if (failedVideos.length === 0) {
    console.log('✅ No TikTok failures found!');
    return;
  }

  // Get video details
  const placeholders = failedVideos.map(() => '?').join(',');
  const videos = await queryDatabase(
    `SELECT id, title FROM videos WHERE id IN (${placeholders})`,
    failedVideos
  );

  console.log('📹 Videos to redeploy to TikTok:');
  videos.forEach(v => {
    console.log(`   - ID ${v.id}: ${v.title}`);
  });

  console.log(`\n✅ Video IDs: [${failedVideos.join(', ')}]`);
}

findTikTokFailures().catch(console.error);
