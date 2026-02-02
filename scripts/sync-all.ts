#!/usr/bin/env tsx
/**
 * Orchestrate full sync: videos first, then AI descriptions in background
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';

async function runSync() {
  console.log('🌊 Odubo Full Sync Starting...\n');
  console.log('================================================\n');

  // Step 1: Sync videos
  console.log('📥 Step 1: Syncing videos from Cloudflare Stream\n');
  
  const syncProcess = spawn('tsx', ['--env-file=.env.local', 'scripts/sync-cloudflare-videos.ts'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  await new Promise<void>((resolve, reject) => {
    syncProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Sync process exited with code ${code}`));
      }
    });
    syncProcess.on('error', reject);
  });

  // Step 2: Spawn AI processing in background
  console.log('\n🤖 Step 2: Starting AI description generation (background)\n');
  console.log('================================================\n');

  const logPath = path.join(process.cwd(), 'tmp', `ai-process-${Date.now()}.log`);
  const logStream = writeFileSync(logPath, '', { flag: 'w' });

  const aiProcess = spawn('tsx', ['--env-file=.env.local', 'scripts/process-ai-descriptions.ts'], {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(),
  });

  aiProcess.unref();

  console.log(`✅ Sync complete! AI processing running in background.`);
  console.log(`   Check logs at: ${logPath}\n`);
}

// Run
runSync().catch((error) => {
  console.error('❌ Sync failed:', error);
  process.exit(1);
});
