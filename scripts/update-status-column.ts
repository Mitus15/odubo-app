/**
 * Update mp4_processing_status for all videos with correct URLs
 */
import { executeQuery } from '../src/lib/db';

async function main() {
  console.log('Updating mp4_processing_status for videos with Stream URLs...');

  const result = await executeQuery(
    `UPDATE videos
     SET mp4_processing_status = 'ready'
     WHERE mp4_url LIKE '%cloudflarestream.com%downloads%'
       AND (mp4_processing_status IS NULL OR mp4_processing_status != 'ready')`,
    []
  );

  console.log(`✅ Updated ${(result as any)?.changes || 0} videos to 'ready' status`);
}

main().catch(console.error);
