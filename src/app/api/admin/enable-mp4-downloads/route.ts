import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Enable MP4 downloads for all clips in the database
 * This calls Cloudflare Stream API to enable MP4 downloads for each video.
 * The MP4 URL is generated dynamically from the UID in clipsMapper.ts
 *
 * POST /api/admin/enable-mp4-downloads
 */
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    // Initialize Cloudflare Stream API
    const streamApi = new CloudflareStreamAPI();

    // Fetch all clips with UIDs
    const clips = await queryDatabase(
      `SELECT id, uid, title FROM videos
       WHERE type = 'clip'
         AND uid IS NOT NULL
         AND uid != ''
       ORDER BY created_at DESC`,
      []
    );

    if (!clips.length) {
      return NextResponse.json({
        success: true,
        message: 'No clips found to process',
        processed: 0,
        total: 0,
      });
    }

    const results: Array<{
      id: number;
      uid: string;
      title: string;
      status: 'enabled' | 'already_enabled' | 'pending' | 'failed';
      error?: string;
    }> = [];

    // Process each clip
    for (const clip of clips) {
      const { id, uid, title } = clip as { id: number; uid: string; title: string };

      try {
        // Enable MP4 downloads via Cloudflare API
        const downloadResponse = await streamApi.enableDownloads(uid);
        const mp4Info = downloadResponse.result?.default;

        if (mp4Info?.status === 'ready' || mp4Info?.url) {
          results.push({
            id,
            uid,
            title: title || 'Untitled',
            status: 'enabled',
          });
        } else if (mp4Info?.status === 'pendingupload' || mp4Info?.status === 'inprogress') {
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
            status: 'enabled',
          });
        }
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        // Check if already enabled (409 Conflict)
        if (errorMsg.includes('409') || errorMsg.includes('already')) {
          results.push({
            id,
            uid,
            title: title || 'Untitled',
            status: 'already_enabled',
          });
        } else {
          results.push({
            id,
            uid,
            title: title || 'Untitled',
            status: 'failed',
            error: errorMsg,
          });
        }
      }
    }

    const enabled = results.filter(r => r.status === 'enabled').length;
    const alreadyEnabled = results.filter(r => r.status === 'already_enabled').length;
    const pending = results.filter(r => r.status === 'pending').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      message: `Processed ${clips.length} clips: ${enabled} enabled, ${alreadyEnabled} already enabled, ${pending} pending, ${failed} failed`,
      processed: clips.length,
      enabled,
      alreadyEnabled,
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
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const streamApi = new CloudflareStreamAPI();

    // Get all clips with UIDs
    const clips = await queryDatabase(
      `SELECT id, uid, title FROM videos
       WHERE type = 'clip' AND uid IS NOT NULL AND uid != ''
       ORDER BY created_at DESC
       LIMIT 20`,
      []
    );

    const results: Array<{
      id: number;
      uid: string;
      title: string;
      mp4Status: 'ready' | 'not_enabled' | 'pending' | 'error';
    }> = [];

    // Check each clip's MP4 status
    for (const clip of clips) {
      const { id, uid, title } = clip as { id: number; uid: string; title: string };

      try {
        const downloadUrl = await streamApi.getDownloadUrl(uid);
        results.push({
          id,
          uid,
          title: title || 'Untitled',
          mp4Status: downloadUrl ? 'ready' : 'not_enabled',
        });
      } catch (err) {
        results.push({
          id,
          uid,
          title: title || 'Untitled',
          mp4Status: 'error',
        });
      }
    }

    const ready = results.filter(r => r.mp4Status === 'ready').length;
    const notEnabled = results.filter(r => r.mp4Status === 'not_enabled').length;
    const errors = results.filter(r => r.mp4Status === 'error').length;

    return NextResponse.json({
      success: true,
      totalChecked: clips.length,
      ready,
      notEnabled,
      errors,
      results,
      message: notEnabled > 0
        ? `${notEnabled} clips need MP4 enabled. POST to this endpoint to enable.`
        : 'All checked clips have MP4 enabled.',
    });
  } catch (err: any) {
    console.error('Check MP4 status error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal error' },
      { status: 500 }
    );
  }
}
