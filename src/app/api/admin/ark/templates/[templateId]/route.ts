import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const { templateId } = await params;
    const body = await req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowed = ['name', 'category_id', 'description', 'icon', 'color', 'charter_template', 'is_active'];
    for (const f of allowed) {
      if (body[f] !== undefined) { fields.push(`${f} = ?`); values.push(body[f]); }
    }
    const jsonFields = ['default_objectives', 'default_milestones', 'default_tasks', 'default_integrations', 'default_tags'];
    for (const f of jsonFields) {
      if (body[f] !== undefined) { fields.push(`${f} = ?`); values.push(body[f] ? JSON.stringify(body[f]) : null); }
    }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(templateId);

    await executeQuery(`UPDATE ark_templates SET ${fields.join(', ')} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark update template error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const { templateId } = await params;
    await executeQuery('UPDATE ark_templates SET is_active = 0 WHERE id = ?', [templateId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark delete template error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete template' }, { status: 500 });
  }
}
