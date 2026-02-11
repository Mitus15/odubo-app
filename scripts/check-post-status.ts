/**
 * Check PostForMe post status
 * Usage: tsx --env-file=.env.local scripts/check-post-status.ts <post-id>
 */

import { getPost } from '../src/lib/postforme';

async function main() {
  const postId = process.argv[2];

  if (!postId) {
    console.error('Usage: tsx --env-file=.env.local scripts/check-post-status.ts <post-id>');
    process.exit(1);
  }

  console.log(`\n🔍 Checking PostForMe post: ${postId}\n`);

  try {
    const response = await getPost(postId);

    if (!response.success || !response.data) {
      console.error('❌ Failed to fetch post:');
      console.error('   Error:', response.error);
      process.exit(1);
    }

    const post = response.data;

    console.log('📊 Post Details:');
    console.log('   ID:', post.id);
    console.log('   Status:', post.status);
    console.log('   Type:', post.type);
    console.log('   Created:', post.created_at);
    console.log('   Published:', post.published_at || 'N/A');
    console.log('   Scheduled:', post.scheduled_at || 'N/A');

    // Show raw response for debugging
    console.log('\n🔍 Raw Post Data:');
    console.log(JSON.stringify(post, null, 2));

    if (post.error_message) {
      console.log('\n❌ Error Message:', post.error_message);
    }

    if (post.platforms && post.platforms.length > 0) {
      console.log('\n🌐 Per-Platform Status:');
      for (const p of post.platforms) {
        console.log(`   ${p.platform}:`);
        console.log(`      Status: ${p.status}`);
        console.log(`      URL: ${p.url || 'N/A'}`);
        console.log(`      External ID: ${p.external_id || 'N/A'}`);
        if (p.error) {
          console.log(`      ❌ Error: ${p.error}`);
        }
      }
    } else {
      console.log('\n🌐 Platform:', post.platform);
      console.log('   External URL:', post.external_url || 'N/A');
      console.log('   External ID:', post.external_id || 'N/A');
    }

    if (post.caption) {
      console.log('\n📝 Caption:', post.caption.slice(0, 100) + (post.caption.length > 100 ? '...' : ''));
    }

    if (post.media_urls && post.media_urls.length > 0) {
      console.log('\n🎬 Media URLs:');
      for (const url of post.media_urls) {
        console.log(`   ${url}`);
      }
    }

    console.log('\n✅ Done\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
