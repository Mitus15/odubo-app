import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { executeQuery } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json() as { processing_status: string };
    const { processing_status } = body;

    if (!processing_status || !['pending', 'processing', 'complete', 'failed'].includes(processing_status)) {
      return NextResponse.json(
        { error: 'Invalid processing_status' },
        { status: 400 }
      );
    }

    await executeQuery(
      `UPDATE tracks 
       SET processing_status = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [processing_status, id]
    );

    return NextResponse.json({ 
      success: true, 
      message: `Track processing status updated to ${processing_status}` 
    });
  } catch (error) {
    console.error('Error updating track processing status:', error);
    return NextResponse.json(
      { error: 'Failed to update track processing status' },
      { status: 500 }
    );
  }
}
