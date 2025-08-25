import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { executeQuery } from '@/lib/db';

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as { ids: string[] };
    
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: 'IDs array is required' },
        { status: 400 }
      );
    }

    // Create placeholders for the IN clause
    const placeholders = body.ids.map(() => '?').join(',');
    
    // Delete tracks
    await executeQuery(
      `DELETE FROM tracks WHERE id IN (${placeholders})`,
      body.ids
    );

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${body.ids.length} tracks`
    });
  } catch (error) {
    console.error('Error bulk deleting tracks:', error);
    return NextResponse.json(
      { error: 'Failed to delete tracks' },
      { status: 500 }
    );
  }
}
