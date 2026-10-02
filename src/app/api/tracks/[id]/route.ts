import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
export const runtime = 'edge';
import { executeQuery, queryDatabase } from '@/lib/db';
import { deriveHlsUrl, withoutAudio } from '@/lib/release/audioSource';
import { mayHearTrackId } from '@/lib/loop/audioAccess';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const tracks = (await queryDatabase(
      `SELECT t.*, a.status AS album_status
         FROM tracks t LEFT JOIN albums a ON a.id = t.album_id
        WHERE t.id = ? LIMIT 1`,
      [id]
    )) as Record<string, unknown>[];
    
    if (tracks.length === 0) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }
    
    const { album_status, ...track } = tracks[0];

    // Compute optional HLS manifest URL based on audio_url convention
    // Example: https://media/.../song.web.m4a -> https://media/.../song.hls/master.m3u8

    const hls_url = deriveHlsUrl(track.audio_url as string | null);
    
    // Until its album is published, a track carries the way to play it only
    // to someone who may hear it: the rule the stream route and the media
    // proxy already hold the bytes to. /api/tracks withholds the same fields
    // from everyone; this answer is per caller, so the player still gets them.
    const published = String(album_status ?? '').toLowerCase() === 'published';
    const audible = published || (await mayHearTrackId(req, id));

    const response = NextResponse.json({ 
      success: true, 
      track: audible ? { ...track, hls_url } : withoutAudio({ ...track, hls_url })
    });
    
    // The published catalogue is the same for everyone. Anything else depends
    // on who asked, so no shared cache may keep it.
    response.headers.set(
      'Cache-Control',
      published ? 'public, max-age=300, stale-while-revalidate=600' : 'private, no-store'
    );
    
    return response;
  } catch (error) {
    console.error('Error fetching track:', error);
    return NextResponse.json(
      { error: 'Failed to fetch track: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Writes to the catalogue are admin-only. This route previously had no
    // check at all, which let anyone repoint a track's audio or change its
    // status. requireAdmin uses verifyUserFromRequest (jose), NOT the unsigned
    // getUserFromRequest decoder used elsewhere in this codebase.
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const { id: trackId } = await params;
    const body = await req.json() as { track_number?: number };
    const { track_number } = body;

    if (track_number !== undefined) {
      await executeQuery(
        'UPDATE tracks SET track_number = ?, updated_at = datetime("now") WHERE id = ?',
        [track_number, trackId]
      );

      return NextResponse.json({
        success: true,
        message: 'Track updated successfully'
      });
    }

    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating track:', error);
    return NextResponse.json(
      { error: 'Failed to update track: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Writes to the catalogue are admin-only. This route previously had no
    // check at all, which let anyone repoint a track's audio or change its
    // status. requireAdmin uses verifyUserFromRequest (jose), NOT the unsigned
    // getUserFromRequest decoder used elsewhere in this codebase.
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const { id: trackId } = await params;
    const body = await req.json() as { 
      audio_url?: string;
      status?: string;
      audio_status?: string;
      duration?: number;
    };

    const { audio_url, status, audio_status, duration } = body;

    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const queryParams: any[] = [];

    if (audio_url !== undefined) {
      updates.push('audio_url = ?');
      queryParams.push(audio_url);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      queryParams.push(status);
    }

    if (audio_status !== undefined) {
      updates.push('audio_status = ?');
      queryParams.push(audio_status);
    }

    if (duration !== undefined && typeof duration === 'number' && !Number.isNaN(duration) && duration > 0) {
      updates.push('duration = ?');
      queryParams.push(Math.round(duration));
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Add updated_at timestamp
    updates.push('updated_at = datetime(\'now\')');
    queryParams.push(trackId);

    const query = `UPDATE tracks SET ${updates.join(', ')} WHERE id = ?`;

    await executeQuery(query, queryParams);

    return NextResponse.json({ 
      success: true, 
      message: 'Track updated successfully' 
    });
  } catch (error) {
    console.error('Error updating track:', error);
    return NextResponse.json(
      { error: 'Failed to update track: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
