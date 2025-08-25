import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { executeQuery } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json() as { cover_art_url: string; cover_art_key: string };
    
    const { cover_art_url, cover_art_key } = body;
    
    if (!cover_art_url || !cover_art_key) {
      return NextResponse.json(
        { error: 'Cover art URL and key are required' },
        { status: 400 }
      );
    }

    await executeQuery(
      'UPDATE albums SET cover_art_url = ?, cover_art_key = ?, updated_at = datetime(?) WHERE id = ?',
      [cover_art_url, cover_art_key, 'now', id]
    );

    return NextResponse.json({
      success: true,
      message: 'Album cover updated successfully'
    });
  } catch (error) {
    console.error('Error updating album cover:', error);
    return NextResponse.json(
      { error: 'Failed to update album cover' },
      { status: 500 }
    );
  }
}
