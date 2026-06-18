import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowed = ['name', 'platform_type', 'icon', 'color', 'base_url', 'description'];
    for (const f of allowed) {
      if (body[f] !== undefined) { fields.push(`${f} = ?`); values.push(body[f]); }
    }
    if (body.default_metadata_schema !== undefined) {
      fields.push('default_metadata_schema = ?');
      values.push(body.default_metadata_schema ? JSON.stringify(body.default_metadata_schema) : null);
    }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await executeQuery(`UPDATE ark_integrations SET ${fields.join(', ')} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark update integration error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update integration' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await executeQuery('DELETE FROM ark_integrations WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark delete integration error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete integration' }, { status: 500 });
  }
}
