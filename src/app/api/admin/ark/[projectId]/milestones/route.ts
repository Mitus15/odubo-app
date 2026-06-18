import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const milestones = await queryDatabase(
      `SELECT m.*, s.name as status_name, s.color as status_color,
        (SELECT COUNT(*) FROM ark_tasks WHERE milestone_id = m.id) as task_count,
        (SELECT COUNT(*) FROM ark_tasks t JOIN ark_statuses st ON t.status_id = st.id WHERE t.milestone_id = m.id AND st.is_closed = 1) as task_done_count
      FROM ark_milestones m
      LEFT JOIN ark_statuses s ON m.status_id = s.id
      WHERE m.project_id = ?
      ORDER BY m.sort_order ASC`,
      [projectId]
    );
    return NextResponse.json({ success: true, milestones: milestones || [] });
  } catch (error) {
    console.error('Ark milestones list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch milestones' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const body = await req.json();
    const { title, description, status_id, sort_order, target_date } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await executeQuery(
      `INSERT INTO ark_milestones (id, project_id, title, description, status_id, sort_order, target_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, title, description || null, status_id || null, sort_order ?? 0, target_date || null, now, now]
    );

    return NextResponse.json({ success: true, milestone: { id, title } }, { status: 201 });
  } catch (error) {
    console.error('Ark create milestone error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create milestone' }, { status: 500 });
  }
}
