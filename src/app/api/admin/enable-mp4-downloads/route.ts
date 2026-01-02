import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Enable MP4 downloads for all clips in the database
 * This calls Cloudflare Stream API to enable MP4 downloads for each video
 * and stores the resulting MP4 URL in the database
 *
 * POST /api/admin/enable-mp4-downloads
 */
export async function POST(req: NextRequest) {
  try {
    // Initialize Cloudflare Stream API
    const streamApi = new CloudflareStreamAPI();

    // Fetch all clips with UIDs that don't have mp4_url yet
    const clips = await queryDatabase(
      `SELECT id, uid, title FROM videos
       WHERE type = 'clip'
         AND uid IS NOT NULL
         AND (mp4_url IS NULL OR mp4_url = '')
       ORDER BY created_at DESC`,
      []
    );

    if (!clips.length) {
      return NextResponse.json({
        success: true,
        message: 'No clips need MP4 enabling',
        processed: 0,
        total: 0,
      });
    }

    const results: Array<{
      id: number;
      uid: string;
      title: string;
      status: 'success' | 'failed' | 'pending';
      mp4Url?: string;
      error?: string;
    }> = [];

    // Process each clip
    for (const clip of clips) {
      const { id, uid, title } = clip as { id: number; uid: string; title: string };

      try {
        // Enable MP4 downloads via Cloudflare API
        const downloadResponse = await streamApi.enableDownloads(uid);

        // Check if we got a URL back
        const mp4Info = downloadResponse.result?.default;

        if (mp4Info?.url) {
          // Store the MP4 URL in the database
          await executeQuery(
            'UPDATE videos SET mp4_url = ? WHERE id = ?',
            [mp4Info.url, id]
          );

          results.push({
            id,
            uid,
            title: title || 'Untitled',
            status: 'success',
            mp4Url: mp4Info.url,
          });
        } else if (mp4Info?.status === 'pendingupload' || mp4Info?.status === 'inprogress') {
          // MP4 is still being generated
          results.push({
            id,
            uid,
            title: title || 'Untitled',
            status: 'pending',
          });
        } else {
          results.push({
            id,
            uid,
            title: title || 'Untitled',
            status: 'failed',
            error: 'Unknown response from Cloudflare',
          });
        }
      } catch (err: any) {
        results.push({
          id,
          uid,
          title: title || 'Untitled',
          status: 'failed',
          error: err?.message || 'Unknown error',
        });
      }
    }

    const successful = results.filter(r => r.status === 'success').length;
    const pending = results.filter(r => r.status === 'pending').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      message: `Processed ${clips.length} clips`,
      processed: clips.length,
      successful,
      pending,
      failed,
      results,
    });
  } catch (err: any) {
    console.error('Enable MP4 downloads error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * Check status of MP4 downloads for all clips
 *
 * GET /api/admin/enable-mp4-downloads
 */
export async function GET(req: NextRequest) {
  try {
    // Get counts
    const totalClips = await queryDatabase(
      `SELECT COUNT(*) as count FROM videos WHERE type = 'clip' AND uid IS NOT NULL`,
      []
    );

    const withMp4 = await queryDatabase(
      `SELECT COUNT(*) as count FROM videos WHERE type = 'clip' AND uid IS NOT NULL AND mp4_url IS NOT NULL AND mp4_url != ''`,
      []
    );

    const withoutMp4 = await queryDatabase(
      `SELECT COUNT(*) as count FROM videos WHERE type = 'clip' AND uid IS NOT NULL AND (mp4_url IS NULL OR mp4_url = '')`,
      []
    );

    // Get sample of clips without MP4
    const sampleWithout = await queryDatabase(
      `SELECT id, uid, title FROM videos
       WHERE type = 'clip' AND uid IS NOT NULL AND (mp4_url IS NULL OR mp4_url = '')
       LIMIT 5`,
      []
    );

    return NextResponse.json({
      totalClips: (totalClips[0] as any)?.count || 0,
      withMp4: (withMp4[0] as any)?.count || 0,
      withoutMp4: (withoutMp4[0] as any)?.count || 0,
      sampleWithoutMp4: sampleWithout,
    });
  } catch (err: any) {
    console.error('Check MP4 status error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal error' },
      { status: 500 }
    );
  }
}
