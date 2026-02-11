/**
 * Reset stuck videos to retry MP4 processing
 * Useful if videos get stuck due to temporary issues
 */

import { queryDatabase, executeQuery } from '../src/lib/db';

async function main() {
  console.log('\n🔄 Reset Stuck Videos\n');

  // Find videos stuck in processing for > 30 minutes
  const stuck = await queryDatabase(
    `SELECT id, title, mp4_processing_started_at
     FROM videos
     WHERE mp4_processing_status = 'processing'
       AND mp4_processing_started_at IS NOT NULL
       AND (julianday('now') - julianday(mp4_processing_started_at)) * 86400000 > ?`,
    [30 * 60 * 1000] // 30 minutes
  ) as Array<{ id: number; title: string; mp4_processing_started_at: string }>;

  if (stuck.length === 0) {
    console.log('✅ No stuck videos found\n');
    return;
  }

  console.log(`Found ${stuck.length} stuck videos:\n`);
  stuck.forEach(v => {
    const elapsed = Math.round((Date.now() - new Date(v.mp4_processing_started_at).getTime()) / 60000);
    console.log(`  • [ID ${v.id}] ${v.title} (stuck for ${elapsed}m)`);
  });

  console.log('\nResetting to pending status...\n');

  // Reset to pending
  await executeQuery(
    `UPDATE videos
     SET mp4_processing_status = 'pending',
         mp4_processing_started_at = NULL,
         mp4_processing_retry_count = 0,
         mp4_processing_error = NULL
     WHERE mp4_processing_status = 'processing'
       AND mp4_processing_started_at IS NOT NULL
       AND (julianday('now') - julianday(mp4_processing_started_at)) * 86400000 > ?`,
    [30 * 60 * 1000]
  );

  console.log('✅ Reset complete. Videos will be retried by background job.\n');
}

main().catch(console.error);
