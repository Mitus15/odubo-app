import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { executeQuery, queryDatabase } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const tracks = await queryDatabase(
      'SELECT * FROM tracks WHERE id = ? LIMIT 1',
      [id]
    );
    
    if (!tracks || (tracks as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }
    
    const track = (tracks as any[])[0];

    // Compute optional HLS manifest URL based on audio_url convention
    // Example: https://media/.../song.web.m4a -> https://media/.../song.hls/master.m3u8
    const deriveHlsUrl = (audioUrl: string | null | undefined): string | null => {
      if (!audioUrl || typeof audioUrl !== 'string') return null;
      try {
        const url = new URL(audioUrl);
        const path = url.pathname; // /dir/song.web.m4a
        const lastSlash = path.lastIndexOf('/');
        const dir = lastSlash >= 0 ? path.slice(0, lastSlash) : '';
        const file = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
        const dot = file.lastIndexOf('.');
        const nameNoExt = dot >= 0 ? file.slice(0, dot) : file;
        const baseName = nameNoExt.endsWith('.web') ? nameNoExt.slice(0, -4) : nameNoExt;
        const hlsPath = `${dir}/${baseName}.hls/master.m3u8`;
        url.pathname = hlsPath;
        return url.toString();
      } catch {
        return null;
      }
    };

    const hls_url = deriveHlsUrl((track as any).audio_url);
    
    // Add cache headers for track metadata
    const response = NextResponse.json({ 
      success: true, 
      track: { ...track, hls_url }
    });
    
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    
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
