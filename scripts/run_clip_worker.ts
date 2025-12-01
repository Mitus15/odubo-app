#!/usr/bin/env tsx
import { queryDatabase, executeQuery, updateJobStatus } from '@/lib/db';
import { processClipJob } from '@/workers/clipProcessor';

async function claimNextJob() {
  const rows = await queryDatabase(
    `SELECT jobId, videoId, cfVideoId FROM job_status WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT 1`
  );
  if (!rows || rows.length === 0) return null;
  const row = rows[0] as any;
  // Mark RUNNING to claim
  await updateJobStatus(row.jobId, 'RUNNING', null, row.videoId, row.cfVideoId);
  return { jobId: row.jobId as string, videoId: Number(row.videoId), cfVideoId: String(row.cfVideoId) };
}

async function runOnce() {
  const job = await claimNextJob();
  if (!job) {
    console.log('[Worker Runner] No pending jobs.');
    return false;
  }
  console.log('[Worker Runner] Processing job', job.jobId);
  await processClipJob(job);
  return true;
}

async function main() {
  const watch = process.argv.includes('--watch');
  if (!watch) {
    await runOnce();
    return;
  }
  while (true) {
    const processed = await runOnce();
    if (!processed) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

main().catch((e) => {
  console.error('[Worker Runner] Fatal error:', e);
  process.exitCode = 1;
});
