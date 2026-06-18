import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const url = new URL(req.url);
    const milestoneId = url.searchParams.get('milestone');
    const statusId = url.searchParams.get('status');

    let sql = `
      SELECT t.*, s.name as status_name, s.color as status_color, m.title as milestone_title
      FROM ark_tasks t
      LEFT JOIN ark_statuses s ON t.status_id = s.id
      LEFT JOIN ark_milestones m ON t.milestone_id = m.id
      WHERE t.project_id = ?
    `;
    const queryParams: string[] = [projectId];

    if (milestoneId) {
      sql += ' AND t.milestone_id = ?';
      queryParams.push(milestoneId);
    }
    if (statusId) {
      sql += ' AND t.status_id = ?';
      queryParams.push(statusId);
    }

    sql += ' ORDER BY t.sort_order ASC, t.created_at DESC';
    const tasks = await queryDatabase(sql, queryParams);
    return NextResponse.json({ success: true, tasks: tasks || [] });
  } catch (error) {
    console.error('Ark tasks list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const body = await req.json();
    const { title, description, milestone_id, status_id, priority, sort_order, due_date, scheduled_date, estimated_hours, depends_on, assigned_to, tags, metadata } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    let finalStatusId = status_id;
    if (!finalStatusId) {
      const defaults = await queryDatabase(
        "SELECT id FROM ark_statuses WHERE is_default = 1 AND (applies_to = 'task' OR applies_to = 'all') LIMIT 1",
        []
      );
      if (defaults && defaults.length > 0) finalStatusId = defaults[0].id;
    }

    await executeQuery(
      `INSERT INTO ark_tasks (id, project_id, milestone_id, title, description, status_id, priority, sort_order, due_date, scheduled_date, estimated_hours, depends_on, assigned_to, tags, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, projectId, milestone_id || null, title, description || null,
        finalStatusId || null, priority || 'medium', sort_order ?? 0,
        due_date || null, scheduled_date || null, estimated_hours || null,
        depends_on ? JSON.stringify(depends_on) : null,
        assigned_to || null,
        tags ? JSON.stringify(tags) : null,
        metadata ? JSON.stringify(metadata) : null,
        now, now
      ]
    );

    return NextResponse.json({ success: true, task: { id, title } }, { status: 201 });
  } catch (error) {
    console.error('Ark create task error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 });
  }
}
