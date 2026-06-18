import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const url = new URL(req.url);
    const entryType = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let sql = 'SELECT * FROM ark_timeline WHERE project_id = ?';
    const queryParams: (string | number)[] = [projectId];

    if (entryType) {
      sql += ' AND entry_type = ?';
      queryParams.push(entryType);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    queryParams.push(limit);

    const entries = await queryDatabase(sql, queryParams);
    return NextResponse.json({ success: true, entries: entries || [] });
  } catch (error) {
    console.error('Ark timeline error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch timeline' }, { status: 500 });
  }
}

// POST — Add manual timeline entry
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const body = await req.json();
    const { entry_type, title, description, metadata } = body;

    if (!entry_type || !title) {
      return NextResponse.json({ success: false, error: 'entry_type and title are required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await executeQuery(
      `INSERT INTO ark_timeline (id, project_id, entry_type, title, description, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, entry_type, title, description || null, metadata ? JSON.stringify(metadata) : null, now]
    );

    return NextResponse.json({ success: true, entry: { id } }, { status: 201 });
  } catch (error) {
    console.error('Ark create timeline entry error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create timeline entry' }, { status: 500 });
  }
}
