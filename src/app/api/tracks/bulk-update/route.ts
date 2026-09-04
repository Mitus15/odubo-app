import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
export const runtime = 'edge';
import { executeQuery } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  try {
    // Writes to the catalogue are admin-only. This route previously had no
    // check at all, which let anyone repoint a track's audio or change its
    // status. requireAdmin uses verifyUserFromRequest (jose), NOT the unsigned
    // getUserFromRequest decoder used elsewhere in this codebase.
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

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
