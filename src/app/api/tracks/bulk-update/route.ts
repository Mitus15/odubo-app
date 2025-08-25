import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { ids: string[]; status: string };
    
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: 'IDs array is required' },
        { status: 400 }
      );
    }

    if (!body.status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    // Create placeholders for the IN clause
    const placeholders = body.ids.map(() => '?').join(',');
    
    await executeQuery(
      `UPDATE tracks SET status = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`,
      [body.status, ...body.ids]
    );

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${body.ids.length} tracks to ${body.status}`
    });
  } catch (error) {
    console.error('Error bulk updating tracks:', error);
    return NextResponse.json(
      { error: 'Failed to update tracks' },
      { status: 500 }
    );
  }
}
