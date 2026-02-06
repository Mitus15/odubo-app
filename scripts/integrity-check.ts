#!/usr/bin/env tsx
/**
 * Database Integrity Check Script
 * 
 * Audits the videos table and related tables for:
 * - Orphaned records (videos in DB not in Stream, clips without parents)
 * - Duplicate UIDs
 * - Missing thumbnails
 * - Broken foreign key references
 * - Deployment inconsistencies
 * - Data leakage (unauthenticated content exposure)
 * 
 * Usage:
 *   tsx --env-file=.env.local scripts/integrity-check.ts
 * 
 * Options:
 *   --fix         Attempt to fix issues automatically (use with caution)
 *   --verbose     Show detailed records for each issue
 */

import { queryDatabase, executeQuery } from '@/lib/db';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

interface IntegrityIssue {
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  count: number;
  description: string;
  records?: Array<{ id: number; uid: string; title: string; issue: string }>;
}

// Parse CLI arguments
const args = process.argv.slice(2);
const fix = args.includes('--fix');
const verbose = args.includes('--verbose');

const issues: IntegrityIssue[] = [];

async function checkIntegrity() {
  console.log('🔍 Arsenal Database Integrity Check');
  console.log('====================================\n');

  if (fix) {
    console.log('⚠️  FIX MODE ENABLED - Will attempt automatic repairs\n');
  }

  // 1. Check for duplicate UIDs
  console.log('1️⃣  Checking for duplicate UIDs...');
  const duplicateUids = await queryDatabase(
    `SELECT uid, COUNT(*) as count
     FROM videos
     WHERE uid IS NOT NULL
     GROUP BY uid
     HAVING count > 1`,
    []
  ) as Array<{ uid: string; count: number }>;

  if (duplicateUids.length > 0) {
    const records = verbose ? await queryDatabase(
      `SELECT id, uid, title, created_at
       FROM videos
       WHERE uid IN (${duplicateUids.map(() => '?').join(',')})
       ORDER BY uid, created_at DESC`,
      duplicateUids.map(d => d.uid)
    ) : undefined;

    issues.push({
      category: 'Duplicate UIDs',
      severity: 'critical',
      count: duplicateUids.length,
      description: 'Multiple videos share the same Cloudflare Stream UID',
      records: records as any,
    });

    if (fix) {
      console.log('  🔧 Fixing: Keeping most recent, removing older duplicates...');
      for (const dup of duplicateUids) {
        await executeQuery(
          `DELETE FROM videos
           WHERE uid = ?
           AND id NOT IN (SELECT id FROM videos WHERE uid = ? ORDER BY created_at DESC LIMIT 1)`,
          [dup.uid, dup.uid]
        );
      }
      console.log('  ✅ Fixed\n');
    } else {
      console.log(`  ⚠️  Found ${duplicateUids.length} duplicate UIDs\n`);
    }
  } else {
    console.log('  ✅ No duplicate UIDs found\n');
  }

  // 2. Check for orphaned clips (parent_video_id references non-existent video)
  console.log('2️⃣  Checking for orphaned clips...');
  const orphanedClips = await queryDatabase(
    `SELECT v.id, v.uid, v.title, v.parent_video_id
     FROM videos v
     WHERE v.parent_video_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM videos p WHERE p.id = v.parent_video_id)`,
    []
  ) as Array<{ id: number; uid: string; title: string; parent_video_id: number }>;

  if (orphanedClips.length > 0) {
    issues.push({
      category: 'Orphaned Clips',
      severity: 'high',
      count: orphanedClips.length,
      description: 'Clips reference non-existent parent videos',
      records: verbose ? orphanedClips.map(c => ({
        id: c.id,
        uid: c.uid,
        title: c.title,
        issue: `References parent_video_id=${c.parent_video_id} which does not exist`,
      })) : undefined,
    });

    if (fix) {
      console.log('  🔧 Fixing: Setting parent_video_id to NULL...');
      await executeQuery(
        `UPDATE videos
         SET parent_video_id = NULL
         WHERE id IN (${orphanedClips.map(() => '?').join(',')})`,
        orphanedClips.map(c => c.id)
      );
      console.log('  ✅ Fixed\n');
    } else {
      console.log(`  ⚠️  Found ${orphanedClips.length} orphaned clips\n`);
    }
  } else {
    console.log('  ✅ No orphaned clips found\n');
  }

  // 3. Check for missing thumbnails
  console.log('3️⃣  Checking for missing thumbnails...');
  const missingThumbnails = await queryDatabase(
    `SELECT id, uid, title, parent_video_id
     FROM videos
     WHERE (thumbnail IS NULL OR thumbnail = '')
       AND uid IS NOT NULL`,
    []
  ) as Array<{ id: number; uid: string; title: string; parent_video_id: number | null }>;

  if (missingThumbnails.length > 0) {
    const clips = missingThumbnails.filter(v => v.parent_video_id !== null).length;
    const parents = missingThumbnails.filter(v => v.parent_video_id === null).length;

    issues.push({
      category: 'Missing Thumbnails',
      severity: 'medium',
      count: missingThumbnails.length,
      description: `Videos without thumbnails (${clips} clips, ${parents} parent videos)`,
      records: verbose ? missingThumbnails.slice(0, 10).map(v => ({
        id: v.id,
        uid: v.uid,
        title: v.title,
        issue: v.parent_video_id ? 'Clip missing thumbnail' : 'Parent video missing thumbnail',
      })) : undefined,
    });

    console.log(`  ⚠️  Found ${missingThumbnails.length} videos without thumbnails`);
    console.log(`     💡 Run: tsx scripts/backfill-thumbnails.ts\n`);
  } else {
    console.log('  ✅ All videos have thumbnails\n');
  }

  // 4. Check for videos in DB but not in Cloudflare Stream
  console.log('4️⃣  Checking for videos not in Cloudflare Stream...');
  try {
    const stream = new CloudflareStreamAPI();
    const streamVideos = await stream.listAllVideos({});
    const streamUids = new Set(streamVideos.map((v: any) => v.uid));

    const dbVideos = await queryDatabase(
      `SELECT id, uid, title FROM videos WHERE uid IS NOT NULL`,
      []
    ) as Array<{ id: number; uid: string; title: string }>;

    const notInStream = dbVideos.filter(v => !streamUids.has(v.uid));

    if (notInStream.length > 0) {
      issues.push({
        category: 'Videos Not in Stream',
        severity: 'high',
        count: notInStream.length,
        description: 'Videos exist in database but not in Cloudflare Stream',
        records: verbose ? notInStream.slice(0, 10).map(v => ({
          id: v.id,
          uid: v.uid,
          title: v.title,
          issue: 'Video deleted from Stream but still in database',
        })) : undefined,
      });

      console.log(`  ⚠️  Found ${notInStream.length} videos not in Stream`);
      console.log(`     💡 These may be deleted videos or manual database entries\n`);
    } else {
      console.log('  ✅ All videos exist in Cloudflare Stream\n');
    }
  } catch (error) {
    console.log('  ⚠️  Could not verify against Cloudflare Stream');
    console.log(`     Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  // 5. Check for deployment inconsistencies (flat columns vs video_deployments table)
  console.log('5️⃣  Checking deployment tracking consistency...');
  const flatDeployments = await queryDatabase(
    `SELECT id, uid, title, youtube_url, tiktok_url, instagram_reels_url
     FROM videos
     WHERE youtube_url IS NOT NULL OR tiktok_url IS NOT NULL OR instagram_reels_url IS NOT NULL`,
    []
  ) as Array<{
    id: number;
    uid: string;
    title: string;
    youtube_url: string | null;
    tiktok_url: string | null;
    instagram_reels_url: string | null;
  }>;

  if (flatDeployments.length > 0) {
    issues.push({
      category: 'Legacy Deployment Data',
      severity: 'low',
      count: flatDeployments.length,
      description: 'Videos using old flat URL columns instead of video_deployments table',
      records: verbose ? flatDeployments.slice(0, 10).map(v => ({
        id: v.id,
        uid: v.uid,
        title: v.title,
        issue: `Has flat columns: ${[
          v.youtube_url && 'youtube_url',
          v.tiktok_url && 'tiktok_url',
          v.instagram_reels_url && 'instagram_reels_url',
        ].filter(Boolean).join(', ')}`,
      })) : undefined,
    });

    console.log(`  ⚠️  Found ${flatDeployments.length} videos using legacy deployment columns`);
    console.log(`     💡 These should be migrated to video_deployments table\n`);
  } else {
    console.log('  ✅ No legacy deployment data found\n');
  }

  // 6. Check for public visibility issues (SQL precedence bugs)
  console.log('6️⃣  Checking for visibility configuration issues...');
  const visibilityIssues = await queryDatabase(
    `SELECT id, uid, title, is_public, status, publication_status
     FROM videos
     WHERE (is_public = 1 OR is_public IS NULL)
       AND (status = 'archived' OR publication_status = 'archived')`,
    []
  ) as Array<{
    id: number;
    uid: string;
    title: string;
    is_public: number | null;
    status: string | null;
    publication_status: string | null;
  }>;

  if (visibilityIssues.length > 0) {
    issues.push({
      category: 'Visibility Conflicts',
      severity: 'high',
      count: visibilityIssues.length,
      description: 'Videos marked public but with archived status',
      records: verbose ? visibilityIssues.map(v => ({
        id: v.id,
        uid: v.uid,
        title: v.title,
        issue: `is_public=${v.is_public}, status=${v.status}, publication_status=${v.publication_status}`,
      })) : undefined,
    });

    console.log(`  ⚠️  Found ${visibilityIssues.length} videos with conflicting visibility settings\n`);
  } else {
    console.log('  ✅ No visibility conflicts found\n');
  }

  // Print summary
  console.log('\n====================================');
  console.log('📊 Integrity Check Summary');
  console.log('====================================\n');

  if (issues.length === 0) {
    console.log('✅ No issues found! Database is healthy.\n');
    return;
  }

  // Group by severity
  const critical = issues.filter(i => i.severity === 'critical');
  const high = issues.filter(i => i.severity === 'high');
  const medium = issues.filter(i => i.severity === 'medium');
  const low = issues.filter(i => i.severity === 'low');

  if (critical.length > 0) {
    console.log('🔴 CRITICAL ISSUES:\n');
    critical.forEach(issue => {
      console.log(`  • ${issue.category}: ${issue.count} records`);
      console.log(`    ${issue.description}`);
      if (verbose && issue.records) {
        issue.records.slice(0, 5).forEach(r => {
          console.log(`      - [${r.id}] ${r.title}: ${r.issue}`);
        });
      }
      console.log();
    });
  }

  if (high.length > 0) {
    console.log('🟠 HIGH PRIORITY:\n');
    high.forEach(issue => {
      console.log(`  • ${issue.category}: ${issue.count} records`);
      console.log(`    ${issue.description}\n`);
    });
  }

  if (medium.length > 0) {
    console.log('🟡 MEDIUM PRIORITY:\n');
    medium.forEach(issue => {
      console.log(`  • ${issue.category}: ${issue.count} records`);
      console.log(`    ${issue.description}\n`);
    });
  }

  if (low.length > 0) {
    console.log('🟢 LOW PRIORITY:\n');
    low.forEach(issue => {
      console.log(`  • ${issue.category}: ${issue.count} records`);
      console.log(`    ${issue.description}\n`);
    });
  }

  console.log('====================================\n');

  if (!fix) {
    console.log('💡 Run with --fix to attempt automatic repairs');
    console.log('💡 Run with --verbose to see detailed records\n');
  }

  // Exit with error code if critical issues found
  if (critical.length > 0 && !fix) {
    process.exit(1);
  }
}

// Run script
checkIntegrity().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
