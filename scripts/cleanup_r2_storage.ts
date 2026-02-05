/**
 * R2 Storage Cleanup Script
 * 
 * Cleans up orphaned files and reorganizes gallery folders.
 * 
 * Run: tsx --env-file=.env.local scripts/cleanup_r2_storage.ts [--dry-run]
 */

import { createStorageService } from '../src/lib/storage';
import { queryDatabase, executeQuery } from '../src/lib/db';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const DRY_RUN = process.argv.includes('--dry-run');
const YES_FLAG = process.argv.includes('--yes');

interface CleanupLog {
  timestamp: string;
  dryRun: boolean;
  deleted: string[];
  moved: Array<{ from: string; to: string }>;
  errors: Array<{ operation: string; key: string; error: string }>;
  summary: {
    totalDeleted: number;
    totalMoved: number;
    spaceSavedMB: number;
  };
}

const log: CleanupLog = {
  timestamp: new Date().toISOString(),
  dryRun: DRY_RUN,
  deleted: [],
  moved: [],
  errors: [],
  summary: {
    totalDeleted: 0,
    totalMoved: 0,
    spaceSavedMB: 0,
  },
};

async function askConfirmation(message: string): Promise<boolean> {
  if (YES_FLAG) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function main() {
  console.log('🧹 R2 Storage Cleanup Script\n');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no actual deletions)' : '🔥 LIVE (will delete files)'}\n`);

  const storage = createStorageService();

  // ============================================================================
  // STEP 1: Gallery Folder Reorganization (test-event → catching-light)
  // ============================================================================
  console.log('📂 Step 1: Reorganizing gallery folders...\n');

  // Find all files in galleries/test-event/
  const testEventFiles = await storage.listR2('galleries/test-event/');
  console.log(`Found ${testEventFiles.length} files in galleries/test-event/`);

  if (testEventFiles.length > 0) {
    console.log('Will move to: galleries/catching-light/\n');

    for (const file of testEventFiles) {
      const newKey = file.key.replace('galleries/test-event/', 'galleries/catching-light/');
      
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would move: ${file.key} → ${newKey}`);
        log.moved.push({ from: file.key, to: newKey });
      } else {
        try {
          const result = await storage.moveInR2(file.key, newKey);
          if (result.success) {
            console.log(`  ✅ Moved: ${file.key} → ${newKey}`);
            log.moved.push({ from: file.key, to: newKey });
            log.summary.totalMoved++;
          } else {
            console.error(`  ❌ Failed: ${file.key} - ${result.error}`);
            log.errors.push({ operation: 'move', key: file.key, error: result.error || 'Unknown' });
          }
        } catch (error) {
          console.error(`  ❌ Error: ${file.key} - ${error}`);
          log.errors.push({ operation: 'move', key: file.key, error: String(error) });
        }
      }
    }

    // Update database gallery_photos table
    if (!DRY_RUN && log.moved.length > 0) {
      console.log('\n📝 Updating database references...');
      try {
        const galleryPhotos = await queryDatabase(
          "SELECT id, r2_key FROM gallery_photos WHERE r2_key LIKE 'galleries/test-event/%'"
        );

        for (const photo of galleryPhotos) {
          const newKey = photo.r2_key.replace('galleries/test-event/', 'galleries/catching-light/');
          await executeQuery('UPDATE gallery_photos SET r2_key = ? WHERE id = ?', [newKey, photo.id]);
          console.log(`  ✅ Updated DB: photo ID ${photo.id}`);
        }
      } catch (error) {
        console.error('  ❌ Database update failed:', error);
        log.errors.push({ operation: 'db-update', key: 'gallery_photos', error: String(error) });
      }
    }
  } else {
    console.log('  ✅ No test-event folder found (already cleaned up?)\n');
  }

  // ============================================================================
  // STEP 2: Delete Orphaned Root-Level Video Files
  // ============================================================================
  console.log('\n📹 Step 2: Cleaning up orphaned root-level videos...\n');

  const allObjects = await storage.listR2(undefined, 10000);
  const rootLevelVideos = allObjects.filter((obj) => {
    const key = obj.key;
    // Match: video_*.mp4, poster_*.jpg at root level
    return (
      !key.includes('/') &&
      (key.startsWith('video_') || key.startsWith('poster_') || key.startsWith('test_'))
    );
  });

  console.log(`Found ${rootLevelVideos.length} orphaned root-level video/poster files`);

  if (rootLevelVideos.length > 0) {
    const totalSizeMB = rootLevelVideos.reduce((sum, obj) => sum + obj.size, 0) / 1024 / 1024;
    console.log(`Total size: ${totalSizeMB.toFixed(2)} MB\n`);

    if (!DRY_RUN) {
      const confirmed = await askConfirmation(
        `Delete ${rootLevelVideos.length} root-level files (${totalSizeMB.toFixed(2)} MB)?`
      );
      if (!confirmed) {
        console.log('  ⏭️  Skipped root-level video cleanup\n');
        return;
      }
    }

    for (const file of rootLevelVideos) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would delete: ${file.key} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        log.deleted.push(file.key);
        log.summary.spaceSavedMB += file.size / 1024 / 1024;
      } else {
        try {
          const result = await storage.deleteFromR2(file.key);
          if (result.success) {
            console.log(`  ✅ Deleted: ${file.key}`);
            log.deleted.push(file.key);
            log.summary.totalDeleted++;
            log.summary.spaceSavedMB += file.size / 1024 / 1024;
          } else {
            console.error(`  ❌ Failed: ${file.key} - ${result.error}`);
            log.errors.push({ operation: 'delete', key: file.key, error: result.error || 'Unknown' });
          }
        } catch (error) {
          console.error(`  ❌ Error: ${file.key} - ${error}`);
          log.errors.push({ operation: 'delete', key: file.key, error: String(error) });
        }
      }
    }
  } else {
    console.log('  ✅ No orphaned root-level videos found\n');
  }

  // ============================================================================
  // STEP 3: Delete Orphaned videos/ Folder
  // ============================================================================
  console.log('\n🎬 Step 3: Cleaning up videos/ folder...\n');

  const videosFolder = allObjects.filter((obj) => obj.key.startsWith('videos/'));
  console.log(`Found ${videosFolder.length} files in videos/ folder`);

  if (videosFolder.length > 0) {
    const totalSizeMB = videosFolder.reduce((sum, obj) => sum + obj.size, 0) / 1024 / 1024;
    console.log(`Total size: ${totalSizeMB.toFixed(2)} MB\n`);

    if (!DRY_RUN) {
      const confirmed = await askConfirmation(
        `Delete entire videos/ folder (${videosFolder.length} files, ${totalSizeMB.toFixed(2)} MB)?`
      );
      if (!confirmed) {
        console.log('  ⏭️  Skipped videos/ folder cleanup\n');
        return;
      }
    }

    for (const file of videosFolder) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would delete: ${file.key}`);
        log.deleted.push(file.key);
        log.summary.spaceSavedMB += file.size / 1024 / 1024;
      } else {
        try {
          const result = await storage.deleteFromR2(file.key);
          if (result.success) {
            console.log(`  ✅ Deleted: ${file.key}`);
            log.deleted.push(file.key);
            log.summary.totalDeleted++;
            log.summary.spaceSavedMB += file.size / 1024 / 1024;
          } else {
            console.error(`  ❌ Failed: ${file.key} - ${result.error}`);
            log.errors.push({ operation: 'delete', key: file.key, error: result.error || 'Unknown' });
          }
        } catch (error) {
          console.error(`  ❌ Error: ${file.key} - ${error}`);
          log.errors.push({ operation: 'delete', key: file.key, error: String(error) });
        }
      }
    }
  } else {
    console.log('  ✅ No videos/ folder found\n');
  }

  // ============================================================================
  // STEP 4: Delete Orphaned music/ Folder
  // ============================================================================
  console.log('\n🎵 Step 4: Cleaning up music/ folder...\n');

  const musicFolder = allObjects.filter((obj) => obj.key.startsWith('music/'));
  console.log(`Found ${musicFolder.length} files in music/ folder`);

  if (musicFolder.length > 0) {
    const totalSizeMB = musicFolder.reduce((sum, obj) => sum + obj.size, 0) / 1024 / 1024;
    console.log(`Total size: ${totalSizeMB.toFixed(2)} MB\n`);

    if (!DRY_RUN) {
      const confirmed = await askConfirmation(
        `Delete entire music/ folder (${musicFolder.length} files, ${totalSizeMB.toFixed(2)} MB)? You will re-upload albums.`
      );
      if (!confirmed) {
        console.log('  ⏭️  Skipped music/ folder cleanup\n');
        return;
      }
    }

    for (const file of musicFolder) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would delete: ${file.key}`);
        log.deleted.push(file.key);
        log.summary.spaceSavedMB += file.size / 1024 / 1024;
      } else {
        try {
          const result = await storage.deleteFromR2(file.key);
          if (result.success) {
            console.log(`  ✅ Deleted: ${file.key}`);
            log.deleted.push(file.key);
            log.summary.totalDeleted++;
            log.summary.spaceSavedMB += file.size / 1024 / 1024;
          } else {
            console.error(`  ❌ Failed: ${file.key} - ${result.error}`);
            log.errors.push({ operation: 'delete', key: file.key, error: result.error || 'Unknown' });
          }
        } catch (error) {
          console.error(`  ❌ Error: ${file.key} - ${error}`);
          log.errors.push({ operation: 'delete', key: file.key, error: String(error) });
        }
      }
    }
  } else {
    console.log('  ✅ No music/ folder found\n');
  }

  // ============================================================================
  // STEP 5: Clear Database Tables
  // ============================================================================
  if (!DRY_RUN) {
    console.log('\n🗄️  Step 5: Clearing database tables...\n');

    const confirmed = await askConfirmation('Clear albums, tracks, and videos tables in database?');
    if (confirmed) {
      try {
        await executeQuery('DELETE FROM tracks');
        console.log('  ✅ Cleared tracks table');

        await executeQuery('DELETE FROM albums');
        console.log('  ✅ Cleared albums table');

        await executeQuery('DELETE FROM videos');
        console.log('  ✅ Cleared videos table');

        await executeQuery('DELETE FROM music_videos');
        console.log('  ✅ Cleared music_videos table');
      } catch (error) {
        console.error('  ❌ Database cleanup failed:', error);
        log.errors.push({ operation: 'db-clear', key: 'tables', error: String(error) });
      }
    } else {
      console.log('  ⏭️  Skipped database cleanup\n');
    }
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  console.log('\n' + '='.repeat(60));
  console.log('✅ CLEANUP SUMMARY');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Files moved: ${log.moved.length}`);
  console.log(`Files deleted: ${log.deleted.length}`);
  console.log(`Space saved: ${log.summary.spaceSavedMB.toFixed(2)} MB`);
  console.log(`Errors: ${log.errors.length}`);
  console.log('='.repeat(60) + '\n');

  // Save log
  const logPath = path.join(process.cwd(), 'tmp', `r2_cleanup_${Date.now()}.json`);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`📄 Full log saved to: ${logPath}\n`);

  if (DRY_RUN) {
    console.log('💡 This was a DRY RUN. Run without --dry-run to execute cleanup.\n');
  } else {
    console.log('✅ Cleanup complete! You can now re-upload your albums with the new structure.\n');
  }
}

main().catch((error) => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});
