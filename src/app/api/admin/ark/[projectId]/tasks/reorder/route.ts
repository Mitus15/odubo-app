import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

// PUT /api/admin/ark/[projectId]/tasks/reorder — Batch reorder tasks
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { order } = body; // Array of { id, sort_order, milestone_id? }

    if (!Array.isArray(order)) {
      return NextResponse.json({ success: false, error: 'order must be an array' }, { status: 400 });
    }

    for (const item of order) {
      const fields = ['sort_order = ?'];
      const values: (string | number | null)[] = [item.sort_order];
      if (item.milestone_id !== undefined) {
        fields.push('milestone_id = ?');
        values.push(item.milestone_id || null);
      }
      values.push(item.id);
      await executeQuery(`UPDATE ark_tasks SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark reorder tasks error:', error);
    return NextResponse.json({ success: false, error: 'Failed to reorder tasks' }, { status: 500 });
  }
}
