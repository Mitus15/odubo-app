/**
 * Redeploy failed TikTok posts
 */
import { queryDatabase } from '../src/lib/db';
import { createPost, getAccounts } from '../src/lib/postforme';

async function main() {
  const videoIds = [425, 426, 427, 428];

  console.log('🎬 Redeploying videos to TikTok...\n');

  // Get TikTok account
  const accountsRes = await getAccounts();
  if (!accountsRes.success || !accountsRes.data) {
    console.error('❌ Failed to get accounts');
    return;
  }

  const tiktokAccount = accountsRes.data.find(a =>
    a.platform.toLowerCase().includes('tiktok') && a.status === 'connected'
  );

  if (!tiktokAccount) {
    console.error('❌ No connected TikTok account found');
    return;
  }

  console.log(`✅ Using TikTok account: @${tiktokAccount.username}\n`);

  for (const videoId of videoIds) {
    const videos = await queryDatabase(
      `SELECT id, title, mp4_url FROM videos WHERE id = ?`,
      [videoId]
    );

    if (!videos || videos.length === 0) {
      console.log(`❌ Video ${videoId} not found`);
      continue;
    }

    const video = videos[0];
    console.log(`📹 Deploying: ${video.title}`);

    if (!video.mp4_url) {
      console.log(`   ⚠️  No MP4 URL - skipping`);
      continue;
    }

    // Deploy to TikTok immediately (no scheduling)
    const result = await createPost({
      caption: video.title,
      social_accounts: [tiktokAccount.id],
      media: [{
        url: video.mp4_url,
        type: 'video'
      }],
      platform_configurations: {
        tiktok: {
          privacy_status: 'public',
          allow_comment: true,
          allow_duet: true,
          allow_stitch: true
        }
      }
    });

    if (result.success && result.data) {
      console.log(`   ✅ Posted! ID: ${result.data.id}`);
      console.log(`   Status: ${result.data.status}`);

      // Map PostForMe status to database status
      const dbStatus = result.data.status === 'processing' ? 'pending' : result.data.status;

      // Update video_deployments table
      await queryDatabase(
        `INSERT INTO video_deployments (
          video_id, platform, postforme_post_id, status, deployed_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [videoId, 'tiktok', result.data.id, dbStatus, new Date().toISOString()]
      );
      console.log(`   💾 Saved to database`);
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
    }

    console.log('');
  }

  console.log('✅ Redeployment complete!');
}

main().catch(console.error);
