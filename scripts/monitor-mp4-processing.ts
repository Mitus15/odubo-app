/**
 * Monitor MP4 Processing Status
 * Shows which videos are still processing and alerts for stuck videos
 */

import { queryDatabase } from '../src/lib/db';

interface Video {
  id: number;
  title: string;
  uid: string;
  mp4_processing_status: string;
  mp4_processing_started_at: string | null;
  mp4_processing_last_checked_at: string | null;
  mp4_processing_retry_count: number;
  mp4_processing_error: string | null;
  created_at: string;
}

async function main() {
  console.log('\n🎬 MP4 Processing Status Monitor\n');
  console.log('═'.repeat(80));

  // Get status summary
  const summary = await queryDatabase(
    `SELECT
       mp4_processing_status,
       COUNT(*) as count
     FROM videos
     WHERE uid IS NOT NULL
     GROUP BY mp4_processing_status`,
    []
  ) as Array<{ mp4_processing_status: string; count: number }>;

  console.log('📊 Status Summary:');
  console.log('─'.repeat(80));
  summary.forEach(s => {
    const emoji = s.mp4_processing_status === 'ready' ? '✅' :
                  s.mp4_processing_status === 'processing' ? '⏳' :
                  s.mp4_processing_status === 'failed' ? '❌' : '⏸️';
    console.log(`${emoji} ${s.mp4_processing_status.toUpperCase()}: ${s.count} videos`);
  });

  // Get processing videos
  const processing = await queryDatabase(
    `SELECT
       id, title, uid,
       mp4_processing_status,
       mp4_processing_started_at,
       mp4_processing_last_checked_at,
       mp4_processing_retry_count,
       created_at
     FROM videos
     WHERE mp4_processing_status = 'processing'
     ORDER BY mp4_processing_started_at ASC`,
    []
  ) as Video[];

  if (processing.length > 0) {
    console.log('\n⏳ Currently Processing:');
    console.log('─'.repeat(80));
    processing.forEach(v => {
      const started = v.mp4_processing_started_at ? new Date(v.mp4_processing_started_at) : null;
      const elapsed = started ? Math.round((Date.now() - started.getTime()) / 60000) : 0;
      const status = elapsed > 30 ? '🔴 STUCK' : elapsed > 10 ? '🟡 SLOW' : '🟢 OK';

      console.log(`${status} [ID ${v.id}] ${v.title}`);
      console.log(`    Started: ${started?.toLocaleString() || 'N/A'} (${elapsed}m ago)`);
      console.log(`    Retries: ${v.mp4_processing_retry_count}`);
      console.log(`    UID: ${v.uid}`);
      console.log();
    });
  }

  // Get failed videos
  const failed = await queryDatabase(
    `SELECT
       id, title, uid,
       mp4_processing_error,
       mp4_processing_retry_count,
       created_at
     FROM videos
     WHERE mp4_processing_status = 'failed'
     ORDER BY created_at DESC
     LIMIT 10`,
    []
  ) as Video[];

  if (failed.length > 0) {
    console.log('❌ Recently Failed:');
    console.log('─'.repeat(80));
    failed.forEach(v => {
      console.log(`[ID ${v.id}] ${v.title}`);
      console.log(`    Error: ${v.mp4_processing_error || 'Unknown'}`);
      console.log(`    Retries: ${v.mp4_processing_retry_count}`);
      console.log(`    UID: ${v.uid}`);
      console.log();
    });
  }

  // Get pending videos
  const pending = await queryDatabase(
    `SELECT COUNT(*) as count
     FROM videos
     WHERE mp4_processing_status = 'pending'`,
    []
  ) as Array<{ count: number }>;

  if (pending[0]?.count > 0) {
    console.log(`⏸️  Pending: ${pending[0].count} videos waiting to be processed`);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('💡 Commands:');
  console.log('   npm run mp4:backfill          - Process all pending/failed videos');
  console.log('   npm run mp4:monitor           - Run this monitor');
  console.log('   npm run mp4:reset-stuck       - Reset stuck videos to retry');
  console.log('\n');
}

main().catch(console.error);
