/**
 * Extract customer subdomain from a working video
 */

import { queryDatabase } from '../src/lib/db';

async function main() {
  const videos = await queryDatabase(
    `SELECT mp4_url FROM videos WHERE mp4_url LIKE '%customer-%' LIMIT 1`,
    []
  ) as any[];

  if (videos && videos.length > 0 && videos[0].mp4_url) {
    const match = videos[0].mp4_url.match(/https:\/\/(customer-[^.]+)\.cloudflarestream\.com/);
    if (match) {
      console.log(match[1]);
    } else {
      console.log('No match found');
    }
  } else {
    console.log('No videos found with customer subdomain');
  }
}

main().catch(console.error);
