import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    
    // Find clips where related_projects contains "parent_id:ID"
    // Since related_projects is a JSON array string, we use LIKE
    const clips = await queryDatabase(
      `SELECT * FROM videos 
       WHERE type = 'clip' 
       AND related_projects LIKE ? 
       ORDER BY created_at DESC`,
      [`%parent_id:${id}%`]
    );

    return NextResponse.json({ success: true, clips });
  } catch (error) {
    console.error('Error fetching clips:', error);
    return NextResponse.json({ error: 'Failed to fetch clips' }, { status: 500 });
  }
}
