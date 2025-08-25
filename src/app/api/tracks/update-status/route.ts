import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const body = await req.json() as { album_id: string; status?: string };
    const { album_id, status = 'ready' } = body;

    if (!album_id) {
      return NextResponse.json(
        { error: 'album_id is required' },
        { status: 400 }
      );
    }

    // Update all tracks in the album to have ready status
    await executeQuery(
      `UPDATE tracks 
       SET audio_status = ?, updated_at = datetime('now')
       WHERE album_id = ? AND audio_url IS NOT NULL`,
      [status, album_id]
    );

    return NextResponse.json({ 
      success: true, 
      message: `Track audio status updated to ${status}` 
    });
  } catch (error) {
    console.error('Error updating track status:', error);
    return NextResponse.json(
      { error: 'Failed to update track status' },
      { status: 500 }
    );
  }
}
