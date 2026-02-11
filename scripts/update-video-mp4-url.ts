/**
 * Update video MP4 URL with correct subdomain
 */

import { executeQuery } from '../src/lib/db';

const videoId = 438;
const uid = '462ef7147819d19406c41eaa44882daa';
const subdomain = 'customer-tpkm273r1u0s40no';
const correctUrl = `https://${subdomain}.cloudflarestream.com/${uid}/downloads/default.mp4`;

async function main() {
  console.log(`Updating video ${videoId} with correct MP4 URL:`);
  console.log(correctUrl);

  await executeQuery(
    'UPDATE videos SET mp4_url = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [correctUrl, videoId]
  );

  console.log('✅ Updated successfully');
}

main().catch(console.error);
