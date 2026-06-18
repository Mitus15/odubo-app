import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ projectId: string; milestoneId: string }> }) {
  try {
    const { projectId, milestoneId } = await params;
    const body = await req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowed = ['title', 'description', 'status_id', 'sort_order', 'target_date', 'completed_date'];
    for (const f of allowed) {
      if (body[f] !== undefined) { fields.push(`${f} = ?`); values.push(body[f]); }
    }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(milestoneId);

    await executeQuery(`UPDATE ark_milestones SET ${fields.join(', ')} WHERE id = ?`, values);

    // Log milestone completion to timeline
    if (body.status_id) {
      const statuses = await queryDatabase('SELECT name, is_closed FROM ark_statuses WHERE id = ?', [body.status_id]);
      if (statuses?.[0]?.is_closed === 1) {
        await executeQuery(
          `INSERT INTO ark_timeline (id, project_id, entry_type, title, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), projectId, 'milestone_reached', `Milestone completed: ${body.title || 'milestone'}`, JSON.stringify({ milestone_id: milestoneId }), now]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark update milestone error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update milestone' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ milestoneId: string }> }) {
  try {
    const { milestoneId } = await params;
    await executeQuery('DELETE FROM ark_milestones WHERE id = ?', [milestoneId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark delete milestone error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete milestone' }, { status: 500 });
  }
}
