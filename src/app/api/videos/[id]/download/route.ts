import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';
import CloudflareStreamAPI from '@/lib/cloudflareStream';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    console.log(`[Download API] Request for video ID: ${id}`);

    // 1. Get Video UID
    const rows = await queryDatabase('SELECT uid FROM videos WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    const { uid } = rows[0];
    if (!uid) {
      return NextResponse.json({ error: 'Video has no UID' }, { status: 400 });
    }

    const stream = new CloudflareStreamAPI();

    // 2. Check/Enable Downloads
    let downloadUrl = await stream.getDownloadUrl(uid);
    
    if (!downloadUrl) {
      console.log(`[Download] Enabling downloads for ${uid}...`);
      await stream.enableDownloads(uid);
      
      // Poll briefly (up to 2 seconds) to see if it's ready immediately
      // (Often it takes longer, so the frontend might need to handle "pending")
      for (let i = 0; i < 4; i++) {
        await new Promise(r => setTimeout(r, 500));
        downloadUrl = await stream.getDownloadUrl(uid);
        if (downloadUrl) break;
      }
    }

    if (downloadUrl) {
      return NextResponse.json({ success: true, url: downloadUrl, status: 'ready' });
    } else {
      return NextResponse.json({ success: true, status: 'pending', message: 'Download generation started. Try again in a few seconds.' });
    }

  } catch (error: any) {
    console.error('Download error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
