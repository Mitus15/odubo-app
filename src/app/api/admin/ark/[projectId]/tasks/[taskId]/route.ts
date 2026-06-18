import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ projectId: string; taskId: string }> }) {
  try {
    const { projectId, taskId } = await params;
    const body = await req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowed = ['title', 'description', 'milestone_id', 'status_id', 'priority', 'sort_order', 'due_date', 'scheduled_date', 'completed_date', 'estimated_hours', 'actual_hours', 'assigned_to'];
    for (const f of allowed) {
      if (body[f] !== undefined) { fields.push(`${f} = ?`); values.push(body[f]); }
    }
    const jsonFields = ['depends_on', 'tags', 'metadata'];
    for (const f of jsonFields) {
      if (body[f] !== undefined) { fields.push(`${f} = ?`); values.push(body[f] ? JSON.stringify(body[f]) : null); }
    }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(taskId);

    await executeQuery(`UPDATE ark_tasks SET ${fields.join(', ')} WHERE id = ? AND project_id = '${projectId}'`, values);

    // If status changed to a closed status, log to timeline
    if (body.status_id) {
      const statuses = await queryDatabase('SELECT name, is_closed FROM ark_statuses WHERE id = ?', [body.status_id]);
      if (statuses?.[0]?.is_closed === 1) {
        await executeQuery(
          `INSERT INTO ark_timeline (id, project_id, entry_type, title, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), projectId, 'task_completed', `Task completed: ${body.title || 'task'}`, JSON.stringify({ task_id: taskId }), now]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark update task error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string; taskId: string }> }) {
  try {
    const { taskId } = await params;
    await executeQuery('DELETE FROM ark_tasks WHERE id = ?', [taskId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark delete task error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete task' }, { status: 500 });
  }
}
