import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const url = new URL(req.url);
    const category = url.searchParams.get('category');

    let sql = 'SELECT * FROM ark_notes WHERE project_id = ?';
    const queryParams: string[] = [projectId];

    if (category) {
      sql += ' AND category = ?';
      queryParams.push(category);
    }

    sql += ' ORDER BY is_pinned DESC, updated_at DESC';
    const notes = await queryDatabase(sql, queryParams);
    return NextResponse.json({ success: true, notes: notes || [] });
  } catch (error) {
    console.error('Ark notes list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const body = await req.json();
    const { title, content, category, is_pinned, tags } = body;

    if (!content) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await executeQuery(
      `INSERT INTO ark_notes (id, project_id, title, content, category, is_pinned, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, title || null, content, category || null, is_pinned ? 1 : 0, tags ? JSON.stringify(tags) : null, now, now]
    );

    return NextResponse.json({ success: true, note: { id, title } }, { status: 201 });
  } catch (error) {
    console.error('Ark create note error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create note' }, { status: 500 });
  }
}
