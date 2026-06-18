import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/admin/ark/[projectId]
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const projects = await queryDatabase(
      `SELECT p.*,
        c.name as category_name, c.color as category_color, c.icon as category_icon,
        s.name as status_name, s.color as status_color,
        (SELECT COUNT(*) FROM ark_tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM ark_tasks t JOIN ark_statuses st ON t.status_id = st.id WHERE t.project_id = p.id AND st.is_closed = 1) as task_done_count
      FROM ark_projects p
      LEFT JOIN ark_categories c ON p.category_id = c.id
      LEFT JOIN ark_statuses s ON p.status_id = s.id
      WHERE p.id = ?`,
      [projectId]
    );

    if (!projects || projects.length === 0) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, project: projects[0] });
  } catch (error) {
    console.error('Ark get project error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch project' }, { status: 500 });
  }
}

// PUT /api/admin/ark/[projectId]
export async function PUT(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const body = await req.json();
    const now = new Date().toISOString();

    // Build dynamic update
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields = ['title', 'category_id', 'status_id', 'priority', 'charter', 'start_date', 'target_date', 'completed_date', 'color', 'icon', 'cover_image_url', 'progress_percent', 'archived_at', 'archive_notes'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    // JSON fields
    const jsonFields = ['objectives', 'success_criteria', 'tags', 'metadata'];
    for (const field of jsonFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(body[field] ? JSON.stringify(body[field]) : null);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(projectId);

    await executeQuery(`UPDATE ark_projects SET ${fields.join(', ')} WHERE id = ?`, values);

    // Log status change to timeline
    if (body.status_id) {
      const statuses = await queryDatabase('SELECT name FROM ark_statuses WHERE id = ?', [body.status_id]);
      const statusName = statuses?.[0]?.name || 'Unknown';
      await executeQuery(
        `INSERT INTO ark_timeline (id, project_id, entry_type, title, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), projectId, 'status_change', `Status changed to ${statusName}`, JSON.stringify({ new_status_id: body.status_id }), now]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark update project error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/admin/ark/[projectId]
export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    // Soft delete by archiving
    const now = new Date().toISOString();
    await executeQuery(
      `UPDATE ark_projects SET archived_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, projectId]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark delete project error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete project' }, { status: 500 });
  }
}
