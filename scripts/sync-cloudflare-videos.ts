#!/usr/bin/env tsx
/**
 * Sync all videos from Cloudflare Stream to database
 * - Fetches all videos with pagination
 * - Filters out improperly named videos and deletes them
 * - Groups clips by base name pattern (improved detection)
 * - Renames clips to "Title - Part X"
 * - Creates parent-child relationships
 * - Assigns release_order based on upload time
 * - Sets publication_status to 'live'
 */

import 'dotenv/config';
import { queryDatabase, executeQuery } from '../src/lib/db';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN!;

interface CloudflareVideo {
  uid: string;
  meta: {
    name?: string;
    [key: string]: any;
  };
  created: string;
  duration: number;
  thumbnail?: string;
  preview?: string;
  status?: {
    state: string;
  };
  [key: string]: any;
}

interface CloudflareResponse {
  result: CloudflareVideo[];
  result_info?: {
    cursor?: string;
  };
  success: boolean;
}

// Fetch all videos from Cloudflare Stream with pagination
async function fetchAllCloudflareVideos(): Promise<CloudflareVideo[]> {
  const allVideos: CloudflareVideo[] = [];
  let cursor: string | undefined;

  console.log('🔍 Fetching videos from Cloudflare Stream...\n');

  do {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`);
    if (cursor) {
      url.searchParams.set('after', cursor);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${response.statusText}`);
    }

    const data: CloudflareResponse = await response.json();
    
    if (!data.success) {
      throw new Error('Cloudflare API returned success: false');
    }

    allVideos.push(...data.result);
    cursor = data.result_info?.cursor;

    console.log(`  Fetched ${data.result.length} videos (total: ${allVideos.length})`);
  } while (cursor);

  console.log(`\n✅ Found ${allVideos.length} total videos\n`);
  return allVideos;
}

// Section keywords that indicate a video is a clip
const SECTION_KEYWORDS = [
  'Intro', 'Outro', 'Title', 'Hi', 'Prologue', 'Credits', 'Epilogue',
  'Verse', 'Chorus', 'Bridge', 'Pre-Chorus', 'Pre-chorus',
  'Dance Break', 'Drop', 'Ambience', 'Prayer', 'Music', 'Transition',
  'Kobe', 'For the Love', 'Offended', 'Real',
];

// Build regex pattern for detecting clips
const CLIP_PATTERN = new RegExp(
  `\\s+(${SECTION_KEYWORDS.join('|')})(\\s+\\d+)?(\\s+Real)?\\.mp4?$`,
  'i'
);

// Extract base name from clip titles
function getBaseName(name: string): string {
  let baseName = name
    // Remove file extension
    .replace(/\.mp4?$/i, '')
    // Remove section patterns
    .replace(CLIP_PATTERN, '')
    // Remove trailing standalone numbers
    .replace(/\s+\d+$/, '')
    .trim();
  
  return baseName;
}

// Check if a title indicates it's a clip/section (not a full video)
function isClipSection(name: string): boolean {
  return CLIP_PATTERN.test(name);
}

// Get a sort key for ordering clips within a parent
function getClipSortKey(name: string): number {
  const lower = name.toLowerCase().replace(/\.mp4?$/i, '');
  
  // Define order of sections (lower number = earlier in sequence)
  const sectionOrder: Record<string, number> = {
    'title': 1,
    'hi': 2,
    'prologue': 3,
    'ambience': 4,
    'prayer intro': 5,
    'prayer': 6,
    'intro real': 7,
    'intro': 10,
    'intro 2': 11,
    'music 1': 15,
    'music 2': 16,
    'verse 1': 20,
    'verse 2': 21,
    'verse 3': 22,
    'verse 4': 23,
    'verse 5': 24,
    'verse': 25,
    'pre-chorus 1': 30,
    'pre-chorus 2': 31,
    'pre-chorus 3': 32,
    'pre-chorus': 33,
    'chorus 1': 40,
    'chorus 2': 41,
    'chorus 3': 42,
    'chorus 4': 43,
    'chorus 5': 44,
    'chorus': 45,
    'bridge 1': 50,
    'bridge 2': 51,
    'bridge': 52,
    'transition': 55,
    'kobe': 58,
    'for the love': 59,
    'dance break': 60,
    'drop': 65,
    'drop 2': 66,
    'offended 1': 80,
    'offended 2': 81,
    'outro 1': 90,
    'outro 2': 91,
    'outro': 92,
    'movie outro': 95,
    'credits': 99,
  };
  
  // Extract the section part (everything after the base name)
  const baseName = getBaseName(name);
  const sectionPart = lower.replace(baseName.toLowerCase(), '').trim();
  
  return sectionOrder[sectionPart] ?? 1000; // Unknown sections go to end
}

// Check if a video has a proper name (not generic/default names)
function hasProperName(name: string): boolean {
  const invalidPatterns = [
    /^video\.mp4?$/i,           // video.mp4, video.mp
    /^untitled/i,               // untitled, Untitled
    /^new\s+video/i,           // new video, New Video
    /^screen\s+recording/i,     // screen recording
    /^recording\s+\d+/i,        // recording 1, Recording 2
    /^\d{8,}$/,                 // Just numbers (timestamps)
    /^[a-f0-9]{32,}$/i,         // Hash/UUID-like names
    /^vid_\d+$/i,               // vid_123
    /^output\.mp4?$/i,          // output.mp4
    /^final\.mp4?$/i,           // final.mp4
  ];

  return !invalidPatterns.some(pattern => pattern.test(name.trim()));
}

// Delete a video from Cloudflare Stream
async function deleteCloudflareVideo(uid: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error(`Failed to delete video ${uid}:`, error);
    return false;
  }
}

// Group videos by base name
function groupVideosByBaseName(videos: CloudflareVideo[]): Map<string, CloudflareVideo[]> {
  const groups = new Map<string, CloudflareVideo[]>();

  for (const video of videos) {
    const name = video.meta.name || 'Untitled';
    const baseName = getBaseName(name);
    
    if (!groups.has(baseName)) {
      groups.set(baseName, []);
    }
    groups.get(baseName)!.push(video);
  }

  return groups;
}

// Main sync function
async function syncVideos() {
  try {
    console.log('🚀 Starting Cloudflare Stream → Database sync\n');
    console.log('================================================\n');

    // Fetch all videos
    const cloudflareVideos = await fetchAllCloudflareVideos();

    // Sort by creation date (oldest first for release_order)
    cloudflareVideos.sort((a, b) => 
      new Date(a.created).getTime() - new Date(b.created).getTime()
    );

    // Filter out improperly named videos
    const properlyNamedVideos: CloudflareVideo[] = [];
    const improperlyNamedVideos: CloudflareVideo[] = [];

    for (const video of cloudflareVideos) {
      const name = video.meta.name || 'Untitled';
      if (hasProperName(name)) {
        properlyNamedVideos.push(video);
      } else {
        improperlyNamedVideos.push(video);
      }
    }

    console.log(`✅ Properly named videos: ${properlyNamedVideos.length}`);
    console.log(`🗑️  Improperly named videos: ${improperlyNamedVideos.length}\n`);

    // Delete improperly named videos
    if (improperlyNamedVideos.length > 0) {
      console.log('🗑️  Deleting improperly named videos from Cloudflare Stream...\n');
      let deletedCount = 0;
      
      for (const video of improperlyNamedVideos) {
        const name = video.meta.name || 'Untitled';
        console.log(`   Deleting: "${name}" (${video.uid})`);
        
        const deleted = await deleteCloudflareVideo(video.uid);
        if (deleted) {
          deletedCount++;
          // Also remove from database if it exists
          await executeQuery('DELETE FROM videos WHERE uid = ?', [video.uid]);
        }
        
        // Rate limit: small delay between deletes
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log(`\n   ✓ Deleted ${deletedCount} improperly named videos\n`);
    }

    // Group by base name
    const groups = groupVideosByBaseName(properlyNamedVideos);
    console.log(`📦 Grouped into ${groups.size} video series\n`);

    let releaseOrder = 1;
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;

    // Process each group
    for (const [baseName, videos] of groups.entries()) {
      console.log(`\n📹 Processing: "${baseName}"`);
      console.log(`   ${videos.length} video(s)\n`);

      // Sort videos within group by clip order
      videos.sort((a, b) => {
        const aName = a.meta.name || '';
        const bName = b.meta.name || '';
        return getClipSortKey(aName) - getClipSortKey(bName);
      });

      // Determine parent and clips
      const hasMultiple = videos.length > 1;
      let parentVideo: CloudflareVideo | null = null;
      let clips: CloudflareVideo[] = [];

      if (hasMultiple) {
        // Look for a non-section video as parent (full video)
        const nonClipVideo = videos.find(v => !isClipSection(v.meta.name || ''));
        
        if (nonClipVideo) {
          // Found a full video - use it as parent
          parentVideo = nonClipVideo;
          clips = videos.filter(v => v.uid !== nonClipVideo.uid);
        } else {
          // All are clips - no parent, treat them all as independent clips under a virtual parent
          clips = videos;
        }
      } else {
        // Single video
        if (isClipSection(videos[0].meta.name || '')) {
          // It's a standalone clip - treat as clip without parent
          clips = videos;
        } else {
          // It's a full video - make it a parent
          parentVideo = videos[0];
        }
      }

      let parentVideoId: number | null = null;

      // Create/update parent video (if exists)
      if (parentVideo) {
        const parentTitle = parentVideo.meta.name || baseName;

        // Check if video exists
        const existing = await queryDatabase(
          'SELECT id, title FROM videos WHERE uid = ?',
          [parentVideo.uid]
        );

        if (existing.length > 0) {
          // Update existing
          parentVideoId = existing[0].id;
          await executeQuery(
            `UPDATE videos SET 
              title = ?,
              duration = ?,
              poster_url = ?,
              release_order = ?,
              publication_status = 'live',
              parent_video_id = NULL,
              clip_index = NULL,
              total_siblings = ?
            WHERE uid = ?`,
            [
              parentTitle,
              String(parentVideo.duration),
              parentVideo.thumbnail || null,
              releaseOrder,
              clips.length,
              parentVideo.uid,
            ]
          );
          console.log(`   ✓ Updated parent: "${parentTitle}" (ID: ${parentVideoId})`);
          totalUpdated++;
        } else {
          // Create new
          await executeQuery(
            `INSERT INTO videos (
              uid, title, duration, poster_url,
              release_order, publication_status, parent_video_id,
              clip_index, total_siblings, created_at
            ) VALUES (?, ?, ?, ?, ?, 'live', NULL, NULL, ?, datetime('now'))`,
            [
              parentVideo.uid,
              parentTitle,
              String(parentVideo.duration),
              parentVideo.thumbnail || null,
              releaseOrder,
              clips.length,
            ]
          );

          // Get the inserted ID
          const inserted = await queryDatabase(
            'SELECT id FROM videos WHERE uid = ?',
            [parentVideo.uid]
          );
          parentVideoId = inserted[0]?.id;
          console.log(`   ✓ Created parent: "${parentTitle}" (ID: ${parentVideoId})`);
          totalCreated++;
        }

        releaseOrder++;
      } else if (clips.length > 0) {
        // No parent video found, but we have clips - create a virtual parent entry
        const virtualParentTitle = baseName;
        
        // Check if a parent entry already exists for this base name
        const existingParent = await queryDatabase(
          'SELECT id FROM videos WHERE title = ? AND parent_video_id IS NULL',
          [virtualParentTitle]
        );

        if (existingParent.length > 0) {
          parentVideoId = existingParent[0].id;
          // Update total_siblings count
          await executeQuery(
            'UPDATE videos SET total_siblings = ?, release_order = ? WHERE id = ?',
            [clips.length, releaseOrder, parentVideoId]
          );
          console.log(`   ✓ Updated virtual parent: "${virtualParentTitle}" (ID: ${parentVideoId})`);
          totalUpdated++;
        } else {
          // Create virtual parent (no uid, no actual video)
          await executeQuery(
            `INSERT INTO videos (
              title, release_order, publication_status, 
              parent_video_id, clip_index, total_siblings, created_at
            ) VALUES (?, ?, 'live', NULL, NULL, ?, datetime('now'))`,
            [virtualParentTitle, releaseOrder, clips.length]
          );

          const inserted = await queryDatabase(
            'SELECT id FROM videos WHERE title = ? AND parent_video_id IS NULL ORDER BY id DESC LIMIT 1',
            [virtualParentTitle]
          );
          parentVideoId = inserted[0]?.id;
          console.log(`   ✓ Created virtual parent: "${virtualParentTitle}" (ID: ${parentVideoId})`);
          totalCreated++;
        }
        
        releaseOrder++;
      }

      // Create/update clips
      if (clips.length > 0 && parentVideoId) {
        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i];
          const clipTitle = `${baseName} - Part ${i + 1}`;

          // Check if clip exists
          const existing = await queryDatabase(
            'SELECT id FROM videos WHERE uid = ?',
            [clip.uid]
          );

          if (existing.length > 0) {
            // Update existing clip
            await executeQuery(
              `UPDATE videos SET
                title = ?,
                duration = ?,
                poster_url = ?,
                parent_video_id = ?,
                clip_index = ?,
                total_siblings = ?,
                publication_status = 'live'
              WHERE uid = ?`,
              [
                clipTitle,
                String(clip.duration),
                clip.thumbnail || null,
                parentVideoId,
                i + 1,
                clips.length,
                clip.uid,
              ]
            );
            console.log(`      ✓ Updated clip: "${clipTitle}"`);
            totalUpdated++;
          } else {
            // Create new clip
            await executeQuery(
              `INSERT INTO videos (
                uid, title, duration, poster_url,
                parent_video_id, clip_index, total_siblings,
                publication_status, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'live', datetime('now'))`,
              [
                clip.uid,
                clipTitle,
                String(clip.duration),
                clip.thumbnail || null,
                parentVideoId,
                i + 1,
                clips.length,
              ]
            );
            console.log(`      ✓ Created clip: "${clipTitle}"`);
            totalCreated++;
          }
        }
      }

      totalProcessed += videos.length;
    }

    console.log('\n================================================');
    console.log('✅ Sync complete!\n');
    console.log(`   Total videos processed: ${totalProcessed}`);
    console.log(`   Created: ${totalCreated}`);
    console.log(`   Updated: ${totalUpdated}`);
    console.log(`   Video series: ${groups.size}`);
    console.log('\n');

  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

// Run
syncVideos();
