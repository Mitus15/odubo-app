import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';

export const runtime = 'nodejs';

// POST /api/videos/[id]/process
// Orchestrates the full analysis pipeline:
// 1. Transcribe (if missing)
// 2. Generate Thumbnails (if missing)
// 3. Generate Description (using transcript + frames)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';

  try {
    // 1. Check current status
    const rows = await queryDatabase(
      `SELECT v.id, v.uid, v.title, v.description, v.poster_url, va.transcript_json 
       FROM videos v 
       LEFT JOIN videos_analysis va ON v.uid = va.uid 
       WHERE v.id = ? LIMIT 1`,
      [id]
    );
    
    if (!rows.length) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    const video = rows[0];
    const stepsCompleted = [];
    const stepsFailed = [];

    // Helper to call internal APIs
    const callApi = async (path: string, body: any) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`${path} failed: ${res.status} ${err}`);
      }
      return res.json();
    };

    // Step 1: Transcribe (if missing)
    if (!video.transcript_json) {
      try {
        console.log(`[Process] Starting transcription for ${id}...`);
        await callApi(`/api/videos/${id}/analysis/transcript/generate`, {});
        stepsCompleted.push('transcription');
      } catch (e: any) {
        console.error(`[Process] Transcription failed:`, e);
        stepsFailed.push('transcription');
        // Continue? Yes, description can work without transcript (fallback)
      }
    } else {
      stepsCompleted.push('transcription (cached)');
    }

    // Step 2: Thumbnails (if missing or default)
    // We assume if poster_url is generic or missing, we need thumbnails.
    // For now, let's always generate candidates if we are running the full process, 
    // but maybe skip if we already have a good selection? 
    // Let's run it to ensure we have options.
    try {
      console.log(`[Process] Generating thumbnails for ${id}...`);
      await callApi('/api/videos/thumbnail/generate', { videoId: id, uid: video.uid });
      stepsCompleted.push('thumbnails');
    } catch (e: any) {
      console.error(`[Process] Thumbnail generation failed:`, e);
      stepsFailed.push('thumbnails');
    }

    // Step 3: Description (Always run to use new transcript/frames)
    try {
      console.log(`[Process] Generating description for ${id}...`);
      const descRes: any = await callApi('/api/videos/description/generate', {
        videoId: id,
        title: video.title,
        existingDescription: video.description
      });
      
      // Update video with new description
      if (descRes.description) {
        await executeQuery('UPDATE videos SET description = ? WHERE id = ?', [descRes.description, id]);
        stepsCompleted.push('description');
      }
    } catch (e: any) {
      console.error(`[Process] Description generation failed:`, e);
      stepsFailed.push('description');
    }

    return NextResponse.json({ 
      success: true, 
      steps: stepsCompleted, 
      failures: stepsFailed 
    });

  } catch (error: any) {
    console.error('Process error:', error);
    return NextResponse.json({ error: error.message || 'Processing failed' }, { status: 500 });
  }
}
